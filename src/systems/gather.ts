/**
 * 采集点规则（V1.2，REDESIGN §5.1）。
 * 纯函数：可采判断与再生标记，供 WorldScene 运行时 + sandbox-sim 回归共用。
 * 再生按「绝对时辰索引」推进，可与时间轴跨日/跨季节推进解耦。
 */
import type { MapGatherPoint } from './schemas'
import type { WorldTimeData } from './time'
import { SHICHEN_PER_DAY } from './time'

/** 绝对时辰索引：day(1-based)×8 + 当日时辰，单调递增，作再生时间轴 */
export function absoluteShichen(t: WorldTimeData): number {
  return (t.day - 1) * SHICHEN_PER_DAY + t.shichen
}

/**
 * 采集点世界状态：pointId → 下次可采的绝对时辰索引。
 * 缺失/值 ≤ 当前时辰 = 可采；值 > 当前时辰 = 再生中。
 */
export interface GatherWorldState {
  /** mapId → pointId → 下次可采绝对时辰 */
  byMap: Record<string, Record<string, number>>
}

export function createGatherWorldState(): GatherWorldState {
  return { byMap: {} }
}

export function gatherPointById(map: { gather: MapGatherPoint[] }, id: string): MapGatherPoint | undefined {
  return map.gather.find((g) => g.id === id)
}

/** 某采集点此刻是否可采（缺省状态即可采） */
export function isGatherAvailable(state: GatherWorldState, mapId: string, pointId: string, t: WorldTimeData): boolean {
  const availableAt = state.byMap[mapId]?.[pointId] ?? 0
  return availableAt <= absoluteShichen(t)
}

/** 采集一次：返回新世界状态（标记再生），并回吐对应采集点（供图层刷新） */
export function gatherAt(
  state: GatherWorldState,
  mapId: string,
  pointId: string,
  regenShichen: number,
  t: WorldTimeData,
): GatherWorldState {
  const byMap = { ...state.byMap }
  const mapState = { ...(byMap[mapId] ?? {}) }
  mapState[pointId] = absoluteShichen(t) + regenShichen
  byMap[mapId] = mapState
  return { byMap }
}