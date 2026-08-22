<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { bus } from '../engine/eventBus'
import { EnemySchema } from '../systems/schemas'
import {
  attemptFlee,
  createBattle,
  playerAttack,
  playerSkill,
  type BattleAction,
  type BattleState,
} from '../systems/combat'
import huiLang from '../../content/enemies/hui_lang.json'

const TEMPLATES: Record<string, unknown> = { hui_lang: huiLang }
const SKILL_COST_HINT = 8

const active = ref(false)
const state = ref<BattleState | null>(null)

const unsubStart = bus.on('battle:start', ({ enemyId }) => {
  const template = EnemySchema.parse(TEMPLATES[enemyId])
  state.value = createBattle(template)
  active.value = true
})
onUnmounted(unsubStart)

function act(action: BattleAction): void {
  if (!state.value || state.value.over) return
  if (action === 'attack') state.value = playerAttack(state.value)
  else if (action === 'skill') state.value = playerSkill(state.value)
  else state.value = attemptFlee(state.value)
}

function close(): void {
  if (!state.value) return
  bus.emit('battle:end', { win: state.value.win })
  active.value = false
  state.value = null
}

function pct(v: number, max: number): string {
  return `${Math.round((v / max) * 100)}%`
}
</script>

<template>
  <div v-if="active && state" class="overlay">
    <div class="panel">
      <div class="row" v-for="side in [
        { name: state.player.name, hp: state.player.hp, maxHp: state.player.maxHp, qi: state.player.qi, maxQi: state.player.maxQi },
        { name: state.enemy.name, hp: state.enemy.hp, maxHp: state.enemy.maxHp, qi: 0, maxQi: 0 },
      ]" :key="side.name">
        <span class="who">{{ side.name }}</span>
        <div class="bars">
          <div class="bar"><i class="hp" :style="{ width: pct(side.hp, side.maxHp) }" /></div>
          <div v-if="side.maxQi > 0" class="bar"><i class="qi" :style="{ width: pct(side.qi, side.maxQi) }" /></div>
        </div>
        <span class="num">{{ side.hp }}/{{ side.maxHp }}</span>
      </div>

      <div class="log">
        <p v-for="(line, i) in state.log" :key="i">{{ line }}</p>
      </div>

      <div v-if="!state.over" class="actions">
        <button @click="act('attack')">攻击</button>
        <button :disabled="state.player.qi < SKILL_COST_HINT" @click="act('skill')">
          法术(灵气-{{ SKILL_COST_HINT }})
        </button>
        <button @click="act('flee')">逃跑</button>
      </div>
      <div v-else class="actions">
        <button @click="close">{{ state.win ? '战斗胜利，继续' : '离开' }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  z-index: 10;
}
.panel {
  width: min(92vw, 420px);
  background: rgba(26, 18, 11, 0.95);
  border: 1px solid #8b6914;
  border-radius: 12px;
  padding: 16px;
  color: #e8dcc0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.who {
  width: 56px;
  white-space: nowrap;
}
.bars {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.bar {
  height: 7px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.15);
  overflow: hidden;
}
.bar i {
  display: block;
  height: 100%;
  transition: width 0.25s ease;
}
.bar .hp {
  background: linear-gradient(90deg, #b04a3a, #d98a6a);
}
.bar .qi {
  background: linear-gradient(90deg, #3a6fb0, #7ec8e8);
}
.num {
  width: 52px;
  text-align: right;
  font-size: 11px;
  opacity: 0.75;
}
.log {
  height: 110px;
  overflow-y: auto;
  border: 1px solid rgba(139, 105, 20, 0.5);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.7;
}
.log p {
  margin: 0;
}
.actions {
  display: flex;
  gap: 10px;
}
.actions button {
  flex: 1;
  min-height: 44px;
  border: 1px solid #8b6914;
  border-radius: 8px;
  background: rgba(58, 42, 24, 0.85);
  color: #e8dcc0;
  font-size: 14px;
}
.actions button:disabled {
  opacity: 0.4;
}
</style>
