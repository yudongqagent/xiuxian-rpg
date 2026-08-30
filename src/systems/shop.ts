/** INV-5：商店库存表（Vite glob）与卖价推导。 */
import type { Shop } from './schemas'
import { buyPriceFactor, sellPriceFactor } from './worldEvents'

const entries = Object.entries(
  import.meta.glob('../../content/shops/*.json', { eager: true }) as Record<string, unknown>,
)

export const STOCKS: Record<string, Shop> = {}
for (const [path, raw] of entries) {
  const id = path.split('/').pop()!.replace(/\.json$/, '')
  try {
    const o = raw as Record<string, unknown>
    STOCKS[String(o['id'] ?? id)] = {
      id: String(o['id'] ?? id),
      name: String(o['name'] ?? id),
      wares: (o['wares'] as Shop['wares']) ?? [],
    }
  } catch (e) {
    console.error(`[shop] 商店解析失败: ${id}`, e)
  }
}

export function getStock(npcId: string): Shop | undefined {
  return STOCKS[npcId]
}

/** 卖价：该物品在任一商店有售价则按五折，否则底价 1 灵石。
 *  V1.4 风评联动：负风评卖贱（GDD §3 声望→坊市物价） */
export function sellPrice(itemId: string, reputation = 0): number {
  let best = 1
  for (const shop of Object.values(STOCKS)) {
    for (const ware of shop.wares) {
      if (ware.item === itemId) best = Math.max(best, Math.ceil(ware.price / 2))
    }
  }
  return Math.max(1, Math.round(best * sellPriceFactor(reputation)))
}

/** V1.4 买价：商店标价经风评系数折算（负风评买贵） */
export function buyPrice(price: number, reputation = 0): number {
  return Math.max(1, Math.round(price * buyPriceFactor(reputation)))
}
