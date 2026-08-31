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
        absentDays: trigger?.['absentDays'] === undefined ? undefined : Number(trigger['absentDays']),
        grudgeOf: trigger?.['grudgeOf'] === undefined ? undefined : String(trigger['grudgeOf']),
        grudgeAt: trigger?.['grudgeAt'] === undefined ? undefined : Number(trigger['grudgeAt']),
        affinityOf: trigger?.['affinityOf'] === undefined ? undefined : String(trigger['affinityOf']),
        affinityAt: trigger?.['affinityAt'] === undefined ? undefined : Number(trigger['affinityAt']),
      },
      consequences: {
        lingshi: cons?.['lingshi'] === undefined ? undefined : Number(cons['lingshi']),
        grantLingshi: cons?.['grantLingshi'] === undefined ? undefined : Number(cons['grantLingshi']),
        reputation: cons?.['reputation'] === undefined ? undefined : Number(cons['reputation']),
        relations:
          cons?.['relations'] === undefined
            ? undefined
            : {
                npcId: String((cons['relations'] as Record<string, unknown>)['npcId'] ?? ''),
                affinityDelta: (cons['relations'] as Record<string, unknown>)['affinityDelta'] === undefined
                  ? undefined
                  : Number((cons['relations'] as Record<string, unknown>)['affinityDelta']),
                grudgeDelta: (cons['relations'] as Record<string, unknown>)['grudgeDelta'] === undefined
                  ? undefined
                  : Number((cons['relations'] as Record<string, unknown>)['grudgeDelta']),
              },
      },
      toast: String(o['toast'] ?? ''),
      after: o['after'] === undefined ? undefined : String(o['after']),
    }
    registerWorldEvent(ev)
  }
}