import Phaser from 'phaser'
import { BootScene } from '../scenes/BootScene'
import { WorldScene } from '../scenes/WorldScene'

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1a120b',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: { default: 'arcade' },
    render: { antialias: true, roundPixels: true },
    scene: [BootScene, WorldScene],
  })
}
