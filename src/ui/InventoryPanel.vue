<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
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

const tab = ref<'items' | 'skills'>('items')
const player = ref(getPlayer())
const unsub = subscribePlayer(() => (player.value = getPlayer()))
onUnmounted(unsub)

const eff = computed(() =>
  effectiveStats(player.value.level, player.value.equipped, (id) => ITEM_BOOK[id]),
)

function slotItemId(slot: keyof Equipped): string | null {
  return player.value.equipped[slot]
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
    <ul v-else>
      <li v-for="s in skills" :key="s.id">
        <span>{{ s.name }}<small class="desc">{{ s.description.slice(0, 24) }}……</small></span>
        <small>{{ s.grade }} · {{ s.kind }}</small>
      </li>
      <p v-if="skills.length === 0" class="empty">尚未习得任何功法</p>
    </ul>
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
</style>
