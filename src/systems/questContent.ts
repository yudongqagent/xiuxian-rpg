import { QuestSchema, type Quest } from './schemas'

const modules = import.meta.glob('../../content/quests/*.json', {
  eager: true,
}) as Record<string, unknown>

const quests: Record<string, Quest> = {}
for (const data of Object.values(modules)) {
  const q = QuestSchema.parse(data)
  quests[q.id] = q
}

export function getQuest(id: string): Quest | undefined {
  return quests[id]
}

export function allQuests(): Quest[] {
  return Object.values(quests)
}

export function questsByGiver(npcId: string): Quest[] {
  return allQuests().filter((q) => q.giver === npcId)
}

export const QUEST_IDS: ReadonlySet<string> = new Set(Object.keys(quests))
