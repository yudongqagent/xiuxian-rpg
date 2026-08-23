<script setup lang="ts">
import { ref } from 'vue'

const VERSION = 'v0.1.0'
const FADE_MS = 850

const leaving = ref(false)
const gone = ref(false)

function start(): void {
  if (leaving.value) return
  leaving.value = true
  window.setTimeout(() => (gone.value = true), FADE_MS)
}
</script>

<template>
  <div v-if="!gone" class="splash" :class="{ leaving }">
    <i class="stars" />
    <i class="moon" />
    <i class="hills far" />
    <i class="hills near" />
    <i class="mist" />
    <span class="seal">仙</span>
    <h1 class="title">凡人仙途</h1>
    <p class="sub">仙路漫漫 · 凡躯亦可问长生</p>
    <button class="start ink-btn" @click="start">开 始 游 戏</button>
    <span class="ver">{{ VERSION }} · 垂直切片</span>
  </div>
</template>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  overflow: hidden;
  background:
    radial-gradient(140% 90% at 78% 12%, rgba(120, 96, 60, 0.2), transparent 55%),
    linear-gradient(180deg, #101722 0%, #171208 55%, #1a120b 100%);
  transition: opacity 0.85s ease, filter 0.85s ease;
}
.splash.leaving {
  opacity: 0;
  filter: blur(3px);
  pointer-events: none;
}
.stars,
.moon,
.hills,
.mist,
.seal {
  pointer-events: none;
}
.stars {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 12% 18%, rgba(240, 230, 200, 0.8) 0 1px, transparent 1.6px),
    radial-gradient(circle at 28% 9%, rgba(240, 230, 200, 0.6) 0 1px, transparent 1.6px),
    radial-gradient(circle at 44% 21%, rgba(240, 230, 200, 0.5) 0 1px, transparent 1.6px),
    radial-gradient(circle at 63% 7%, rgba(240, 230, 200, 0.7) 0 1px, transparent 1.6px),
    radial-gradient(circle at 82% 26%, rgba(240, 230, 200, 0.5) 0 1px, transparent 1.6px),
    radial-gradient(circle at 91% 13%, rgba(240, 230, 200, 0.7) 0 1px, transparent 1.6px);
  animation: twinkle 4.2s ease-in-out infinite alternate;
}
@keyframes twinkle {
  from {
    opacity: 0.45;
  }
  to {
    opacity: 1;
  }
}
.moon {
  position: absolute;
  top: 11%;
  right: 16%;
  width: 74px;
  height: 74px;
  border-radius: 50%;
  background: radial-gradient(circle at 38% 34%, #fdf6dd, #e8d99e 62%, #cbb87a);
  box-shadow:
    0 0 34px 10px rgba(248, 232, 178, 0.28),
    0 0 90px 30px rgba(248, 232, 178, 0.14);
}
.hills {
  position: absolute;
  left: -4%;
  right: -4%;
  bottom: 0;
}
.hills.far {
  height: 38%;
  clip-path: polygon(0 100%, 0 58%, 14% 36%, 27% 52%, 41% 24%, 56% 46%, 70% 20%, 84% 42%, 100% 30%, 100% 100%);
  background: linear-gradient(180deg, rgba(52, 48, 40, 0.75), rgba(30, 26, 20, 0.9));
}
.hills.near {
  height: 26%;
  clip-path: polygon(0 100%, 0 66%, 18% 44%, 33% 64%, 52% 34%, 71% 60%, 86% 42%, 100% 58%, 100% 100%);
  background: linear-gradient(180deg, #241c12, #14100a);
}
.mist {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 17%;
  height: 14%;
  background: linear-gradient(180deg, transparent, rgba(216, 200, 160, 0.09), transparent);
}
.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(44px, 10vw, 68px);
  font-weight: 700;
  letter-spacing: 0.22em;
  text-indent: 0.22em;
  color: #f0dfae;
  text-shadow:
    0 0 16px rgba(255, 215, 122, 0.35),
    0 1px 0 #6e5218,
    0 3px 0 #3d2d0e,
    0 6px 18px rgba(0, 0, 0, 0.65);
}
.sub {
  margin: 0;
  font-family: var(--font-display);
  font-size: 15px;
  letter-spacing: 0.4em;
  text-indent: 0.4em;
  color: rgba(232, 220, 192, 0.72);
}
.start {
  min-width: 218px;
  min-height: 50px;
  margin-top: 14px;
  font-size: 17px;
}
.ver {
  position: absolute;
  bottom: calc(14px + env(safe-area-inset-bottom));
  font-size: 11px;
  letter-spacing: 0.14em;
  opacity: 0.5;
}
.seal {
  position: absolute;
  top: calc(18px + env(safe-area-inset-top));
  right: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 6px;
  background: #a03226;
  color: #f6ead0;
  font-family: var(--font-display);
  font-size: 19px;
  transform: rotate(4deg);
  box-shadow: inset 0 0 0 1.5px rgba(246, 234, 208, 0.65);
}
</style>
