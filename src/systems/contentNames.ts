import { EnemySchema, ItemSchema, NpcSchema, RegionSchema } from './schemas'
import type { NpcSchedule } from './schemas'
import type { NpcCultivateCfg } from './npclife'

export type NameKind = 'npc' | 'enemy' | 'item' | 'region'

function collectNames(
  modules: Record<string, unknown>,
  parse: (data: unknown) => { id: string; name: string },
): Map<string, string> {
  const names = new Map<string, string>()
  for (const data of Object.values(modules)) {
    const parsed = parse(data)
    names.set(parsed.id, parsed.name)
  }
  return names
}

const NPC_MODULES = import.meta.glob('../../content/npcs/*.json', { eager: true }) as Record<string, unknown>
const NPC_NAMES = collectNames(NPC_MODULES, (d) => NpcSchema.parse(d))

/** V1.3 日程：npcId → 时辰名 → [x,y] 点位（供 WorldScene 摆位 + 目击写回） */
const NPC_SCHEDULES = new Map<string, NpcSchedule>()
/** V1.3 目击半径（格）：偷摘药园时此 NPC 在场即记恨＋1 */
const NPC_WATCH_RADIUS = new Map<string, number>()
/** V2.1 收礼清单：npcId → itemId[]（玩家持有其一可近身赠出） */
const NPC_LIKES = new Map<string, string[]>()
/** V2.2 打探文案：npcId → 情报文本（按 H 询问弹出；缺省概括日程） */
const NPC_PROBES = new Map<string, string>()
/** V2.2 世界级生命周期：npcId → cultivate 配置（缺省 = 剧情锚，免疫死亡） */
const NPC_CULTIVATES = new Map<string, NpcCultivateCfg>()
for (const data of Object.values(NPC_MODULES)) {
  const npc = NpcSchema.parse(data)
  if (npc.schedule) NPC_SCHEDULES.set(npc.id, npc.schedule)
  if (npc.watchRadius !== undefined) NPC_WATCH_RADIUS.set(npc.id, npc.watchRadius)
  if (npc.likes) NPC_LIKES.set(npc.id, npc.likes)
  if (npc.probe) NPC_PROBES.set(npc.id, npc.probe)
  if (npc.cultivate) NPC_CULTIVATES.set(npc.id, npc.cultivate)
}

/** NPC 日程表（缺省 undefined → 静态站位） */
export function npcScheduleFor(npcId: string): NpcSchedule | undefined {
  return NPC_SCHEDULES.get(npcId)
}

/** NPC 目击半径（格），缺省 0 = 不盯梢 */
export function npcWatchRadiusFor(npcId: string): number {
  return NPC_WATCH_RADIUS.get(npcId) ?? 0
}

/** NPC 收礼清单（V2.1），缺省空数组 = 不收礼 */
export function npcLikesFor(npcId: string): string[] {
  return NPC_LIKES.get(npcId) ?? []
}

/** NPC 打探文案（V2.2），缺省空 = 用日程概括兜底 */
export function npcProbeFor(npcId: string): string {
  return NPC_PROBES.get(npcId) ?? ''
}

/** NPC 生命周期配置（V2.2），缺省 undefined = 剧情锚/不朽（免疫死亡） */
export function npcCultivateFor(npcId: string): NpcCultivateCfg | undefined {
  return NPC_CULTIVATES.get(npcId)
}

/** 有生命周期的全部 NPC（V2.2）：世界级推进（不依赖玩家所处地图） */
export function npcCultivateIds(): string[] {
  return [...NPC_CULTIVATES.keys()]
}
const ENEMY_NAMES = collectNames(
  import.meta.glob('../../content/enemies/*.json', { eager: true }) as Record<string, unknown>,
  (d) => EnemySchema.parse(d),
)
const ITEM_NAMES = collectNames(
  import.meta.glob('../../content/items/*.json', { eager: true }) as Record<string, unknown>,
  (d) => ItemSchema.parse(d),
)
const REGION_MODULES = import.meta.glob('../../content/world/*.json', {
  eager: true,
}) as Record<string, unknown>
const REGION_NAMES = collectNames(REGION_MODULES, (d) => RegionSchema.parse(d))
const REGION_QI = new Map<string, number>()
for (const data of Object.values(REGION_MODULES)) {
  const r = RegionSchema.parse(data)
  REGION_QI.set(r.id, r.qiDensity)
}

export function regionQiDensity(regionId: string | undefined): number {
  return (regionId && REGION_QI.get(regionId)) || 1
}

const ITEM_SOURCES = new Map<string, string[]>()
for (const data of Object.values(
  import.meta.glob('../../content/enemies/*.json', { eager: true }) as Record<string, unknown>,
)) {
  const e = EnemySchema.parse(data)
  for (const drop of e.loot ?? []) {
    const list = ITEM_SOURCES.get(drop.item) ?? []
    list.push(e.id)
    ITEM_SOURCES.set(drop.item, list)
  }
}

/** 掉落该物品的妖兽 id 列表（任务寻路用） */
export function enemiesDropping(itemId: string): string[] {
  return ITEM_SOURCES.get(itemId) ?? []
}

const NAMES: Record<NameKind, Map<string, string>> = {
  npc: NPC_NAMES,
  enemy: ENEMY_NAMES,
  item: ITEM_NAMES,
  region: REGION_NAMES,
}

export function resolveName(kind: NameKind, id: string): string {
  return NAMES[kind].get(id) ?? id
}
