<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { bus } from '../engine/eventBus'

const active = ref(false)
const mult = ref(1)
interface Floater {
  id: number
  text: string
  cls: string
}
const floaters = ref<Floater[]>([])
let seq = 0

const unState = bus.on('meditate:state', ({ active: a, mult: m }) => {
  active.value = a
  mult.value = m
  if (a) chime(392, 0.12)
})
const unTick = bus.on('meditate:tick', ({ hp, qi }) => {
  if (qi > 0) pushFloater(`+${qi} 灵`, 'qi')
  if (hp > 0) pushFloater(`+${hp} 血`, 'hp')
})

function pushFloater(text: string, cls: string): void {
  const id = seq++
  floaters.value.push({ id, text, cls })
  window.setTimeout(() => {
    floaters.value = floaters.value.filter((f) => f.id !== id)
  }, FLOATER_LIFE_MS)
}

const FLOATER_LIFE_MS = 1100
const CHIME_GAIN = 0.04
let audio: AudioContext | undefined

function chime(freq: number, dur: number): void {
  try {
    audio ??= new AudioContext()
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(CHIME_GAIN, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur)
    osc.connect(gain).connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + dur)
  } catch {
    audio = undefined
  }
}

function toggle(): void {
  chime(active.value ? 262 : 330, 0.1)
  bus.emit('meditate:toggle')
}

onUnmounted(() => {
  unState()
  unTick()
  void audio?.close().catch(() => undefined)
  audio = undefined
})
</script>

<template>
  <div class="meditate-wrap">
    <span v-for="f in floaters" :key="f.id" class="floater" :class="f.cls">{{ f.text }}</span>
    <button class="fab" :class="{ on: active }" :aria-pressed="active" @click="toggle">
      <span class="label">{{ active ? '吐纳中' : '打坐' }}</span>
      <span v-if="active" class="mult">灵气 ×{{ mult }}</span>
    </button>
  </div>
</template>

<style scoped>
.meditate-wrap {
  position: fixed;
  right: calc(16px + env(safe-area-inset-right));
  bottom: calc(96px + env(safe-area-inset-bottom));
  z-index: 5;
  pointer-events: none;
}
.fab {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 1px solid #8b6914;
  background: rgba(26, 18, 11, 0.82);
  color: #e8dcc0;
  font-size: 14px;
  letter-spacing: 0.1em;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
}
.fab.on {
  border-color: #ffd97a;
  color: #ffd97a;
  animation: breathe 2s ease-in-out infinite;
}
@keyframes breathe {
  0%,
  100% {
    box-shadow:
      0 0 6px 2px rgba(126, 200, 169, 0.25),
      0 2px 10px rgba(0, 0, 0, 0.45);
  }
  50% {
    box-shadow:
      0 0 18px 6px rgba(126, 200, 169, 0.55),
      0 2px 10px rgba(0, 0, 0, 0.45);
  }
}
.mult {
  font-size: 9px;
  opacity: 0.75;
  letter-spacing: 0;
}
.floater {
  position: absolute;
  right: 8px;
  top: -6px;
  font-size: 13px;
  font-weight: bold;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  animation: rise 1.1s ease-out forwards;
  white-space: nowrap;
}
.floater.qi {
  color: #7ec8e8;
}
.floater.hp {
  color: #d98a6a;
  animation-delay: 0.12s;
}
@keyframes rise {
  0% {
    transform: translateY(0);
    opacity: 0;
  }
  18% {
    opacity: 1;
  }
  100% {
    transform: translateY(-34px);
    opacity: 0;
  }
}
</style>
