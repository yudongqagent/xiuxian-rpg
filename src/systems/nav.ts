/**
 * 跨地图自动寻路路由：模块级状态（scene.restart 后仍存活）。
 * 路线 = 传送门链 + 最终目标图块；世界层逐段行走，跨图后由 create() 续航。
 */
import { getAllMaps, getGameMap } from './maps'

export interface NavHop {
  fromMapId: string
  /** 传送门所在图块（from 地图坐标） */
  portal: { x: number; y: number }
  toMapId: string
}

export interface NavRoute {
  targetMapId: string
  target: { x: number; y: number }
  label: string
  hops: NavHop[]
}

let route: NavRoute | null = null

export function getNavRoute(): NavRoute | null {
  return route
}

export function setNavRoute(r: NavRoute | null): void {
  route = r
}

/**
 * 跨地图 BFS：返回从 fromMap 到 toMap 的传送门链；不可达返回 null。
 * V2.3 全图可达：章节锁已删，portal 恒可通行。
 */
export function portalPath(fromMapId: string, toMapId: string): NavHop[] | null {
  if (fromMapId === toMapId) return []
  const maps = getAllMaps()
  const prev = new Map<string, { id: string; hop: NavHop }>()
  const queue: string[] = [fromMapId]
  const seen = new Set([fromMapId])
  while (queue.length > 0) {
    const cur = queue.shift()!
    const curMap = getGameMap(cur)
    for (const p of curMap.portals) {
      const next = p.to.map
      if (seen.has(next)) continue
      const hop: NavHop = { fromMapId: cur, portal: { x: p.x, y: p.y }, toMapId: next }
      prev.set(next, { id: cur, hop })
      if (next === toMapId) {
        const hops: NavHop[] = []
        let node: string | undefined = toMapId
        while (node && node !== fromMapId) {
          const entry = prev.get(node)
          if (!entry) break
          hops.unshift(entry.hop)
          node = entry.id
        }
        return hops
      }
      seen.add(next)
      queue.push(next)
    }
  }
  return null
}
