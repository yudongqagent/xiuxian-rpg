import Phaser from 'phaser'

// ===================================================================
// 程序化生成所有贴图 —— 零二进制资源。
// rich-graphics：主角 4 向行走图集 / NPC 群像；妖兽与粒子贴图见 fx.ts
// ===================================================================

const T = 32

type C = CanvasRenderingContext2D

function circle(c: C, x: number, y: number, r: number, col: string): void {
  c.fillStyle = col
  c.beginPath()
  c.arc(x, y, r, 0, Math.PI * 2)
  c.fill()
}

/** 侠客帧：cols=3(待机/迈左/迈右) rows=3(下/上/侧) 帧 24×30 */
function drawHeroFrame(c: C, ox: number, oy: number, dir: 0 | 1 | 2, step: 0 | 1 | 2): void {
  const robe = '#3f5e8c'
  const robeDark = '#324a70'
  const trim = '#c9a44a'
  const skin = '#f0d8b8'
  const hair = '#2b2016'
  // 腿（先画，被袍摆压住）
  c.fillStyle = robeDark
  if (step === 0) {
    c.fillRect(ox + 8, oy + 25, 3, 4)
    c.fillRect(ox + 13, oy + 25, 3, 4)
  } else {
    const l = step === 1 ? [7, 26] : [13, 24]
    const r = step === 1 ? [14, 24] : [8, 26]
    c.fillRect(ox + l[0], oy + l[1], 3, 4)
    c.fillRect(ox + r[0], oy + r[1], 3, 4)
  }
  // 袍身（梯形）
  c.fillStyle = robe
  c.beginPath()
  c.moveTo(ox + 7, oy + 12)
  c.lineTo(ox + 17, oy + 12)
  c.lineTo(ox + 19, oy + 26)
  c.lineTo(ox + 5, oy + 26)
  c.closePath()
  c.fill()
  // 腰带
  c.fillStyle = trim
  c.fillRect(ox + 6.5, oy + 16, 11, 2)
  // 手臂
  circle(c, ox + (step === 1 ? 5 : 6), oy + 15, 2, skin)
  circle(c, ox + (step === 2 ? 19 : 18), oy + 15, 2, skin)
  // 头
  circle(c, ox + 12, oy + 7, 4.5, skin)
  c.fillStyle = hair
  c.beginPath()
  c.arc(ox + 12, oy + 6.5, 4.5, Math.PI * (dir === 1 ? 0 : 1), dir === 0 ? Math.PI : 0)
  c.fill()
  c.fillRect(ox + 7.5, oy + 4, 9, 2)
  // 发髻
  circle(c, ox + 12, oy + 1.5, 2, hair)
  // 面向细节：下=双目；侧=单目偏前；上=无目
  if (dir === 0) {
    c.fillRect(ox + 10, oy + 7, 1.4, 1.6)
    c.fillRect(ox + 13, oy + 7, 1.4, 1.6)
  } else if (dir === 2) {
    c.fillRect(ox + 14, oy + 7, 1.4, 1.6)
  }
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  create(): void {
    const g = this.add.graphics()

    g.fillStyle(0x3d5e2f).fillRect(0, 0, T, T)
    g.fillStyle(0x476b36, 1)
    for (let i = 0; i < 6; i++) g.fillRect((i * 7) % T, (i * 11) % T, 2, 4)
    g.generateTexture('tile-grass', T, T)

    g.clear()
    g.fillStyle(0x9a7f56).fillRect(0, 0, T, T)
    g.fillStyle(0x8a7048, 1)
    g.fillRect(4, 6, 5, 3)
    g.fillRect(18, 20, 6, 3)
    g.generateTexture('tile-path', T, T)

    g.clear()
    g.fillStyle(0x27476e).fillRect(0, 0, T, T)
    g.fillStyle(0x31578a, 1)
    g.fillRect(2, 10, 12, 2)
    g.fillRect(16, 22, 12, 2)
    g.generateTexture('tile-water', T, T)

    // 树：双层冠+高光
    g.clear()
    g.fillStyle(0x5a3a24).fillRect(13, 18, 6, 12)
    g.fillStyle(0x24401f).fillCircle(17, 14, 10)
    g.fillStyle(0x2c5231).fillCircle(15, 12, 11)
    g.fillStyle(0x38653d, 1).fillCircle(11, 9, 6)
    g.fillStyle(0x4a7a48, 1).fillCircle(13, 7, 3)
    g.generateTexture('tree', T, T + 8)

    // 妖兽（灰狼）
    g.clear()
    g.fillStyle(0x6e6e78).fillCircle(11, 11, 9)
    g.fillStyle(0x8a8a96).fillTriangle(4, 5, 8, 1, 10, 6)
    g.fillTriangle(14, 5, 18, 1, 18, 6)
    g.fillStyle(0xd94f3d).fillCircle(8, 10, 2)
    g.generateTexture('wolf', 22, 22)

    // 玩家占位纹理保留（兼容旧引用）
    g.clear()
    g.fillStyle(0xf0e6c8).fillCircle(12, 12, 10)
    g.lineStyle(2, 0x8b6914).strokeCircle(12, 12, 10)
    g.generateTexture('player', 24, 24)

    g.destroy()

    this.buildHeroAtlas()
    this.buildNpcVariants()
    this.scene.start('World')
  }

  /** 主角行走图集：canvas spritesheet，帧 24×30，rows=下/上/侧 cols=待机/迈左/迈右 */
  private buildHeroAtlas(): void {
    const FW = 24
    const FH = 30
    const key = 'hero'
    if (this.textures.exists(key)) return
    const tex = this.textures.createCanvas(key, FW * 3, FH * 3)!
    const c = tex.context as C
    ;([0, 1, 2] as const).forEach((dir, row) => {
      ;([0, 1, 2] as const).forEach((step, col) => drawHeroFrame(c, col * FW, row * FH, dir, step))
    })
    tex.refresh()
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 3; col++) tex.add(row * 3 + col, 0, col * FW, row * FH, FW, FH)
  }

  /** NPC 群像：掌门/大夫/少年/少女/老人 各具轮廓配色 */
  private buildNpcVariants(): void {
    const make = (key: string, robe: string, trim: string, extra?: (c: C) => void): void => {
      if (this.textures.exists(key)) return
      const tex = this.textures.createCanvas(key, 22, 26)!
      const c = tex.context as C
      c.fillStyle = robe
      c.beginPath()
      c.moveTo(6, 10)
      c.lineTo(16, 10)
      c.lineTo(19, 24)
      c.lineTo(3, 24)
      c.closePath()
      c.fill()
      c.fillStyle = trim
      c.fillRect(4, 18, 14, 2)
      circle(c, 11, 6, 4.2, '#f0d8b8')
      circle(c, 11, 1.5, 2, '#2b2016')
      c.fillStyle = '#2b2016'
      c.fillRect(7, 4, 8, 2)
      extra?.(c)
      tex.refresh()
    }
    make('npc', '#b08ad0', '#8b6914')
    make('npc-master', '#2f3a52', '#ffd97a', (c) => {
      c.fillStyle = '#ffd97a'
      c.fillRect(2, 9, 3, 3)
      c.fillRect(17, 9, 3, 3)
    })
    make('npc-doctor', '#6b4a2f', '#d9c9a0', (c) => {
      c.fillStyle = '#e8e4da'
      c.fillRect(8, 9, 6, 4)
    })
    make('npc-youth', '#3f7a4a', '#a0d8b0')
    make('npc-maiden', '#d07aa8', '#f2d16b', (c) => {
      circle(c, 7.5, 3, 2, '#2b2016')
      circle(c, 14.5, 3, 2, '#2b2016')
    })
    make('npc-elder', '#7a6a58', '#c9b88a', (c) => {
      c.fillStyle = '#e8e4da'
      c.fillRect(9, 10, 4, 6)
    })
    make('npc-worker', '#5c5038', '#b8a878', (c) => {
      c.fillStyle = '#3a2c20'
      c.fillRect(4, 0, 14, 3)
    })
    make('npc-roamer', '#47608a', '#c4b078', (c) => {
      c.fillStyle = '#c4b078'
      c.fillRect(2, 10, 3, 3)
      c.fillRect(17, 10, 3, 3)
    })
  }
}
