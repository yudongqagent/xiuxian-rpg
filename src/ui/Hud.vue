<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { bus } from '../engine/eventBus'
import {
  effectiveStats,
  expToNext,
  gateAt,
  getPlayer,
  realmLabel,
  subscribePlayer,
} from '../systems/player'
import { ITEMS } from '../systems/itemBook'
import { getTrackedQuest, getNextMainQuestHint, type TrackedQuestView } from '../systems/questRuntime'
import { getWorldTime, timeLabel, subscribeWorldTime, type WorldTimeData } from '../systems/time'
import { lifespanAt, remainingYears } from '../systems/lifespan'

defineEmits<{ 'open-inventory': []; 'open-quests': []; 'open-saves': []; 'open-map': []; 'open-breakthrough': [] }>()
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
const worldTime = ref<WorldTimeData>(getWorldTime())
const unTime = subscribeWorldTime(() => (worldTime.value = getWorldTime()))
const nextHint = ref(getNextMainQuestHint())
const unQuest = bus.on('quest:updated', () => {
  tracked.value = getTrackedQuest()
  nextHint.value = getNextMainQuestHint()
})
const unNames = bus.on('names:ready', () => {
  nextHint.value = getNextMainQuestHint()
})
onUnmounted(() => {
  unPos()
  unStats()
  unQuest()
  unNames()
  unTime()
})

const stats = computed(() =>
  effectiveStats(player.value.level, player.value.equipped, (id) => ITEMS[id]),
)
const gateReady = computed(
  () => Boolean(gateAt(player.value.level)) && player.value.exp >= expToNext(player.value.level),
)
// 2.0 寿元（V1.5）：常驻倒计时 —— 世界历驱动，玩家岁数随世界日推进（60 日 = 一载），只减不增
const remaining = computed(() => remainingYears(player.value.level, worldTime.value.day))
const lifespanTotal = computed(() => lifespanAt(player.value.level))
const lifeWarn = computed(() => remaining.value < lifespanTotal.value / 2)
const lifeLow = computed(() => remaining.value <= 30)

function pctOf(v: number, max: number): string {
  return `${Math.min(100, Math.round((v / max) * 100))}%`
}
</script>

<template>
  <div class="hud">
    <div class="realm">
      <span class="name">凡人 · {{ realmLabel(player.level) }}</span>
      <span :class="['yrs', { warn: lifeWarn, low: lifeLow }]" role="timer">
        寿余 {{ remaining }}/{{ lifespanTotal }} 载
      </span>
      <div class="bar"><i class="exp" :style="{ width: pctOf(player.exp, expToNext(player.level)) }" /></div>
      <span class="hint">血 {{ player.hp }}/{{ stats.maxHp }} · 灵 {{ player.qi }}/{{ stats.maxQi }} · 攻 {{ stats.atk }} 防 {{ stats.def }} · 灵石 {{ player.lingshi }} · 修为
        {{ player.exp }}/{{ expToNext(player.level) }} · <span class="clock">{{ timeLabel(worldTime) }}</span></span>
    </div>
    <button class="btn" @click="$emit('open-map')">地图</button>
    <button class="btn" @click="$emit('open-saves')">存档</button>
    <button class="btn" @click="toggleMute">{{ muted ? '🔇' : '🔊' }}</button>
    <button class="btn" @click="$emit('open-quests')">任务</button>
    <button class="btn" @click="$emit('open-inventory')">背包</button>
    <button v-if="gateReady" class="btn gate" @click="$emit('open-breakthrough')">突破</button>
    <div class="coords">{{ Math.floor(pos.x / 32) }},{{ Math.floor(pos.y / 32) }}</div>
  </div>
  <button v-if="tracked" class="tracker" @click="bus.emit('navigate:quest')">
    <span class="tname">「{{ tracked.quest.name }}」</span>
    <span v-if="tracked.readyToTurnIn" class="tdone">
      {{ tracked.turnInGiver ? `回去找${tracked.turnInGiver}交付` : '目标完成，回去交付吧' }}（点击自动寻路）
    </span>
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
.btn.gate {
  border-color: #ffd97a;
  color: #ffd97a;
  animation: gate-pulse 1.6s ease-in-out infinite;
}
@keyframes gate-pulse {
  0%,
  100% {
    box-shadow: 0 0 4px 1px rgba(255, 217, 122, 0.3);
  }
  50% {
    box-shadow: 0 0 14px 4px rgba(255, 217, 122, 0.6);
  }
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
.clock {
  color: #9fd0e8;
}
.yrs {
  margin-left: 8px;
  font-family: var(--font-display);
  color: #9fe0a9;
  letter-spacing: 1px;
}
.yrs.warn {
  color: #ffd97a;
  animation: yrs-pulse 1.6s ease-in-out infinite;
}
.yrs.low {
  color: #e88a7a;
  animation: yrs-pulse 0.8s ease-in-out infinite;
}
@keyframes yrs-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}
.tdone {
  color: #9fe0a9;
}
</style>
