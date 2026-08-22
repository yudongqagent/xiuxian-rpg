import type { JoystickVector } from './joystickTypes'

type GameEvents = {
  /** 摇杆输入向量，长度 0~1 */
  'joystick:move': JoystickVector
  'joystick:end': void
  'ui:toggle-inventory': void
  'inventory:changed': string[]
  'player:position': { x: number; y: number }
}

/** Vue UI 与 Phaser 世界之间唯一通信通道 */
export const bus = new (class {
  private m = new Map<keyof GameEvents, Set<(p: never) => void>>()
  on<K extends keyof GameEvents>(k: K, fn: (p: GameEvents[K]) => void): () => void {
    if (!this.m.has(k)) this.m.set(k, new Set())
    this.m.get(k)!.add(fn as never)
    return () => this.m.get(k)?.delete(fn as never)
  }
  emit<K extends keyof GameEvents>(k: K, p?: GameEvents[K]): void {
    this.m.get(k)?.forEach((fn) => fn(p as never))
  }
})()
