<script setup lang="ts">
import { ref } from 'vue'
import { bus } from '../engine/eventBus'

const R = 52
const knob = ref({ x: 0, y: 0 })
let pid: number | null = null

function move(e: PointerEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  let dx = e.clientX - cx
  let dy = e.clientY - cy
  const len = Math.hypot(dx, dy) || 1
  const clamped = Math.min(len, R)
  dx = (dx / len) * clamped
  dy = (dy / len) * clamped
  knob.value = { x: dx, y: dy }
  bus.emit('joystick:move', { x: dx / R, y: dy / R })
}

function end() {
  pid = null
  knob.value = { x: 0, y: 0 }
  bus.emit('joystick:end')
}
</script>

<template>
  <div
    class="joy"
    @pointerdown="
      (e) => {
        pid = e.pointerId
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        move(e)
      }
    "
    @pointermove="(e) => pid !== null && move(e)"
    @pointerup="end"
    @pointercancel="end"
  >
    <div class="knob" :style="{ transform: `translate(${knob.x}px, ${knob.y}px)` }" />
  </div>
</template>

<style scoped>
.joy {
  position: fixed;
  left: 22px;
  bottom: calc(22px + env(safe-area-inset-bottom));
  width: 128px;
  height: 128px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.18);
  touch-action: none;
}
.knob {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 56px;
  height: 56px;
  margin: -28px 0 0 -28px;
  border-radius: 50%;
  background: rgba(240, 230, 200, 0.55);
  pointer-events: none;
}
</style>
