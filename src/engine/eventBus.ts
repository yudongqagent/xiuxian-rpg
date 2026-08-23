import type { JoystickVector } from './joystickTypes'
import type { QuestSaveData, QuestStatus } from '../systems/quests'

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
  /** 战斗收尾：win=胜利；false 含战败与逃跑；enemyId 由战斗面板回传（任务击杀目标用） */
  'battle:end': { win: boolean; fled?: boolean; enemyId?: string }
  /** 进入新地图：name 供区域横幅，regionId 供任务到达类目标 */
  'area:enter': { name: string; regionId?: string }
  /** 物品入包（拾取/掉落/奖励统一入口），count 缺省为 1 */
  'item:acquired': { itemId: string; count?: number }
  /** 玩家成长状态变化（等级/经验/血灵），HUD 重读 store */
  'player:stats': void
  /** 任务状态迁移通知 */
  'quest:updated': { questId: string; status: QuestStatus }
  /** 任务提示 toast */
  'quest:notify': { text: string; kind?: 'info' | 'success' }
  /** 接取任务请求 */
  'quest:offer': { questId: string }
  /** 交付任务请求 */
  'quest:turnin': { questId: string }
  /** 经验产出（成长系统接入前由任务奖励发出） */
  'reward:exp': { expQi: number }
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
