import Phaser from 'phaser'

// ===================================================================
// rich-graphics：氛围渲染与动效辅助（程序化，零二进制资源）
// ===================================================================

type C = CanvasRenderingContext2D

function circle(c: C, x: number, y: number, r: number, col: string): void {
  c.fillStyle = col
  c.beginPath()
  c.arc(x, y, r, 0, Math.PI * 2)
  c.fill()
}

/** 妖兽变体与粒子/氛围贴图（BootScene 末尾调用一次） */
export function buildFxTextures(scene: Phaser.Scene): void {
  const ell = (c: C, x: number, y: number, rx: number, ry: number, col: string) => {
    c.fillStyle = col
    c.beginPath()
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
    c.fill()
  }
  const tri = (c: C, pts: number[][], col: string) => {
    c.fillStyle = col
    c.beginPath()
    c.moveTo(pts[0][0], pts[0][1])
    c.lineTo(pts[1][0], pts[1][1])
    c.lineTo(pts[2][0], pts[2][1])
    c.closePath()
    c.fill()
  }

  // 铁背狼：深色+背甲
  if (!scene.textures.exists('wolf-tiebei')) {
    const tex = scene.textures.createCanvas('wolf-tiebei', 22, 22)!
    const c = tex.context as C
    circle(c, 11, 12, 9, '#4a4a56')
    tri(
      c,
      [
        [4, 6],
        [8, 2],
        [10, 7],
      ],
      '#6a6a78',
    )
    tri(
      c,
      [
        [14, 6],
        [18, 2],
        [18, 7],
      ],
      '#6a6a78',
    )
    c.fillStyle = '#8f8468'
    c.fillRect(4, 8, 14, 3)
    circle(c, 8, 11, 1.6, '#d9b23d')
    tex.refresh()
  }

  // 野狼帮众：类人剪影+头巾
  if (!scene.textures.exists('bandit')) {
    const tex = scene.textures.createCanvas('bandit', 22, 22)!
    const c = tex.context as C
    c.fillStyle = '#5c4a38'
    c.fillRect(6, 10, 10, 10)
    circle(c, 11, 7, 4, '#e0c098')
    c.fillStyle = '#8a3324'
    c.fillRect(6, 4, 10, 4)
    tex.refresh()
  }

  // 雾影莽：三段蛇躯（Boss）
  if (!scene.textures.exists('mang')) {
    const tex = scene.textures.createCanvas('mang', 26, 24)!
    const c = tex.context as C
    ell(c, 11, 17, 10, 4.5, '#4a3a66')
    ell(c, 13, 12, 7, 4, '#5c4a80')
    ell(c, 15, 7.5, 5, 3.5, '#6e5a96')
    circle(c, 17, 6.5, 1.5, '#d94f3d')
    tex.refresh()
  }

  // 野猪王：獠牙+鬃（Boss）
  if (!scene.textures.exists('boar')) {
    const tex = scene.textures.createCanvas('boar', 24, 22)!
    const c = tex.context as C
    ell(c, 13, 13, 9.5, 6.5, '#4a3527')
    c.fillStyle = '#5c4530'
    c.fillRect(4, 6, 4, 7)
    tri(
      c,
      [
        [5, 15],
        [2, 18],
        [7, 17],
      ],
      '#e8e0d0',
    )
    tri(
      c,
      [
        [21, 15],
        [24, 18],
        [19, 17],
      ],
      '#e8e0d0',
    )
    circle(c, 8, 10, 1.5, '#d94f3d')
    tex.refresh()
  }

  // 尘土粒子：柔边圆
  if (!scene.textures.exists('dust')) {
    const tex = scene.textures.createCanvas('dust', 10, 10)!
    const c = tex.context as C
    for (let r = 5; r > 0; r--) circle(c, 5, 5, r, `rgba(176,158,120,${0.16 * (6 - r)})`)
    tex.refresh()
  }
  // 水面波光菱形
  if (!scene.textures.exists('sparkle')) {
    const tex = scene.textures.createCanvas('sparkle', 8, 8)!
    const c = tex.context as C
    c.fillStyle = 'rgba(210,235,255,0.95)'
    c.beginPath()
    c.moveTo(4, 0)
    c.lineTo(7, 4)
    c.lineTo(4, 8)
    c.lineTo(1, 4)
    c.closePath()
    c.fill()
    tex.refresh()
  }
  // Boss 光环
  if (!scene.textures.exists('aura')) {
    const tex = scene.textures.createCanvas('aura', 56, 56)!
    const c = tex.context as C
    c.strokeStyle = 'rgba(214,88,60,0.9)'
    c.lineWidth = 3
    c.beginPath()
    c.arc(28, 28, 25, 0, Math.PI * 2)
    c.stroke()
    c.strokeStyle = 'rgba(255,217,122,0.5)'
    c.lineWidth = 1.5
    c.beginPath()
    c.arc(28, 28, 21, 0, Math.PI * 2)
    c.stroke()
    tex.refresh()
  }
  // 传送门脉冲环
  if (!scene.textures.exists('portal-ring')) {
    const tex = scene.textures.createCanvas('portal-ring', 40, 40)!
    const c = tex.context as C
    c.strokeStyle = 'rgba(63,174,154,0.85)'
    c.lineWidth = 2.5
    c.beginPath()
    c.arc(20, 20, 18, 0, Math.PI * 2)
    c.stroke()
    tex.refresh()
  }
  // 暗角：径向渐变
  if (!scene.textures.exists('vignette')) {
    const tex = scene.textures.createCanvas('vignette', 256, 256)!
    const c = tex.context as C
    const grad = c.createRadialGradient(128, 128, 70, 128, 128, 185)
    grad.addColorStop(0, 'rgba(8,5,3,0)')
    grad.addColorStop(1, 'rgba(8,5,3,0.6)')
    c.fillStyle = grad
    c.fillRect(0, 0, 256, 256)
    tex.refresh()
  }
}

/** 区域 → 氛围色调（仙剑式水墨暖冷调） */
const MOOD_TINTS: Record<string, { color: number; alpha: number }> = {
  qixuanmen: { color: 0xffe3b8, alpha: 0.07 },
  shanji: { color: 0xcfe0ff, alpha: 0.09 },
  yaogu: { color: 0x14301c, alpha: 0.16 },
}

const NPC_PALETTES: Record<string, string> = {
  mo_dafu: 'npc-doctor',
  wang_zhangmen: 'npc-master',
  li_feiyu: 'npc-youth',
  mo_caihuan: 'npc-maiden',
  chaopeng_laoren: 'npc-elder',
}

const ENEMY_VISUALS: Record<string, { tex: string; scale: number; boss: boolean }> = {
  hui_lang: { tex: 'wolf', scale: 1, boss: false },
  tiebei_lang: { tex: 'wolf-tiebei', scale: 1.1, boss: false },
  yelang_bangzhong: { tex: 'bandit', scale: 1, boss: false },
  wuying_mang: { tex: 'mang', scale: 1.25, boss: true },
  ye_zhu_wang: { tex: 'boar', scale: 1.35, boss: true },
}

export function npcTextureFor(npcId: string): string {
  return NPC_PALETTES[npcId] ?? 'npc'
}

export function enemyVisualFor(enemyId: string): { tex: string; scale: number; boss: boolean } {
  return ENEMY_VISUALS[enemyId] ?? { tex: 'wolf', scale: 1, boss: false }
}

/** 全屏氛围：色调叠加 + 暗角；返回色调层句柄供 gfx-scene 昼夜循环调制 */
export function applyAtmosphere(
  scene: Phaser.Scene,
  mapId: string,
): { grade: Phaser.GameObjects.Rectangle } {
  const cam = scene.cameras.main
  const tint = MOOD_TINTS[mapId] ?? { color: 0xf0e0c0, alpha: 0.06 }
  const grade = scene.add
    .rectangle(0, 0, cam.width, cam.height, tint.color, tint.alpha)
    .setOrigin(0)
    .setScrollFactor(0)
    .setDepth(60)
  const vig = scene.add
    .image(cam.width / 2, cam.height / 2, 'vignette')
    .setDisplaySize(cam.width + 4, cam.height + 4)
    .setScrollFactor(0)
    .setDepth(61)
    .setAlpha(mapId === 'yaogu' ? 0.75 : 0.5)
  const layout = () => {
    grade.setSize(cam.width, cam.height)
    vig.setPosition(cam.width / 2, cam.height / 2).setDisplaySize(cam.width + 4, cam.height + 4)
  }
  scene.scale.on('resize', layout)
  scene.events.once('shutdown', () => scene.scale.off('resize', layout))
  return { grade }
}

/** 环境动效：水面波光 / 树摇 / 传送门脉冲 */
export function addAmbientFx(
  scene: Phaser.Scene,
  parts: {
    rows: string[]
    trees: Phaser.GameObjects.Image[]
    portals: Array<{ x: number; y: number }>
  },
): void {
  parts.rows.forEach((row, y) =>
    row.split('').forEach((ch, x) => {
      if (ch !== '~') return
      const s = scene.add
        .image(x * 32 + 16 + Phaser.Math.Between(-8, 8), y * 32 + 16 + Phaser.Math.Between(-6, 6), 'sparkle')
        .setDepth(1)
        .setAlpha(0)
      scene.tweens.add({
        targets: s,
        alpha: { from: 0, to: 0.65 },
        duration: 700,
        delay: Phaser.Math.Between(0, 2600),
        hold: 260,
        yoyo: true,
        repeat: -1,
      })
    }),
  )
  parts.trees.forEach((t, i) => {
    scene.tweens.add({
      targets: t,
      angle: { from: -1.2, to: 1.2 },
      duration: 1700 + (i % 5) * 260,
      delay: (i * 137) % 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  })
  parts.portals.forEach((p, i) => {
    const ring = scene.add.image(p.x, p.y, 'portal-ring').setDepth(1).setScale(0.6).setAlpha(0.8)
    scene.tweens.add({
      targets: ring,
      scale: 1.15,
      alpha: 0.15,
      duration: 900,
      delay: i * 220,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeOut',
    })
  })
}

/** 跟随玩家的行走尘土粒子 */
export function attachHeroDust(
  scene: Phaser.Scene,
  player: Phaser.Physics.Arcade.Sprite,
): { setMoving: (moving: boolean) => void } {
  const emitter = scene.add
    .particles(0, 0, 'dust', {
      follow: player,
      followOffset: { x: 0, y: 13 },
      lifespan: 380,
      speed: { min: 6, max: 22 },
      angle: { min: 190, max: 350 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.55, end: 0 },
      frequency: 130,
      quantity: 1,
      emitting: false,
    })
    .setDepth(2)
  return {
    setMoving(moving: boolean) {
      emitter.emitting = moving
    },
  }
}

/** NPC 待机呼吸浮动（静态体，y 补间安全） */
export function idleBob(scene: Phaser.Scene, target: Phaser.GameObjects.Image, amp = 2): void {
  scene.tweens.add({
    targets: target,
    y: target.y - amp,
    duration: 640,
    delay: Phaser.Math.Between(0, 500),
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  })
}

/** 妖兽呼吸：缩放脉冲（动态体禁用 y 补间，否则追击速度每帧被补间覆盖） */
export function enemyBob(scene: Phaser.Scene, target: Phaser.GameObjects.Image): void {
  scene.tweens.add({
    targets: target,
    scaleX: target.scaleX * 1.06,
    scaleY: target.scaleY * 0.94,
    duration: 560,
    delay: Phaser.Math.Between(0, 500),
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  })
}

/** Boss 脚下光环 */
export function bossAura(scene: Phaser.Scene, x: number, y: number): void {
  const aura = scene.add.image(x, y, 'aura').setDepth(0.5).setScale(0.9).setAlpha(0.45)
  scene.tweens.add({
    targets: aura,
    scale: 1.08,
    alpha: 0.25,
    duration: 850,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  })
}
