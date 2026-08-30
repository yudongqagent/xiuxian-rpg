<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { bus } from '../engine/eventBus'
import { getPlayer, realmLabel } from '../systems/player'
import { ageOf } from '../systems/lifespan'
import { getWorldTime, yearOf } from '../systems/time'

// 2.0 寿元（V1.5）：寿元耗尽即此世终结（多结局之一）。世界时钟已被冻结，本面板为终局画幕。
const open = ref(false)
const summary = ref({ year: 1, realm: '', age: 22, remaining: 0 })
const un = bus.on('aging:end', () => {
  const day = getWorldTime().day
  const p = getPlayer()
  open.value = true
  summary.value = {
    year: yearOf({ day, shichen: 0 }),
    realm: realmLabel(p.level),
    age: ageOf(day),
    remaining: 120 - ageOf(day),
  }
})
onUnmounted(() => un())
</script>

<template>
  <div v-if="open" class="ending">
    <div class="panel ink-frame">
      <p class="title">寿尽而终</p>
      <p class="body">此世历尽岁月的消磨，寿元终归耗尽——</p>
      <p class="verdict">
        <span class="hl">结局 · 寿数尽</span><br />
        一介凡人未能冲破寿关，唯有濛然物化。道途戛然而止，唯余此世未完之愿。
      </p>
      <p class="meta">{{ summary.realm }} · 享年 {{ summary.age }} 岁（寿余 {{ summary.remaining }}）· 第 {{ summary.year }} 载 · 此世已定格</p>
      <button class="go ink-btn" @click="open = false">再看一眼此世</button>
    </div>
  </div>
</template>

<style scoped>
.ending {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, rgba(10, 7, 4, 0.78) 0%, rgba(0, 0, 0, 0.86) 100%);
}
.panel {
  width: min(90vw, 400px);
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: center;
}
.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 24px;
  letter-spacing: 8px;
  color: #e88a7a;
  text-shadow: 0 0 16px rgba(232, 138, 122, 0.35);
}
.body {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: #e8dcc0;
  opacity: 0.85;
}
.verdict {
  margin: 0;
  font-size: 13px;
  line-height: 1.9;
  color: #e8dcc0;
}
.verdict .hl {
  color: #ffd97a;
  font-family: var(--font-display);
  letter-spacing: 3px;
}
.meta {
  margin: 0;
  font-size: 11px;
  color: #a08f78;
}
.go {
  min-height: 44px;
  font-size: 15px;
  letter-spacing: 3px;
}
</style>