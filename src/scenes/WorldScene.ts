import Phaser from 'phaser'
import { bus } from '../engine/eventBus'
import { loadSave, writeSave } from '../engine/save'
import { restoreQuests, snapshotQuests } from '../systems/questRuntime' // quest-engine

const TILE = 32
const PLAYER_SPEED = 160
const ENEMY_SPEED = 40
const ENEMY_WANDER_INTERVAL = 2000
const INTERACT_RANGE = 80
const SPAWN = { x: 20 * TILE, y: 28 * TILE }
const ENEMY_SPAWNS = [
  { x: 16 * TILE, y: 12 * TILE },
  { x: 24 * TILE, y: 18 * TILE },
]
const ENEMY_ID = 'hui_lang'
/** 0=草地 1=小路 2=水 3=树 */
const MAP: number[][] = Array.from({ length: 40 }, (_, y) =>
  Array.from({ length: 40 }, (_, x) => {
    if (y === 0 || x === 0 || y >= 38 || x >= 38) return 2
    if (Math.abs(x - 20) < 2 && Math.abs(y - 20) < 14) return 1
    if ((x * 7 + y * 13) % 23 === 0) return 3
    if (x > 30 && y < 10 && (x + y) % 17 === 0) return 3
    return 0
  }),
)

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

  constructor() {
    super('World')
  }

  create(): void {
    const map = this.make.tilemap({
      tileWidth: TILE,
      tileHeight: TILE,
      width: MAP[0].length,
      height: MAP.length,
    })
    // 用生成的贴图拼一张 3 帧图集：草、路、水
    const atlas = this.textures.createCanvas('tiles', TILE * 3, TILE)!
    atlas.drawFrame('tile-grass', undefined, 0, 0)
    atlas.drawFrame('tile-path', undefined, TILE, 0)
    atlas.drawFrame('tile-water', undefined, TILE * 2, 0)
    atlas.refresh()
    const tiles = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0)!
    const layer = map.createBlankLayer('ground', tiles, 0, 0)!
    MAP.forEach((row, y) => row.forEach((t, x) => layer.putTileAt(t === 3 ? 0 : t, x, y)))

    // 障碍层（树）
    const obstacles = this.physics.add.staticGroup()
    MAP.forEach((row, y) =>
      row.forEach((t, x) => {
        if (t !== 3) return
        layer.putTileAt(0, x, y)
        obstacles
          .create(x * TILE + TILE / 2, y * TILE + TILE / 2, 'tree')
          ?.setSize(TILE, TILE)
          .setOffset(0, -8)
          .refreshBody()
      }),
    )

    // 示例 NPC
    const moDafu = this.physics.add.staticImage(21.5 * TILE, 14 * TILE, 'npc')
    moDafu.setInteractive({ useHandCursor: true })
    moDafu.on('pointerdown', () => this.tryInteract())
    this.npcs.push({ id: 'mo_dafu', sprite: moDafu })
    this.prompt = this.add
      .text(0, 0, '[E] 交谈', {
        fontSize: '12px',
        color: '#e8dcc0',
        backgroundColor: '#1a120b',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5)
      .setVisible(false)

    // 玩家
    this.player = this.physics.add.sprite(SPAWN.x, SPAWN.y, 'player')
    this.player.setCollideWorldBounds(true)
    this.physics.add.collider(this.player, obstacles)
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15)
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels)

    // 妖兽游荡 + 接触触发战斗
    this.wolves = this.physics.add.group()
    ENEMY_SPAWNS.forEach(({ x, y }) => {
      const wolf = this.wolves.create(x, y, 'wolf') as Phaser.Physics.Arcade.Sprite
      wolf.setCollideWorldBounds(true)
      this.time.addEvent({
        delay: ENEMY_WANDER_INTERVAL,
        loop: true,
        callback: () => {
          if (this.battleActive) return
          wolf.setVelocity(
            Phaser.Math.Between(-1, 1) * ENEMY_SPEED,
            Phaser.Math.Between(-1, 1) * ENEMY_SPEED,
          )
        },
      })
    })
    this.physics.add.collider(this.wolves, obstacles)
    this.physics.add.collider(this.player, this.wolves)
    this.physics.add.overlap(this.player, this.wolves, (_p, wolfObj) => {
      const wolf = wolfObj as Phaser.Physics.Arcade.Sprite
      if (this.battleActive || !wolf.body) return
      this.activeEnemy = wolf
      this.battleActive = true
      this.player.setVelocity(0, 0)
      this.joyVec = { x: 0, y: 0 }
      bus.emit('battle:start', { enemyId: ENEMY_ID })
    })

    // 摇杆输入 + 键盘备用
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
      bus.on('battle:end', ({ win }) => {
        this.battleActive = false
        if (win) {
          this.activeEnemy?.destroy()
        } else {
          this.player.setPosition(SPAWN.x, SPAWN.y)
          this.joyVec = { x: 0, y: 0 }
        }
        this.activeEnemy = undefined
      }),
    )
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

    // 存档恢复 + 自动保存
    void loadSave().then((save) => {
      if (save) this.player.setPosition(save.x, save.y)
      restoreQuests(save?.quests) // quest-engine: 恢复任务进度
      this.time.addEvent({
        delay: 5000,
        loop: true,
        callback: () =>
          void writeSave({
            version: 1,
            playerId: 'mortal-001',
            x: this.player.x,
            y: this.player.y,
            inventory: [],
            savedAt: Date.now(),
            quests: snapshotQuests(), // quest-engine: 任务进度入档
          }),
      })
    })

    // 上报坐标给 HUD
    this.time.addEvent({
      delay: 250,
      loop: true,
      callback: () =>
        bus.emit('player:position', { x: this.player.x, y: this.player.y }),
    })

    this.events.on('shutdown', () => this.unsubs.forEach((u) => u()))
  }

  update(): void {
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
