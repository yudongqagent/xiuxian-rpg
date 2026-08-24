import Phaser from 'phaser'
import { bus } from '../engine/eventBus'
import { AUTO_SLOT, loadSave, writeSave, type SlotId } from '../engine/save'
import { DEFAULT_MAP_ID, getGameMap, isWalkable } from '../systems/maps'
import type { GameMap } from '../systems/schemas'

type PortalTarget = GameMap['portals'][number]['to']
import { FRAME, HOUSE_KEY, MAP_ATLAS_KEY, buildMapTileTextures } from './mapTiles'
// combat-depth：成长/背包状态恢复与战败惩罚
import {
  fromPlayerSave,
  getPlayer,
  meditateTick,
  respawnPenalty,
  setPlayer,
  toPlayerSave,
  updatePlayer,
} from '../systems/player'
import { regionQiDensity } from '../systems/contentNames'
// quest-engine：任务进度恢复与入档
import {
  getTrackedTarget,
  isQuestCompleted,
  restoreQuests,
  snapshotQuests,
} from '../systems/questRuntime'
// ==== rich-graphics ====
import {
  addAmbientFx,
  applyAtmosphere,
  attachHeroDust,
  bossAura,
  buildFxTextures,
  enemyBob,
  enemyVisualFor,
  idleBob,
  npcTextureFor,
} from './fx'
// ==== gfx-scene：场景表现层（B1 过渡/B2 道具/B3 视差/B4 流水/C1 天气/C2 昼夜/C3 光晕）====
import { buildProps } from './mapTiles'
import {
  addFlowingWater,
  addLightHalos,
  addParallax,
  attachDayNight,
  attachWeather,
  bakeTerrainBlend,
  placeProps,
} from './sceneScene'
// ==== gfx-battle-ui ====
import { attachHeroPolish, attachNpcLife } from './heroPolish'

const TILE = 32
const PLAYER_SPEED = 160
const ENEMY_SPEED = 40
const ENEMY_WANDER_INTERVAL = 2000
const ENEMY_HITBOX_RATIO = 0.8
const ENEMY_HITBOX_MIN = 12
const INTERACT_RANGE = 80
const FADE_MS = 350
const SAVE_VERSION = 2
const BATTLE_ACK_WATCHDOG_MS = 1500
const MEDITATE_TICK_MS = 2000
const LOCK_TOAST_COOLDOWN_MS = 1500
const ENEMY_RESPAWN_MS = 30000
const WAYPOINT_ARRIVAL_PX = 10
const PATH_DIRS: Array<[number, number]> = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
]

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
  private portalZones: Array<{
    zone: Phaser.GameObjects.Zone
    to: PortalTarget
    lockQuest?: string
    lockHint?: string
  }> = []
  private lockToastUntil = 0
  private autoPath: Phaser.Math.Vector2[] = []
  private obstacles!: Phaser.Physics.Arcade.StaticGroup
  private ready = false
  private transitioning = false
  private battleGraceUntil = 0
  private battleAcked = false
  private knockbackUntil = 0
  private meditating = false
  private meditateMult = 1
  private meditateTimer: Phaser.Time.TimerEvent | undefined
  // ==== rich-graphics ====
  private heroDust: { setMoving: (moving: boolean) => void } | null = null
  private heroDir: 'down' | 'up' | 'side' = 'down'
  private treeSprites: Phaser.GameObjects.Image[] = []
  private waterBlockers: Phaser.GameObjects.Rectangle[] = []

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

    // ==== rich-graphics：氛围/环境动效 ====
    buildFxTextures(this)
    const atmosphere = applyAtmosphere(this, this.mapId)
    addAmbientFx(this, {
      rows: this.gameMap.rows,
      trees: this.treeSprites,
      portals: this.portalZones.map((z) => ({ x: z.zone.x, y: z.zone.y })),
    })

    this.player = this.physics.add.sprite(0, 0, 'hero', 0)
    this.player.body?.setSize(20, 24)
    // 行走动画（下/上/侧，侧向用 flipX）
    const mkWalk = (key: string, row: number) =>
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers('hero', {
          frames: [row * 3 + 1, row * 3 + 0, row * 3 + 2, row * 3 + 0],
        }),
        frameRate: 7,
        repeat: -1,
      })
    if (!this.anims.exists('walk-down')) mkWalk('walk-down', 0)
    if (!this.anims.exists('walk-up')) mkWalk('walk-up', 1)
    if (!this.anims.exists('walk-side')) mkWalk('walk-side', 2)
    this.heroDust = attachHeroDust(this, this.player)
    // ==== gfx-battle-ui：主角呼吸帧与方向性柔影（GFX2-A2）====
    attachHeroPolish(this, this.player)

    this.player.setCollideWorldBounds(true)
    this.physics.world.setBounds(0, 0, this.gameMap.width * TILE, this.gameMap.height * TILE)
    this.physics.add.collider(this.player, this.obstacles)
    this.physics.add.collider(this.player, this.waterBlockers)
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15)
    this.cameras.main.setBounds(0, 0, this.gameMap.width * TILE, this.gameMap.height * TILE)
    // PT-9：视口大于地图时放大镜头铺满，避免边缘露出虚空
    const fitCamera = () => {
      const z = Math.max(
        1,
        this.scale.width / (this.gameMap.width * TILE),
        this.scale.height / (this.gameMap.height * TILE),
      )
      this.cameras.main.setZoom(z)
    }
    fitCamera()
    this.scale.on('resize', fitCamera)
    this.events.once('shutdown', () => this.scale.off('resize', fitCamera))

    this.spawnEnemyWolves()
    this.bindInputs()
    this.bindBusEvents()

    // ==== gfx-scene：场景表现层装配（B1-B4 / C1-C3）====
    buildProps(this)
    addParallax(
      this,
      this.mapId,
      this.gameMap.spawn.x * TILE + TILE / 2,
      this.gameMap.spawn.y * TILE + TILE / 2,
      this.gameMap.width * TILE,
      this.gameMap.height * TILE,
    )
    bakeTerrainBlend(this, this.gameMap)
    const { lanternLights } = placeProps(this, this.gameMap)
    addFlowingWater(this, this.gameMap)
    attachWeather(this, this.mapId)
    attachDayNight(this, atmosphere.grade)
    addLightHalos(this, [
      ...lanternLights,
      ...this.portalZones.map((z) => ({ x: z.zone.x, y: z.zone.y, color: 0x7ffce8 })),
    ])

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
      callback: () => {
        if (this.battleActive || this.transitioning) return
        void writeSave(this.snapshotSave(), AUTO_SLOT)
      }
    })

    this.time.addEvent({
      delay: 250,
      loop: true,
      callback: () =>
        bus.emit('player:position', { x: this.player.x, y: this.player.y }),
    })

    this.cameras.main.fadeIn(FADE_MS, 0, 0, 0)
    bus.emit('area:enter', { name: this.gameMap.name, regionId: this.gameMap.regionId })
    this.ready = true
    const qa = (window.__xiuxian ??= { bus })
    qa.scene = {
      path: () => this.autoPath.map((p) => [Math.round(p.x), Math.round(p.y)]),
      pos: () => [Math.round(this.player.x), Math.round(this.player.y)],
      findPath: (tx: number, ty: number) =>
        this.findPath(tx, ty)?.map((p) => [Math.round(p.x), Math.round(p.y)]) ?? null,
      portals: () =>
        this.portalZones.map((z) => ({
          tile: [Math.round(z.zone.x / TILE), Math.round(z.zone.y / TILE)],
          lockQuest: z.lockQuest,
        })),
    }
    bus.emit('map:minimap', {
      rows: this.gameMap.rows,
      player: { x: this.player.x / TILE, y: this.player.y / TILE },
      npcs: this.gameMap.npcPlacements.map((n) => ({ x: n.x, y: n.y })),
      portals: this.gameMap.portals.map((p) => ({
        x: p.x,
        y: p.y,
        locked: Boolean(p.lockQuest && !isQuestCompleted(p.lockQuest)),
      })),
    })

    // PT-6：窗口失焦/切页时清空输入，防止按键状态残留
    const clearInput = () => {
      this.joyVec = { x: 0, y: 0 }
      this.input.keyboard?.resetKeys()
    }
    window.addEventListener('blur', clearInput)
    document.addEventListener('visibilitychange', clearInput)
    this.events.once('shutdown', () => {
      window.removeEventListener('blur', clearInput)
      document.removeEventListener('visibilitychange', clearInput)
    })
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
            {
              const r = this.add.rectangle(cx, cy, TILE, TILE)
              r.setVisible(false)
              this.physics.add.existing(r, true)
              this.waterBlockers.push(r)
            }
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
            // ==== rich-graphics：保留树精灵引用用于摇曳 ====
            {
              const t = obstacles.create(cx, cy, 'tree')?.setSize(TILE, TILE).setOffset(0, -8).refreshBody()
              if (t) this.treeSprites.push(t)
            }
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

  /** 传送门：踏入后淡出 → restart 携带目标地图与落点；章节锁未解锁则提示并拦下 */
  private placePortals(): void {
    this.portalZones = this.gameMap.portals.map((p) => {
      const zone = this.add.zone(p.x * TILE + TILE / 2, p.y * TILE + TILE / 2, TILE, TILE)
      this.physics.add.existing(zone, true)
      this.add
        .text(zone.x, zone.y - TILE, p.lockQuest ? `🔒${p.label}` : p.label, {
          fontSize: '11px',
          color: p.lockQuest ? '#c9b18a' : '#bff3e8',
          backgroundColor: 'rgba(26,18,11,0.7)',
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5)
      return { zone, to: p.to, lockQuest: p.lockQuest, lockHint: p.lockHint }
    })
  }

  /** 任务追踪导航：解析当前目标 → 本图内定位 → 自动寻路 */
  private navigateToObjective(): void {
    const target = getTrackedTarget()
    if (!target) {
      bus.emit('quest:notify', { text: '暂无进行中的任务', kind: 'info' })
      return
    }
    if (target.kind === 'talk') {
      const spot = this.gameMap.npcPlacements.find((n) => n.npcId === target.id)
      if (!spot) {
        bus.emit('quest:notify', { text: '此人不在本图，先去别处寻访', kind: 'info' })
        return
      }
      this.startAutoPathTo(spot.x, spot.y + 1)
      return
    }
    if (target.kind === 'reach') {
      const portal = this.gameMap.portals.find((pt) => getGameMap(pt.to.map).regionId === target.id)
      if (!portal) {
        bus.emit('quest:notify', { text: '本图没有通往该处的路', kind: 'info' })
        return
      }
      if (portal.lockQuest && !isQuestCompleted(portal.lockQuest)) {
        bus.emit('quest:notify', { text: portal.lockHint ?? '此路尚未开启', kind: 'info' })
        return
      }
      this.startAutoPathTo(portal.x, portal.y)
      return
    }
    const spawns = this.gameMap.enemySpawns.filter(
      (s) => target.kind === 'collect' || s.enemyId === target.id,
    )
    if (spawns.length === 0) {
      bus.emit('quest:notify', { text: '目标不在本图，去别处看看', kind: 'info' })
      return
    }
    const p = this.player
    const nearest = spawns.reduce((a, b) =>
      Phaser.Math.Distance.Between(a.x, a.y, p.x / TILE, p.y / TILE) <
      Phaser.Math.Distance.Between(b.x, b.y, p.x / TILE, p.y / TILE)
        ? a
        : b,
    )
    this.startAutoPathTo(nearest.x, nearest.y)
  }

  private placeNpcs(): void {
    this.npcs = []
    this.gameMap.npcPlacements.forEach(({ npcId, x, y }) => {
      // ==== rich-graphics：按身份换装 + 待机浮动 ====
      const sprite = this.physics.add.staticImage(
        x * TILE + TILE / 2,
        y * TILE + TILE / 2,
        npcTextureFor(npcId),
      )
      idleBob(this, sprite, 1.6)
      sprite.setInteractive({ useHandCursor: true })
      sprite.on('pointerdown', () => this.tryInteract())
      void import('../systems/contentNames').then((m) => {
        this.add
          .text(sprite.x, sprite.y - 26, m.resolveName('npc', npcId), {
            fontSize: '11px',
            color: '#ffe9b0',
            stroke: '#1a120b',
            strokeThickness: 3,
          })
          .setOrigin(0.5, 1)
          .setDepth(6)
      })
      this.npcs.push({ id: npcId, sprite })
    })
    // ==== gfx-battle-ui：NPC 待机动作池 + 对话面向玩家（GFX2-A3）====
    attachNpcLife(this, this.npcs.map((n) => n.sprite))
  }

  /** setScale 不缩放物理体：按缩放后视觉尺寸重建命中盒（居中收窄），保证任意方向接触都能触发遭遇 */
  private fitEnemyHitbox(wolf: Phaser.Physics.Arcade.Sprite, scale: number): void {
    const body = wolf.body as Phaser.Physics.Arcade.Body
    const w = wolf.width * scale
    const h = wolf.height * scale
    const bw = Math.max(ENEMY_HITBOX_MIN, Math.round(w * ENEMY_HITBOX_RATIO))
    const bh = Math.max(ENEMY_HITBOX_MIN, Math.round(h * ENEMY_HITBOX_RATIO))
    body.setSize(bw, bh)
    body.setOffset(Math.round((w - bw) / 2), Math.round((h - bh) / 2))
  }

  /** 打坐吐纳：移动/战斗/对话即打断；恢复速率随区域灵气密度放大 */
  private toggleMeditate(): void {
    if (this.meditating) {
      this.stopMeditate()
      return
    }
    if (this.battleActive || this.transitioning || this.dialogueOpen) return
    this.meditating = true
    this.meditateMult = regionQiDensity(this.gameMap.regionId)
    this.player?.setVelocity(0, 0)
    this.joyVec = { x: 0, y: 0 }
    this.meditateTimer = this.time.addEvent({
      delay: MEDITATE_TICK_MS,
      loop: true,
      callback: () => {
        let gained = { hp: 0, qi: 0 }
        updatePlayer((p) => {
          const r = meditateTick(p, this.meditateMult)
          gained = { hp: r.hp, qi: r.qi }
          return r.player
        })
        bus.emit('meditate:tick', { ...gained, mult: this.meditateMult })
      },
    })
    bus.emit('meditate:state', { active: true, mult: this.meditateMult })
  }

  private stopMeditate(): void {
    if (!this.meditating) return
    this.meditating = false
    this.meditateTimer?.remove()
    this.meditateTimer = undefined
    bus.emit('meditate:state', { active: false, mult: this.meditateMult })
  }

  /** 妖兽：按 DSL 出生点游荡，越界则折返 */
  private spawnEnemyWolves(): void {    this.wolves = this.physics.add.group()
    this.gameMap.enemySpawns.forEach(({ enemyId, x, y, radius }) => {
      const wx = x * TILE + TILE / 2
      const wy = y * TILE + TILE / 2
      // ==== rich-graphics：妖兽外观差异化 ====
      const vis = enemyVisualFor(enemyId)
      const wolf = this.wolves.create(wx, wy, vis.tex) as Phaser.Physics.Arcade.Sprite
      wolf.setScale(vis.scale)
      this.fitEnemyHitbox(wolf, vis.scale)
      wolf.setCollideWorldBounds(true)
      if (vis.boss) bossAura(this, wx, wy)
      else enemyBob(this, wolf)
      wolf.setData('enemyId', enemyId)
      wolf.setData('homeX', wx)
      wolf.setData('homeY', wy)
      wolf.setData('radius', radius)
      this.time.addEvent({
        delay: ENEMY_WANDER_INTERVAL,
        loop: true,
        callback: () => {
          if (this.battleActive || this.transitioning || !wolf.body) return
          const hx = wolf.getData('homeX') as number
          const hy = wolf.getData('homeY') as number
          const r = wolf.getData('radius') as number
          // 仇恨：玩家进入 2.5 倍游荡半径则主动追击（提升遭遇率）
          const aggro = Phaser.Math.Distance.Between(wolf.x, wolf.y, this.player.x, this.player.y)
          if (aggro < r * 2.5 && aggro > 24) {
            const dir = new Phaser.Math.Vector2(
              this.player.x - wolf.x,
              this.player.y - wolf.y,
            ).normalize()
            wolf.setVelocity(dir.x * ENEMY_SPEED * 1.6, dir.y * ENEMY_SPEED * 1.6)
            return
          }
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
    this.physics.add.collider(this.wolves, this.waterBlockers)
    this.physics.add.overlap(this.player!, this.wolves, (_p, wolfObj) => {
      const wolf = wolfObj as Phaser.Physics.Arcade.Sprite
      if (this.battleActive || this.transitioning || this.dialogueOpen) return
      if (this.time.now < this.battleGraceUntil) return
      this.activeEnemy = wolf
      this.battleActive = true
      this.battleAcked = false
      this.stopMeditate()
      this.player!.setVelocity(0, 0)
      this.joyVec = { x: 0, y: 0 }
      this.time.delayedCall(BATTLE_ACK_WATCHDOG_MS, () => {
        if (this.battleActive && !this.battleAcked) {
          console.error('[world] Battle UI did not open, watchdog force-unlocking')
          this.battleActive = false
          this.battleGraceUntil = this.time.now + 1000
        }
      })
      bus.emit('battle:start', { enemyId: wolf.getData('enemyId') as string })
    })
    this.physics.add.overlap(this.player!, this.portalZones.map((z) => z.zone), (_p, zObj) => {
      if (this.transitioning || this.battleActive) return
      const hit = this.portalZones.find((z) => z.zone === zObj)
      if (!hit) return
      if (hit.lockQuest && !isQuestCompleted(hit.lockQuest)) {
        if (this.time.now > this.lockToastUntil) {
          this.lockToastUntil = this.time.now + LOCK_TOAST_COOLDOWN_MS
          bus.emit('quest:notify', { text: hit.lockHint ?? '此路尚未开启', kind: 'info' })
        }
        const last = this.autoPath[this.autoPath.length - 1]
        if (!last || (Math.abs(last.x - hit.zone.x) < TILE && Math.abs(last.y - hit.zone.y) < TILE)) {
          this.autoPath = []
        }
        return
      }
      this.transitionTo(hit.to)
    })
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.ready || this.dialogueOpen || this.battleActive || this.transitioning) return
      const tx = Math.floor(pointer.worldX / TILE)
      const ty = Math.floor(pointer.worldY / TILE)
      if (tx < 0 || ty < 0 || tx >= this.gameMap.width || ty >= this.gameMap.height) return
      const near = this.nearestNpc()
      if (near && Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, near.sprite.x, near.sprite.y) < TILE) {
        this.tryInteract()
        return
      }
      this.startAutoPathTo(tx, ty)
    })
  }

  /** BFS 网格寻路（4 向，图块中心为路径点）；目标不可走时吸附到 3 格内最近可走格 */
  private startAutoPathTo(tx: number, ty: number): void {
    if (this.meditating) this.stopMeditate()
    if (!isWalkable(this.gameMap, tx, ty)) {
      const near = this.nearestWalkable(tx, ty, 3)
      if (!near) {
        bus.emit('quest:notify', { text: '那里过不去', kind: 'info' })
        return
      }
      tx = near.x
      ty = near.y
    }
    const path = this.findPath(tx, ty)
    if (!path) {
      bus.emit('quest:notify', { text: '那里过不去', kind: 'info' })
      return
    }
    this.autoPath = path
  }

  private nearestWalkable(tx: number, ty: number, radius: number): { x: number; y: number } | null {
    for (let r = 1; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
          if (isWalkable(this.gameMap, tx + dx, ty + dy)) return { x: tx + dx, y: ty + dy }
        }
      }
    }
    return null
  }

  private findPath(tx: number, ty: number): Phaser.Math.Vector2[] | null {
    const sx = Math.floor(this.player.x / TILE)
    const sy = Math.floor(this.player.y / TILE)
    if (sx === tx && sy === ty) return []
    const w = this.gameMap.width
    const h = this.gameMap.height
    const prev = new Map<number, number>()
    const queue: number[] = [sy * w + sx]
    prev.set(sy * w + sx, -1)
    let found = -1
    while (queue.length > 0) {
      const cur = queue.shift()!
      const cx = cur % w
      const cy = Math.floor(cur / w)
      if (cx === tx && cy === ty) {
        found = cur
        break
      }
      for (const [dx, dy] of PATH_DIRS) {
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        if (!isWalkable(this.gameMap, nx, ny)) continue
        const key = ny * w + nx
        if (prev.has(key)) continue
        prev.set(key, cur)
        queue.push(key)
      }
    }
    if (found < 0) return null
    const path: Phaser.Math.Vector2[] = []
    for (let cur = found; cur >= 0; cur = prev.get(cur)!) {
      const cx = cur % w
      const cy = Math.floor(cur / w)
      if (cx === sx && cy === sy) break
      path.unshift(new Phaser.Math.Vector2(cx * TILE + TILE / 2, cy * TILE + TILE / 2))
    }
    return path
  }

  private transitionTo(to: PortalTarget): void {
    this.transitioning = true
    this.autoPath = []
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
      // 仅当对话面板确认打开后才冻结世界（修复无对话 NPC 的软锁）
        bus.on('dialogue:state', ({ open }) => {
        this.dialogueOpen = open
        if (open) {
          this.joyVec = { x: 0, y: 0 }
          this.prompt.setVisible(false)
          this.stopMeditate()
        }
      }),
      // ENG-5：手动存/读档
      bus.on('save:write', ({ slot }) => void writeSave(this.snapshotSave(), slot as SlotId)),
      bus.on('save:load', ({ slot }) => void this.loadFromSlot(slot as SlotId)),
      bus.on('battle:opened', () => (this.battleAcked = true)),
      bus.on('meditate:toggle', () => this.toggleMeditate()),
      bus.on('navigate:quest', () => this.navigateToObjective()),
      bus.on('navigate:tile', ({ x, y }) => this.startAutoPathTo(x, y)),
      bus.on('joystick:move', () => (this.autoPath = [])),
      bus.on('battle:end', ({ win, fled }) => {
        this.battleActive = false
        // 战斗结束后短暂免遭遇窗口，防止贴身妖兽瞬间再开战
        this.battleGraceUntil = this.time.now + 2200
        if (win) {
          const enemy = this.activeEnemy
          if (enemy && enemy.body) {
            // 妖兽 30s 后在出生点复活（刷怪可重复，锚 GDD 碎片可玩）
            enemy.setVisible(false)
            ;(enemy.body as Phaser.Physics.Arcade.Body).enable = false
            const hx = enemy.getData('homeX') as number
            const hy = enemy.getData('homeY') as number
            this.time.delayedCall(ENEMY_RESPAWN_MS, () => {
              if (!enemy.body) return
              enemy.enableBody(true, hx, hy, true, true)
              enemy.setVelocity(0, 0)
            })
          }
        } else {
          const enemy = this.activeEnemy
          if (fled) this.knockbackUntil = this.time.now + 450
          if (fled && enemy && enemy.body) {
            // 逃跑：真实位移弹开（update 抑制输入 450ms，防止速度被输入覆盖）
            const dir = new Phaser.Math.Vector2(this.player.x - enemy.x, this.player.y - enemy.y)
            if (dir.lengthSq() < 0.01) dir.set(Phaser.Math.Between(-1, 1), Phaser.Math.Between(-1, 1))
            dir.normalize()
            this.player.setPosition(
              Phaser.Math.Clamp(this.player.x + dir.x * TILE * 1.6, 16, this.gameMap.width * TILE - 16),
              Phaser.Math.Clamp(this.player.y + dir.y * TILE * 1.6, 16, this.gameMap.height * TILE - 16),
            )
            ;(enemy.body as Phaser.Physics.Arcade.Body).setVelocity(-dir.x * 60, -dir.y * 60)
          }
          if (!fled) {
            // 战败（非逃跑）：宽惩罚——气血折半，送回出生点
            updatePlayer(respawnPenalty)
            bus.emit('player:stats')
            this.player.setPosition(this.spawnPoint.x, this.spawnPoint.y)
          }
          this.joyVec = { x: 0, y: 0 }
        }
        this.activeEnemy = undefined
      }),
    )
  }

  update(): void {
    if (!this.ready || !this.player?.body || this.transitioning) return
    if (this.meditating) {
      const k = this.keyState()
      if (Math.abs(this.joyVec.x) + Math.abs(this.joyVec.y) + Math.abs(k.x) + Math.abs(k.y) > 0.01) {
        this.stopMeditate()
      }
    }
    if (this.dialogueOpen || this.battleActive) {
      this.autoPath = []
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
    if (this.time.now < this.knockbackUntil) return
    const k = this.keyState()
    if (k.x !== 0 || k.y !== 0) this.autoPath = []
    if (this.autoPath.length > 0) {
      const target = this.autoPath[0]
      const dx = target.x - this.player.x
      const dy = target.y - this.player.y
      if (Math.abs(dx) < WAYPOINT_ARRIVAL_PX && Math.abs(dy) < WAYPOINT_ARRIVAL_PX) {
        this.autoPath.shift()
        if (this.autoPath.length === 0) this.player.setVelocity(0, 0)
      } else {
        const dir = new Phaser.Math.Vector2(dx, dy).normalize()
        this.player.setVelocity(dir.x * PLAYER_SPEED, dir.y * PLAYER_SPEED)
      }
    } else {
      const vx = (this.joyVec.x + k.x) * PLAYER_SPEED
      const vy = (this.joyVec.y + k.y) * PLAYER_SPEED
      this.player.setVelocity(Phaser.Math.Clamp(vx, -PLAYER_SPEED, PLAYER_SPEED), Phaser.Math.Clamp(vy, -PLAYER_SPEED, PLAYER_SPEED))
    }

    // ==== rich-graphics：行走动画与尘土 ====
    const moving = Math.abs(this.player.body.velocity.x) + Math.abs(this.player.body.velocity.y) > 4
    this.heroDust?.setMoving(moving)
    if (moving) {
      const dir =
        Math.abs(this.player.body.velocity.x) > Math.abs(this.player.body.velocity.y)
          ? ('side' as const)
          : this.player.body.velocity.y < 0
            ? ('up' as const)
            : ('down' as const)
      if (dir !== this.heroDir) {
        this.heroDir = dir
        this.player.play(`walk-${dir}`, true)
      } else if (!this.player.anims.isPlaying || this.player.anims.currentAnim?.key !== `walk-${dir}`) {
        this.player.play(`walk-${dir}`, true)
      }
      if (dir === 'side') this.player.setFlipX(this.player.body.velocity.x < 0)
      else this.player.setFlipX(false)
    } else {
      this.player.anims.stop()
      const row = this.heroDir === 'down' ? 0 : this.heroDir === 'up' ? 1 : 2
      this.player.setFrame(row * 3)
    }
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

  private snapshotSave() {
    return {
      version: SAVE_VERSION,
      playerId: 'mortal-001',
      x: this.player.x,
      y: this.player.y,
      mapId: this.mapId,
      inventory: [],
      savedAt: Date.now(),
      player: toPlayerSave(getPlayer()),
      quests: snapshotQuests(),
    }
  }

  /** 从指定档位恢复：先落盘为当前进度，再带落点重启场景 */
  private async loadFromSlot(slot: SlotId): Promise<void> {
    if (this.transitioning) return
    const data = await loadSave(slot)
    if (!data) return
    // 关键：写入 auto 档。重启后 initWorld 从 auto 档恢复，
    // 否则会被旧自动存档覆盖（表现为读档后等级/任务回退）
    await writeSave(data, AUTO_SLOT)
    setPlayer(fromPlayerSave(data.player))
    restoreQuests(data.quests)
    bus.emit('player:stats')
    this.transitioning = true
    this.cameras.main.fadeOut(FADE_MS, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () =>
      this.scene.restart({ mapId: data.mapId ?? this.mapId, x: Math.floor(data.x / TILE), y: Math.floor(data.y / TILE) }),
    )
  }

  private tryInteract(): void {
    if (this.transitioning || this.battleActive) return
    const near = this.nearestNpc()
    if (!near || this.dialogueOpen) return
    bus.emit('dialogue:open', { npcId: near.id })
  }
}
