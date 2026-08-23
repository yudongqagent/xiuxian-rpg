/** INV-4：炼丹纯函数（材料消耗与产出）。物品存在性由调用方 lookup 保证。 */
import { addItem, removeItem, type PlayerState } from './player'
import type { Recipe } from './schemas'

export interface CraftResult {
  player: PlayerState
  ok: boolean
  reason?: 'missing'
}

export function missingInputs(
  p: PlayerState,
  recipe: Recipe,
): Array<{ item: string; need: number; have: number }> {
  return recipe.inputs
    .map((i) => ({ item: i.item, need: i.count, have: p.inventory[i.item] ?? 0 }))
    .filter((r) => r.have < r.need)
}

export function canCraft(p: PlayerState, recipe: Recipe): boolean {
  return missingInputs(p, recipe).length === 0
}

/** 合成：材料足够时消耗 inputs 并发放 output（数量叠加进背包） */
export function craft(p: PlayerState, recipe: Recipe): CraftResult {
  if (!canCraft(p, recipe)) return { player: p, ok: false, reason: 'missing' }
  let next = p
  for (const i of recipe.inputs) next = removeItem(next, i.item, i.count)
  next = addItem(next, recipe.output.item, recipe.output.count)
  return { player: next, ok: true }
}
