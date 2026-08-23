import Phaser from 'phaser'
import { bus } from '../engine/eventBus'

const SHADOW_KEY = 'soft-shadow'
const SHADOW_W = 30
const SHADOW_H = 11
const SHADOW_OFFSET_Y = 13
const SHADOW_DIR_FACTOR = 0.035
const SHADOW_MAX_SHIFT = 5
const BREATH_MS = 1150
const BREATH_SCALE = 1.045
const NPC_ACTION_MIN_DELAY = 2400
const NPC_ACTION_MAX_DELAY = 4600
const NPC_INTERACT_RANGE = 80

type C = CanvasRenderingContext2D

function ensureShadowTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(SHADOW_KEY)) return
  const tex = scene.textures.createCanvas(SHADOW_KEY, SHADOW_W, SHADOW_H)!
  const c = tex.context as C
  const g = c.createRadialGradient(SHADOW_W / 2, SHADOW_H / 2, 1, SHADOW_W / 2, SHADOW_H / 2, SHADOW_W / 2)
  g.addColorStop(0, 'rgba(10,6,3,0.42)')
  g.addColorStop(0.7, 'rgba(10,6,3,0.22)')
  g.addColorStop(1, 'rgba(10,6,3,0)')
  c.fillStyle = g
  c.beginPath()
  c.ellipse(SHADOW_W / 2, SHADOW_H / 2, SHADOW_W / 2 - 0.5, SHADOW_H / 2 - 0.5, 0, 0, Math.PI * 2)
  c.fill()
  tex.refresh()
}

const BREATH_MOVE_EPSILON = 4

/** GFX2-A2：主角待机呼吸帧 + 方向性柔影 */
export function attachHeroPolish(
  scene: Phaser.Scene,
  player: Phaser.Physics.Arcade.Sprite,
): void {
  ensureShadowTexture(scene)
  const shadow = scene.add
    .image(player.x, player.y + SHADOW_OFFSET_Y, SHADOW_KEY)
    .setDepth(player.depth)
  scene.children.moveBelow(shadow, player)

  const breath = scene.tweens.add({
    targets: player,
    scaleY: { from: 1, to: BREATH_SCALE },
    duration: BREATH_MS,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  })

  let moving = false
  const onUpdate = () => {
    if (!player.active || !player.body) return
    const body = player.body as Phaser.Physics.Arcade.Body
    const speed = Math.abs(body.velocity.x)
    shadow.setPosition(
      player.x + Phaser.Math.Clamp(-body.velocity.x * SHADOW_DIR_FACTOR, -SHADOW_MAX_SHIFT, SHADOW_MAX_SHIFT),
      player.y + SHADOW_OFFSET_Y,
    )
    shadow.setScale(1 + Math.min(speed / 900, 0.25), 1)
    shadow.setAlpha(Math.max(0.55, 0.85 - speed / 1200))
    const nowMoving = Math.abs(body.velocity.x) + Math.abs(body.velocity.y) > BREATH_MOVE_EPSILON
    if (nowMoving !== moving) {
      moving = nowMoving
      if (moving) breath.pause()
      else breath.resume()
    }
  }
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate)

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate)
    breath.stop()
    shadow.destroy()
  })
}

type IdleAction = 'glance' | 'crossArms' | 'shiftWeight'

/** GFX2-A3：NPC 待机动作池（张望/抱臂/重心挪移）+ 对话时面向玩家 */
export function attachNpcLife(scene: Phaser.Scene, npcs: Phaser.GameObjects.Image[]): void {
  let playerPos = { x: 0, y: 0 }
  let talkingTo: Phaser.GameObjects.Image | undefined
  let dialogueOpen = false

  const unPos = bus.on('player:position', (p) => (playerPos = p))
  const unState = bus.on('dialogue:state', ({ open }) => {
    dialogueOpen = open
    if (!open) {
      if (talkingTo) talkingTo.setFlipX(false)
      talkingTo = undefined
      return
    }
    let best: Phaser.GameObjects.Image | undefined
    let bestDist = NPC_INTERACT_RANGE
    for (const s of npcs) {
      const d = Phaser.Math.Distance.Between(playerPos.x, playerPos.y, s.x, s.y)
      if (d < bestDist) {
        bestDist = d
        best = s
      }
    }
    if (!best) return
    talkingTo = best
    best.setFlipX(playerPos.x < best.x)
  })

  const timers: Array<Phaser.Time.TimerEvent> = []
  for (const sprite of npcs) {
    scheduleNext(scene, sprite, timers, () => dialogueOpen)
  }

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    unPos()
    unState()
    timers.forEach((t) => t.remove(false))
  })
}

function scheduleNext(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Image,
  timers: Array<Phaser.Time.TimerEvent>,
  blocked: () => boolean,
): void {
  const timer = scene.time.delayedCall(
    Phaser.Math.Between(NPC_ACTION_MIN_DELAY, NPC_ACTION_MAX_DELAY),
    () => {
      if (!sprite.active) return
      if (!blocked()) playIdleAction(scene, sprite)
      scheduleNext(scene, sprite, timers, blocked)
    },
  )
  timers.push(timer)
}

function playIdleAction(scene: Phaser.Scene, sprite: Phaser.GameObjects.Image): void {
  const roll = Math.random()
  if (roll < 0.4) glanceAround(scene, sprite)
  else if (roll < 0.7) crossArms(scene, sprite)
  else shiftWeight(scene, sprite)
}

function glanceAround(scene: Phaser.Scene, sprite: Phaser.GameObjects.Image): void {
  sprite.setFlipX(Math.random() < 0.5)
  scene.time.delayedCall(900, () => {
    if (sprite.active) sprite.setFlipX(false)
  })
}

function crossArms(scene: Phaser.Scene, sprite: Phaser.GameObjects.Image): void {
  scene.tweens.add({
    targets: sprite,
    scaleX: 1.07,
    scaleY: 0.95,
    duration: 320,
    yoyo: true,
    hold: 1300,
    ease: 'Sine.easeInOut',
  })
}

function shiftWeight(scene: Phaser.Scene, sprite: Phaser.GameObjects.Image): void {
  scene.tweens.add({
    targets: sprite,
    x: sprite.x + Phaser.Math.Between(-2, 2),
    duration: 480,
    yoyo: true,
    ease: 'Sine.easeInOut',
  })
}
