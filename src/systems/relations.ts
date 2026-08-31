/**
 * 关系图雏形（V1.3，REDESIGN §6.2）→ 恩仇系统（V2.1，REDESIGN §6.1）。
 * 纯函数：好感/记恨的写回与读取 + 恩仇类型推导，供 WorldScene 运行时 + sandbox-sim 回归共用。
 * 写回规则：玩家偷摘被目击 → 记恨+1 好感-2；送礼 → 好感+8（七日内重复送只+1，防刷）。
 * 恩仇类型：记恨 ≥4 结怨(rival)、≥8 成仇(enemy)；好感 ≥30 欠情(debt)、≥60 为师(mentor)。
 * 口味锚：记恨 1-2 口头不满，3+ 告发（V1.4 事件「杂役院失窃」入口），阈值成就 → 事件风暴（报恩/寻仇）。
 */
import type { WorldTimeData } from './time'
import { SHICHEN_NAMES } from './time'
import type { NpcRelationState, RelationType } from './time'

export type NpcRelationsState = Record<string, NpcRelationState>

export function createNpcRelationsState(): NpcRelationsState {
  return {}
}

/** 单次偷摘导致的记恨增量（V1.3 验收：张二在辰时看到偷摘 → 记恨+1） */
export const GRUDGE_PER_THEFT = 1
/** 单次偷摘连带的好感折损（V2.1：偷摘伤感情） */
export const AFFINITY_PER_THEFT = -2
/** 首礼/间隔七日后全量好感（V2.1 送礼写回） */
export const GIFT_AFFINITY_FRESH = 8
/** 七日内重复送礼只记薄情 */
export const GIFT_AFFINITY_REPEAT = 1
/** 送礼好感衰减窗口（世界日） */
export const GIFT_GRACE_DAYS = 7
/** 结仇阈值：记恨 ≥ 此值 → enemy */
export const ENMITY_GRUDGE = 8
/** 结怨阈值：记恨 ≥ 此值 → rival */
export const RIVAL_GRUDGE = 4
/** 师恩阈值：好感 ≥ 此值 → mentor */
export const MENTOR_AFFINITY = 60
/** 情债阈值：好感 ≥ 此值 → debt */
export const DEBT_AFFINITY = 30

const clampAffinity = (v: number): number => Math.max(-100, Math.min(100, Math.round(v)))
const clampGrudge = (v: number): number => Math.max(0, Math.min(100, Math.round(v)))

/** 恩仇类型推导（V2.1）：仇重于恩，记恨优先判定；无达标面回退 undefined */
export function relationTypeFor(rel: { affinity: number; grudge: number }): RelationType | undefined {
  if (rel.grudge >= ENMITY_GRUDGE) return 'enemy'
  if (rel.grudge >= RIVAL_GRUDGE) return 'rival'
  if (rel.affinity >= MENTOR_AFFINITY) return 'mentor'
  if (rel.affinity >= DEBT_AFFINITY) return 'debt'
  return undefined
}

/** 对某 NPC 写回一次关系变化：好感/记恨按增量叠加并钳制，恩仇类型随阈值自动推导 */
export function bumpRelation(
  state: NpcRelationsState,
  npcId: string,
  delta: Partial<NpcRelationState>,
): NpcRelationsState {
  const cur = state[npcId] ?? { affinity: 0, grudge: 0 }
  const affinity = clampAffinity(cur.affinity + (delta.affinity ?? 0))
  const grudge = clampGrudge(cur.grudge + (delta.grudge ?? 0))
  return {
    ...state,
    [npcId]: {
      affinity,
      grudge,
      type: delta.type ?? relationTypeFor({ affinity, grudge }),
      lastGiftDay: delta.lastGiftDay ?? cur.lastGiftDay,
    },
  }
}

/** 读取某 NPC 对玩家的关系（缺省中性） */
export function relationOf(state: NpcRelationsState, npcId: string): NpcRelationState {
  return state[npcId] ?? { affinity: 0, grudge: 0 }
}

/** V2.1 送礼好感结算：同 NPC 七日内再送只记薄礼（+1），首礼/间隔满七日全量（+8） */
export function giftAffinityGain(
  rel: NpcRelationState | undefined,
  today: number,
): { affinity: number; fresh: boolean } {
  const last = rel?.lastGiftDay
  const fresh = last === undefined || today - last >= GIFT_GRACE_DAYS
  return fresh
    ? { affinity: GIFT_AFFINITY_FRESH, fresh: true }
    : { affinity: GIFT_AFFINITY_REPEAT, fresh: false }
}

/**
 * NPC 日程查表（REDESIGN §6.2「位置 = 日程表查表」）。
 * schedule: 时辰名 → [x, y]；取当前时辰；缺省该时辰取上一时辰点位；
 * 若完全无匹配（无 schedule 或 schedule 为空），返回 null（由调用方回退到 npcPlacements 静态站位）。
 */
export function npcSpotAt(
  schedule: Partial<Record<(typeof SHICHEN_NAMES)[number], [number, number]>> | null | undefined,
  t: WorldTimeData,
): { x: number; y: number } | null {
  if (!schedule) return null
  const ranked = Object.entries(schedule)
    .map(([name, pos]) => ({ idx: SHICHEN_NAMES.indexOf(name as (typeof SHICHEN_NAMES)[number]), pos }))
    .filter((e) => e.idx >= 0 && !!e.pos)
    .sort((a, b) => a.idx - b.idx)
  if (ranked.length === 0) return null
  let spot: { x: number; y: number } | null = null
  for (const { idx, pos } of ranked) {
    if (idx > t.shichen) break
    spot = { x: pos[0], y: pos[1] }
  }
  return spot
}