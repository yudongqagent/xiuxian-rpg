/**
 * 时间轴核心（V0.1，REDESIGN §6.1）。
 * 世界时刻：时辰(1/8日) → 日 → 月 → 季节 → 年。
 * 纯函数负责推导/变换；末尾附极小的可订阅存储供 UI 层跨组件共享，做法同 player.ts。
 * 时间推进由世界层驱动（真实秒换算 + 动作成本），本模块不依赖 Phaser。
 */

export const SHICHEN_PER_DAY = 8
/** 现实 60 秒 ≈ 游戏内一个时辰（REDESIGN：一个时辰约现实 1 分钟） */
export const REAL_SECONDS_PER_SHICHEN = 60
/** 移动成本锚点：行走 40 格 ≈ 1 时辰（地图穿行级时间成本，REDESIGN §6.1） */
export const TILES_PER_SHICHEN = 40
export const DAYS_PER_SEASON = 15
export const SEASONS = ['春', '夏', '秋', '冬'] as const
/** 1 年 = 4 季 = 60 游戏日（世界历，V1.5 寿元也以此为 1 岁） */
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS.length
/** 游戏内时辰显示名（取传统十二时辰之八，覆盖昼夜） */
export const SHICHEN_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未'] as const

export interface WorldTimeData {
  /** 第几天，从 1 开始 */
  day: number
  /** 当日第几个时辰（0..SHICHEN_PER_DAY-1） */
  shichen: number
}

export interface WorldSnapshot {
  /** 世界时间轴 */
  time: WorldTimeData
  /** 2.0 采集点再生进度（V1.2）：mapId → pointId → 下次可采绝对时辰；缺省整图为可采 */
  gather?: Record<string, Record<string, number>>
  /** 关系图雏形（V1.3）：npcId → 好感/记恨（REDESIGN §6.2） */
  relations?: Record<string, NpcRelationState>
  /** 事件风暴（V1.4）：已触发且结算的事件 id（once 事件防重复；REDESIGN §6.1） */
  events?: string[]
  /** 事件风暴（V1.4）：杂役上工记录（最后采药日），旷工计数锚 */
  labor?: { lastWorkDay?: number }
  /** 坊市风评（V1.4，GDD §3 声望→坊市物价）：-100..100，默认 0 */
  reputation?: number
  /** 寿元（V1.5）：大境界硬锁/此世终结；推进由世界历驱动，无需存年龄 */
  aging?: { lockedRealms?: string[]; ended?: boolean }
  /** NPC 世界级生命周期（V2.2）：npcId → 出生日/当前修炼层数；世界历推进即修炼 */
  npcs?: Record<string, { bornDay: number; level: number }>
  /** NPC 坐化登记（V2.2）：已陨落 NPC（once 防重复，重载不重播） */
  npcPassed?: string[]
  // V2 扩：eventQueue / regionStates / seenHints / fog
}

/** 恩仇类型（V2.1，GDD §6 关系 → 恩仇）：由好感/记恨阈值推导，bumpRelation 自动维护 */
export type RelationType = 'mentor' | 'rival' | 'debt' | 'spouse' | 'enemy'

/** 单个 NPC 对玩家的关系状态（好感为正、记恨为负；V1.3 窗口见三角形箭头标注；V2.1 恩仇类型） */
export interface NpcRelationState {
  /** 好感 -100..100 */
  affinity: number
  /** 记恨 0..100 */
  grudge: number
  /** 恩仇类型（V2.1，REDESIGN §6.1）：仇重于恩——记恨够深即盖过旧恩 */
  type?: RelationType
  /** 最近一次送礼的世界日（V2.1：同 NPC 七日内重复送礼只记薄情，防刷好感） */
  lastGiftDay?: number
}

export function createWorldTime(): WorldTimeData {
  return { day: 1, shichen: 0 }
}

/** 纯函数：推进 n 个时辰（可为负），跨日进位、跨日回退均合法 */
export function advanceTime(t: WorldTimeData, shichen: number): WorldTimeData {
  const total = (t.day - 1) * SHICHEN_PER_DAY + t.shichen + shichen
  const day = Math.floor(total / SHICHEN_PER_DAY) + 1
  const s = ((total % SHICHEN_PER_DAY) + SHICHEN_PER_DAY) % SHICHEN_PER_DAY
  return { day, shichen: s }
}

export function shichenName(t: WorldTimeData): string {
  return SHICHEN_NAMES[t.shichen] ?? String(t.shichen)
}

export function seasonIndex(t: WorldTimeData): number {
  return Math.floor((t.day - 1) / DAYS_PER_SEASON) % SEASONS.length
}

export function seasonName(t: WorldTimeData): string {
  return SEASONS[seasonIndex(t)]
}

export function dayOfSeason(t: WorldTimeData): number {
  return ((t.day - 1) % DAYS_PER_SEASON) + 1
}

/** 第几年（游戏历，从 1 起） */
export function yearOf(t: WorldTimeData): number {
  return Math.floor((t.day - 1) / (DAYS_PER_SEASON * SEASONS.length)) + 1
}

export function timeLabel(t: WorldTimeData): string {
  return `${shichenName(t)}时 · 第${t.day}日 · ${seasonName(t)} · 第${yearOf(t)}年`
}

/** 移动时间成本：行走 n 格折算时辰数（锚 TILES_PER_SHICHEN，纯函数便于 G3b 回归） */
export function tilesToShichen(tiles: number): number {
  return Math.max(0, Math.floor(tiles / TILES_PER_SHICHEN))
}

export function toWorldSnapshot(t: WorldTimeData): WorldSnapshot {
  return { time: { ...t } }
}

/** 旧档缺省/非法时兜底为开局时间；只认数字字段（向后兼容） */
export function fromWorldSnapshot(snapshot: WorldSnapshot | undefined): WorldTimeData {
  const t = snapshot?.time
  if (!t) return createWorldTime()
  const day = Number.isFinite(t.day) && t.day >= 1 ? Math.floor(t.day) : 1
  const shichen =
    Number.isFinite(t.shichen) && t.shichen >= 0 && t.shichen < SHICHEN_PER_DAY
      ? Math.floor(t.shichen)
      : 0
  return { day, shichen }
}

type Listener = () => void
const listeners = new Set<Listener>()
let current: WorldTimeData = createWorldTime()

export function getWorldTime(): WorldTimeData {
  return current
}

export function setWorldTime(next: WorldTimeData): void {
  current = { ...next }
  listeners.forEach((fn) => fn())
}

export function advanceWorldTime(shichen: number): void {
  setWorldTime(advanceTime(current, shichen))
}

export function subscribeWorldTime(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}