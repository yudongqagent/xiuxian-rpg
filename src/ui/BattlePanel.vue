<script setup lang="ts">
import { computed, onUnmounted, ref, toRaw } from 'vue'
import { bus } from '../engine/eventBus'
import { EnemySchema, ItemSchema, SkillSchema, type Enemy, type Item, type Skill } from '../systems/schemas'
import {
  attemptFlee,
  castSkill,
  createBattle,
  expReward,
  fleeChance,
  playerAttack,
  rollLoot,
  skillEffect,
  useItem,
  type BattleState,
} from '../systems/combat'
import {
  addItem,
  expToNext,
  getPlayer,
  grantExp,
  realmLabel,
  statsForLevel,
  subscribePlayer,
  syncAfterBattle,
  removeItem,
  updatePlayer,
} from '../systems/player'

import huiLang from '../../content/enemies/hui_lang.json'
import shanXiao from '../../content/enemies/shan_xiao.json'
import duZhu from '../../content/enemies/du_zhu.json'
import yeZhuWang from '../../content/enemies/ye_zhu_wang.json'
import huodanShu from '../../content/skills/huodan_shu.json'
import changchunGong from '../../content/skills/changchun_gong.json'
import zhayanJianfa from '../../content/skills/zhayan_jianfa.json'
import huiqiSan from '../../content/items/huiqi_san.json'
import huichunSan from '../../content/items/huichun_san.json'
import xiSuiDan from '../../content/items/xi_sui_dan.json'

const ENEMY_TEMPLATES: Record<string, Enemy> = Object.fromEntries(
  [huiLang, shanXiao, duZhu, yeZhuWang].map((raw) => {
    const e = EnemySchema.parse(raw)
    return [e.id, e]
  }),
)
const SKILL_BOOK: Record<string, Skill> = Object.fromEntries(
  [huodanShu, changchunGong, zhayanJianfa].map((raw) => {
    const s = SkillSchema.parse(raw)
    return [s.id, s]
  }),
)
const ITEM_BOOK: Record<string, Item> = Object.fromEntries(
  [huiqiSan, huichunSan, xiSuiDan].map((raw) => {
    const i = ItemSchema.parse(raw)
    return [i.id, i]
  }),
)

const FLOATER_LIFE_MS = 900

const active = ref(false)
const state = ref<BattleState | null>(null)
const submenu = ref<'none' | 'skill' | 'item'>('none')
const player = ref(getPlayer())
const unsubPlayer = subscribePlayer(() => (player.value = getPlayer()))

interface Floater {
  id: number
  text: string
  cls: string
}
const floaters = ref<Floater[]>([])
let floaterSeq = 0

const learnedSkills = computed(() =>
  player.value.skills.map((id) => SKILL_BOOK[id]).filter((s): s is Skill => Boolean(s)),
)
const battleItems = computed(() =>
  Object.entries(player.value.inventory)
    .map(([id, count]) => ({ item: ITEM_BOOK[id], count }))
    .filter((row): row is { item: Item; count: number } => Boolean(row.item) && row.count > 0),
)

const victory = ref<{ exp: number; loot: string[]; levelsGained: number; realmBefore: string } | null>(null)
const defeated = ref(false)

const unsubStart = bus.on('battle:start', ({ enemyId }) => {
  const template = ENEMY_TEMPLATES[enemyId]
  if (!template) throw new Error(`未知妖兽: ${enemyId}`)
  const p = getPlayer()
  const stats = statsForLevel(p.level)
  // combat.ts 内部用 structuredClone，不能传入响应式 Proxy
  const rawTemplate = toRaw(template)
  state.value = createBattle(rawTemplate, { stats, hp: p.hp, qi: p.qi })
  submenu.value = 'none'
  victory.value = null
  defeated.value = false
  floaters.value = []
  active.value = true
})
onUnmounted(() => {
  unsubStart()
  unsubPlayer()
})

function spawnFloaters(prev: BattleState | null, next: BattleState): void {
  if (!prev) return
  if (next.enemy.hp < prev.enemy.hp) pushFloater(`-${prev.enemy.hp - next.enemy.hp}`, 'foe')
  if (next.player.hp < prev.player.hp) pushFloater(`-${prev.player.hp - next.player.hp}`, 'self')
  if (next.player.hp > prev.player.hp) pushFloater(`+${next.player.hp - prev.player.hp}`, 'heal')
}

function pushFloater(text: string, cls: string): void {
  const id = floaterSeq++
  floaters.value.push({ id, text, cls })
  setTimeout(() => {
    floaters.value = floaters.value.filter((f) => f.id !== id)
  }, FLOATER_LIFE_MS)
}

function apply(next: BattleState): void {
  const prev = toRaw(state.value) as BattleState | null
  spawnFloaters(prev, next)
  state.value = next
  submenu.value = 'none'
  if (next.over && next.win && !victory.value) settleVictory(next)
  if (next.over && !next.win && !next.fled && !defeated.value) defeated.value = true
}

function settleVictory(final: BattleState): void {
  const enemyId = Object.keys(ENEMY_TEMPLATES).find((id) => ENEMY_TEMPLATES[id].name === final.enemy.name)
  const template = enemyId ? ENEMY_TEMPLATES[enemyId] : undefined
  const exp = template ? expReward(toRaw(template)) : 0
  const loot = rollLoot(template?.loot, Math.random)
  updatePlayer((p) => {
    let np = syncAfterBattle(p, final.player.hp, final.player.qi)
    for (const itemId of loot) np = addItem(np, itemId)
    return grantExp(np, exp).player
  })
  const levelsGained = getPlayer().level - playerBeforeLevel
  const lootNames = loot.map((id) => ITEM_BOOK[id]?.name ?? id)
  victory.value = { exp, loot: lootNames, levelsGained, realmBefore: realmLabel(playerBeforeLevel) }
  for (const itemId of loot) bus.emit('item:acquired', { itemId, count: 1 })
  bus.emit('player:stats')
}

let playerBeforeLevel = 1

function act(action: 'attack' | 'flee'): void {
  const cur = state.value
  if (!cur || cur.over) return
  playerBeforeLevel = getPlayer().level
  const raw = toRaw(cur)
  if (action === 'attack') apply(playerAttack(raw))
  else apply(attemptFlee(raw))
}

function cast(skillId: string): void {
  const cur = state.value
  const skill = SKILL_BOOK[skillId]
  if (!cur || cur.over || !skill) return
  playerBeforeLevel = getPlayer().level
  apply(castSkill(toRaw(cur), skill))
}

function useBattleItem(itemId: string): void {
  const cur = state.value
  const item = ITEM_BOOK[itemId]
  if (!cur || cur.over || !item) return
  if ((getPlayer().inventory[itemId] ?? 0) <= 0) return
  playerBeforeLevel = getPlayer().level
  updatePlayer((p) => removeItem(p, itemId))
  apply(useItem(toRaw(cur), item))
}

function close(): void {
  const cur = state.value
  if (!cur) return
  // 战败惩罚（气血折半+回出生点）由世界层在 battle:end 中统一处理
  bus.emit('battle:end', { win: cur.win, fled: cur.fled })
  active.value = false
  state.value = null
}

function toggle(menu: 'skill' | 'item'): void {
  submenu.value = submenu.value === menu ? 'none' : menu
}

function pct(v: number, max: number): string {
  return `${Math.round((v / max) * 100)}%`
}
</script>

<template>
  <div v-if="active && state" class="overlay">
    <div class="panel">
      <div class="row">
        <span class="who self">{{ state.player.name }} · {{ realmLabel(player.level) }}</span>
        <div class="bars">
          <div class="bar"><i class="hp" :style="{ width: pct(state.player.hp, state.player.maxHp) }" /></div>
          <div class="bar"><i class="qi" :style="{ width: pct(state.player.qi, state.player.maxQi) }" /></div>
        </div>
        <span class="num">{{ state.player.hp }}/{{ state.player.maxHp }}</span>
      </div>

      <div class="row foe-row">
        <span class="who">{{ state.enemy.name }}</span>
        <div class="bars">
          <div class="bar"><i class="foe" :style="{ width: pct(state.enemy.hp, state.enemy.maxHp) }" /></div>
          <div class="intent">下一手：{{ state.enemy.intent }}</div>
        </div>
        <span class="num">{{ state.enemy.hp }}/{{ state.enemy.maxHp }}</span>
      </div>

      <div class="stage">
        <span
          v-for="f in floaters"
          :key="f.id"
          class="floater"
          :class="f.cls"
          :style="{ animationDelay: '0s' }"
          >{{ f.text }}</span
        >
      </div>

      <div class="log">
        <p v-for="(line, i) in state.log" :key="i" :class="line.kind">{{ line.text }}</p>
      </div>

      <template v-if="!state.over">
        <div v-if="submenu === 'skill'" class="menu">
          <button
            v-for="s in learnedSkills"
            :key="s.id"
            :disabled="state.player.qi < skillEffect(s).cost"
            @click="cast(s.id)"
          >
            {{ s.name }}
            <small>{{ skillEffect(s).kind === 'damage' ? '伤害' : skillEffect(s).kind === 'heal' ? '回复' : '增益' }}
              灵气-{{ skillEffect(s).cost }}</small
            >
          </button>
          <button class="back" @click="submenu = 'none'">返回</button>
        </div>
        <div v-else-if="submenu === 'item'" class="menu">
          <button v-for="row in battleItems" :key="row.item.id" @click="useBattleItem(row.item.id)">
            {{ row.item.name }} <small>×{{ row.count }}</small>
          </button>
          <p v-if="battleItems.length === 0" class="empty">囊中空空，无药可用</p>
          <button class="back" @click="submenu = 'none'">返回</button>
        </div>
        <div v-else class="actions">
          <button @click="act('attack')">攻击</button>
          <button :disabled="learnedSkills.length === 0" @click="toggle('skill')">法术</button>
          <button :disabled="battleItems.length === 0" @click="toggle('item')">丹药</button>
          <button class="flee" @click="act('flee')">逃跑({{ Math.round(fleeChance(state) * 100) }}%)</button>
        </div>
      </template>
      <template v-else>
        <div v-if="state.win && victory" class="verdict win">
          <p class="title">胜 · 斩妖除魔</p>
          <p>经验 +{{ victory.exp }}（{{ realmLabel(getPlayer().level) }} {{ getPlayer().exp }}/{{
            expToNext(getPlayer().level)
          }}）</p>
          <p v-if="victory.levelsGained > 0" class="levelup">
            境界突破！{{ victory.realmBefore }} → {{ realmLabel(getPlayer().level) }}
          </p>
          <p v-if="victory.loot.length > 0">战利品：{{ victory.loot.join('、') }}</p>
          <p v-else class="dim">未获战利品</p>
          <button @click="close">继续</button>
        </div>
        <div v-else-if="defeated" class="verdict lose">
          <p class="title">败 · 重伤昏厥</p>
          <p>醒来时已被送回原地，气血折半——留得性命，来日方长。</p>
          <button @click="close">回到出生点</button>
        </div>
        <div v-else class="actions">
          <button @click="close">离开战斗</button>
        </div>
      </template>
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
  position: relative;
  width: min(92vw, 440px);
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
  width: 110px;
  white-space: nowrap;
}
.who.self {
  color: #ffd97a;
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
.bar .foe {
  background: linear-gradient(90deg, #6e2ba0, #b06ad9);
}
.num {
  width: 52px;
  text-align: right;
  font-size: 11px;
  opacity: 0.75;
}
.intent {
  font-size: 10px;
  color: #d9a06a;
}
.stage {
  position: relative;
  height: 26px;
}
.floater {
  position: absolute;
  left: 50%;
  top: 0;
  font-weight: bold;
  font-size: 16px;
  animation: rise 0.9s ease-out forwards;
}
.floater.self {
  color: #ff8a7a;
}
.floater.foe {
  color: #ffd97a;
}
.floater.heal {
  color: #8fe89a;
}
@keyframes rise {
  from {
    transform: translate(-50%, 0);
    opacity: 1;
  }
  to {
    transform: translate(-50%, -22px);
    opacity: 0;
  }
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
.log .player {
  color: #cfe3b5;
}
.log .enemy {
  color: #e8a0a0;
}
.log .system {
  opacity: 0.75;
}
.log .reward {
  color: #ffd97a;
}
.actions,
.menu {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.actions button,
.menu button {
  flex: 1;
  min-height: 44px;
  border: 1px solid #8b6914;
  border-radius: 8px;
  background: rgba(58, 42, 24, 0.85);
  color: #e8dcc0;
  font-size: 14px;
}
.menu button small {
  display: block;
  font-size: 10px;
  opacity: 0.7;
}
.actions button:disabled,
.menu button:disabled {
  opacity: 0.4;
}
.menu .back {
  max-width: 80px;
}
.flee {
  max-width: 110px;
}
.empty {
  width: 100%;
  text-align: center;
  opacity: 0.6;
  font-size: 13px;
  margin: 4px 0;
}
.verdict {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.verdict .title {
  font-size: 17px;
  letter-spacing: 4px;
}
.verdict.win .title {
  color: #ffd97a;
}
.verdict.lose .title {
  color: #e88a7a;
}
.verdict .levelup {
  color: #8fe89a;
}
.verdict .dim {
  opacity: 0.55;
  font-size: 12px;
}
.verdict button {
  min-height: 44px;
  border: 1px solid #8b6914;
  border-radius: 8px;
  background: rgba(58, 42, 24, 0.85);
  color: #e8dcc0;
  font-size: 14px;
}
</style>
