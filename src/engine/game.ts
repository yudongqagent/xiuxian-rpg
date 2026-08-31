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
        portals: () => Array<{ tile: [number, number] }>
        garden: () => unknown
        gather: () => {
          points: Array<{ id: string; x: number; y: number; itemId: string }>
          availableAt: Record<string, number>
          now: number
        }
        navDirect: (tx: number, ty: number) => void
        npcs: () => Array<{ id: string; x: number; y: number }>
        relations: () => Record<string, unknown>
        'relations.bump': (npcId: string, delta: { affinity?: number; affine?: number; grudge?: number }) => void
        world: () => {
          events: string[]
          labor: { lastWorkDay?: number }
          reputation: number
          absentDays: number
          aging: { lockedRealms: string[]; ended: boolean }
          npcPassed: string[]
          seenWarnings: string[]
          _now: unknown
        }
        'battle.lose': () => void
        'npc.probe': (npcId: string) => string
        'npc.insight': (npcId: string) =>
          | {
              realm: string
              level: number
              base: number
              cap: number
              lifespanYear: number
              bornYear: number
            }
          | null
        'rng.force': (v: number | null) => void
        'realm.set': (level: number) => void
        flags: () => { dialogueOpen: boolean; battleActive: boolean; transitioning: boolean }
        time: { get: () => unknown; advance: (shichen: number) => void; set: (day: number, shichen: number) => void }
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
