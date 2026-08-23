/**
 * 内容完整性校验：
 * 1. 所有 content/ JSON 符合 zod schema
 * 2. 跨引用完整（NPC.regionId 等存在性检查在此扩展）
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { z } from 'zod'
import { ItemSchema, SkillSchema, NpcSchema, RegionSchema, DialogueSchema, EnemySchema, QuestSchema, GameMapSchema, WALKABLE_TILE_CHARS, RecipeSchema, ShopSchema } from '../src/systems/schemas'

const ROOT = join(import.meta.dirname, '..', 'content')

function readAll(dir: string): Record<string, unknown>[] {
  return readdirSync(join(ROOT, dir))
    .filter((f: string) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(ROOT, dir, f), 'utf-8')) as Record<string, unknown>)
}

let errors = 0
function check(label: string, schema: z.ZodTypeAny, dir: string) {
  for (const data of readAll(dir)) {
    const r = schema.safeParse(data)
    if (!r.success) {
      errors++
      console.error(`✗ [${label}] ${String(data['id'] ?? '<unknown>')}:\n  ${r.error.message}`)
    }
  }
  console.log(`✓ ${label} 校验通过`)
}

check('物品', ItemSchema, 'items')
check('功法', SkillSchema, 'skills')
check('人物', NpcSchema, 'npcs')
check('区域', RegionSchema, 'world')
check('对话', DialogueSchema, 'dialogues')
check('妖兽', EnemySchema, 'enemies')
check('配方', RecipeSchema, 'recipes')
check('商店', ShopSchema, 'shops')
check('任务', QuestSchema, 'quests')
check('地图', GameMapSchema, 'maps')

const regionIds = new Set(readAll('world').map((r) => String(r['id'])))
const npcIds = new Set(readAll('npcs').map((n) => String(n['id'])))
const itemIds = new Set(readAll('items').map((i) => String(i['id'])))
const enemyIds = new Set(readAll('enemies').map((e) => String(e['id'])))
const questIds = new Set(readAll('quests').map((q) => String(q['id'])))
const mapIds = new Set(readAll('maps').map((m) => String(m['id'])))

interface RawMap {
  id: string
  rows: string[]
  spawn: { x: number; y: number }
  portals: Array<{ x: number; y: number; to: { map: string; x: number; y: number }; label: string }>
  npcPlacements: Array<{ npcId: string; x: number; y: number }>
  enemySpawns: Array<{ enemyId: string; x: number; y: number }>
  props?: Array<{ type: string; x: number; y: number }>
}

function tileWalkable(rows: string[], x: number, y: number): boolean {
  return WALKABLE_TILE_CHARS.has(rows[y]?.[x] ?? '')
}

function refErr(owner: string, label: string, id: string) {
  errors++
  console.error(`✗ [引用] ${owner} 的${label} "${id}" 不存在`)
}

function checkRefs() {
  for (const npc of readAll('npcs')) {
    const regionId = String(npc['regionId'])
    if (!regionIds.has(regionId)) {
      errors++
      console.error(`✗ [引用] NPC ${String(npc['id'])} 的 regionId "${regionId}" 不存在`)
    }
  }
  for (const region of readAll('world')) {
    const adjacent = Array.isArray(region['adjacent']) ? (region['adjacent'] as string[]) : []
    for (const adj of adjacent) {
      if (!regionIds.has(adj)) {
        errors++
        console.error(`✗ [引用] 区域 ${String(region['id'])} 的相邻区域 "${adj}" 不存在`)
      }
    }
  }
  for (const dialogue of readAll('dialogues')) {
    const dlgId = String(dialogue['id'])
    if (!npcIds.has(String(dialogue['npcId']))) {
      errors++
      console.error(`✗ [引用] 对话 ${dlgId} 的 npcId "${String(dialogue['npcId'])}" 不存在`)
    }
    const nodes = new Set(
      (Array.isArray(dialogue['nodes']) ? dialogue['nodes'] : []).map((n) => String((n as { id: string }).id)),
    )
    const entry = String(dialogue['entry'])
    if (!nodes.has(entry)) {
      errors++
      console.error(`✗ [引用] 对话 ${dlgId} 的入口节点 "${entry}" 不存在`)
    }
    for (const node of Array.isArray(dialogue['nodes']) ? dialogue['nodes'] : []) {
      const choices = Array.isArray((node as { choices?: unknown[] }).choices)
        ? ((node as { choices: unknown[] }).choices as Array<{ next?: string | null }>)
        : []
      for (const c of choices) {
        if (c.next !== null && c.next !== undefined && !nodes.has(c.next)) {
          errors++
          console.error(`✗ [引用] 对话 ${dlgId} 节点 "${String((node as { id: string }).id)}" 的选项目标 "${c.next}" 不存在`)
        }
      }
    }
  }
  for (const quest of readAll('quests')) {
    const qid = String(quest['id'])
    const type = String(quest['type'])
    if (type === 'main' && !qid.startsWith('qm_')) {
      errors++
      console.error(`✗ [规范] 主线任务 ${qid} 的 id 必须以 qm_ 开头`)
    }
    if (type !== 'main' && qid.startsWith('qm_')) {
      errors++
      console.error(`✗ [规范] 非主线任务 ${qid} 不应使用 qm_ 前缀`)
    }
    if (!npcIds.has(String(quest['giver']))) refErr(`任务 ${qid}`, '发布人', String(quest['giver']))
    for (const dep of (quest['prerequisites'] as { quests?: string[] })?.quests ?? []) {
      if (!questIds.has(dep)) refErr(`任务 ${qid}`, '前置任务', dep)
    }
    const steps = Array.isArray(quest['steps']) ? quest['steps'] : []
    for (const step of steps) {
      const s = step as { kind: string; target?: string; npc?: string; region?: string }
      if (s.kind === 'kill' && s.target && !enemyIds.has(s.target)) refErr(`任务 ${qid}`, '击杀目标', s.target)
      if (s.kind === 'talk' && s.npc && !npcIds.has(s.npc)) refErr(`任务 ${qid}`, '对话 NPC', s.npc)
      if (s.kind === 'collect' && s.target && !itemIds.has(s.target)) refErr(`任务 ${qid}`, '收集物品', s.target)
      if (s.kind === 'reach' && s.region && !regionIds.has(s.region)) refErr(`任务 ${qid}`, '目标区域', s.region)
    }
    const rewardItems = (quest['rewards'] as { items?: string[] })?.items ?? []
    for (const it of rewardItems) {
      if (!itemIds.has(it)) refErr(`任务 ${qid}`, '奖励物品', it)
    }
  }
  for (const raw of readAll('maps')) {
    const m = raw as unknown as RawMap
    const mid = m.id
    const spots: Array<readonly [string, number, number]> = [
      ['出生点', m.spawn.x, m.spawn.y],
      ...m.portals.map((p) => ['传送点', p.x, p.y] as const),
      ...m.npcPlacements.map((n) => [`NPC ${n.npcId}`, n.x, n.y] as const),
      ...m.enemySpawns.map((e) => [`妖兽 ${e.enemyId}`, e.x, e.y] as const),
    ]
    for (const [label, x, y] of spots) {
      if (!tileWalkable(m.rows, x, y)) {
        errors++
        console.error(`✗ [地图] ${mid} 的${label}落在不可行走格 (${x},${y})`)
      }
    }
    for (const p of m.portals) {
      if (!mapIds.has(p.to.map)) {
        errors++
        console.error(`✗ [引用] 地图 ${mid} 传送点 (${p.x},${p.y}) 的目标地图 "${p.to.map}" 不存在`)
        continue
      }
      const target = readAll('maps').find((t) => t['id'] === p.to.map) as unknown as RawMap
      if (!tileWalkable(target.rows, p.to.x, p.to.y)) {
        errors++
        console.error(`✗ [地图] 地图 ${mid} 传送点 (${p.x},${p.y}) 的落点 (${p.to.x},${p.to.y}) 在 "${p.to.map}" 上不可行走`)
      }
    }
    for (const n of m.npcPlacements) {
      if (!npcIds.has(n.npcId)) refErr(`地图 ${mid}`, 'NPC', n.npcId)
    }
    for (const e of m.enemySpawns) {
      if (!enemyIds.has(e.enemyId)) refErr(`地图 ${mid}`, '妖兽', e.enemyId)
    }
    for (const p of m.props ?? []) {
      if (!tileWalkable(m.rows, p.x, p.y)) {
        errors++
        console.error(`✗ [地图] ${mid} 的道具 ${p.type} 落在不可行走格 (${p.x},${p.y})`)
      }
    }
  }
  for (const enemy of readAll('enemies')) {
    const eid = String(enemy['id'])
    const loot = Array.isArray(enemy['loot']) ? (enemy['loot'] as Array<{ item?: string }>) : []
    for (const entry of loot) {
      if (entry.item && !itemIds.has(entry.item)) refErr(`妖兽 ${eid}`, '掉落物品', entry.item)
    }
  }
  for (const shop of readAll('shops')) {
    const sid = String(shop['id'])
    if (!npcIds.has(sid)) refErr(`商店 ${sid}`, '商贩 NPC', sid)
    const wares = Array.isArray(shop['wares']) ? (shop['wares'] as Array<{ item?: string }>) : []
    for (const ware of wares) {
      if (ware.item && !itemIds.has(ware.item)) refErr(`商店 ${sid}`, '商品', ware.item)
    }
  }
  for (const recipe of readAll('recipes')) {
    const rid = String(recipe['id'])
    const inputs = Array.isArray(recipe['inputs']) ? (recipe['inputs'] as Array<{ item?: string }>) : []
    for (const i of inputs) {
      if (i.item && !itemIds.has(i.item)) refErr(`配方 ${rid}`, '材料', i.item)
    }
    const out = (recipe['output'] as { item?: string })?.item
    if (out && !itemIds.has(out)) refErr(`配方 ${rid}`, '产物', out)
  }
  console.log('✓ 引用完整性校验通过')
}
if (errors === 0) checkRefs()

if (errors > 0) {
  console.error(`\n${errors} 处内容错误，禁止部署！`)
  process.exit(1)
}
console.log('\n全部内容校验通过 ✅')
