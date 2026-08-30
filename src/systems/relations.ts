/**
 * 关系图雏形（V1.3，REDESIGN §6.2）。
 * 纯函数：好感/记恨的写回与读取，供 WorldScene 运行时 + sandbox-sim 回归共用。
 * 写回规则：玩家在 NPC 目击半径内偷摘（采集）→ 记恨 +1（张二盯梢药园）。
 * 口味锚：记恨 1-2 口头不满，3+ 告发（V1.4 事件「杂役院失窃」入口），5+ 结仇。
 */
import type { WorldTimeData } from './time'
import { SHICHEN_NAMES } from './time'
import type { NpcRelationState } from './time'

export type NpcRelationsState = Record<string, NpcRelationState>

export function createNpcRelationsState(): NpcRelationsState {
  return {}
}

/** 单次偷摘导致的记恨增量（V1.3 验收：张二在辰时看到偷摘 → 记恨+1） */
export const GRUDGE_PER_THEFT = 1

const clampAffinity = (v: number): number => Math.max(-100, Math.min(100, Math.round(v)))
const clampGrudge = (v: number): number => Math.max(0, Math.min(100, Math.round(v)))

/** 对某 NPC 写回一次关系变化：好感/记恨均按增量叠加并钳制 */
export function bumpRelation(
  state: NpcRelationsState,
  npcId: string,
  delta: Partial<NpcRelationState>,
): NpcRelationsState {
  const cur = state[npcId] ?? { affinity: 0, grudge: 0 }
  return {
    ...state,
    [npcId]: {
      affinity: clampAffinity(cur.affinity + (delta.affinity ?? 0)),
      grudge: clampGrudge(cur.grudge + (delta.grudge ?? 0)),
    },
  }
}

/** 读取某 NPC 对玩家的关系（缺省中性） */
export function relationOf(state: NpcRelationsState, npcId: string): NpcRelationState {
  return state[npcId] ?? { affinity: 0, grudge: 0 }
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