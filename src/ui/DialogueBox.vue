<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { bus } from '../engine/eventBus'
import { getDialogueByNpc } from '../systems/dialogues'
import type { Dialogue } from '../systems/schemas'
import { getQuestDialogueActions, type DialogueAction } from '../systems/questRuntime'
import { getStock } from '../systems/shop'
import { portraitFor } from './portraits'

const view = ref<{ dialogue: Dialogue; nodeId: string } | null>(null)

const node = computed(() => view.value?.dialogue.nodes.find((n) => n.id === view.value?.nodeId))
const choices = computed(() => node.value?.choices ?? [])
const portraitUrl = computed(() => (view.value ? portraitFor(view.value.dialogue.npcId) : ''))

const questVersion = ref(0)
const questActions = computed<DialogueAction[]>(() => {
  void questVersion.value
  return view.value ? getQuestDialogueActions(view.value.dialogue.npcId) : []
})

function runQuestAction(a: DialogueAction): void {
  bus.emit(a.kind === 'offer' ? 'quest:offer' : 'quest:turnin', { questId: a.questId })
}

const hasShopStock = (npcId: string): boolean => !!getStock(npcId)

function open(npcId: string): void {
  const d = getDialogueByNpc(npcId)
  // 无对话内容的 NPC：直接忽略，不冻结世界（修复软锁）
  if (!d || !d.nodes.some((n) => n.id === d.entry)) return
  view.value = { dialogue: d, nodeId: d.entry }
  bus.emit('dialogue:state', { open: true })
}

function choose(i: number): void {
  const c = choices.value[i]
  if (!c) return
  if (c.next === null || !view.value?.dialogue.nodes.some((n) => n.id === c.next)) return close()
  view.value = { ...view.value, nodeId: c.next }
}

function close(): void {
  if (!view.value) return
  view.value = null
  bus.emit('dialogue:close')
  bus.emit('dialogue:state', { open: false })
}

function onKey(e: KeyboardEvent): void {
  if (!view.value) return
  if (e.key === 'Escape') return close()
  const idx = Number(e.key)
  if (idx >= 1 && idx <= 9) return choose(idx - 1)
  if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
    if (choices.value.length > 0) choose(0)
    else close()
  }
}

function openShop(): void {
  if (!view.value) return
  const npcId = view.value.dialogue.npcId
  close()
  bus.emit('shop:open', { npcId })
}

function onVis(): void {
  if (document.hidden && view.value) close()
}

const unOpen = bus.on('dialogue:open', ({ npcId }) => open(npcId))
const unQuest = bus.on('quest:updated', () => questVersion.value++)
onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', onVis)
})
onUnmounted(() => {
  unOpen()
  unQuest()
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('visibilitychange', onVis)
  if (view.value) close()
})
</script>

<template>
  <div v-if="node" class="dialogue ink-sheet">
    <button class="close" aria-label="关闭" @click="close">✕</button>
    <div class="body">
      <div :key="node.id" class="portrait-col">
        <img class="portrait" :src="portraitUrl" :alt="node.speaker" draggable="false" />
        <span class="plate">{{ node.speaker }}</span>
      </div>
      <div class="text-col">
        <p class="text">{{ node.text }}</p>
        <div
          v-if="choices.length || questActions.length || (view && hasShopStock(view.dialogue.npcId))"
          class="choices"
        >
          <button v-for="a in questActions" :key="a.questId" class="quest" @click="runQuestAction(a)">
            <i>◆</i>{{ a.label }}
          </button>
          <button v-if="view && hasShopStock(view.dialogue.npcId)" class="quest" @click="openShop">
        <i>◆</i>浏览商货
      </button>
      <button v-for="(c, i) in choices" :key="i" @click="choose(i)">
            <i>{{ i + 1 }}.</i>{{ c.text }}
          </button>
        </div>
        <button v-else class="continue" @click="close">继续 [E]</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialogue {
  position: fixed;
  inset: auto 0 0 0;
  padding: 14px 16px calc(16px + env(safe-area-inset-bottom));
}
.close {
  position: absolute;
  top: 8px;
  right: 10px;
  z-index: 1;
  min-width: 32px;
  min-height: 32px;
  border: 1px solid rgba(139, 105, 20, 0.5);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: #e8dcc0;
  font-size: 14px;
}
.body {
  display: flex;
  align-items: flex-end;
  gap: 14px;
}
.portrait-col {
  position: relative;
  flex: none;
  width: 84px;
  animation: portrait-bob 1.15s ease-in-out infinite alternate;
}
@keyframes portrait-bob {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-4px);
  }
}
.portrait {
  display: block;
  width: 84px;
  height: 84px;
  border-radius: 10px;
  border: 1px solid rgba(201, 164, 74, 0.55);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.5),
    0 3px 12px rgba(0, 0, 0, 0.5);
}
.plate {
  position: absolute;
  left: 50%;
  bottom: -7px;
  transform: translateX(-50%);
  white-space: nowrap;
  padding: 2px 10px;
  border: 1px solid rgba(139, 105, 20, 0.8);
  border-radius: 999px;
  background: linear-gradient(180deg, #33270f, #241a0a);
  color: #ffd97a;
  font-family: var(--font-display);
  font-size: 12px;
  letter-spacing: 0.18em;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
}
.text-col {
  flex: 1;
  min-width: 0;
}
.text {
  margin: 6px 0 10px;
  font-size: 15px;
  line-height: 1.6;
}
.choices {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.choices button,
.continue {
  text-align: left;
  min-height: 44px;
  border: 1px solid rgba(139, 105, 20, 0.5);
  border-radius: 8px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  font-size: 14px;
}
.choices button i {
  font-style: normal;
  color: #ffd97a;
  margin-right: 8px;
}
.choices button.quest {
  border-color: #ffd97a;
}
.continue {
  align-self: flex-end;
  opacity: 0.85;
}
@media (max-width: 380px) {
  .portrait-col {
    width: 64px;
  }
  .portrait {
    width: 64px;
    height: 64px;
  }
}
</style>
