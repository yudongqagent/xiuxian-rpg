<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { bus } from '../engine/eventBus'
import { listSaves, MANUAL_SLOTS, type SaveData } from '../engine/save'
import { getPlayer, realmLabel } from '../systems/player'
import { getGameMap, DEFAULT_MAP_ID } from '../systems/maps'

const emit = defineEmits<{ close: [] }>()

interface Row {
  slot: string
  label: string
  data: SaveData | null
}

const rows = ref<Row[]>([])

async function refresh(): Promise<void> {
  const all = await listSaves()
  rows.value = [
    { slot: 'auto', label: '自动存档', data: all['auto'] ?? null },
    ...MANUAL_SLOTS.map((slot) => ({ slot, label: `手动档 ${slot.slice(1)}`, data: all[slot] ?? null })),
  ]
}

function meta(d: SaveData): string {
  const time = new Date(d.savedAt).toLocaleString('zh-CN', { hour12: false })
  const realm = realmLabel(d.player?.level ?? getPlayer().level)
  let mapName = d.mapId ?? DEFAULT_MAP_ID
  try {
    mapName = getGameMap(mapName).name
  } catch {
    /* 未知地图回退 id */
  }
  return `${time} · ${realm} · ${mapName}`
}

function save(slot: string): void {
  bus.emit('save:write', { slot })
  window.setTimeout(() => void refresh(), 300)
}

function load(slot: string): void {
  bus.emit('save:load', { slot })
  emit('close')
}

onMounted(() => void refresh())
</script>

<template>
  <div class="panel ink-frame">
    <div class="head">
      <span class="title">存 档</span>
      <button class="close" @click="$emit('close')">✕</button>
    </div>
    <div v-for="r in rows" :key="r.slot" class="row">
      <div class="info">
        <span class="slot">{{ r.label }}</span>
        <span v-if="r.data" class="meta">{{ meta(r.data) }}</span>
        <span v-else class="meta empty">—— 空 ——</span>
      </div>
      <template v-if="r.slot !== 'auto'">
        <button class="ink-btn" @click="save(r.slot)">保存</button>
        <button class="ink-btn" :disabled="!r.data" @click="load(r.slot)">读取</button>
      </template>
      <span v-else class="auto-tag">自动</span>
    </div>
    <p class="hint">自动存档每 5 秒写入；手动档可随时覆盖。</p>
  </div>
</template>

<style scoped>
.panel {
  position: fixed;
  z-index: 30;
  inset: auto 0 0 0;
  max-height: 62vh;
  overflow: auto;
  padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.title {
  color: #ffd97a;
  font-size: 15px;
  letter-spacing: 6px;
}
.close {
  min-width: 32px;
  min-height: 32px;
  border: 1px solid rgba(139, 105, 20, 0.5);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: #e8dcc0;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 4px;
  border-top: 1px solid rgba(139, 105, 20, 0.35);
}
.info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.slot {
  font-size: 14px;
  color: #f2e6c8;
}
.meta {
  font-size: 11px;
  opacity: 0.75;
}
.meta.empty {
  opacity: 0.4;
}
.auto-tag {
  font-size: 12px;
  opacity: 0.5;
  border: 1px solid rgba(232, 220, 192, 0.3);
  border-radius: 6px;
  padding: 4px 10px;
}
.hint {
  margin: 10px 0 0;
  font-size: 11px;
  opacity: 0.55;
}
</style>
