/**
 * 内容完整性校验：
 * 1. 所有 content/ JSON 符合 zod schema
 * 2. 跨引用完整（NPC.regionId 等存在性检查在此扩展）
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { z } from 'zod'
import { ItemSchema, SkillSchema, NpcSchema, RegionSchema } from '../src/systems/schemas'

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

const regionIds = new Set(readAll('world').map((r) => String(r['id'])))

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
  console.log('✓ 引用完整性校验通过')
}
if (errors === 0) checkRefs()

if (errors > 0) {
  console.error(`\n${errors} 处内容错误，禁止部署！`)
  process.exit(1)
}
console.log('\n全部内容校验通过 ✅')
