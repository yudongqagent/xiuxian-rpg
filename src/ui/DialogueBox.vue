<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { bus } from '../engine/eventBus'
import { getDialogueByNpc } from '../systems/dialogues'
import type { Dialogue } from '../systems/schemas'

const nodeId = ref<string | null>(null)
let active: Dialogue | undefined

const node = computed(() => active?.nodes.find((n) => n.id === nodeId.value))
const choices = computed(() => node.value?.choices ?? [])

function open(npcId: string): void {
  const d = getDialogueByNpc(npcId)
  if (!d || !d.nodes.some((n) => n.id === d.entry)) return
  active = d
  nodeId.value = d.entry
}

function choose(i: number): void {
  const c = choices.value[i]
  if (!c) return
  if (c.next === null || !active?.nodes.some((n) => n.id === c.next)) return close()
  nodeId.value = c.next
}

function close(): void {
  nodeId.value = null
  bus.emit('dialogue:close')
}

function onKey(e: KeyboardEvent): void {
  if (!nodeId.value) return
  const idx = Number(e.key)
  if (idx >= 1 && idx <= 9) return choose(idx - 1)
  if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
    if (choices.value.length > 0) choose(0)
    else close()
  }
}

const unOpen = bus.on('dialogue:open', ({ npcId }) => open(npcId))
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => {
  unOpen()
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div v-if="node" class="dialogue">
    <div class="speaker">{{ node.speaker }}</div>
    <p class="text">{{ node.text }}</p>
    <div v-if="choices.length" class="choices">
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
.continue {
  align-self: flex-end;
  opacity: 0.85;
}
</style>
