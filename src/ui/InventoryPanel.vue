<script setup lang="ts">
import { ref } from 'vue'

const items = [
  { id: 'huiqi_dan', name: '回气散', grade: '凡品', count: 3 },
  { id: 'qingyun_jian', name: '青云剑', grade: '法器', count: 1 },
]
const tab = ref<'items' | 'skills'>('items')
</script>

<template>
  <div class="panel">
    <header>
      <b>储物袋</b>
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
    </ul>
    <p v-else class="empty">尚未习得任何功法</p>
  </div>
</template>

<style scoped>
.panel {
  position: fixed;
  inset: auto 0 0 0;
  max-height: 62vh;
  overflow: auto;
  background: rgba(20, 14, 9, 0.96);
  border-top: 1px solid #8b6914;
  color: #e8dcc0;
  padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
}
header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
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
.empty {
  opacity: 0.6;
  font-size: 13px;
}
</style>
