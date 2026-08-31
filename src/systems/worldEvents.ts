/**
 * 事件风暴（V1.4，REDESIGN §6.1 首例「杂役院失窃」）→ 恩仇风暴（V2.1 报恩/寻仇）。
 * 纯函数：旷工计数 / 条件求值 / 后果结算，供 WorldScene 运行时 + sandbox-sim 回归共用。
 * 正文案/阈值全部来自 content/events/*.json（配置化内容，validate 校验引用）。
 * V2.1：trigger 三族条件（旷工/记恨/好感）可任意组合叠加，consequences 可算灵石周济与关系清算。
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

/** 事件条件求值（纯函数）：旷工≥threshold；记恨 > grudgeAt；好感 ≥ affinityAt；族人条件可组合叠加 */
export function eventTriggered(ev: WorldEvent, ctx: EventContext): boolean {
  const tr = ev.trigger
  const conds: boolean[] = []
  if (tr.absentDays !== undefined) conds.push(absentWorkDays(ctx.lastWorkDay, ctx.day) >= tr.absentDays)
  if (tr.grudgeOf !== undefined && tr.grudgeAt !== undefined) {
    conds.push(relationOf(ctx.relations, tr.grudgeOf).grudge > tr.grudgeAt)
  }
  if (tr.affinityOf !== undefined && tr.affinityAt !== undefined) {
    conds.push(relationOf(ctx.relations, tr.affinityOf).affinity >= tr.affinityAt)
  }
  if (conds.length === 0) return false
  return conds.every(Boolean)
}

export interface EventConsequences {
  /** 扣灵石（负值，来自 consequences.lingshi） */
  lingshiDelta: number
  /** 赠灵石（正值，V2.1 报恩来自 consequences.grantLingshi） */
  grantLingshiDelta: number
  /** 坊市风评变化 */
  reputationDelta: number
  /** 关系清算（V2.1）：对某 NPC 扭转好感/记恨（寻仇清记恨、报恩还人情） */
  relationsDelta?: { npcId: string; affinityDelta?: number; grudgeDelta?: number }
}

/** 后果结算（纯函数）：返回灵石/风评增量与可选关系清算（灵石扣罚为负；风评可为正负） */
export function resolveConsequences(ev: WorldEvent): EventConsequences {
  return {
    lingshiDelta: -(ev.consequences.lingshi ?? 0),
    grantLingshiDelta: ev.consequences.grantLingshi ?? 0,
    reputationDelta: ev.consequences.reputation ?? 0,
    relationsDelta: ev.consequences.relations
      ? {
          npcId: ev.consequences.relations.npcId,
          affinityDelta: ev.consequences.relations.affinityDelta,
          grudgeDelta: ev.consequences.relations.grudgeDelta,
        }
      : undefined,
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