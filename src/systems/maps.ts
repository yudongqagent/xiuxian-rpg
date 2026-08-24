import { GameMapSchema, WALKABLE_TILE_CHARS, type GameMap } from './schemas'

const modules = import.meta.glob('../../content/maps/*.json', {
  eager: true,
}) as Record<string, unknown>

const maps = new Map<string, GameMap>()
for (const data of Object.values(modules)) {
  const m = GameMapSchema.parse(data)
  maps.set(m.id, m)
}

export const DEFAULT_MAP_ID = 'qixuanmen'

export function getGameMap(id: string): GameMap {
  return maps.get(id) ?? maps.get(DEFAULT_MAP_ID)!
}

/** 全量地图（大地图面板用）；按内容文件名排序保证展示稳定 */
export function getAllMaps(): GameMap[] {
  return [...maps.values()].sort((a, b) => a.id.localeCompare(b.id))
}

export function tileAt(map: GameMap, x: number, y: number): string | null {
  return map.rows[y]?.[x] ?? null
}

export function isWalkable(map: GameMap, x: number, y: number): boolean {
  const t = tileAt(map, x, y)
  return t !== null && WALKABLE_TILE_CHARS.has(t)
}
