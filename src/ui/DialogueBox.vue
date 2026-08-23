<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { bus } from '../engine/eventBus'
import { getDialogueByNpc } from '../systems/dialogues'
import type { Dialogue } from '../systems/schemas'
import { getQuestDialogueActions, type DialogueAction } from '../systems/questRuntime'

const view = ref<{ dialogue: Dialogue; nodeId: string } | null>(null)

const node = computed(() => view.value?.dialogue.nodes.find((n) => n.id === view.value?.nodeId))
const choices = computed(() => node.value?.choices ?? [])

const questVersion = ref(0)
const questActions = computed<DialogueAction[]>(() => {
  void questVersion.value
  return view.value ? getQuestDialogueActions(view.value.dialogue.npcId) : []
})

function runQuestAction(a: DialogueAction): void {
  bus.emit(a.kind === 'offer' ? 'quest:offer' : 'quest:turnin', { questId: a.questId })
}

function open(npcId: string): void {
  const d = getDialogueByNpc(npcId)
  if (!d || !d.nodes.some((n) => n.id === d.entry)) return
  view.value = { dialogue: d, nodeId: d.entry }
}

function choose(i: number): void {
  const c = choices.value[i]
  if (!c) return
  if (c.next === null || !view.value?.dialogue.nodes.some((n) => n.id === c.next)) return close()
  view.value = { ...view.value, nodeId: c.next }
}

function close(): void {
  view.value = null
  bus.emit('dialogue:close')
}

function onKey(e: KeyboardEvent): void {
  if (!view.value) return
  const idx = Number(e.key)
  if (idx >= 1 && idx <= 9) return choose(idx - 1)
  if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
    if (choices.value.length > 0) choose(0)
    else close()
  }
}

const unOpen = bus.on('dialogue:open', ({ npcId }) => open(npcId))
const unQuest = bus.on('quest:updated', () => questVersion.value++)
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => {
  unOpen()
  unQuest()
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div v-if="node" class="dialogue">
    <div class="speaker">{{ node.speaker }}</div>
    <p class="text">{{ node.text }}</p>
    <div v-if="choices.length || questActions.length" class="choices">
      <button v-for="a in questActions" :key="a.questId" class="quest" @click="runQuestAction(a)">
        <i>◆</i>{{ a.label }}
      </button>
      <button v-for="(c, i) in choices" :key="i" @click="choose(i)">
        <i>{{ i + 1 }}.</i>{{ c.text }}
      </button>
    </div>
    <button v-else class="continue" @click="close">继续 [E]</button>
  </div>
</template>

<style scoped>
.dialogue {
  position: fixed;
  inset: auto 0 0 0;
  background: rgba(20, 14, 9, 0.96);
  border-top: 1px solid #8b6914;
  color: #e8dcc0;
  padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
}
.speaker {
  color: #ffd97a;
  font-size: 14px;
  margin-bottom: 6px;
}
.text {
  margin: 0 0 10px;
  font-size: 15px;
  line-height: 1.6;
}
.choices {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
button {
  text-align: left;
  min-height: 44px;
  border: 1px solid rgba(139, 105, 20, 0.5);
  border-radius: 8px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  font-size: 14px;
}
button i {
  font-style: normal;
  color: #ffd97a;
  margin-right: 8px;
}
button.quest {
  border-color: #ffd97a;
}
.continue {
  align-self: flex-end;
  opacity: 0.85;
}
</style>
