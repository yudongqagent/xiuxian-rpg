import Phaser from 'phaser'
import { bus } from '../engine/eventBus'
import { loadSave, writeSave } from '../engine/save'
import { DEFAULT_MAP_ID, getGameMap, isWalkable } from '../systems/maps'
import type { GameMap } from '../systems/schemas'

type PortalTarget = GameMap['portals'][number]['to']
import { FRAME, HOUSE_KEY, MAP_ATLAS_KEY, buildMapTileTextures } from './mapTiles'
// combat-depth：成长/背包状态恢复与战败惩罚
import {
  fromPlayerSave,
  getPlayer,
  respawnPenalty,
  setPlayer,
  toPlayerSave,
  updatePlayer,
} from '../systems/player'
// quest-engine：任务进度恢复与入档
import { restoreQuests, snapshotQuests } from '../systems/questRuntime'

const TILE = 32
const PLAYER_SPEED = 160
const ENEMY_SPEED = 40
const ENEMY_WANDER_INTERVAL = 2000
const INTERACT_RANGE = 80
const FADE_MS = 350
const SAVE_VERSION = 2

// ===================================================================
// 多地图系统（world-maps 分支）：地图来自 content/maps/*.json DSL，
// 场景跳转经 portal 触发 scene.restart 携带落点。战斗/对话逻辑不变。
// ===================================================================

interface SceneRoute {
  mapId?: string
  x?: number
  y?: number
}

export class WorldScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite
  private wolves!: Phaser.Physics.Arcade.Group
  private activeEnemy: Phaser.Physics.Arcade.Sprite | undefined
  private battleActive = false
  private joyVec = { x: 0, y: 0 }
  private keyState: () => { x: number; y: number } = () => ({ x: 0, y: 0 })
  private unsubs: Array<() => void> = []
  private npcs: Array<{ id: string; sprite: Phaser.GameObjects.Image }> = []
  private dialogueOpen = false
  private interactKey!: Phaser.Input.Keyboard.Key
  private prompt!: Phaser.GameObjects.Text

  private mapId = DEFAULT_MAP_ID
  private gameMap!: GameMap
  private spawnPoint = { x: 0, y: 0 }
  private portalZones: Array<{ zone: Phaser.GameObjects.Zone; to: PortalTarget }> = []
  private obstacles!: Phaser.Physics.Arcade.StaticGroup
  private ready = false
  private transitioning = false

  constructor() {
    super('World')
  }

  create(): void {
    this.ready = false
    this.transitioning = false
    void this.initWorld()
  }

  private async initWorld(): Promise<void> {
    const route = (this.scene.settings.data ?? {}) as SceneRoute
    const save = await loadSave()
    this.gameMap = getGameMap(route.mapId ?? save?.mapId ?? DEFAULT_MAP_ID)
    this.mapId = this.gameMap.id

    this.buildTerrain()
    this.placePortals()
    this.placeNpcs()

    this.player = this.physics.add.sprite(0, 0, 'player')
    this.player.setCollideWorldBounds(true)
    this.physics.world.setBounds(0, 0, this.gameMap.width * TILE, this.gameMap.height * TILE)
    this.physics.add.collider(this.player, this.obstacles)
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15)
    this.cameras.main.setBounds(0, 0, this.gameMap.width * TILE, this.gameMap.height * TILE)

    this.spawnEnemyWolves()
    this.bindInputs()
    this.bindBusEvents()
    this.prompt = this.add
      .text(0, 0, '[E] 交谈', {
        fontSize: '12px',
        color: '#e8dcc0',
        backgroundColor: '#1a120b',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5)
      .setVisible(false)

    this.spawnPoint = {
      x: this.gameMap.spawn.x * TILE + TILE / 2,
      y: this.gameMap.spawn.y * TILE + TILE / 2,
    }
    let startX = this.spawnPoint.x
    let startY = this.spawnPoint.y
    if (
      route.x !== undefined &&
      route.y !== undefined &&
      isWalkable(this.gameMap, route.x, route.y)
    ) {
      startX = route.x * TILE + TILE / 2
      startY = route.y * TILE + TILE / 2
    } else if (save && save.mapId === this.mapId) {
      startX = save.x
      startY = save.y
    }
    this.player.setPosition(startX, startY)

    // combat-depth：恢复成长/背包/功法（旧档无 player 字段则全新开局）
    setPlayer(fromPlayerSave(save?.player))
    bus.emit('player:stats')
    // quest-engine：恢复任务进度
    restoreQuests(save?.quests)

    this.time.addEvent({
      delay: 5000,
      loop: true,
      callback: () =>
        void writeSave({
          version: SAVE_VERSION,
          playerId: 'mortal-001',
          x: this.player.x,
          y: this.player.y,
          mapId: this.mapId,
          inventory: [],
          savedAt: Date.now(),
          player: toPlayerSave(getPlayer()),
          quests: snapshotQuests(),
        }),
    })

    this.time.addEvent({
      delay: 250,
      loop: true,
      callback: () =>
        bus.emit('player:position', { x: this.player.x, y: this.player.y }),
    })

    this.cameras.main.fadeIn(FADE_MS, 0, 0, 0)
    bus.emit('area:enter', { name: this.gameMap.name })
    this.ready = true

    this.events.on('shutdown', () => this.unsubs.forEach((u) => u()))
  }

  /** 地形与障碍：图例字符 → 图集帧 / 静态碰撞体 */
  private buildTerrain(): void {
    buildMapTileTextures(this)
    const m = this.make.tilemap({
      tileWidth: TILE,
      tileHeight: TILE,
      width: this.gameMap.width,
      height: this.gameMap.height,
    })
    const tiles = m.addTilesetImage(MAP_ATLAS_KEY, MAP_ATLAS_KEY, TILE, TILE, 0, 0)!
    const layer = m.createBlankLayer('ground', tiles, 0, 0)!
    const obstacles = this.physics.add.staticGroup()
    this.obstacles = obstacles

    this.gameMap.rows.forEach((row, y) =>
      row.split('').forEach((ch, x) => {
        const cx = x * TILE + TILE / 2
        const cy = y * TILE + TILE / 2
        switch (ch) {
          case ',':
            layer.putTileAt(FRAME.PATH, x, y)
            break
          case '~':
            layer.putTileAt(FRAME.WATER, x, y)
            break
          case 'B':
            layer.putTileAt(FRAME.BRIDGE, x, y)
            break
          case 'F':
            layer.putTileAt(FRAME.FLOWER, x, y)
            break
          case 'D':
            layer.putTileAt(FRAME.DOOR, x, y)
            break
          case '#':
            layer.putTileAt(FRAME.WALL, x, y)
            obstacles.create(cx, cy, MAP_ATLAS_KEY, FRAME.WALL)?.setSize(TILE, TILE).refreshBody()
            break
          case 'T':
            layer.putTileAt(FRAME.GRASS, x, y)
            obstacles.create(cx, cy, 'tree')?.setSize(TILE, TILE).setOffset(0, -8).refreshBody()
            break
          case 'H':
            layer.putTileAt(FRAME.GRASS, x, y)
            obstacles.create(cx, cy, HOUSE_KEY)?.setSize(TILE, TILE).refreshBody()
            break
          default:
            layer.putTileAt(FRAME.GRASS, x, y)
        }
      }),
    )
  }

  /** 传送门：踏入后淡出 → restart 携带目标地图与落点 */
  private placePortals(): void {
    this.portalZones = this.gameMap.portals.map((p) => {
      const zone = this.add.zone(p.x * TILE + TILE / 2, p.y * TILE + TILE / 2, TILE, TILE)
      this.physics.add.existing(zone, true)
      this.add
        .text(zone.x, zone.y - TILE, p.label, {
          fontSize: '11px',
          color: '#bff3e8',
          backgroundColor: 'rgba(26,18,11,0.7)',
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5)
      return { zone, to: p.to }
    })
  }

  private placeNpcs(): void {
    this.npcs = []
    this.gameMap.npcPlacements.forEach(({ npcId, x, y }) => {
      const sprite = this.physics.add.staticImage(
        x * TILE + TILE / 2,
        y * TILE + TILE / 2,
        'npc',
      )
      sprite.setInteractive({ useHandCursor: true })
      sprite.on('pointerdown', () => this.tryInteract())
      this.npcs.push({ id: npcId, sprite })
    })
  }

  /** 妖兽：按 DSL 出生点游荡，越界则折返 */
  private spawnEnemyWolves(): void {
    this.wolves = this.physics.add.group()
    this.gameMap.enemySpawns.forEach(({ enemyId, x, y, radius }) => {
      const wx = x * TILE + TILE / 2
      const wy = y * TILE + TILE / 2
      const wolf = this.wolves.create(wx, wy, 'wolf') as Phaser.Physics.Arcade.Sprite
      wolf.setCollideWorldBounds(true)
      wolf.setData('enemyId', enemyId)
      wolf.setData('homeX', wx)
      wolf.setData('homeY', wy)
      wolf.setData('radius', radius)
      this.time.addEvent({
        delay: ENEMY_WANDER_INTERVAL,
        loop: true,
        callback: () => {
          if (this.battleActive || !wolf.body) return
          const hx = wolf.getData('homeX') as number
          const hy = wolf.getData('homeY') as number
          const r = wolf.getData('radius') as number
          if (Phaser.Math.Distance.Between(wolf.x, wolf.y, hx, hy) > r) {
            const dir = new Phaser.Math.Vector2(hx - wolf.x, hy - wolf.y).normalize()
            wolf.setVelocity(dir.x * ENEMY_SPEED, dir.y * ENEMY_SPEED)
          } else {
            wolf.setVelocity(
              Phaser.Math.Between(-1, 1) * ENEMY_SPEED,
              Phaser.Math.Between(-1, 1) * ENEMY_SPEED,
            )
          }
        },
      })
    })
    this.physics.add.collider(this.wolves, this.obstacles!)
    this.physics.add.collider(this.player!, this.wolves)
    this.physics.add.overlap(this.player!, this.wolves, (_p, wolfObj) => {
      const wolf = wolfObj as Phaser.Physics.Arcade.Sprite
      if (this.battleActive || this.transitioning || !wolf.body) return
      this.activeEnemy = wolf
      this.battleActive = true
      this.player!.setVelocity(0, 0)
      this.joyVec = { x: 0, y: 0 }
      bus.emit('battle:start', { enemyId: wolf.getData('enemyId') as string })
    })
    this.physics.add.overlap(this.player!, this.portalZones.map((z) => z.zone), (_p, zObj) => {
      if (this.transitioning || this.battleActive) return
      const hit = this.portalZones.find((z) => z.zone === zObj)
      if (!hit) return
      this.transitionTo(hit.to)
    })
  }

  private transitionTo(to: PortalTarget): void {
    this.transitioning = true
    this.player!.setVelocity(0, 0)
    this.joyVec = { x: 0, y: 0 }
    this.cameras.main.fadeOut(FADE_MS, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () =>
      this.scene.restart({ mapId: to.map, x: to.x, y: to.y }),
    )
  }

  private bindInputs(): void {
    const cursors = this.input.keyboard!.createCursorKeys()
    const wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<
      'W' | 'A' | 'S' | 'D',
      Phaser.Input.Keyboard.Key
    >
    this.interactKey = this.input.keyboard!.addKey('E')
    this.keyState = () => ({
      x: (cursors.right.isDown || wasd.D.isDown ? 1 : 0) - (cursors.left.isDown || wasd.A.isDown ? 1 : 0),
      y: (cursors.down.isDown || wasd.S.isDown ? 1 : 0) - (cursors.up.isDown || wasd.W.isDown ? 1 : 0),
    })
  }

  private bindBusEvents(): void {
    this.unsubs.push(
      bus.on('joystick:move', (v) => (this.joyVec = v)),
      bus.on('joystick:end', () => (this.joyVec = { x: 0, y: 0 })),
      bus.on('dialogue:open', () => {
        this.dialogueOpen = true
        this.joyVec = { x: 0, y: 0 }
        this.prompt.setVisible(false)
      }),
      bus.on('dialogue:close', () => (this.dialogueOpen = false)),
      bus.on('battle:start', () => (this.battleActive = true)),
      bus.on('battle:end', ({ win, fled }) => {
        this.battleActive = false
        if (win) {
          this.activeEnemy?.destroy()
        } else if (!fled) {
          // 战败（非逃跑）：宽惩罚——气血折半，送回出生点
          updatePlayer(respawnPenalty)
          bus.emit('player:stats')
          this.player.setPosition(this.spawnPoint.x, this.spawnPoint.y)
          this.joyVec = { x: 0, y: 0 }
        }
        this.activeEnemy = undefined
      }),
    )
  }

  update(): void {
    if (!this.ready || !this.player?.body || this.transitioning) return
    if (this.dialogueOpen || this.battleActive) {
      this.player.setVelocity(0, 0)
      return
    }
    const near = this.nearestNpc()
    if (near) {
      this.prompt.setPosition(near.sprite.x, near.sprite.y - TILE).setVisible(true)
      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) this.tryInteract()
    } else {
      this.prompt.setVisible(false)
    }
    const k = this.keyState()
    const vx = (this.joyVec.x + k.x) * PLAYER_SPEED
    const vy = (this.joyVec.y + k.y) * PLAYER_SPEED
    this.player.setVelocity(Phaser.Math.Clamp(vx, -PLAYER_SPEED, PLAYER_SPEED), Phaser.Math.Clamp(vy, -PLAYER_SPEED, PLAYER_SPEED))
  }

  private nearestNpc(): { id: string; sprite: Phaser.GameObjects.Image } | null {
    let best: { id: string; sprite: Phaser.GameObjects.Image } | null = null
    let bestDist = INTERACT_RANGE
    for (const npc of this.npcs) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.sprite.x, npc.sprite.y)
      if (d < bestDist) {
        bestDist = d
        best = npc
      }
    }
    return best
  }

  private tryInteract(): void {
    const near = this.nearestNpc()
    if (!near || this.dialogueOpen) return
    bus.emit('dialogue:open', { npcId: near.id })
  }
}
