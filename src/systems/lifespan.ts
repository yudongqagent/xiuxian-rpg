/**
 * 寿元系统（V1.5，REDESIGN §7.1 + GDD §2 境界寿元表）。
 * 推进模型＝世界历法驱动：60 游戏日 = 1 岁（与 time.ts yearOf 同源），寿元推进不可回退。
 * 纯函数：境界→寿元 / 世界历年龄 / 剩余年限 / 大限「无望」判定 / 闭关参悟修为。
 * 规则（V1.5 定案）：寿元耗尽＝此世终结（多结局之一，不删档不续命）；
 *   大境界硬锁＝剩余不足半寿时突破失败即此世无望；
 *   打坐参悟按原著需漫长岁月，闭关可一键跳过（等待快进，岁月流逝即寿元消耗）；
 *   道具功法可加速冲刺，从而节省寿元（现有丹药/筑基丹即突破加速）。
 * 末尾附可订阅 aging 存储（同 worldEvents 风评做法），持久化由 WorldScene 入档。
 */
import { grantExp, type PlayerState } from './player'
import { DAYS_PER_YEAR } from './time'

/** 出身年龄：凡人少年入山（V1.5 锚，呼应 GDD §2 凡人 ~80 的可观余量） */
export const INIT_AGE = 22

/** 大境界寿元上限（GDD §2 表）：凡人~80 / 炼气~120 / 筑基~200 / 结丹~400 / 元婴~800 / 化神~1500 */
export function lifespanAt(level: number): number {
  if (level <= 13) return 120
  if (level <= 16) return 200
  if (level <= 20) return 400
  if (level <= 24) return 800
  return 1500
}

/** 世界历年龄：自 60 游戏日折一岁（与 yearOf 同一日历源），寿元推进不可回退 */
export function ageOf(day: number): number {
  return INIT_AGE + Math.floor(Math.max(0, day - 1) / DAYS_PER_YEAR)
}

/** 剩余年限 = 寿元上限 - 当前年龄（≤ 0 即寿元耗尽，此世终结） */
export function remainingYears(level: number, day: number): number {
  return lifespanAt(level) - ageOf(day)
}

/** 寿元耗尽：剩余年限 ≤ 0（多结局之一「寿尽而终」） */
export function lifespanExhausted(level: number, day: number): boolean {
  return remainingYears(level, day) <= 0
}

/** 破境无望判定（V1.5 硬锁）：剩余年限不足半寿 → 突破失败即此世无望（续命不可逆） */
export function hopelessRemaining(level: number, day: number): boolean {
  return remainingYears(level, day) < lifespanAt(level) / 2
}

/** 闭关参悟修为（V1.5 锚）：1 月 ≈ 4 修为 × 灵气密度 → 纯闭关约四十载方达炼气十三圆满（原著苦修感） */
export const MEDITATE_EXP_PER_MONTH = 4

/** 闭关参悟 n 个月（纯函数）：修为入账（遵守圆满门限），返回本段修为增额 */
export function cultivateMonths(
  p: PlayerState,
  months: number,
  qiDensity: number,
  expPerMonth = MEDITATE_EXP_PER_MONTH,
): { player: PlayerState; expGain: number } {
  const amount = Math.max(0, Math.round(months * expPerMonth * qiDensity))
  return { player: grantExp(p, amount).player, expGain: amount }
}

export interface AgingState {
  /** 此世已无望的大境界名（硬锁：破境失败且剩余不足半寿时写入，续命不可逆） */
  lockedRealms: string[]
  /** 寿元已耗尽，此世已终结（终局状态，防止重复触发） */
  ended: boolean
}

export function createAgingState(): AgingState {
  return { lockedRealms: [], ended: false }
}

export function lockRealm(s: AgingState, realm: string): AgingState {
  return s.lockedRealms.includes(realm) ? s : { ...s, lockedRealms: [...s.lockedRealms, realm] }
}

export function isRealmLocked(s: AgingState, realm: string): boolean {
  return s.lockedRealms.includes(realm)
}

export function markEnded(s: AgingState): AgingState {
  return s.ended ? s : { ...s, ended: true }
}

// ---- aging 可订阅存储（供 UI 跨组件共享；持久化由 WorldScene 入档） ----
type Listener = () => void
const listeners = new Set<Listener>()
let current: AgingState = createAgingState()

export function getAging(): AgingState {
  return current
}

export function setAging(next: AgingState): void {
  current = next
  listeners.forEach((fn) => fn())
}

export function subscribeAging(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}