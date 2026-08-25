<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { bus } from '../engine/eventBus'
import {
  attemptBreakthrough,
  breakthroughChance,
  effectiveStats,
  expToNext,
  gateAt,
  getPlayer,
  realmLabel,
  subscribePlayer,
  updatePlayer,
  type GateInfo,
} from '../systems/player'
import { ITEMS } from '../systems/itemBook'
import { regionQiDensity } from '../systems/contentNames'

const emit = defineEmits<{ close: [] }>()

const player = ref(getPlayer())
const unsub = subscribePlayer(() => (player.value = getPlayer()))
const regionId = ref<string | undefined>(undefined)
const unArea = bus.on('area:enter', ({ regionId: rid }) => (regionId.value = rid))
onUnmounted(() => {
  unsub()
  unArea()
})

const gate = computed<GateInfo | null>(() => gateAt(player.value.level))
const s = computed(() => effectiveStats(player.value.level, player.value.equipped, (id) => ITEMS[id]))
const expFull = computed(() => gate.value && player.value.exp >= expToNext(player.value.level))
const qiFull = computed(() => player.value.qi >= s.value.maxQi)
const pillNeed = computed(() =>
  gate.value?.realm === '化神' && gate.value.pillId === 'xi_sui_dan' ? 2 : 1,
)
const pillCount = computed(() =>
  gate.value ? (player.value.inventory[gate.value.pillId] ?? 0) : 0,
)
const chance = computed(() =>
  gate.value ? breakthroughChance(gate.value, regionId.value, Math.max(pillCount.value, 1)) : 0,
)
const luckyName = computed(() =>
  regionId.value === 'shanggu_dongfu' ? '上古洞府（灵脉）+15%' : regionId.value === 'huangfeng_gu' ? '黄枫谷（灵气氤氲）+5%' : '无',
)

const result = ref<{ success: boolean; chance: number } | null>(null)
const reason = ref<string | null>(null)

const REASON_TEXT: Record<string, string> = {
  exp_not_full: '修为尚未圆满，且先行功。',
  qi_not_full: '灵气未满，难以冲关。',
  no_pill: '丹药不济，强行冲关九死一生。',
}

function attempt(): void {
  if (!gate.value) return
  reason.value = null
  const res = attemptBreakthrough(getPlayer(), gate.value, regionId.value)
  if (res.reason) {
    reason.value = REASON_TEXT[res.reason] ?? '时机未至。'
    return
  }
  updatePlayer(() => res.player)
  result.value = { success: res.success, chance: res.chance }
  bus.emit('player:stats')
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="panel ink-frame">
      <div class="head">
        <span class="title">冲击瓶颈</span>
        <button class="close ink-btn" @click="emit('close')">✕</button>
      </div>

      <template v-if="gate && !result">
        <p class="desc">
          修为已至{{ gate.realm }}门槛。需灵气圆满、丹药辅佐，方可尝试破境——失败则丹力反噬、重伤呕血，境界不堕。
        </p>
        <ul class="conds">
          <li :class="{ ok: expFull }">修为圆满 {{ player.exp }}/{{ expToNext(player.level) }}</li>
          <li :class="{ ok: qiFull }">灵气圆满 {{ player.qi }}/{{ s.maxQi }}</li>
          <li :class="{ ok: pillCount >= pillNeed }">
            {{ gate?.pillName }} ×{{ pillCount }}/{{ pillNeed }}
          </li>
          <li>机缘加成：{{ luckyName }}</li>
        </ul>
        <p class="chance">成功率 {{ Math.round(chance * 100) }}%</p>
        <p v-if="reason" class="reason">{{ reason }}</p>
        <button class="go ink-btn" :disabled="!expFull || !qiFull || pillCount < pillNeed" @click="attempt">
          冲击{{ gate.realm }}大关
        </button>
      </template>

      <template v-else-if="result">
        <div v-if="result.success" class="verdict win">
          <p class="big">破境成功！</p>
          <p>丹力化开，气海翻涌——你已是{{ realmLabel(getPlayer().level) }}修士。气机圆满，神清气爽。</p>
        </div>
        <div v-else class="verdict lose">
          <p class="big">破境失败……</p>
          <p>丹力反噬，气血翻涌，你呕血昏厥。所幸道基未损，境界不堕——重整旗鼓，来日再战。</p>
        </div>
        <button class="go ink-btn" @click="emit('close')">继续</button>
      </template>

      <p v-else class="desc">此刻并无瓶颈可破。</p>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 7, 4, 0.6);
}
.panel {
  width: min(92vw, 420px);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title {
  font-family: var(--font-display);
  font-size: 18px;
  letter-spacing: 4px;
  color: #ffd97a;
}
.close {
  min-height: 32px;
  min-width: 32px;
}
.desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: #e8dcc0;
  opacity: 0.85;
}
.conds {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}
.conds li {
  color: #d98a6a;
}
.conds li.ok {
  color: #9fe0a9;
}
.chance {
  margin: 0;
  font-size: 16px;
  color: #ffd97a;
  text-align: center;
  font-family: var(--font-display);
  letter-spacing: 2px;
}
.reason {
  margin: 0;
  font-size: 12px;
  color: #e88a7a;
}
.go {
  min-height: 44px;
  font-size: 15px;
  letter-spacing: 2px;
}
.go:disabled {
  opacity: 0.45;
}
.verdict {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  line-height: 1.7;
}
.verdict .big {
  margin: 0;
  font-family: var(--font-display);
  font-size: 22px;
  letter-spacing: 6px;
}
.verdict.win .big {
  color: #ffd97a;
  text-shadow: 0 0 14px rgba(255, 217, 122, 0.4);
}
.verdict.lose .big {
  color: #e88a7a;
}
.verdict p {
  margin: 0;
  color: #e8dcc0;
}
</style>
