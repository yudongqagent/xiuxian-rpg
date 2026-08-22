/**
 * 内容完整性校验：
 * 1. 所有 content/ JSON 符合 zod schema
 * 2. 跨引用完整（NPC.regionId 等存在性检查在此扩展）
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { z } from 'zod'
import { ItemSchema, SkillSchema, NpcSchema, RegionSchema, DialogueSchema } from '../src/systems/schemas'

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

const regionIds = new Set(readAll('world').map((r) => String(r['id'])))
const npcIds = new Set(readAll('npcs').map((n) => String(n['id'])))

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
  console.log('✓ 引用完整性校验通过')
}
if (errors === 0) checkRefs()

if (errors > 0) {
  console.error(`\n${errors} 处内容错误，禁止部署！`)
  process.exit(1)
}
console.log('\n全部内容校验通过 ✅')
