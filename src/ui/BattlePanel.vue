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
  effectiveStats,
  subscribePlayer,
  syncAfterBattle,
  removeItem,
  updatePlayer,
} from '../systems/player'

import { ITEMS } from '../systems/itemBook'
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

// 全量加载妖兽模板（新增内容零登记即可入战），不再手工枚举
const ENEMY_MODULE_ENTRIES = Object.entries(
  import.meta.glob('../../content/enemies/*.json', { eager: true }) as Record<string, unknown>,
)
const ENEMY_TEMPLATES: Record<string, Enemy> = {}
for (const [path, raw] of ENEMY_MODULE_ENTRIES) {
  const id = path.split('/').pop()!.replace(/\.json$/, '')
  try {
    ENEMY_TEMPLATES[id] = EnemySchema.parse(raw)
  } catch (e) {
    console.error(`[battle] 妖兽模板解析失败: ${id}`, e)
  }
}
/** 兜底模板：内容缺失时也绝不中断战斗流程 */
function fallbackEnemy(enemyId: string): Enemy {
  console.error(`[battle] 未知妖兽 "${enemyId}"，使用兜底模板`)
  const base = ENEMY_TEMPLATES['hui_lang'] ?? Object.values(ENEMY_TEMPLATES)[0]
  return { ...base, id: 'unknown', name: '未知妖兽' }
}
const SKILL_BOOK: Record<string, Skill> = Object.fromEntries(
  [huodanShu, changchunGong, zhayanJianfa].map((raw) => {
    const s = SkillSchema.parse(raw)
    return [s.id, s]
  }),
)
const ITEM_BOOK: Record<string, Item> = ITEMS

const FLOATER_LIFE_MS = 900
const PROJECTILE_MS = 500
const SELF_GLOW_MS = 300
const BURST_MS = 430
const FLASH_MS = 320
const SHAKE_MS = 360

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

// ==== gfx-battle-ui：战斗演出状态（弹道/命中反馈）====
const busy = ref(false)
const firing = ref(false)
const bursting = ref(false)
const selfGlow = ref(false)
const foeFlash = ref(false)
const selfFlash = ref(false)
const shaking = ref(false)
let fxTimers: number[] = []

function later(ms: number, fn: () => void): void {
  fxTimers.push(window.setTimeout(fn, ms))
}

function clearFxTimers(): void {
  fxTimers.forEach((t) => window.clearTimeout(t))
  fxTimers = []
}

onUnmounted(() => {
  clearFxTimers()
})

function hitFeedback(target: 'foe' | 'self'): void {
  shaking.value = true
  later(SHAKE_MS, () => (shaking.value = false))
  const flag = target === 'foe' ? foeFlash : selfFlash
  flag.value = true
  later(FLASH_MS, () => (flag.value = false))
}

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

let battleEnemyId: string | undefined

const unsubStart = bus.on('battle:start', ({ enemyId }) => {
  battleEnemyId = enemyId
  const template = ENEMY_TEMPLATES[enemyId] ?? fallbackEnemy(enemyId)
  const p = getPlayer()
  const stats = effectiveStats(p.level, p.equipped, (id) => ITEM_BOOK[id])
  // combat.ts 内部用 structuredClone，不能传入响应式 Proxy
  const rawTemplate = toRaw(template)
  state.value = createBattle(rawTemplate, { stats, hp: p.hp, qi: p.qi })
  submenu.value = 'none'
  victory.value = null
  defeated.value = false
  floaters.value = []
  clearFxTimers()
  busy.value = false
  bus.emit('battle:opened')
  firing.value = false
  bursting.value = false
  active.value = true
})
onUnmounted(() => {
  unsubStart()
  unsubPlayer()
})

function spawnFloaters(prev: BattleState | null, next: BattleState): void {
  if (!prev) return
  if (next.enemy.hp < prev.enemy.hp) {
    pushFloater(`-${prev.enemy.hp - next.enemy.hp}`, 'foe')
    hitFeedback('foe')
  }
  if (next.player.hp < prev.player.hp) {
    pushFloater(`-${prev.player.hp - next.player.hp}`, 'self')
    hitFeedback('self')
  }
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
  if (!cur || cur.over || busy.value) return
  playerBeforeLevel = getPlayer().level
  const raw = toRaw(cur)
  if (action === 'attack') apply(playerAttack(raw))
  else {
    apply(attemptFlee(raw))
    // 逃跑成功：短暂展示后自动收面板（PT-8）
    const next = state.value
    if (next && next.over && next.fled) {
      window.setTimeout(() => {
        if (state.value === next) close()
      }, 700)
    }
  }
}

function cast(skillId: string): void {
  const cur = state.value
  const skill = SKILL_BOOK[skillId]
  if (!cur || cur.over || !skill || busy.value) return
  playerBeforeLevel = getPlayer().level
  busy.value = true
  submenu.value = 'none'
  const raw = toRaw(cur)
  if (skillEffect(skill).kind === 'damage') {
    firing.value = true
    later(PROJECTILE_MS, () => {
      firing.value = false
      bursting.value = true
      apply(castSkill(raw, skill))
      later(BURST_MS, () => {
        bursting.value = false
        busy.value = false
      })
    })
  } else {
    selfGlow.value = true
    later(SELF_GLOW_MS, () => {
      selfGlow.value = false
      apply(castSkill(raw, skill))
      busy.value = false
    })
  }
}

function useBattleItem(itemId: string): void {
  const cur = state.value
  const item = ITEM_BOOK[itemId]
  if (!cur || cur.over || !item || busy.value) return
  if ((getPlayer().inventory[itemId] ?? 0) <= 0) return
  playerBeforeLevel = getPlayer().level
  updatePlayer((p) => removeItem(p, itemId))
  apply(useItem(toRaw(cur), item))
}

function close(): void {
  const cur = state.value
  if (!cur || busy.value) return
  // 战败惩罚（气血折半+回出生点）由世界层在 battle:end 中统一处理
  bus.emit('battle:end', { win: cur.win, fled: cur.fled, enemyId: battleEnemyId })
  active.value = false
  state.value = null
}

function toggle(menu: 'skill' | 'item'): void {
  if (busy.value) return
  submenu.value = submenu.value === menu ? 'none' : menu
}

function pct(v: number, max: number): string {
  return `${Math.round((v / max) * 100)}%`
}
</script>

<template>
  <div v-if="active && state" class="overlay">
    <div class="wash" />
    <div class="panel ink-frame" :class="{ shaking }">
      <div class="fx-layer">
        <span v-if="selfGlow" class="self-glow" />
        <span v-if="firing" class="projectile"><i /></span>
        <span v-if="bursting" class="burst"><i v-for="n in 8" :key="n" /></span>
      </div>

      <div class="row" :class="{ hitflash: selfFlash || selfGlow }">
        <span class="who self">{{ state.player.name }} · {{ realmLabel(player.level) }}</span>
        <div class="bars">
          <div class="bar"><i class="hp" :style="{ width: pct(state.player.hp, state.player.maxHp) }" /></div>
          <div class="bar"><i class="qi" :style="{ width: pct(state.player.qi, state.player.maxQi) }" /></div>
        </div>
        <span class="num">{{ state.player.hp }}/{{ state.player.maxHp }}</span>
      </div>

      <div class="row foe-row" :class="{ hitflash: foeFlash }">
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
          :class="[f.cls, { big: f.cls !== 'heal' }]"
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
          <button class="ink-btn" @click="close">继续</button>
        </div>
        <div v-else-if="defeated" class="verdict lose">
          <p class="title">败 · 重伤昏厥</p>
          <p>醒来时已被送回原地，气血折半——留得性命，来日方长。</p>
          <button class="ink-btn" @click="close">回到出生点</button>
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
  z-index: 10;
  background: rgba(10, 7, 4, 0.35);
  backdrop-filter: blur(5px) saturate(0.85);
  -webkit-backdrop-filter: blur(5px) saturate(0.85);
}
.wash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 50% 36%, rgba(46, 32, 18, 0.28), rgba(10, 7, 4, 0.62) 74%),
    repeating-radial-gradient(ellipse at 16% 84%, transparent 0 34px, rgba(232, 220, 192, 0.02) 34px 37px),
    repeating-linear-gradient(112deg, transparent 0 46px, rgba(210, 190, 150, 0.025) 46px 49px);
}
.panel {
  width: min(92vw, 440px);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.panel.shaking {
  animation: panel-shake 360ms cubic-bezier(0.36, 0.07, 0.19, 0.97);
}
@keyframes panel-shake {
  0%,
  100% {
    transform: translate(0, 0) rotate(0);
  }
  15% {
    transform: translate(-6px, 2px) rotate(-0.4deg);
  }
  32% {
    transform: translate(5px, -3px) rotate(0.35deg);
  }
  50% {
    transform: translate(-4px, 1px) rotate(-0.25deg);
  }
  68% {
    transform: translate(3px, -1px) rotate(0.15deg);
  }
  84% {
    transform: translate(-2px, 1px);
  }
}
.fx-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  border-radius: 12px;
  z-index: 3;
}
.self-glow {
  position: absolute;
  left: 8%;
  top: 6%;
  width: 90px;
  height: 60px;
  background: radial-gradient(ellipse at center, rgba(140, 235, 160, 0.4), transparent 70%);
  animation: glow-pulse 300ms ease-out forwards;
}
@keyframes glow-pulse {
  from {
    opacity: 1;
    transform: scale(0.7);
  }
  to {
    opacity: 0;
    transform: scale(1.5);
  }
}
.projectile {
  position: absolute;
  left: 16%;
  top: 76%;
}
.projectile i {
  position: absolute;
  display: block;
  margin: -9px 0 0 -9px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff6d8, #ffb84a 55%, #e2571e);
  box-shadow:
    0 0 12px 4px rgba(255, 150, 60, 0.6),
    0 0 30px 10px rgba(255, 110, 40, 0.25);
  animation: bolt-fly 500ms cubic-bezier(0.3, 0, 0.75, 0.6) forwards;
}
@keyframes bolt-fly {
  0% {
    left: 16%;
    top: 76%;
    transform: scale(0.65);
    opacity: 0.85;
  }
  45% {
    left: 48%;
    top: 42%;
  }
  100% {
    left: 82%;
    top: 17%;
    transform: scale(1.15);
    opacity: 1;
  }
}
.burst {
  position: absolute;
  left: 82%;
  top: 17%;
}
.burst::before {
  content: '';
  position: absolute;
  left: -21px;
  top: -21px;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 2px solid rgba(255, 217, 122, 0.85);
  animation: ring-out 420ms ease-out forwards;
}
@keyframes ring-out {
  from {
    transform: scale(0.3);
    opacity: 1;
  }
  to {
    transform: scale(2.1);
    opacity: 0;
  }
}
.burst i {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: radial-gradient(circle, #ffe9b0, #ff9636);
  animation: shard 420ms ease-out forwards;
}
.burst i:nth-child(1) {
  --dx: 30px;
  --dy: -20px;
}
.burst i:nth-child(2) {
  --dx: 8px;
  --dy: -32px;
}
.burst i:nth-child(3) {
  --dx: -24px;
  --dy: -22px;
}
.burst i:nth-child(4) {
  --dx: -34px;
  --dy: 4px;
}
.burst i:nth-child(5) {
  --dx: -18px;
  --dy: 28px;
}
.burst i:nth-child(6) {
  --dx: 12px;
  --dy: 32px;
}
.burst i:nth-child(7) {
  --dx: 32px;
  --dy: 14px;
}
.burst i:nth-child(8) {
  --dx: 2px;
  --dy: -6px;
}
@keyframes shard {
  from {
    transform: translate(0, 0) scale(1.3);
    opacity: 1;
  }
  to {
    transform: translate(var(--dx), var(--dy)) scale(0.15);
    opacity: 0;
  }
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  padding: 2px 3px;
  border-radius: 6px;
}
.row.hitflash {
  animation: hit-flash 320ms steps(2, jump-none);
}
@keyframes hit-flash {
  0%,
  100% {
    filter: brightness(1);
    background: transparent;
  }
  30% {
    filter: brightness(2.4);
    background: rgba(255, 255, 255, 0.14);
  }
}
.who {
  width: 110px;
  white-space: nowrap;
}
.who.self {
  color: #ffd97a;
  font-family: var(--font-display);
  letter-spacing: 0.06em;
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
  height: 30px;
}
.floater {
  position: absolute;
  left: 50%;
  top: 0;
  font-weight: bold;
  font-size: 16px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  animation: rise-pop 0.9s ease-out forwards;
}
.floater.big {
  font-family: var(--font-display);
  font-size: 24px;
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
@keyframes rise-pop {
  0% {
    transform: translate(-50%, 4px) scale(2);
    opacity: 0;
  }
  14% {
    transform: translate(-50%, 0) scale(1.35);
    opacity: 1;
  }
  34% {
    transform: translate(-50%, -8px) scale(1);
  }
  100% {
    transform: translate(-50%, -26px) scale(0.92);
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
  background: rgba(0, 0, 0, 0.25);
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
.combo-hint {
  margin: 0;
  text-align: center;
  font-size: 12px;
  color: #ffd97a;
  text-shadow: 0 0 8px rgba(255, 217, 122, 0.6);
  animation: comboPulse 1.1s ease-in-out infinite;
}
@keyframes comboPulse {
  0%,
  100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
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
  font-family: var(--font-display);
  font-size: 19px;
  letter-spacing: 6px;
}
.verdict.win .title {
  color: #ffd97a;
  text-shadow: 0 0 14px rgba(255, 217, 122, 0.35);
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
  font-size: 14px;
}
</style>
