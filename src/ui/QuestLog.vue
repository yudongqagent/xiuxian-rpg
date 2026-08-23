<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { bus } from '../engine/eventBus'
import {
  getActiveQuests,
  getAvailableQuests,
  getCompletedQuests,
  type ActiveQuestView,
} from '../systems/questRuntime'
import type { Quest } from '../systems/schemas'

const emit = defineEmits<{ close: [] }>()

const TABS = [
  { key: 'active', label: '进行中' },
  { key: 'available', label: '可接取' },
  { key: 'completed', label: '已完成' },
] as const
type TabKey = (typeof TABS)[number]['key']

const tab = ref<TabKey>('active')
const version = ref(0)
const unQuest = bus.on('quest:updated', () => version.value++)
onUnmounted(unQuest)

const TYPE_LABEL: Record<Quest['type'], string> = {
  main: '主线',
  side: '支线',
  daily: '日常',
  hidden: '隐藏',
}

function activeList(): ActiveQuestView[] {
  void version.value
  return getActiveQuests()
}
function availableList(): Quest[] {
  void version.value
  return getAvailableQuests()
}
function completedList(): Quest[] {
  void version.value
  return getCompletedQuests()
}

function rewardLine(q: Quest): string {
  const parts = [`灵石+${q.rewards.lingshi}`, `修为+${q.rewards.exp_qi}`]
  if (q.rewards.items.length) parts.push('物品×' + q.rewards.items.length)
  return parts.join(' ')
}
</script>

<template>
  <div class="panel">
    <header>
      <b>任务录</b>
      <nav>
        <button v-for="t in TABS" :key="t.key" :class="{ on: tab === t.key }" @click="tab = t.key">
          {{ t.label }}
        </button>
      </nav>
      <button class="close" @click="$emit('close')">✕</button>
    </header>

    <ul v-if="tab === 'active'">
      <li v-for="v in activeList()" :key="v.quest.id">
        <div class="qhead">
          <span>{{ v.quest.name }}</span>
          <small :class="'type-' + v.quest.type">{{ TYPE_LABEL[v.quest.type] }}</small>
        </div>
        <p v-if="v.readyToTurnIn" class="turnin">目标全部完成，回去交付吧</p>
        <ol>
          <li v-for="(s, i) in v.steps" :key="i" :class="{ done: s.done, cur: s.current }">
            <i>{{ s.done ? '✓' : s.current ? '◆' : '·' }}</i>{{ s.text }}
          </li>
        </ol>
      </li>
      <p v-if="activeList().length === 0" class="empty">暂无进行中的任务</p>
    </ul>

    <ul v-else-if="tab === 'available'">
      <li v-for="q in availableList()" :key="q.id">
        <div class="qhead">
          <span>{{ q.name }}</span>
          <small :class="'type-' + q.type">{{ TYPE_LABEL[q.type] }}</small>
        </div>
        <p class="meta">{{ rewardLine(q) }} · 前往 {{ q.giver }} 处接取</p>
      </li>
      <p v-if="availableList().length === 0" class="empty">暂无可接取的任务</p>
    </ul>

    <ul v-else>
      <li v-for="q in completedList()" :key="q.id">
        <div class="qhead">
          <span>{{ q.name }}</span>
          <small :class="'type-' + q.type">{{ TYPE_LABEL[q.type] }}</small>
        </div>
        <p class="meta">{{ rewardLine(q) }}</p>
      </li>
      <p v-if="completedList().length === 0" class="empty">尚未完成任何任务</p>
    </ul>
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
nav button {
  background: none;
  border: none;
  color: inherit;
  font-size: 13px;
}
nav .on {
  color: #ffd97a;
  text-decoration: underline;
}
.close {
  font-size: 16px;
  background: none;
  border: none;
  color: inherit;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
li {
  padding: 10px 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 14px;
}
.qhead {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.qhead small {
  opacity: 0.75;
}
.type-main {
  color: #ffd97a;
}
.type-hidden {
  color: #c39be0;
}
ol {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.9;
}
ol li.cur {
  color: #ffd97a;
}
ol li.done {
  opacity: 0.55;
  text-decoration: line-through;
}
ol i {
  font-style: normal;
  margin-right: 6px;
}
.turnin {
  margin: 4px 0 0;
  font-size: 13px;
  color: #9fe0a9;
}
.meta {
  margin: 4px 0 0;
  font-size: 12px;
  opacity: 0.7;
}
.empty {
  padding: 24px 0;
  text-align: center;
  opacity: 0.5;
  font-size: 13px;
}
</style>
