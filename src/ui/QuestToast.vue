<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { bus } from '../engine/eventBus'

interface ToastItem {
  id: number
  text: string
  kind: 'info' | 'success'
}

const TOAST_LIFETIME_MS = 3200
const MAX_TOASTS = 3

const items = ref<ToastItem[]>([])
let nextId = 1
const timers = new Set<ReturnType<typeof setTimeout>>()

const un = bus.on('quest:notify', ({ text, kind }) => {
  const item: ToastItem = { id: nextId++, text, kind: kind ?? 'info' }
  items.value = [...items.value.slice(-(MAX_TOASTS - 1)), item]
  const timer = setTimeout(() => {
    timers.delete(timer)
    items.value = items.value.filter((t) => t.id !== item.id)
  }, TOAST_LIFETIME_MS)
  timers.add(timer)
})

onUnmounted(() => {
  un()
  timers.forEach(clearTimeout)
})
</script>

<template>
  <div class="toasts">
    <transition-group name="toast">
      <div v-for="t in items" :key="t.id" class="toast" :class="t.kind">{{ t.text }}</div>
    </transition-group>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  top: calc(96px + env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  z-index: 20;
  max-width: 86vw;
}
.toast {
  border: 1px solid rgba(139, 105, 20, 0.7);
  border-radius: 10px;
  background: rgba(26, 18, 11, 0.92);
  color: #e8dcc0;
  font-size: 13px;
  line-height: 1.6;
  padding: 8px 14px;
  text-align: center;
}
.toast.success {
  border-color: #7ec8a9;
  color: #cfe8b5;
}
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
