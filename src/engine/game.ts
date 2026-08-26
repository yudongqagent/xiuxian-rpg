import Phaser from 'phaser'
import { BootScene } from '../scenes/BootScene'
import { WorldScene } from '../scenes/WorldScene'
import { bus } from './eventBus'

declare global {
  interface Window {
    __xiuxian?: {
      bus: typeof bus
      scene?: {
        path: () => Array<[number, number]>
        pos: () => [number, number]
        findPath: (tx: number, ty: number) => Array<[number, number]> | null
        portals: () => Array<{ tile: [number, number]; lockQuest?: string }>
        garden: () => unknown
        navDirect: (tx: number, ty: number) => void
        flags: () => { dialogueOpen: boolean; battleActive: boolean; transitioning: boolean }
      }
    }
  }
}

export function createGame(parent: HTMLElement): Phaser.Game {
  window.__xiuxian = { bus }
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
