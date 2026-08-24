import { EnemySchema, ItemSchema, NpcSchema, RegionSchema } from './schemas'

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

const NPC_NAMES = collectNames(
  import.meta.glob('../../content/npcs/*.json', { eager: true }) as Record<string, unknown>,
  (d) => NpcSchema.parse(d),
)
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

const NAMES: Record<NameKind, Map<string, string>> = {
  npc: NPC_NAMES,
  enemy: ENEMY_NAMES,
  item: ITEM_NAMES,
  region: REGION_NAMES,
}

export function resolveName(kind: NameKind, id: string): string {
  return NAMES[kind].get(id) ?? id
}
