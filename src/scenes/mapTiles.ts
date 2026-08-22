import Phaser from 'phaser'

export const MAP_ATLAS_KEY = 'map-tiles'
export const HOUSE_KEY = 'house'

/** 图集帧序号：0草 1路 2水 3桥 4花草 5墙 6门户 */
export const FRAME = { GRASS: 0, PATH: 1, WATER: 2, BRIDGE: 3, FLOWER: 4, WALL: 5, DOOR: 6 } as const

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
