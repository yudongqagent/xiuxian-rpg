/**
 * 事件风暴（V1.4，REDESIGN §6.1 首例「杂役院失窃」）。
 * 纯函数：旷工计数 / 条件求值 / 后果结算，供 WorldScene 运行时 + sandbox-sim 回归共用。
 * 正文案/阈值全部来自 content/events/*.json（配置化内容，validate 校验引用）。
 * 末尾附极小的可订阅风评存储（同 player.ts 做法），供 ShopPanel 展示与价格联动。
 */
import type { NpcRelationsState } from './relations'
import { relationOf } from './relations'
import type { WorldEvent } from './schemas'

/**
 * 事件表：由 worldEventLoader（浏览器，Vite glob）填充。
 * tsx(Node) 下不加载 glob（sandbox-sim 用纯函数自夹具回归）。
 */
export const WORLD_EVENTS: WorldEvent[] = []

export function registerWorldEvent(ev: WorldEvent): void {
  if (!WORLD_EVENTS.some((e) => e.id === ev.id)) WORLD_EVENTS.push(ev)
}

export function getWorldEvent(id: string): WorldEvent | undefined {
  return WORLD_EVENTS.find((e) => e.id === id)
}

/** 旷工计数：自最后一次在杂役院采药（上工）至今日的间隔日数（纯函数）。 */
export function absentWorkDays(lastWorkDay: number | undefined, today: number): number {
  return lastWorkDay === undefined ? today - 1 : Math.max(0, today - lastWorkDay)
}

export interface EventContext {
  /** 当前世界日（from getWorldTime().day） */
  day: number
  /** 最后一次杂役院上工日（undefined 表示从未出勤，自第 1 日起旷工） */
  lastWorkDay: number | undefined
  relations: NpcRelationsState
}

/** 事件条件求值：旷工≥threshold 且 grudgeOf 的记恨 > grudgeAt（纯函数） */
export function eventTriggered(ev: WorldEvent, ctx: EventContext): boolean {
  if (absentWorkDays(ctx.lastWorkDay, ctx.day) < ev.trigger.absentDays) return false
  return relationOf(ctx.relations, ev.trigger.grudgeOf).grudge > ev.trigger.grudgeAt
}

export interface EventConsequences {
  lingshiDelta: number
  reputationDelta: number
}

/** 后果结算（纯函数）：返回灵石/风评增量（灵石扣罚为负；风评可为正负） */
export function resolveConsequences(ev: WorldEvent): EventConsequences {
  return {
    lingshiDelta: -ev.consequences.lingshi,
    reputationDelta: ev.consequences.reputation,
  }
}

/** 坊市风评文本（GDD §3 声望→坊市物价），供 HUD/商店顶栏展示 */
export function reputationLabel(reputation: number): string {
  if (reputation >= 60) return '坊市青睐'
  if (reputation >= 20) return '口碑尚佳'
  if (reputation > -20) return '不温不火'
  if (reputation > -60) return '风评受损'
  return '声名狼藉'
}

/** 风评->买价系数：负风评买贵（钳 [0.7,1.3]，1 灵石保底价另行处理） */
export function buyPriceFactor(reputation: number): number {
  return clamp(1 - reputation / 250, 0.7, 1.3)
}

/** 风评->卖价系数：负风评卖贱（钳 [0.7,1.3]） */
export function sellPriceFactor(reputation: number): number {
  return clamp(1 + reputation / 250, 0.7, 1.3)
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

// ---- 风评可订阅存储（供 UI 跨组件共享；持久化由 WorldScene 入档） ----
const REPUTATION_MIN = -100
const REPUTATION_MAX = 100

type Listener = () => void
const listeners = new Set<Listener>()
let current: number = 0

export function getReputation(): number {
  return current
}

export function setReputation(next: number): void {
  current = Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, Math.round(next)))
  listeners.forEach((fn) => fn())
}

export function subscribeReputation(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}