/**
 * NPC 世界级生命周期与日程情报（V2.2，REDESIGN §6.2）。
 * 纯函数：日程打探文案（可被人窥探的钟表逻辑）、NPC 修炼层数随世界历演进、寿元大限坐化判定。
 * 供 WorldScene 运行时 + sandbox-sim 回归共用；contentNames(glob) 不在此依赖。
 * 免疫死亡：未配置 cultivate 的 NPC（剧情锚）永存，满足 §6.1「关键剧情 NPC 免疫死亡」。
 */
import type { NpcSchedule } from './schemas'
import { DAYS_PER_YEAR, SHICHEN_NAMES } from './time'

export interface NpcCultivateCfg {
  realm: string
  level: number
  cap: number
  lifespanYears: number
  growthYears?: number
}

/** 修炼升级间隔（世界年，缺省值） */
export const DEFAULT_GROWTH_YEARS = 5

/** NPC 修炼层数随世界历演进（纯函数）：自出生日每 growthYears 年升 1 层，封顶 cap */
export function cultivateLevelOnDay(cult: NpcCultivateCfg, bornDay: number, day: number): number {
  const per = (cult.growthYears ?? DEFAULT_GROWTH_YEARS) * DAYS_PER_YEAR
  return Math.min(cult.cap, cult.level + Math.floor(Math.max(0, day - bornDay) / per))
}

/** 寿元大限判定（纯函数）：第 lifespanYears 年年初（世界日 ≥ 出生日 + (lifespanYears-1) 载）起坐化 */
export function passedAwayOnDay(cult: NpcCultivateCfg, bornDay: number, day: number): boolean {
  return day >= bornDay + (cult.lifespanYears - 1) * DAYS_PER_YEAR
}

/** 境界大限年份（出生年为 1）：第 bornYear + lifespanYears - 1 年起坐化 */
export function lifespanYearOf(cult: NpcCultivateCfg, bornYear: number): number {
  return bornYear + cult.lifespanYears - 1
}

/** 打探·日程概括（纯函数）：把时辰点位表折叠成白话；同日同点断续时用 / 分段 */
export function scheduleSummary(schedule: NpcSchedule | undefined | null): string {
  if (!schedule || Object.keys(schedule).length === 0) return '行踪不定，常驻故地'
  const spots = new Map<string, string[]>()
  const order: string[] = []
  for (const name of SHICHEN_NAMES) {
    const pos = schedule[name]
    if (!pos) continue
    const key = `${pos[0]},${pos[1]}`
    if (!spots.has(key)) {
      spots.set(key, [])
      order.push(key)
    }
    spots.get(key)!.push(name)
  }
  const segs = order.map((key) => {
    const [x, y] = key.split(',').map(Number) as [number, number]
    return `${succinct(spots.get(key)!, SHICHEN_NAMES)}在 (${x},${y})`
  })
  return segs.join('；')
}

/** 连续时辰折叠：子~寅/午~未 */
function succinct(names: string[], all: readonly string[]): string {
  const parts: string[] = []
  let s = 0
  for (let i = 1; i <= names.length; i++) {
    if (i === names.length || all.indexOf(names[i] as string) !== all.indexOf(names[i - 1] as string) + 1) {
      parts.push(names[s] === names[i - 1] ? (names[s] as string) : `${names[s] as string}~${names[i - 1] as string}`)
      s = i
    }
  }
  return parts.join('/')
}