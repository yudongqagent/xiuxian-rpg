<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { bus } from '../engine/eventBus'
import { getTrackedQuest, type TrackedQuestView } from '../systems/questRuntime'

defineEmits<{ 'open-inventory': []; 'open-quests': [] }>()

const pos = ref({ x: 0, y: 0 })
const un = bus.on('player:position', (p) => (pos.value = p))

const tracked = ref<TrackedQuestView | null>(getTrackedQuest())
const unQuest = bus.on('quest:updated', () => (tracked.value = getTrackedQuest()))
onUnmounted(() => {
  un()
  unQuest()
})
</script>

<template>
  <div class="hud">
    <div class="realm">
      <span class="name">凡人 · 张铁柱</span>
      <div class="bar"><i style="width: 32%" /></div>
      <span class="hint">炼气一层 32/100 灵气</span>
    </div>
    <button class="btn" @click="$emit('open-quests')">任务</button>
    <button class="btn" @click="$emit('open-inventory')">背包</button>
    <div class="coords">{{ Math.round(pos.x / 32) }},{{ Math.round(pos.y / 32) }}</div>
  </div>
  <button v-if="tracked" class="tracker" @click="$emit('open-quests')">
    <span class="tname">「{{ tracked.quest.name }}」</span>
    <span v-if="tracked.readyToTurnIn" class="tdone">目标完成，回去交付吧</span>
    <span v-else>{{ tracked.objectiveLine }}</span>
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
  padding: calc(10px + env(safe-area-inset-top)) 14px 0;
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
  left: 14px;
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
