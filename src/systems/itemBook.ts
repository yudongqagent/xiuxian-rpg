/** INV-3：全量物品表（Vite glob），供背包/战斗/HUD 共享。 */
import { ItemSchema, type Item } from './schemas'

const entries = Object.entries(
  import.meta.glob('../../content/items/*.json', { eager: true }) as Record<string, unknown>,
)

export const ITEMS: Record<string, Item> = {}
for (const [path, raw] of entries) {
  const id = path.split('/').pop()!.replace(/\.json$/, '')
  try {
    ITEMS[id] = ItemSchema.parse(raw)
  } catch (e) {
    console.error(`[items] 物品模板解析失败: ${id}`, e)
  }
}

export function getItem(id: string): Item | undefined {
  return ITEMS[id]
}
