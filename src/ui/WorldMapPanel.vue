<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { bus } from '../engine/eventBus'
import { getAllMaps, getGameMap } from '../systems/maps'
import { isQuestCompleted } from '../systems/questRuntime'
import { resolveName } from '../systems/contentNames'
import { getQuest } from '../systems/questContent'

const emit = defineEmits<{ close: [] }>()

interface Row {
  mapId: string
  name: string
  status: 'here' | 'open' | 'locked'
  lockHint: string
}

function lockOf(mapId: string): string | null {
  for (const m of getAllMaps()) {
    for (const p of m.portals) {
      if (p.to.map === mapId && p.lockQuest && !isQuestCompleted(p.lockQuest)) return p.lockHint ?? '主线推进后开放'
    }
  }
  return null
}

const currentMap = ref(getGameMap('').id)
const unArea = bus.on('area:enter', ({ name }) => {
  const found = getAllMaps().find((m) => m.name === name)
  if (found) currentMap.value = found.id
})
onUnmounted(() => unArea())

const rows = computed<Row[]>(() =>
  getAllMaps().map((m) => {
    const lock = lockOf(m.id)
    return {
      mapId: m.id,
      name: m.regionId ? resolveName('region', m.regionId) : m.name,
      status: m.id === currentMap.value ? 'here' : lock ? 'locked' : 'open',
      lockHint: lock ?? '',
    }
  }),
)
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="panel ink-frame">
      <div class="head">
        <span class="title">山河图 · 人界·越国</span>
        <button class="close ink-btn" @click="emit('close')">✕</button>
      </div>
      <p class="sub">随主线推进，新的山川将逐一开放</p>
      <ul class="list">
        <li v-for="row in rows" :key="row.mapId" :class="row.status">
          <span class="dot" />
          <span class="mname">{{ row.name }}</span>
          <span v-if="row.status === 'here'" class="here">此地</span>
          <span v-else-if="row.status === 'locked'" class="lock">{{ row.lockHint }}</span>
          <span v-else class="ok">可前往</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 7, 4, 0.6);
}
.panel {
  width: min(92vw, 420px);
  max-height: calc(100dvh - 40px);
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title {
  font-family: var(--font-display);
  font-size: 17px;
  letter-spacing: 3px;
  color: #ffd97a;
}
.close {
  min-height: 32px;
  min-width: 32px;
}
.sub {
  margin: 0;
  font-size: 12px;
  opacity: 0.65;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border: 1px solid rgba(139, 105, 20, 0.45);
  border-radius: 8px;
  font-size: 13px;
  color: #e8dcc0;
}
.list li.locked {
  opacity: 0.55;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #7ec8a9;
  flex: none;
}
.locked .dot {
  background: #6b5f4a;
}
.mname {
  font-weight: bold;
}
.lock {
  margin-left: auto;
  font-size: 11px;
  color: #d9a06a;
  text-align: right;
}
.ok {
  margin-left: auto;
  font-size: 11px;
  color: #9fe0a9;
}
.here {
  margin-left: auto;
  font-size: 11px;
  color: #ffd97a;
}
</style>
