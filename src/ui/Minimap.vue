<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { bus } from '../engine/eventBus'

interface Snapshot {
  rows: string[]
  player: { x: number; y: number }
  npcs: Array<{ x: number; y: number }>
  portals: Array<{ x: number; y: number; locked: boolean }>
}
const snap = ref<Snapshot | null>(null)
const pos = ref({ x: 0, y: 0 })
const unMap = bus.on('map:minimap', (s) => {
  snap.value = s
  pos.value = { ...s.player }
})
const unPos = bus.on('player:position', (p) => {
  pos.value = { x: p.x / 32, y: p.y / 32 }
})
onUnmounted(() => {
  unMap()
  unPos()
})

const CELL = 3
const canvasEl = ref<HTMLCanvasElement | null>(null)

function draw(): void {
  const s = snap.value
  const canvas = canvasEl.value
  if (!s || !canvas) return
  const w = s.rows[0]?.length ?? 0
  const h = s.rows.length
  canvas.width = w * CELL
  canvas.height = h * CELL
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#0a0704'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = s.rows[y]?.[x] ?? ' '
      if ('.,FDB'.includes(c)) ctx.fillStyle = '#2e4030'
      else if (c === '~') ctx.fillStyle = '#274a63'
      else ctx.fillStyle = '#171310'
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
    }
  }
  for (const n of s.npcs) {
    ctx.fillStyle = '#8fe89a'
    ctx.fillRect(n.x * CELL - 1, n.y * CELL - 1, CELL + 2, CELL + 2)
  }
  for (const p of s.portals) {
    ctx.fillStyle = p.locked ? '#6b5f4a' : '#b06ad9'
    ctx.fillRect(p.x * CELL - 1, p.y * CELL - 1, CELL + 2, CELL + 2)
  }
  ctx.fillStyle = '#ffd97a'
  ctx.beginPath()
  ctx.arc(pos.value.x * CELL, pos.value.y * CELL, 2.6, 0, Math.PI * 2)
  ctx.fill()
}

watch([snap, pos], draw, { deep: true })
</script>

<template>
  <div v-if="snap" class="minimap">
    <canvas ref="canvasEl" />
  </div>
</template>

<style scoped>
.minimap {
  position: fixed;
  right: calc(10px + env(safe-area-inset-right));
  top: calc(64px + env(safe-area-inset-top));
  z-index: 4;
  border: 1px solid rgba(139, 105, 20, 0.6);
  border-radius: 6px;
  overflow: hidden;
  opacity: 0.92;
  pointer-events: none;
}
canvas {
  display: block;
  max-width: 30vw;
  height: auto;
}
</style>
