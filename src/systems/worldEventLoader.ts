/** 事件风暴（V1.4）：Vite glob 加载 content/events/*.json → 注册进 WORLD_EVENTS 表。仅浏览器侧导入。 */
import type { WorldEvent } from './schemas'
import { registerWorldEvent } from './worldEvents'

const entries = Object.entries(
  import.meta.glob('../../content/events/*.json', { eager: true }) as Record<string, unknown>,
)

export function loadWorldEvents(): void {
  for (const [path, raw] of entries) {
    const id = path.split('/').pop()!.replace(/\.json$/, '')
    const o = raw as Record<string, unknown>
    const trigger = o['trigger'] as Record<string, unknown>
    const cons = o['consequences'] as Record<string, unknown>
    const ev: WorldEvent = {
      id: String(o['id'] ?? id),
      name: String(o['name'] ?? id),
      nominee: String(o['nominee'] ?? ''),
      once: o['once'] !== false,
      trigger: {
        absentDays: Number(trigger?.['absentDays'] ?? 0),
        grudgeOf: String(trigger?.['grudgeOf'] ?? ''),
        grudgeAt: Number(trigger?.['grudgeAt'] ?? 0),
      },
      consequences: {
        lingshi: Number(cons?.['lingshi'] ?? 0),
        reputation: Number(cons?.['reputation'] ?? 0),
      },
      toast: String(o['toast'] ?? ''),
      after: o['after'] === undefined ? undefined : String(o['after']),
    }
    registerWorldEvent(ev)
  }
}