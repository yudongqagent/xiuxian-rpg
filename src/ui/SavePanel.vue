<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { bus } from '../engine/eventBus'
import { exportSaveCode, importSaveCode, listSaves, MANUAL_SLOTS, type SaveData } from '../engine/save'
import { getPlayer, realmLabel } from '../systems/player'
import { getGameMap, DEFAULT_MAP_ID } from '../systems/maps'

const emit = defineEmits<{ close: [] }>()

interface Row {
  slot: string
  label: string
  data: SaveData | null
}

const rows = ref<Row[]>([])
const codeText = ref('')
const importSlot = ref('s3')
const importMsg = ref('')

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

async function exportCode(slot: string): Promise<void> {
  const code = await exportSaveCode(slot as 's1' | 's2' | 's3')
  if (!code) {
    importMsg.value = '该档位为空，无法导出'
    return
  }
  codeText.value = code
  importMsg.value = `已导出 ${slot} 存档码（${code.length} 字符），全选复制分享`
}

async function importCode(): Promise<void> {
  const ok = await importSaveCode(codeText.value, importSlot.value as 's1' | 's2' | 's3')
  importMsg.value = ok ? `已导入到 ${importSlot.value}` : '存档码无效（格式或校验失败）'
  if (ok) await refresh()
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
        <button v-if="r.slot !== 'auto'" class="ink-btn small" :disabled="!r.data" @click="exportCode(r.slot)">导出码</button>
      </template>
      <span v-else class="auto-tag">自动</span>
    </div>
    <p class="hint">自动存档每 5 秒写入；手动档可随时覆盖。</p>
    <div class="xcode">
      <textarea
        v-model="codeText"
        placeholder="在此粘贴或导出生成存档码"
        spellcheck="false"
      />
      <div class="xops">
        <select v-model="importSlot">
          <option value="s1">导入到 手动档1</option>
          <option value="s2">导入到 手动档2</option>
          <option value="s3">导入到 手动档3</option>
        </select>
        <button class="ink-btn" @click="importCode">导入</button>
        <span class="msg">{{ importMsg }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.xcode {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.xcode textarea {
  width: 100%;
  height: 64px;
  resize: none;
  border: 1px solid rgba(139, 105, 20, 0.5);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.35);
  color: #e8dcc0;
  font-size: 11px;
  padding: 8px;
}
.xops {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.xops select {
  border: 1px solid #8b6914;
  border-radius: 6px;
  background: rgba(26, 18, 11, 0.85);
  color: #e8dcc0;
  padding: 6px;
}
.msg {
  opacity: 0.75;
  font-size: 11px;
}
.small {
  min-height: 32px;
}
</style>
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
