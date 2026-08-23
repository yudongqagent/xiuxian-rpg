<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { bus } from '../engine/eventBus'
import { ItemSchema, SkillSchema, type Item } from '../systems/schemas'
import { getPlayer, realmLabel, statsForLevel, subscribePlayer } from '../systems/player'

import huiqiSan from '../../content/items/huiqi_san.json'
import huichunSan from '../../content/items/huichun_san.json'
import xiSuiDan from '../../content/items/xi_sui_dan.json'
import yaodan from '../../content/items/yaodan.json'
import qiXieLingCao from '../../content/items/qi_xie_ling_cao.json'
import huodanShu from '../../content/skills/huodan_shu.json'
import changchunGong from '../../content/skills/changchun_gong.json'
import zhayanJianfa from '../../content/skills/zhayan_jianfa.json'

const ITEM_BOOK: Record<string, Item> = Object.fromEntries(
  [huiqiSan, huichunSan, xiSuiDan, yaodan, qiXieLingCao].map((raw) => {
    const i = ItemSchema.parse(raw)
    return [i.id, i]
  }),
)
const SKILL_BOOK = Object.fromEntries(
  [huodanShu, changchunGong, zhayanJianfa].map((raw) => {
    const s = SkillSchema.parse(raw)
    return [s.id, s]
  }),
)

const tab = ref<'items' | 'skills'>('items')
const player = ref(getPlayer())
const unsub = subscribePlayer(() => (player.value = getPlayer()))
onUnmounted(unsub)

const items = computed(() =>
  Object.entries(player.value.inventory)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({ id, name: ITEM_BOOK[id]?.name ?? id, grade: ITEM_BOOK[id]?.grade ?? '凡品', count })),
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
    <ul v-if="tab === 'items'">
      <li v-for="it in items" :key="it.id">
        <span>{{ it.name }}</span><small>{{ it.grade }} ×{{ it.count }}</small>
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
</style>
