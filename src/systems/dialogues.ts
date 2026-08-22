import { DialogueSchema, type Dialogue } from './schemas'

const modules = import.meta.glob('../../content/dialogues/*.json', {
  eager: true,
}) as Record<string, unknown>

const trees = new Map<string, Dialogue>()
for (const data of Object.values(modules)) {
  const d = DialogueSchema.parse(data)
  trees.set(d.npcId, d)
}

export function getDialogueByNpc(npcId: string): Dialogue | undefined {
  return trees.get(npcId)
}
