import type { JoystickVector } from './joystickTypes'
import type { QuestSaveData, QuestStatus } from '../systems/quests'
import type { WorldTimeData } from '../systems/time'

type GameEvents = {
  /** 摇杆输入向量，长度 0~1 */
  'joystick:move': JoystickVector
  'joystick:end': void
  'ui:toggle-inventory': void
  'inventory:changed': string[]
  'player:position': { x: number; y: number }
  'dialogue:open': { npcId: string }
  'dialogue:close': void
  /** 对话面板真实开/关状态（仅当 UI 确认打开后才冻结世界，防止无对话 NPC 软锁） */
  'dialogue:state': { open: boolean }
  /** 世界层触发遭遇，enemyId 对应 content/enemies/<id>.json */
  'battle:start': { enemyId: string }
  /** UI 层玩家指令 */
  'battle:action': 'attack' | 'skill' | 'flee'
  /** 战斗收尾：win=胜利；false 含战败与逃跑；enemyId 由战斗面板回传（任务击杀目标用） */
  'battle:opened': void
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
  /** INV-5：打开商店面板 */
  'shop:open': { npcId: string }
  /** ENG-5：手动存/读档（slot 为 s1/s2/s3） */
  'save:write': { slot: string }
  'save:load': { slot: string }
  /** 打坐吐纳：UI 请求切换；世界层回报状态与每跳恢复量（mult=区域灵气密度） */
  'meditate:toggle': void
  'meditate:state': { active: boolean; mult: number }
  'meditate:tick': { hp: number; qi: number; exp: number; mult: number }
  /** 自动寻路：请求世界层沿 BFS 路径走向当前任务目标 */
  'navigate:quest': void
  /** 自动寻路：走向指定图块（点击寻路的事件通道） */
  'navigate:tile': { x: number; y: number }
  /** 内容名称表懒加载完成（HUD 由此刷新「下一步」等含名称的派生文案） */
  'names:ready': void
  /** 2.0 时间轴：世界时刻变化（时辰/日/季节/年推进时广播，HUD 时钟刷新） */
  'time:state': WorldTimeData
  /** 寿元（V1.5）：闭关参悟一键跳过等待（世界层快进岁月并结算修为） */
  'meditate:seclude': void
  /** 寿元（V1.5）：突破失败且剩余不足半寿 → 该大境界此世无望（世界层入档硬锁） */
  'aging:lock': { realm: string }
  /** 寿元（V1.5）：寿元耗尽即此世终结（结局，世界层冻结世界时钟） */
  'aging:end': void
  /** 小地图数据：进入地图时发一次全量快照（图块行 + 静态点位，图块坐标） */
  'map:minimap': {
    rows: string[]
    player: { x: number; y: number }
    npcs: Array<{ x: number; y: number }>
    portals: Array<{ x: number; y: number; locked: boolean }>
  }
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
    this.m.get(k)?.forEach((fn) => {
      try {
        fn(p as never)
      } catch (e) {
        // 防御：单个监听器异常只记录，不中断其余流程（防软锁扩散）
        console.error(`[bus] 事件 ${String(k)} 的处理器异常`, e)
      }
    })
  }
})()
