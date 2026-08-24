<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { bus } from '../engine/eventBus'
import {
  effectiveStats,
  expToNext,
  getPlayer,
  realmLabel,
  subscribePlayer,
} from '../systems/player'
import { ITEMS } from '../systems/itemBook'
import { getTrackedQuest, getNextMainQuestHint, type TrackedQuestView } from '../systems/questRuntime'

defineEmits<{ 'open-inventory': []; 'open-quests': []; 'open-saves': []; 'open-map': [] }>()
const muted = ref(localStorage.getItem('xj-muted') === '1')
function toggleMute(): void {
  import('../systems/audio').then((m) => {
    muted.value = m.toggleMute()
  })
}

const pos = ref({ x: 0, y: 0 })
const player = ref(getPlayer())
const unPos = bus.on('player:position', (p) => (pos.value = p))
const unStats = subscribePlayer(() => (player.value = getPlayer()))
const tracked = ref<TrackedQuestView | null>(getTrackedQuest())
const nextHint = ref(getNextMainQuestHint())
const unQuest = bus.on('quest:updated', () => {
  tracked.value = getTrackedQuest()
  nextHint.value = getNextMainQuestHint()
})
onUnmounted(() => {
  unPos()
  unStats()
  unQuest()
})

const stats = computed(() =>
  effectiveStats(player.value.level, player.value.equipped, (id) => ITEMS[id]),
)

function pctOf(v: number, max: number): string {
  return `${Math.min(100, Math.round((v / max) * 100))}%`
}
</script>

<template>
  <div class="hud">
    <div class="realm">
      <span class="name">凡人 · {{ realmLabel(player.level) }}</span>
      <div class="bar"><i class="exp" :style="{ width: pctOf(player.exp, expToNext(player.level)) }" /></div>
      <span class="hint">血 {{ player.hp }}/{{ stats.maxHp }} · 灵 {{ player.qi }}/{{ stats.maxQi }} · 攻 {{ stats.atk }} 防 {{ stats.def }} · 灵石 {{ player.lingshi }} · 修为
        {{ player.exp }}/{{ expToNext(player.level) }}</span>
    </div>
    <button class="btn" @click="$emit('open-map')">地图</button>
    <button class="btn" @click="$emit('open-saves')">存档</button>
    <button class="btn" @click="toggleMute">{{ muted ? '🔇' : '🔊' }}</button>
    <button class="btn" @click="$emit('open-quests')">任务</button>
    <button class="btn" @click="$emit('open-inventory')">背包</button>
    <div class="coords">{{ Math.floor(pos.x / 32) }},{{ Math.floor(pos.y / 32) }}</div>
  </div>
  <button v-if="tracked" class="tracker" @click="bus.emit('navigate:quest')">
    <span class="tname">「{{ tracked.quest.name }}」</span>
    <span v-if="tracked.readyToTurnIn" class="tdone">目标完成，回去交付吧</span>
    <span v-else>{{ tracked.objectiveLine }}</span>
  </button>
  <button v-else-if="nextHint" class="tracker" @click="$emit('open-quests')">
    <span class="tname">下一步：找{{ nextHint.giverName }}</span>
    <span>接取「{{ nextHint.questName }}」</span>
  </button>
</template>

<style scoped>
.hud {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: calc(10px + env(safe-area-inset-top)) calc(14px + env(safe-area-inset-right)) 0
    calc(14px + env(safe-area-inset-left));
  color: #e8dcc0;
  pointer-events: none;
}
.realm {
  flex: 1;
  font-size: 12px;
}
.bar {
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.15);
  overflow: hidden;
}
.bar i {
  display: block;
  height: 100%;
}
.bar .exp {
  background: linear-gradient(90deg, #7ec8a9, #cfe8b5);
}
.btn {
  pointer-events: auto;
  border: 1px solid #8b6914;
  border-radius: 8px;
  padding: 8px 14px;
  background: rgba(26, 18, 11, 0.75);
  color: #e8dcc0;
  font-size: 13px;
}
.coords {
  font-size: 10px;
  opacity: 0.6;
}
.tracker {
  position: fixed;
  left: calc(14px + env(safe-area-inset-left));
  top: calc(52px + env(safe-area-inset-top));
  max-width: 60vw;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  text-align: left;
  pointer-events: auto;
  border: 1px solid rgba(139, 105, 20, 0.6);
  border-radius: 8px;
  padding: 6px 10px;
  background: rgba(26, 18, 11, 0.72);
  color: #e8dcc0;
  font-size: 12px;
  line-height: 1.5;
}
.tname {
  color: #ffd97a;
}
.tdone {
  color: #9fe0a9;
}
</style>
