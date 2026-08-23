<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { bus } from '../engine/eventBus'
import { buyItem, getPlayer, sellItem, subscribePlayer } from '../systems/player'
import { getStock, sellPrice } from '../systems/shop'
import { ITEMS } from '../systems/itemBook'

const props = defineProps<{ npcId: string }>()
const emit = defineEmits<{ close: [] }>()

const player = ref(getPlayer())
const unStats = subscribePlayer(() => (player.value = getPlayer()))
onUnmounted(unStats)

const stock = computed(() => getStock(props.npcId))

const wares = computed(() =>
  (stock.value?.wares ?? []).map((w) => ({
    id: w.item,
    name: ITEMS[w.item]?.name ?? w.item,
    desc: ITEMS[w.item]?.description?.slice(0, 30) ?? '',
    price: w.price,
    affordable: player.value.lingshi >= w.price,
  })),
)

const sellables = computed(() =>
  Object.entries(player.value.inventory)
    .filter(([id, count]) => count > 0 && ITEMS[id] && (ITEMS[id].type === 'consumable' || ITEMS[id].type === 'material'))
    .map(([id, count]) => ({ id, name: ITEMS[id]?.name ?? id, count, unit: sellPrice(id) })),
)

function buy(id: string, price: number): void {
  update(buyItem, id, price)
}
function sell(id: string): void {
  const unit = sellPrice(id)
  update(sellItem, id, unit)
}
function update(fn: (p: ReturnType<typeof getPlayer>, a: string, b: number) => ReturnType<typeof getPlayer>, a: string, b: number): void {
  // 局部包装：player 模块的纯函数签名适配
  const cur = getPlayer()
  const next = fn(cur, a, b)
  if (next !== cur) {
    // 直接经 subscribePlayer 广播
    import('../systems/player').then((m) => m.setPlayer(next))
  }
}
</script>

<template>
  <div class="panel ink-sheet">
    <header>
      <b>坊 市 · {{ stock?.name ?? '商贩' }}</b>
      <span class="ls">灵石 {{ player.lingshi }}</span>
      <button class="close" @click="$emit('close')">✕</button>
    </header>

    <h4>购入</h4>
    <ul>
      <li v-for="w in wares" :key="w.id">
        <span>{{ w.name }}<small class="desc">{{ w.desc }}</small></span>
        <small class="price">{{ w.price }} 灵石</small>
        <button class="ink-btn" :disabled="!w.affordable" @click="buy(w.id, w.price)">购买</button>
      </li>
      <p v-if="wares.length === 0" class="empty">今日无货</p>
    </ul>

    <h4>卖出（五折）</h4>
    <ul>
      <li v-for="row in sellables" :key="row.id">
        <span>{{ row.name }}</span><small>×{{ row.count }} · 每件 {{ row.unit }} 灵石</small>
        <button class="ink-btn" @click="sell(row.id)">卖 1</button>
      </li>
      <p v-if="sellables.length === 0" class="empty">没有可出售的物件</p>
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
  padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
}
header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
header b {
  flex: 1;
  color: #ffd97a;
  font-size: 15px;
}
.ls {
  color: #9fe0c8;
  font-size: 12px;
}
.close {
  min-width: 32px;
  min-height: 32px;
  border: 1px solid rgba(139, 105, 20, 0.5);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: #e8dcc0;
}
h4 {
  margin: 10px 0 4px;
  color: #e8dcc0;
  font-size: 13px;
}
li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 2px;
  border-top: 1px solid rgba(139, 105, 20, 0.3);
}
li span {
  flex: 1;
  font-size: 13px;
}
.desc {
  display: block;
  opacity: 0.6;
  font-size: 11px;
}
.price {
  color: #ffd97a;
  font-size: 12px;
}
.empty {
  font-size: 12px;
  opacity: 0.5;
}
</style>
