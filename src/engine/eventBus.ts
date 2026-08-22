import type { JoystickVector } from './joystickTypes'

type GameEvents = {
  /** 摇杆输入向量，长度 0~1 */
  'joystick:move': JoystickVector
  'joystick:end': void
  'ui:toggle-inventory': void
  'inventory:changed': string[]
  'player:position': { x: number; y: number }
  'dialogue:open': { npcId: string }
  'dialogue:close': void
  /** 世界层触发遭遇，enemyId 对应 content/enemies/<id>.json */
  'battle:start': { enemyId: string }
  /** UI 层玩家指令 */
  'battle:action': 'attack' | 'skill' | 'flee'
  /** 战斗收尾：win=胜利；false 含战败与逃跑 */
  'battle:end': { win: boolean }
  /** 进入新地图，UI 层展示区域名横幅 */
  'area:enter': { name: string }
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
