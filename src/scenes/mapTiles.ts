import Phaser from 'phaser'

export const MAP_ATLAS_KEY = 'map-tiles'
export const HOUSE_KEY = 'house'

/** 图集帧序号：0草 1路 2水 3桥 4花草 5墙 6门户 */
export const FRAME = { GRASS: 0, PATH: 1, WATER: 2, BRIDGE: 3, FLOWER: 4, WALL: 5, DOOR: 6 } as const

// ==== gfx-scene：场景道具贴图键（B2）====
export const PROP_KEYS = {
  lantern: 'prop-lantern',
  well: 'prop-well',
  signpost: 'prop-signpost',
  fence: 'prop-fence',
  stall: 'prop-stall',
} as const

const T = 32
const FRAMES = 7

export function buildMapTileTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(HOUSE_KEY)) {
    const g = scene.add.graphics()
    g.fillStyle(0x6b4a2f).fillRect(2, 14, 28, 16)
    g.fillStyle(0x8a6239).fillRect(4, 16, 24, 12)
    g.fillStyle(0x7a2e22).fillTriangle(0, 15, 32, 15, 16, 0)
    g.fillStyle(0x93382a).fillTriangle(3, 14, 29, 14, 16, 2)
    g.fillStyle(0x3a2a1a).fillRect(13, 20, 6, 10)
    g.generateTexture(HOUSE_KEY, T, T)
    g.destroy()
  }
  if (scene.textures.exists(MAP_ATLAS_KEY)) return

  const atlas = scene.textures.createCanvas(MAP_ATLAS_KEY, T * FRAMES, T)!
  const c = atlas.context

  atlas.drawFrame('tile-grass', undefined, FRAME.GRASS * T, 0)
  atlas.drawFrame('tile-path', undefined, FRAME.PATH * T, 0)
  atlas.drawFrame('tile-water', undefined, FRAME.WATER * T, 0)

  const bx = FRAME.BRIDGE * T
  c.fillStyle = '#6b4a2f'
  for (let i = 0; i < 4; i++) c.fillRect(bx + 2, 2 + i * 8, T - 4, 5)

  const fx = FRAME.FLOWER * T
  atlas.drawFrame('tile-grass', undefined, fx, 0)
  const petals = ['#e8a0c8', '#f2d16b', '#c8d8f0']
  petals.forEach((col, i) => {
    c.fillStyle = col
    c.beginPath()
    c.arc(fx + 8 + i * 8, 12 + ((i * 9) % 12), 2.5, 0, Math.PI * 2)
    c.fill()
  })

  const wx = FRAME.WALL * T
  c.fillStyle = '#7d7468'
  c.fillRect(wx, 0, T, T)
  c.fillStyle = '#6a6258'
  for (let r = 0; r < 4; r++)
    for (let b = 0; b < 2; b++) c.fillRect(wx + b * 16 + (r % 2 ? 4 : 0), r * 8 + 1, 14, 6)

  const dx = FRAME.DOOR * T
  atlas.drawFrame('tile-path', undefined, dx, 0)
  c.fillStyle = '#3fae9a'
  c.globalAlpha = 0.85
  c.beginPath()
  c.arc(dx + T / 2, T / 2, 11, 0, Math.PI * 2)
  c.fill()
  c.globalAlpha = 1
  c.fillStyle = '#bff3e8'
  c.beginPath()
  c.arc(dx + T / 2, T / 2, 5, 0, Math.PI * 2)
  c.fill()

  atlas.refresh()
  for (let i = 0; i < FRAMES; i++) atlas.add(i, 0, i * T, 0, T, T)
}

// ==== gfx-scene：程序化道具贴图（B2，零二进制资源）====
type Ctx = CanvasRenderingContext2D

function propCircle(c: Ctx, x: number, y: number, r: number, col: string): void {
  c.fillStyle = col
  c.beginPath()
  c.arc(x, y, r, 0, Math.PI * 2)
  c.fill()
}

export function buildProps(scene: Phaser.Scene): void {
  if (!scene.textures.exists(PROP_KEYS.lantern)) {
    const tex = scene.textures.createCanvas(PROP_KEYS.lantern, 14, 24)!
    const c = tex.context as Ctx
    c.fillStyle = '#3a2a1a'
    c.fillRect(5, 1, 4, 2)
    c.fillStyle = '#c23b2e'
    c.beginPath()
    c.ellipse(7, 11, 6, 8, 0, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = '#e8b34a'
    c.lineWidth = 1
    for (const rx of [2.5, 4.5]) {
      c.beginPath()
      c.ellipse(7, 11, rx, 8, 0, 0, Math.PI * 2)
      c.stroke()
    }
    c.fillRect(3, 11, 8, 1)
    c.fillStyle = '#f6d992'
    c.fillRect(5, 7, 4, 6)
    c.fillStyle = '#3a2a1a'
    c.fillRect(5, 19, 4, 2)
    c.fillStyle = '#d94f3d'
    c.fillRect(6, 21, 2, 3)
    tex.refresh()
  }
  if (!scene.textures.exists(PROP_KEYS.well)) {
    const tex = scene.textures.createCanvas(PROP_KEYS.well, 26, 26)!
    const c = tex.context as Ctx
    c.fillStyle = '#6f6a60'
    c.fillRect(3, 14, 20, 10)
    c.fillStyle = '#8a857a'
    c.fillRect(3, 14, 20, 3)
    propCircle(c, 13, 15, 6, '#2c2620')
    propCircle(c, 13, 15, 4.5, '#17303e')
    c.fillStyle = '#5a3a24'
    c.fillRect(3, 4, 3, 12)
    c.fillRect(20, 4, 3, 12)
    c.fillStyle = '#7a5230'
    c.fillRect(1, 2, 24, 4)
    c.strokeStyle = '#c9bb90'
    c.lineWidth = 1.5
    c.beginPath()
    c.moveTo(13, 6)
    c.lineTo(13, 13)
    c.stroke()
    tex.refresh()
  }
  if (!scene.textures.exists(PROP_KEYS.signpost)) {
    const tex = scene.textures.createCanvas(PROP_KEYS.signpost, 22, 28)!
    const c = tex.context as Ctx
    c.fillStyle = '#5a3a24'
    c.fillRect(9, 8, 4, 19)
    c.fillStyle = '#7a5230'
    c.fillRect(2, 4, 18, 9)
    c.fillStyle = '#93704a'
    c.fillRect(3, 5, 16, 7)
    c.strokeStyle = '#5a3a24'
    c.lineWidth = 1
    for (let i = 0; i < 2; i++) {
      c.beginPath()
      c.moveTo(5, 7 + i * 3)
      c.lineTo(17, 7 + i * 3)
      c.stroke()
    }
    tex.refresh()
  }
  if (!scene.textures.exists(PROP_KEYS.fence)) {
    const tex = scene.textures.createCanvas(PROP_KEYS.fence, 32, 18)!
    const c = tex.context as Ctx
    c.fillStyle = '#8a6239'
    c.fillRect(1, 5, 30, 3)
    c.fillRect(1, 11, 30, 3)
    c.fillStyle = '#6b4a2f'
    for (const px of [2, 13, 25]) {
      c.fillRect(px, 2, 4, 15)
      c.fillStyle = '#7a5230'
      c.fillRect(px, 2, 4, 2)
      c.fillStyle = '#6b4a2f'
    }
    tex.refresh()
  }
  if (!scene.textures.exists(PROP_KEYS.stall)) {
    const tex = scene.textures.createCanvas(PROP_KEYS.stall, 32, 28)!
    const c = tex.context as Ctx
    c.fillStyle = '#6b4a2f'
    c.fillRect(3, 10, 3, 17)
    c.fillRect(26, 10, 3, 17)
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? '#c23b2e' : '#efe3cc'
      c.fillRect(i * 4, 2, 4, 7)
    }
    c.fillStyle = '#8a6239'
    c.fillRect(2, 16, 28, 9)
    c.fillStyle = '#a87e46'
    c.fillRect(2, 16, 28, 3)
    c.fillStyle = '#4a7a48'
    c.fillRect(7, 12, 5, 4)
    c.fillStyle = '#d94f3d'
    c.fillRect(15, 12, 5, 4)
    c.fillStyle = '#e8b34a'
    c.fillRect(22, 12, 4, 4)
    tex.refresh()
  }
}
