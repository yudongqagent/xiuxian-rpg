<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { bus } from '../engine/eventBus'

const BANNER_MS = 2600

const name = ref('')
const visible = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const un = bus.on('area:enter', ({ name: n }) => {
  name.value = n
  visible.value = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => (visible.value = false), BANNER_MS)
})

onUnmounted(() => {
  un()
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <Transition name="banner">
    <div v-if="visible" class="area-banner">
      <span class="rule" />
      <span class="name">{{ name }}</span>
      <span class="rule" />
    </div>
  </Transition>
</template>

<style scoped>
.area-banner {
  position: fixed;
  top: calc(18% + env(safe-area-inset-top));
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  pointer-events: none;
}
.name {
  color: #f2e6c8;
  font-size: 26px;
  letter-spacing: 10px;
  text-indent: 10px;
  text-shadow: 0 0 12px rgba(0, 0, 0, 0.9), 0 2px 4px rgba(0, 0, 0, 0.8);
  font-weight: 600;
}
.rule {
  width: 56px;
  height: 1px;
  background: linear-gradient(90deg, transparent, #c9a86a);
}
.rule:last-child {
  background: linear-gradient(90deg, #c9a86a, transparent);
}
.banner-enter-active,
.banner-leave-active {
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.banner-enter-from,
.banner-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
