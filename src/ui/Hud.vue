<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { bus } from '../engine/eventBus'
import {
  expToNext,
  getPlayer,
  realmLabel,
  statsForLevel,
  subscribePlayer,
} from '../systems/player'

const pos = ref({ x: 0, y: 0 })
const player = ref(getPlayer())
const unPos = bus.on('player:position', (p) => (pos.value = p))
const unStats = subscribePlayer(() => (player.value = getPlayer()))
onUnmounted(() => {
  unPos()
  unStats()
})

const stats = computed(() => statsForLevel(player.value.level))

function pctOf(v: number, max: number): string {
  return `${Math.min(100, Math.round((v / max) * 100))}%`
}
</script>

<template>
  <div class="hud">
    <div class="realm">
      <span class="name">凡人 · {{ realmLabel(player.level) }}</span>
      <div class="bar"><i class="exp" :style="{ width: pctOf(player.exp, expToNext(player.level)) }" /></div>
      <span class="hint">血 {{ player.hp }}/{{ stats.maxHp }} · 灵 {{ player.qi }}/{{ stats.maxQi }} · 修为
        {{ player.exp }}/{{ expToNext(player.level) }}</span>
    </div>
    <button class="btn" @click="$emit('open-inventory')">背包</button>
    <div class="coords">{{ Math.round(pos.x / 32) }},{{ Math.round(pos.y / 32) }}</div>
  </div>
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
</style>
