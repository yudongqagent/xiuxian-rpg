/**
 * 坊市物价纯函数（INV-5/GDD §3）。
 * 独立于 shop.ts：shop.ts 用 Vite glob 装载商店表，Node 侧 sandbox-sim 直接喂入商店表，
 * 二者共用这里的价格推导，保证浏览器/Node 两套口径一致。
 */
import { buyPriceFactor, sellPriceFactor } from './worldEvents'

export interface MarketWare {
  item: string
  price: number
}

export interface MarketStocks {
  [shopId: string]: { wares: MarketWare[] }
}

/** 卖价：该物品在任一商店最高五折；无商店挂售则底价 1 灵石。风评系数联动（世界 events 钳 0.7~1.3） */
export function bestSellPrice(stocks: MarketStocks, itemId: string, reputation = 0): number {
  let best = 1
  for (const shop of Object.values(stocks)) {
    for (const ware of shop.wares) {
      if (ware.item === itemId) best = Math.max(best, Math.ceil(ware.price / 2))
    }
  }
  return Math.max(1, Math.round(best * sellPriceFactor(reputation)))
}

/** 买价：商店标价经风评系数折算（负风评买贵），灵石保底价另由调用方约束 */
export function applyBuyPrice(price: number, reputation = 0): number {
  return Math.max(1, Math.round(price * buyPriceFactor(reputation)))
}