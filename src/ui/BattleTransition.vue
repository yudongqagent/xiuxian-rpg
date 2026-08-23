<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { bus } from '../engine/eventBus'

const IRIS_MS = 380
const HOLD_MS = 90

const phase = ref<'idle' | 'close' | 'open'>('idle')
let openTimer = 0
let endTimer = 0

const unStart = bus.on('battle:start', () => {
  if (phase.value !== 'idle') return
  phase.value = 'close'
  openTimer = window.setTimeout(() => {
    phase.value = 'open'
    endTimer = window.setTimeout(() => (phase.value = 'idle'), IRIS_MS + 60)
  }, IRIS_MS + HOLD_MS)
})

onUnmounted(() => {
  unStart()
  window.clearTimeout(openTimer)
  window.clearTimeout(endTimer)
})
</script>

<template>
  <div v-if="phase !== 'idle'" class="iris" :class="phase">
    <i class="hole" />
  </div>
</template>

<style scoped>
.iris {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  pointer-events: none;
}
.iris.close {
  pointer-events: auto;
}
.hole {
  display: block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  box-shadow:
    0 0 0 300vmax #0a0704,
    inset 0 0 24px 8px rgba(10, 7, 4, 0.9);
  will-change: transform;
}
.close .hole {
  transform-origin: center;
  animation: irisClose 380ms cubic-bezier(0.55, 0, 0.85, 0.4) forwards;
}
.open .hole {
  transform-origin: center;
  animation: irisOpen 420ms cubic-bezier(0.2, 0.6, 0.35, 1) forwards;
}
@keyframes irisClose {
  from {
    transform: scale(260);
  }
  to {
    transform: scale(0.02);
  }
}
@keyframes irisOpen {
  from {
    transform: scale(0.02);
  }
  to {
    transform: scale(260);
  }
}
</style>
