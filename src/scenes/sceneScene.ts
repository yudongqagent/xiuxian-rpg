import Phaser from 'phaser'
import type { GameMap } from '../systems/schemas'
import { PROP_KEYS } from './mapTiles'

// ===================================================================
// gfx-scene：场景表现层（B1 地形过渡 / B3 视差 / B4 流水瀑布 /
// C1 天气粒子 / C2 昼夜循环 / C3 光晕），全部程序化生成，零二进制资源。
// ===================================================================

type C = CanvasRenderingContext2D

const TILE = 32
const BLEND_DEPTH = 0.45
const MAX_BAKE_PX = 2048
const STREAM_MIN_RUN = 3
const WATERFALL_MIN_RUN = 4
const PARALLAX_FAR = 0.2
const PARALLAX_NEAR = 0.4
const SKY_H_FRAC = 0.58
const RIDGE_FAR_H = 150
const RIDGE_NEAR_H = 112
const WEATHER_DEPTH = 55
const FOG_DEPTH = 57
const HALO_DEPTH = 50
const HALO_ALPHA = 0.38
const HALO_SCALE = 1.7
const DAY_NIGHT_PERIOD_MS = 120000
const DAY_NIGHT_TICK_MS = 400
const DAY_NIGHT_START_PHASE = 0.05

interface MoodPalette {
  skyTop: number
  skyBottom: number
  farRidge: number
  nearRidge: number
}

const MOOD_SCENERY: Record<string, MoodPalette> = {
  qixuanmen: { skyTop: 0xf2c48c, skyBottom: 0xffeed2, farRidge: 0xb08a6e, nearRidge: 0x7e5e46 },
  shanji: { skyTop: 0xa8c4de, skyBottom: 0xeaf2f8, farRidge: 0x7e94ae, nearRidge: 0x55688a },
  yaogu: { skyTop: 0x182a1e, skyBottom: 0x2e4a34, farRidge: 0x12251a, nearRidge: 0x1c3826 },
}

const DEFAULT_MOOD: MoodPalette = {
  skyTop: 0xd8c8a8,
  skyBottom: 0xf4ecdc,
  farRidge: 0xa89478,
  nearRidge: 0x7c6a54,
}

const GRASS_RGB = '61,94,47'
const SAND_RGB = '176,158,116'
const FOAM_RGB = '159,208,232'

const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`

function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const chAt = (m: GameMap, x: number, y: number): string => m.rows[y]?.[x] ?? ''

const isPathLike = (ch: string): boolean => ch === ',' || ch === 'B' || ch === 'D'

const isWater = (ch: string): boolean => ch === '~'

function cornerWedge(
  c: C,
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  r: number,
  col: string,
): void {
  c.fillStyle = col
  c.beginPath()
  c.moveTo(cx, cy)
  c.lineTo(cx + sx * r, cy)
  c.arc(cx, cy, r, Math.atan2(0, sx), Math.atan2(sy, 0), sx !== sy)
  c.closePath()
  c.fill()
}

function gradStrip(
  c: C,
  x: number,
  y: number,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgb: string,
  a: number,
): void {
  const g = c.createLinearGradient(x0, y0, x1, y1)
  g.addColorStop(0, `rgba(${rgb},${a})`)
  g.addColorStop(1, `rgba(${rgb},0)`)
  c.fillStyle = g
  c.fillRect(x, y, w, h)
}

// ==== GFX2-B1：地形自动过渡烘焙（草↔路↔水 圆角衔接）====
export function bakeTerrainBlend(scene: Phaser.Scene, m: GameMap): void {
  const w = m.width * TILE
  const h = m.height * TILE
  if (w > MAX_BAKE_PX || h > MAX_BAKE_PX) return
  if (scene.textures.exists('terrain-blend')) scene.textures.remove('terrain-blend')
  const tex = scene.textures.createCanvas('terrain-blend', w, h)!
  const c = tex.context as C
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      const ch = chAt(m, x, y)
      const ox = x * TILE
      const oy = y * TILE
      if (isPathLike(ch)) blendPathTile(c, m, x, y, ox, oy)
      else if (isWater(ch)) blendShoreTile(c, m, x, y, ox, oy)
    }
  }
  tex.refresh()
  scene.add.image(0, 0, 'terrain-blend').setOrigin(0).setDepth(BLEND_DEPTH)
}

function blendPathTile(c: C, m: GameMap, x: number, y: number, ox: number, oy: number): void {
  const up = isPathLike(chAt(m, x, y - 1))
  const down = isPathLike(chAt(m, x, y + 1))
  const left = isPathLike(chAt(m, x - 1, y))
  const right = isPathLike(chAt(m, x + 1, y))
  if (!up) gradStrip(c, ox, oy, TILE, 10, ox, oy, ox, oy + 10, GRASS_RGB, 0.75)
  if (!down) {
    gradStrip(c, ox, oy + TILE - 10, TILE, 10, ox, oy + TILE, ox, oy + TILE - 10, GRASS_RGB, 0.75)
  }
  if (!left) gradStrip(c, ox, oy, 10, TILE, ox, oy, ox + 10, oy, GRASS_RGB, 0.75)
  if (!right) {
    gradStrip(c, ox + TILE - 10, oy, 10, TILE, ox + TILE, oy, ox + TILE - 10, oy, GRASS_RGB, 0.75)
  }
  const diagPath = (dx: number, dy: number): boolean => isPathLike(chAt(m, dx, dy))
  const wedge = (cx: number, cy: number, r: number, a: number): void =>
    cornerWedge(c, cx, cy, cx === ox ? 1 : -1, cy === oy ? 1 : -1, r, `rgba(${GRASS_RGB},${a})`)
  if (!up && !left) wedge(ox, oy, 13, 0.92)
  if (!up && !right) wedge(ox + TILE, oy, 13, 0.92)
  if (!down && !left) wedge(ox, oy + TILE, 13, 0.92)
  if (!down && !right) wedge(ox + TILE, oy + TILE, 13, 0.92)
  if (up && left && !diagPath(x - 1, y - 1)) wedge(ox, oy, 9, 0.85)
  if (up && right && !diagPath(x + 1, y - 1)) wedge(ox + TILE, oy, 9, 0.85)
  if (down && left && !diagPath(x - 1, y + 1)) wedge(ox, oy + TILE, 9, 0.85)
  if (down && right && !diagPath(x + 1, y + 1)) wedge(ox + TILE, oy + TILE, 9, 0.85)
}

function blendShoreTile(c: C, m: GameMap, x: number, y: number, ox: number, oy: number): void {
  const up = !isWater(chAt(m, x, y - 1))
  const down = !isWater(chAt(m, x, y + 1))
  const left = !isWater(chAt(m, x - 1, y))
  const right = !isWater(chAt(m, x + 1, y))
  if (up) {
    c.fillStyle = `rgba(${SAND_RGB},0.9)`
    c.fillRect(ox, oy, TILE, 3)
    gradStrip(c, ox, oy + 3, TILE, 9, ox, oy + 3, ox, oy + 12, FOAM_RGB, 0.5)
  }
  if (down) {
    gradStrip(c, ox, oy + TILE - 12, TILE, 9, ox, oy + TILE - 3, ox, oy + TILE - 12, FOAM_RGB, 0.5)
    c.fillStyle = `rgba(${SAND_RGB},0.9)`
    c.fillRect(ox, oy + TILE - 3, TILE, 3)
  }
  if (left) {
    c.fillStyle = `rgba(${SAND_RGB},0.9)`
    c.fillRect(ox, oy, 3, TILE)
    gradStrip(c, ox + 3, oy, 9, TILE, ox + 3, oy, ox + 12, oy, FOAM_RGB, 0.5)
  }
  if (right) {
    gradStrip(c, ox + TILE - 12, oy, 9, TILE, ox + TILE - 3, oy, ox + TILE - 12, oy, FOAM_RGB, 0.5)
    c.fillStyle = `rgba(${SAND_RGB},0.9)`
    c.fillRect(ox + TILE - 3, oy, 3, TILE)
  }
  const diagLand = (dx: number, dy: number): boolean =>
    chAt(m, dx, dy) !== '' && !isWater(chAt(m, dx, dy))
  const wedge = (cx: number, cy: number, r: number, a: number): void =>
    cornerWedge(c, cx, cy, cx === ox ? 1 : -1, cy === oy ? 1 : -1, r, `rgba(${SAND_RGB},${a})`)
  const foam = (cx: number, cy: number): void => {
    c.fillStyle = `rgba(${FOAM_RGB},0.55)`
    c.beginPath()
    c.arc(cx, cy, 5, 0, Math.PI * 2)
    c.fill()
  }
  if (up && left && !diagLand(x - 1, y - 1)) {
    wedge(ox, oy, 11, 0.9)
    foam(ox + 6, oy + 6)
  }
  if (up && right && !diagLand(x + 1, y - 1)) {
    wedge(ox + TILE, oy, 11, 0.9)
    foam(ox + TILE - 6, oy + 6)
  }
  if (down && left && !diagLand(x - 1, y + 1)) {
    wedge(ox, oy + TILE, 11, 0.9)
    foam(ox + 6, oy + TILE - 6)
  }
  if (down && right && !diagLand(x + 1, y + 1)) {
    wedge(ox + TILE, oy + TILE, 11, 0.9)
    foam(ox + TILE - 6, oy + TILE - 6)
  }
}

// ==== GFX2-B3：天空渐变 + 远山剪影两层视差 ====
export function addParallax(
  scene: Phaser.Scene,
  mapId: string,
  focusX: number,
  focusY: number,
  worldW: number,
  worldH: number,
): void {
  const cam = scene.cameras.main
  const mood = MOOD_SCENERY[mapId] ?? DEFAULT_MOOD
  const viewW = Math.ceil(cam.width)
  const viewH = Math.ceil(cam.height)

  if (scene.textures.exists('sky-grad')) scene.textures.remove('sky-grad')
  const skyTex = scene.textures.createCanvas('sky-grad', viewW, viewH)!
  const sc = skyTex.context as C
  const grad = sc.createLinearGradient(0, 0, 0, viewH)
  grad.addColorStop(0, hex(mood.skyTop))
  grad.addColorStop(1, hex(mood.skyBottom))
  sc.fillStyle = grad
  sc.fillRect(0, 0, viewW, viewH)
  skyTex.refresh()

  const farW = Math.ceil(viewW + Math.max(0, worldW - viewW) * PARALLAX_FAR)
  const nearW = Math.ceil(viewW + Math.max(0, worldW - viewW) * PARALLAX_NEAR)
  buildRidge(scene, 'ridge-far', farW, RIDGE_FAR_H, mood.farRidge, 11)
  buildRidge(scene, 'ridge-near', nearW, RIDGE_NEAR_H, mood.nearRidge, 73)

  const initScrollX = Phaser.Math.Clamp(focusX - viewW / 2, 0, Math.max(0, worldW - viewW))
  const initScrollY = Phaser.Math.Clamp(focusY - viewH / 2, 0, Math.max(0, worldH - viewH))
  const horizonFrac = worldH < viewH ? (viewH - RIDGE_NEAR_H - 30) / viewH : SKY_H_FRAC

  const sky = scene.add
    .image(initScrollX, initScrollY, 'sky-grad')
    .setOrigin(0)
    .setScrollFactor(0)
    .setDepth(-30)
  const far = scene.add
    .image(initScrollX * PARALLAX_FAR, initScrollY + viewH * horizonFrac, 'ridge-far')
    .setOrigin(0, 1)
    .setScrollFactor(PARALLAX_FAR, 0)
    .setDepth(-20)
  const near = scene.add
    .image(initScrollX * PARALLAX_NEAR, initScrollY + viewH * horizonFrac + 34, 'ridge-near')
    .setOrigin(0, 1)
    .setScrollFactor(PARALLAX_NEAR, 0)
    .setDepth(-10)

  const layout = (): void => {
    const vh = Math.ceil(cam.height)
    sky.setPosition(initScrollX, initScrollY)
    far.setY(initScrollY + vh * horizonFrac)
    near.setY(initScrollY + vh * horizonFrac + 34)
  }
  scene.scale.on('resize', layout)
  scene.events.once('shutdown', () => scene.scale.off('resize', layout))
}

function buildRidge(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  color: number,
  seed: number,
): void {
  if (scene.textures.exists(key)) scene.textures.remove(key)
  const tex = scene.textures.createCanvas(key, w, h)!
  const c = tex.context as C
  const rnd = mulberry32(seed)
  const step = 64
  const n = Math.ceil(w / step) + 2
  const ctrl: number[] = []
  for (let i = 0; i < n; i++) ctrl.push(h * (0.25 + rnd() * 0.5))
  const yAt = (x: number): number => {
    const f = x / step
    const i = Math.floor(f)
    const t = f - i
    const s = (1 - Math.cos(t * Math.PI)) / 2
    return ctrl[i]! * (1 - s) + ctrl[i + 1]! * s
  }
  c.fillStyle = hex(color)
  c.beginPath()
  c.moveTo(0, h)
  for (let x = 0; x <= w; x += 4) c.lineTo(x, yAt(x))
  c.lineTo(w, h)
  c.closePath()
  c.fill()
  const haze = c.createLinearGradient(0, h * 0.5, 0, h)
  haze.addColorStop(0, 'rgba(255,255,255,0)')
  haze.addColorStop(1, 'rgba(255,255,255,0.15)')
  c.fillStyle = haze
  c.fillRect(0, 0, w, h)
  tex.refresh()
}

// ==== GFX2-B4：溪流流动高光带 + 长竖直跌水瀑布 ====
export function addFlowingWater(scene: Phaser.Scene, m: GameMap): void {
  ensureWaterTextures(scene)
  for (let y = 0; y < m.height; y++) {
    let runStart = -1
    for (let x = 0; x <= m.width; x++) {
      const wet = x < m.width && isWater(chAt(m, x, y))
      if (wet && runStart < 0) runStart = x
      if (!wet && runStart >= 0) {
        if (x - runStart >= STREAM_MIN_RUN) {
          for (let tx = runStart + 1; tx < x - 1; tx += 2) addStreamBand(scene, tx, y)
        }
        runStart = -1
      }
    }
  }
  for (let x = 0; x < m.width; x++) {
    let runStart = -1
    for (let y = 0; y <= m.height; y++) {
      const wet = y < m.height && isWater(chAt(m, x, y))
      if (wet && runStart < 0) runStart = y
      if (!wet && runStart >= 0) {
        const len = y - runStart
        const narrow =
          !isWater(chAt(m, x - 1, y - 1)) &&
          !isWater(chAt(m, x + 1, y - 1)) &&
          !isWater(chAt(m, x - 1, runStart)) &&
          !isWater(chAt(m, x + 1, runStart))
        if (
          len >= WATERFALL_MIN_RUN &&
          narrow &&
          runStart > 0 &&
          !isWater(chAt(m, x, runStart - 1))
        ) {
          addWaterfall(scene, x, runStart, len)
        }
        runStart = -1
      }
    }
  }
}

function addStreamBand(scene: Phaser.Scene, tx: number, ty: number): void {
  const band = scene.add
    .image(
      tx * TILE + 16 + Phaser.Math.Between(-4, 4),
      ty * TILE + 16 + Phaser.Math.Between(-7, 7),
      'water-band',
    )
    .setDepth(BLEND_DEPTH + 0.05)
    .setAlpha(0)
  scene.tweens.add({
    targets: band,
    alpha: { from: 0, to: 0.8 },
    x: band.x + 8,
    duration: 620 + Phaser.Math.Between(0, 380),
    delay: Phaser.Math.Between(0, 1400),
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  })
}

function addWaterfall(scene: Phaser.Scene, tx: number, ty: number, lenTiles: number): void {
  const fall = scene.add
    .tileSprite(tx * TILE, ty * TILE, TILE, lenTiles * TILE, 'water-streak')
    .setOrigin(0)
    .setDepth(BLEND_DEPTH + 0.06)
    .setAlpha(0.85)
  scene.tweens.add({
    targets: fall,
    tilePositionY: { from: 0, to: TILE * 2 },
    duration: 520,
    repeat: -1,
  })
  const foam = scene.add
    .image(tx * TILE + 16, (ty + lenTiles) * TILE - 4, 'sparkle')
    .setDepth(BLEND_DEPTH + 0.07)
  scene.tweens.add({
    targets: foam,
    scale: { from: 0.8, to: 1.6 },
    alpha: { from: 0.9, to: 0.2 },
    duration: 420,
    yoyo: true,
    repeat: -1,
  })
}

function ensureWaterTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('water-band')) {
    const tex = scene.textures.createCanvas('water-band', TILE, 5)!
    const c = tex.context as C
    const g = c.createLinearGradient(0, 0, TILE, 0)
    g.addColorStop(0, 'rgba(210,235,255,0)')
    g.addColorStop(0.5, 'rgba(215,238,255,0.85)')
    g.addColorStop(1, 'rgba(210,235,255,0)')
    c.fillStyle = g
    c.fillRect(0, 0, TILE, 5)
    tex.refresh()
  }
  if (!scene.textures.exists('water-streak')) {
    const tex = scene.textures.createCanvas('water-streak', TILE, TILE)!
    const c = tex.context as C
    const rnd = mulberry32(7)
    for (let i = 0; i < 7; i++) {
      const x = rnd() * TILE
      const y0 = rnd() * TILE
      const len = 6 + rnd() * 14
      const g = c.createLinearGradient(x, y0, x, y0 + len)
      g.addColorStop(0, 'rgba(190,225,250,0)')
      g.addColorStop(0.5, `rgba(200,232,252,${0.35 + rnd() * 0.4})`)
      g.addColorStop(1, 'rgba(190,225,250,0)')
      c.strokeStyle = g
      c.lineWidth = 1.6
      c.beginPath()
      c.moveTo(x, y0)
      c.lineTo(x, y0 + len)
      c.stroke()
    }
    for (let i = 0; i < 5; i++) {
      c.fillStyle = `rgba(235,248,255,${0.5 + rnd() * 0.4})`
      c.beginPath()
      c.arc(rnd() * TILE, rnd() * TILE, 1 + rnd(), 0, Math.PI * 2)
      c.fill()
    }
    tex.refresh()
  }
}

// ==== GFX2-C1：区域天气粒子（存活总量受控 <80）====
export function attachWeather(scene: Phaser.Scene, mapId: string): void {
  const cam = scene.cameras.main
  const vw = Math.ceil(cam.width)
  const vh = Math.ceil(cam.height)
  if (mapId === 'qixuanmen') {
    ensurePetalTexture(scene)
    scene.add
      .particles(0, 0, 'petal', {
        x: { min: -20, max: vw + 20 },
        y: -12,
        lifespan: 7000,
        speedY: { min: 16, max: 34 },
        speedX: { min: -20, max: -5 },
        rotate: { start: 0, end: 200 },
        scale: { min: 0.6, max: 1.15 },
        alpha: { start: 0.85, end: 0.25 },
        quantity: 1,
        frequency: 170,
      })
      .setScrollFactor(0)
      .setDepth(WEATHER_DEPTH)
  } else if (mapId === 'shanji') {
    ensureLeafTexture(scene)
    scene.add
      .particles(0, 0, 'leaf', {
        x: { min: -20, max: vw + 20 },
        y: -12,
        lifespan: 6000,
        speedY: { min: 26, max: 48 },
        speedX: { min: -34, max: -8 },
        rotate: { start: 0, end: 360 },
        scale: { min: 0.7, max: 1.2 },
        alpha: { start: 0.95, end: 0.4 },
        quantity: 1,
        frequency: 190,
      })
      .setScrollFactor(0)
      .setDepth(WEATHER_DEPTH)
  } else if (mapId === 'yaogu') {
    ensureNightTextures(scene)
    scene.add
      .particles(0, 0, 'firefly', {
        x: { min: 0, max: vw },
        y: { min: 80, max: vh },
        lifespan: 2600,
        speedX: { min: -9, max: 9 },
        speedY: { min: -7, max: 7 },
        scale: { min: 0.5, max: 1 },
        alpha: { start: 0.9, end: 0 },
        quantity: 1,
        frequency: 300,
      })
      .setScrollFactor(0)
      .setDepth(WEATHER_DEPTH)
    scene.add
      .particles(0, 0, 'fog-puff', {
        x: { min: 0, max: vw },
        y: { min: vh - 140, max: vh },
        lifespan: 11000,
        speedX: { min: 5, max: 15 },
        speedY: { min: -2, max: 2 },
        scale: { start: 1.3, end: 2.6 },
        alpha: { start: 0.11, end: 0 },
        quantity: 1,
        frequency: 1100,
      })
      .setScrollFactor(0)
      .setDepth(FOG_DEPTH)
  }
}

function ensurePetalTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('petal')) return
  const tex = scene.textures.createCanvas('petal', 10, 8)!
  const c = tex.context as C
  c.translate(5, 4)
  c.rotate(Math.PI / 5)
  c.fillStyle = '#eeb4d0'
  c.beginPath()
  c.ellipse(0, 0, 4.5, 2.6, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#f8dcea'
  c.beginPath()
  c.ellipse(-1, -0.6, 2.4, 1.3, 0, 0, Math.PI * 2)
  c.fill()
  tex.refresh()
}

function ensureLeafTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('leaf')) return
  const tex = scene.textures.createCanvas('leaf', 12, 8)!
  const c = tex.context as C
  c.fillStyle = '#dd8f3f'
  c.beginPath()
  c.moveTo(1, 4)
  c.quadraticCurveTo(5, -1, 11, 3)
  c.quadraticCurveTo(6, 8, 1, 4)
  c.closePath()
  c.fill()
  c.strokeStyle = '#a86426'
  c.lineWidth = 0.8
  c.beginPath()
  c.moveTo(1.5, 4)
  c.lineTo(10, 3.4)
  c.stroke()
  tex.refresh()
}

function ensureNightTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('firefly')) {
    const tex = scene.textures.createCanvas('firefly', 14, 14)!
    const c = tex.context as C
    const g = c.createRadialGradient(7, 7, 0, 7, 7, 7)
    g.addColorStop(0, 'rgba(238,248,168,1)')
    g.addColorStop(0.4, 'rgba(206,238,120,0.75)')
    g.addColorStop(1, 'rgba(186,228,96,0)')
    c.fillStyle = g
    c.fillRect(0, 0, 14, 14)
    tex.refresh()
  }
  if (!scene.textures.exists('fog-puff')) {
    const tex = scene.textures.createCanvas('fog-puff', 72, 40)!
    const c = tex.context as C
    const puff = (x: number, y: number, r: number, a: number): void => {
      const g = c.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, `rgba(226,238,230,${a})`)
      g.addColorStop(1, 'rgba(226,238,230,0)')
      c.fillStyle = g
      c.fillRect(x - r, y - r, r * 2, r * 2)
    }
    puff(36, 22, 20, 0.5)
    puff(18, 26, 13, 0.35)
    puff(54, 24, 14, 0.35)
    tex.refresh()
  }
}

// ==== GFX2-C2：昼夜色调循环（黄昏暖→夜晚蓝→黎明，约 120s，微幅）====
interface DayNightKey {
  at: number
  color: number
  alpha: number
}

const DAY_NIGHT_KEYS: DayNightKey[] = [
  { at: 0, color: 0xffd9a8, alpha: 0.07 },
  { at: 0.15, color: 0xfff2dc, alpha: 0.03 },
  { at: 0.45, color: 0xffb36b, alpha: 0.11 },
  { at: 0.62, color: 0x24356b, alpha: 0.2 },
  { at: 0.85, color: 0x1b2a55, alpha: 0.16 },
]

export function dayNightAt(t01: number): { color: number; alpha: number } {
  const t = ((t01 % 1) + 1) % 1
  for (let i = 0; i < DAY_NIGHT_KEYS.length; i++) {
    const cur = DAY_NIGHT_KEYS[i]!
    const next =
      DAY_NIGHT_KEYS[(i + 1) % DAY_NIGHT_KEYS.length] ??
      ({ ...cur, at: cur.at + 1 } as DayNightKey)
    const spanEnd = i + 1 < DAY_NIGHT_KEYS.length ? next.at : next.at + 1
    if (t >= cur.at && t < spanEnd) {
      const f = (t - cur.at) / (spanEnd - cur.at)
      const mix = (a: number, b: number): number => Math.round(a + (b - a) * f)
      const color =
        (mix((cur.color >> 16) & 255, (next.color >> 16) & 255) << 16) |
        (mix((cur.color >> 8) & 255, (next.color >> 8) & 255) << 8) |
        mix(cur.color & 255, next.color & 255)
      return { color, alpha: cur.alpha + (next.alpha - cur.alpha) * f }
    }
  }
  return { color: DAY_NIGHT_KEYS[0]!.color, alpha: DAY_NIGHT_KEYS[0]!.alpha }
}

export function attachDayNight(
  scene: Phaser.Scene,
  grade: Phaser.GameObjects.Rectangle,
): void {
  const apply = (): void => {
    const t = DAY_NIGHT_START_PHASE + scene.time.now / DAY_NIGHT_PERIOD_MS
    const { color, alpha } = dayNightAt(t)
    grade.setFillStyle(color, alpha)
  }
  apply()
  scene.time.addEvent({ delay: DAY_NIGHT_TICK_MS, loop: true, callback: apply })
}

// ==== GFX2-C3：灯笼/传送门 加性径向光晕 ====
export interface LightPoint {
  x: number
  y: number
  color: number
}

export function addLightHalos(scene: Phaser.Scene, lights: LightPoint[]): void {
  if (!scene.textures.exists('glow')) {
    const tex = scene.textures.createCanvas('glow', 64, 64)!
    const c = tex.context as C
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,0.9)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.38)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = g
    c.fillRect(0, 0, 64, 64)
    tex.refresh()
  }
  lights.forEach((l, i) => {
    const halo = scene.add
      .image(l.x, l.y, 'glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(l.color)
      .setScale(HALO_SCALE)
      .setAlpha(HALO_ALPHA)
      .setDepth(HALO_DEPTH)
    scene.tweens.add({
      targets: halo,
      alpha: HALO_ALPHA * 1.55,
      scale: HALO_SCALE * 1.12,
      duration: 1100,
      delay: (i * 190) % 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  })
}

// ==== GFX2-B2：道具摆放（含地面软阴影）====
export interface PlacedProp {
  type: string
  sprite: Phaser.GameObjects.Image
}

export function placeProps(
  scene: Phaser.Scene,
  m: GameMap,
): { props: PlacedProp[]; lanternLights: LightPoint[] } {
  if (!scene.textures.exists('prop-shadow')) {
    const tex = scene.textures.createCanvas('prop-shadow', 40, 14)!
    const c = tex.context as C
    const g = c.createRadialGradient(20, 7, 0, 20, 7, 18)
    g.addColorStop(0, 'rgba(10,8,4,0.42)')
    g.addColorStop(1, 'rgba(10,8,4,0)')
    c.save()
    c.translate(20, 7)
    c.scale(1, 0.36)
    c.translate(-20, -7)
    c.fillStyle = g
    c.fillRect(0, -11, 40, 36)
    c.restore()
    tex.refresh()
  }
  const lanternLights: LightPoint[] = []
  const props: PlacedProp[] = m.props.map((p, i) => {
    const px = p.x * TILE + TILE / 2
    const py = p.y * TILE + TILE / 2
    const shadow = scene.add.image(px, py + 9, 'prop-shadow').setDepth(2.8).setAlpha(0.85)
    shadow.setScale(p.type === 'fence' ? 0.8 : p.type === 'stall' ? 1.15 : 0.9)
    const sprite = scene.add
      .image(px, py, PROP_KEYS[p.type])
      .setDepth(3)
      .setFlipX(((p.x * 7 + p.y * 13 + i) & 1) === 0 && p.type !== 'fence')
    if (p.type === 'lantern') lanternLights.push({ x: px, y: py - 4, color: 0xffb45e })
    return { type: p.type, sprite }
  })
  return { props, lanternLights }
}
