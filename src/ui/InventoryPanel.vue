<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { bus } from '../engine/eventBus'
import type { Item } from '../systems/schemas'
import {
  getPlayer,
  realmLabel,
  subscribePlayer,
  updatePlayer,
  equipItem,
  unequipItem,
  effectiveStats,
  type Equipped,
} from '../systems/player'
import { ITEMS } from '../systems/itemBook'
import { canCraft, craft, missingInputs } from '../systems/alchemy'
import type { Recipe } from '../systems/schemas'

const recipeEntries = Object.entries(
  import.meta.glob('../../content/recipes/*.json', { eager: true }) as Record<string, unknown>,
)
const RECIPES: Recipe[] = []
for (const [path, raw] of recipeEntries) {
  try {
    const o = raw as Record<string, unknown>
    const inputs = (o['inputs'] as Array<{ item: string; count: number }>) ?? []
    const out = o['output'] as { item: string; count: number }
    RECIPES.push({
      id: String(o['id']),
      name: String(o['name']),
      inputs,
      output: out,
      description: String(o['description'] ?? ''),
    })
  } catch {
    console.error(`[alchemy] 配方解析失败: ${path}`)
  }
}

const ITEM_BOOK: Record<string, Item> = ITEMS
const skillEntries = Object.entries(
  import.meta.glob('../../content/skills/*.json', { eager: true }) as Record<string, unknown>,
)
const SKILL_BOOK: Record<string, { id: string; name: string; grade: string; kind: string; description: string }> =
  {}
for (const [path, raw] of skillEntries) {
  const parsed = safeSkill(raw)
  if (parsed) SKILL_BOOK[parsed.id] = parsed
}

function safeSkill(raw: unknown): { id: string; name: string; grade: string; kind: string; description: string } | null {
  try {
    // 延迟校验：与 schemas 保持同构但避免额外静态依赖
    const o = raw as Record<string, unknown>
    return {
      id: String(o['id']),
      name: String(o['name']),
      grade: String(o['grade']),
      kind: String((o['battle'] as Record<string, unknown> | undefined)?.['kind'] ?? o['type'] ?? ''),
      description: String(o['description'] ?? ''),
    }
  } catch {
    return null
  }
}

const tab = ref<'items' | 'skills' | 'alchemy' | 'garden'>('items')
const player = ref(getPlayer())
const unsub = subscribePlayer(() => (player.value = getPlayer()))
onUnmounted(unsub)

// ==== 药圃：每秒刷新倒计时 ====
import { gardenView, plantHerb, ripenAll, harvestAll, GROW_MS } from '../systems/garden'
const nowMs = ref(Date.now())
let gardenTimer: ReturnType<typeof setInterval> | undefined
function startGardenTick(): void {
  if (!gardenTimer) gardenTimer = setInterval(() => (nowMs.value = Date.now()), 1000)
}
function stopGardenTick(): void {
  if (gardenTimer) {
    clearInterval(gardenTimer)
    gardenTimer = undefined
  }
}
watch(tab, (t) => (t === 'garden' ? startGardenTick() : stopGardenTick()), { immediate: true })
onUnmounted(stopGardenTick)
const garden = computed(() => gardenView(player.value.garden ?? { plots: [null, null, null, null], drops: 0, bottleAt: Date.now() }, nowMs.value))
const seedCount = computed(() => player.value.inventory['qi_xie_ling_cao'] ?? 0)

function onPlant(slot: number): void {
  updatePlayer((p) => plantHerb(p, slot, Date.now()).player)
}
function onRipen(): void {
  const r = ripenAll(getPlayer(), Date.now())
  updatePlayer(() => r.player)
  if (r.ripened > 0) bus.emit('quest:notify', { text: `瓶中绿液催熟灵植 ×${r.ripened}`, kind: 'success' })
}
function onHarvest(): void {
  const r = harvestAll(getPlayer(), Date.now())
  updatePlayer(() => r.player)
  const total = Object.values(r.harvested).reduce((a, b) => a + b, 0)
  for (const [id, count] of Object.entries(r.harvested)) {
    bus.emit('item:acquired', { itemId: id, count })
  }
  if (total > 0) bus.emit('quest:notify', { text: `采收灵药 ×${total}`, kind: 'success' })
}

const eff = computed(() =>
  effectiveStats(player.value.level, player.value.equipped, (id) => ITEM_BOOK[id]),
)

function slotItemId(slot: keyof Equipped): string | null {
  return player.value.equipped[slot]
}

function onCraft(r: Recipe): void {
  if (!canCraft(player.value, r)) return
  const result = craft(getPlayer(), r)
  updatePlayer(() => result.player)
  bus.emit('item:acquired', { itemId: r.output.item, count: r.output.count })
}

function onToggleEquip(item: Item): void {
  const slot: keyof Equipped = item.type === 'weapon' ? 'weapon' : 'armor'
  if (slotItemId(slot) === item.id) updatePlayer((p) => unequipItem(p, slot))
  else updatePlayer((p) => equipItem(p, slot, item.id))
}

const items = computed(() =>
  Object.entries(player.value.inventory)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({
      id,
      count,
      item: ITEM_BOOK[id],
    }))
    .filter((row): row is { id: string; count: number; item: Item } => Boolean(row.item)),
)
const skills = computed(() =>
  player.value.skills.map((id) => SKILL_BOOK[id]).filter(Boolean),
)
</script>

<template>
  <div class="panel ink-sheet">
    <header>
      <b>储物袋 · {{ realmLabel(player.level) }}</b>
      <nav>
        <button :class="{ on: tab === 'items' }" @click="tab = 'items'">物品</button>
        <button :class="{ on: tab === 'skills' }" @click="tab = 'skills'">功法</button>
        <button :class="{ on: tab === 'alchemy' }" @click="tab = 'alchemy'">炼丹</button>
        <button :class="{ on: tab === 'garden' }" @click="tab = 'garden'">药圃</button>
      </nav>
      <button class="close" @click="$emit('close')">✕</button>
    </header>
    <div v-if="tab === 'items'" class="equip">
      <button
        v-for="slot in (['weapon', 'armor'] as const)"
        :key="slot"
        class="eq-slot"
        :class="{ filled: slotItemId(slot) }"
        @click="slotItemId(slot) && ITEM_BOOK[slotItemId(slot)!] && onToggleEquip(ITEM_BOOK[slotItemId(slot)!])"
      >
        <i>{{ slot === 'weapon' ? '⚔' : '🛡' }}</i>
        <span>{{ slot === 'weapon' ? '武器' : '防具' }}：{{
          slotItemId(slot) ? `${ITEM_BOOK[slotItemId(slot)!]?.name}（点击卸下）` : '空'
        }}</span>
        <small v-if="slotItemId(slot)">
          {{ slot === 'weapon' ? `攻+${ITEM_BOOK[slotItemId(slot)!]?.stats?.atk ?? 0}` : `防+${ITEM_BOOK[slotItemId(slot)!]?.stats?.def ?? 0}` }}
        </small>
      </button>
      <span class="eff">攻 {{ eff.atk }} · 防 {{ eff.def }}</span>
    </div>
    <ul v-if="tab === 'items'">
      <li v-for="row in items" :key="row.id">
        <span>{{ row.item.name }}</span><small>{{ row.item.grade }} ×{{ row.count }}</small>
        <button
          v-if="row.item.type === 'weapon' || row.item.type === 'armor'"
          class="eq-btn"
          @click="onToggleEquip(row.item)"
        >{{ slotItemId(row.item.type === 'weapon' ? 'weapon' : 'armor') === row.item.id ? '卸下' : (row.item.type === 'weapon' ? '⚔ 穿着' : '🛡 穿着') }}</button>
      </li>
      <p v-if="items.length === 0" class="empty">囊中空空</p>
    </ul>
    <ul v-else-if="tab === 'skills'">
      <li v-for="s in skills" :key="s.id">
        <span>{{ s.name }}<small class="desc">{{ s.description.slice(0, 24) }}……</small></span>
        <small>{{ s.grade }} · {{ s.kind }}</small>
      </li>
      <p v-if="skills.length === 0" class="empty">尚未习得任何功法</p>
    </ul>
    <div v-if="tab === 'alchemy'" class="alch">
      <div v-for="r in RECIPES" :key="r.id" class="recipe">
        <div class="rhead">
          <span>{{ r.name }}</span>
          <button class="ink-btn" :disabled="!canCraft(player, r)" @click="onCraft(r)">
            {{ canCraft(player, r) ? '炼 制' : '材料不足' }}
          </button>
        </div>
        <small class="mats">
          <template v-for="(i, idx) in r.inputs" :key="i.item">
            <span :class="{ lack: (player.inventory[i.item] ?? 0) < i.count }">
              {{ ITEM_BOOK[i.item]?.name ?? i.item }} {{ player.inventory[i.item] ?? 0 }}/{{ i.count }}
            </span><template v-if="idx < r.inputs.length - 1"> · </template>
          </template>
          <b> → {{ ITEM_BOOK[r.output.item]?.name ?? r.output.item }} ×{{ r.output.count }}</b>
        </small>
      </div>
      <p v-if="RECIPES.length === 0" class="empty">暂无丹方</p>
    </div>
    <div v-if="tab === 'garden'" class="garden">
      <p class="gdesc">神秘小瓶于月光中凝出绿液——每半个时辰一滴（上限五滴），一滴可催熟全部灵植。播下七叶灵草，须臾之间，一株化三。</p>
      <p class="drops">瓶中绿液：{{ garden.drops }} / 5</p>
      <div class="plots">
        <div v-for="(pl, idx) in garden.plots" :key="idx" class="plot" :class="{ mature: pl.mature }">
          <template v-if="!pl.itemId">
            <span class="pempty">空畦</span>
            <button class="ink-btn" :disabled="seedCount < 1" @click="onPlant(idx)">
              播种（灵草×1，余{{ seedCount }}）
            </button>
          </template>
          <template v-else-if="pl.mature">
            <span class="pmature">灵草已成</span>
            <button class="ink-btn" @click="onHarvest()">采 收</button>
          </template>
          <template v-else>
            <span class="pgrow">生长中 {{ Math.ceil(pl.remainingMs / 60000) }} 刻</span>
            <button class="ink-btn" :disabled="garden.drops < 1" @click="onRipen()">绿液催熟</button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  z-index: 30;
  position: fixed;
  inset: auto 0 0 0;
  max-height: 62vh;
  overflow: auto;
  color: #e8dcc0;
  padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
}
header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
header b {
  font-family: var(--font-display);
  font-size: 15px;
  letter-spacing: 0.2em;
}
nav {
  flex: 1;
  display: flex;
  gap: 8px;
}
button {
  background: none;
  border: none;
  color: inherit;
  font-size: 13px;
}
.on {
  color: #ffd97a;
  text-decoration: underline;
}
.close {
  font-size: 16px;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
li {
  display: flex;
  justify-content: space-between;
  padding: 10px 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 14px;
}
small {
  opacity: 0.7;
}
.desc {
  display: block;
  font-size: 11px;
}
.empty {
  opacity: 0.6;
  font-size: 13px;
}
.equip {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.eq-slot {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(139, 105, 20, 0.5);
  border-radius: 8px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.04);
  color: #e8dcc0;
  font-size: 12px;
}
.eq-slot.filled {
  border-color: #ffd97a;
}
.eff {
  font-size: 12px;
  color: #9fe0c8;
  margin-left: auto;
}
.eq-btn {
  min-height: 36px;
  border: 1px solid #8b6914;
  border-radius: 6px;
  background: rgba(58, 42, 24, 0.85);
  color: #ffd97a;
  font-size: 12px;
  padding: 0 10px;
}
.alch {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.recipe {
  border: 1px solid rgba(139, 105, 20, 0.4);
  border-radius: 8px;
  padding: 10px 12px;
}
.rhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #f2e6c8;
  font-size: 14px;
}
.mats {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  opacity: 0.8;
}
.mats .lack {
  color: #e08a7a;
}
.garden {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.gdesc {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  opacity: 0.75;
}
.drops {
  margin: 0;
  font-size: 14px;
  color: #9fe0a9;
  font-family: var(--font-display);
}
.plots {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.plot {
  border: 1px solid rgba(139, 105, 20, 0.5);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  font-size: 12px;
}
.plot.mature {
  border-color: #9fe0a9;
}
.pempty {
  opacity: 0.5;
}
.pmature {
  color: #9fe0a9;
}
.pgrow {
  color: #7ec8e8;
}
.plot .ink-btn {
  font-size: 11px;
  min-height: 32px;
  padding: 4px 8px;
}
.plot .ink-btn:disabled {
  opacity: 0.4;
}
</style>
