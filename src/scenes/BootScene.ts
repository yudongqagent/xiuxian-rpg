import Phaser from 'phaser'

/** 程序化生成所有贴图 —— 骨架阶段零二进制资源，后续替换为真实美术。 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  create(): void {
    const g = this.add.graphics()
    const T = 32

    // 草地
    g.fillStyle(0x3d5e2f).fillRect(0, 0, T, T)
    g.fillStyle(0x476b36, 1)
    for (let i = 0; i < 6; i++) g.fillRect((i * 7) % T, (i * 11) % T, 2, 4)
    g.generateTexture('tile-grass', T, T)

    // 灵田/小路
    g.clear()
    g.fillStyle(0x9a7f56).fillRect(0, 0, T, T)
    g.fillStyle(0x8a7048, 1)
    g.fillRect(4, 6, 5, 3)
    g.fillRect(18, 20, 6, 3)
    g.generateTexture('tile-path', T, T)

    // 水面
    g.clear()
    g.fillStyle(0x27476e).fillRect(0, 0, T, T)
    g.fillStyle(0x31578a, 1)
    g.fillRect(2, 10, 12, 2)
    g.fillRect(16, 22, 12, 2)
    g.generateTexture('tile-water', T, T)

    // 树（障碍物）
    g.clear()
    g.fillStyle(0x5a3a24).fillRect(13, 18, 6, 12)
    g.fillStyle(0x2c5231).fillCircle(16, 12, 11)
    g.fillStyle(0x38653d, 1).fillCircle(12, 9, 6)
    g.generateTexture('tree', T, T + 8)

    // 玩家
    g.clear()
    g.fillStyle(0xf0e6c8).fillCircle(12, 12, 10)
    g.lineStyle(2, 0x8b6914).strokeCircle(12, 12, 10)
    g.generateTexture('player', 24, 24)

    // NPC
    g.clear()
    g.fillStyle(0xc98ad4).fillCircle(10, 10, 8)
    g.generateTexture('npc', 20, 20)

    g.destroy()
    this.scene.start('World')
  }
}
