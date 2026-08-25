/**
 * 掌天瓶药圃（GDD §1.1 探索驱动/碎片可玩）：
 * 神秘小瓶月光凝绿液（真实时间 30 分钟一滴，上限 5），绿液可催熟药圃灵植；
 * 灵植真实时间成熟（600 秒），采收得三倍药材——种药→催熟→炼丹的凡人流资本循环。
 * 纯函数 (input) => output；时间由调用方注入（Date.now()），便于测试与离线结算。
 */
import type { PlayerState } from './player'

export interface Plot {
  itemId: string
  plantedAt: number
}

export interface Garden {
  /** 药圃格子；null 为空 */
  plots: Array<Plot | null>
  /** 瓶中现有绿液滴数 */
  drops: number
  /** 上次绿液结算时间戳（ms） */
  bottleAt: number
}

export const BOTTLE_DROP_INTERVAL_MS = 30 * 60 * 1000
export const BOTTLE_DROPS_CAP = 5
export const GARDEN_PLOT_COUNT = 4
export const GROW_MS = 10 * 60 * 1000
export const HARVEST_YIELD = 3
export const GARDEN_SEED = 'qi_xie_ling_cao'

export function createGarden(now: number): Garden {
  return { plots: Array(GARDEN_PLOT_COUNT).fill(null), drops: 1, bottleAt: now }
}

/** 惰性结算瓶液：读取即按真实时间补滴（时钟回拨/读取滞后不倒扣） */
export function bottleDrops(garden: Garden, now: number): number {
  const elapsed = Math.max(0, now - garden.bottleAt)
  const gained = Math.floor(elapsed / BOTTLE_DROP_INTERVAL_MS)
  return Math.min(BOTTLE_DROPS_CAP, Math.max(0, garden.drops + gained))
}

export function settleBottle(garden: Garden, now: number): Garden {
  return { ...garden, drops: bottleDrops(garden, now), bottleAt: now }
}

export function isMature(plot: Plot, now: number): boolean {
  return now - plot.plantedAt >= GROW_MS
}

export function plantHerb(p: PlayerState, slot: number, now: number): { player: PlayerState; garden: Garden; ok: boolean } {
  const garden = p.garden ?? createGarden(now)
  const settled = settleBottle(garden, now)
  if (slot < 0 || slot >= GARDEN_PLOT_COUNT || settled.plots[slot]) {
    return { player: p, garden: settled, ok: false }
  }
  if ((p.inventory[GARDEN_SEED] ?? 0) < 1) return { player: p, garden: settled, ok: false }
  const inv = { ...p.inventory }
  inv[GARDEN_SEED] = (inv[GARDEN_SEED] ?? 0) - 1
  if (inv[GARDEN_SEED] <= 0) delete inv[GARDEN_SEED]
  const plots = [...settled.plots]
  plots[slot] = { itemId: GARDEN_SEED, plantedAt: now }
  return { player: { ...p, inventory: inv, garden: { ...settled, plots } }, garden: { ...settled, plots }, ok: true }
}

/** 绿液催熟：一滴催熟全部生长中的灵植（神秘小瓶之妙） */
export function ripenAll(p: PlayerState, now: number): { player: PlayerState; garden: Garden; ripened: number } {
  const garden = p.garden ?? createGarden(now)
  const settled = settleBottle(garden, now)
  if (settled.drops < 1) return { player: p, garden: settled, ripened: 0 }
  let ripened = 0
  const plots = settled.plots.map((plot) => {
    if (plot && !isMature(plot, now)) {
      ripened += 1
      return { ...plot, plantedAt: now - GROW_MS }
    }
    return plot
  })
  if (ripened === 0) return { player: p, garden: settled, ripened: 0 }
  return {
    player: { ...p, garden: { ...settled, plots, drops: settled.drops - 1, bottleAt: now } },
    garden: { ...settled, plots, drops: settled.drops - 1, bottleAt: now },
    ripened,
  }
}

export function harvestAll(
  p: PlayerState,
  now: number,
): { player: PlayerState; harvested: Record<string, number> } {
  const garden = p.garden ?? createGarden(now)
  const harvested: Record<string, number> = {}
  const plots = garden.plots.map((plot) => {
    if (plot && isMature(plot, now)) {
      harvested[plot.itemId] = (harvested[plot.itemId] ?? 0) + HARVEST_YIELD
      return null
    }
    return plot
  })
  if (Object.keys(harvested).length === 0) return { player: p, harvested }
  const inv = { ...p.inventory }
  for (const [id, count] of Object.entries(harvested)) {
    inv[id] = (inv[id] ?? 0) + count
  }
  return { player: { ...p, inventory: inv, garden: { ...garden, plots } }, harvested }
}

/** 药圃视图：供 UI 渲染（含剩余成熟毫秒数） */
export interface PlotView {
  itemId: string | null
  remainingMs: number
  mature: boolean
}

export function gardenView(garden: Garden, now: number): { drops: number; plots: PlotView[] } {
  return {
    drops: bottleDrops(garden, now),
    plots: garden.plots.map((plot) =>
      plot
        ? {
            itemId: plot.itemId,
            remainingMs: Math.max(0, GROW_MS - (now - plot.plantedAt)),
            mature: isMature(plot, now),
          }
        : { itemId: null, remainingMs: 0, mature: false },
    ),
  }
}
