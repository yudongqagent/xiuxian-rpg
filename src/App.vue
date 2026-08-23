<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import Hud from './ui/Hud.vue'
import Joystick from './ui/Joystick.vue'
import InventoryPanel from './ui/InventoryPanel.vue'
import DialogueBox from './ui/DialogueBox.vue'
import BattlePanel from './ui/BattlePanel.vue'
import AreaBanner from './ui/AreaBanner.vue'
import QuestLog from './ui/QuestLog.vue'
import QuestToast from './ui/QuestToast.vue'
import TitleSplash from './ui/TitleSplash.vue'
import BattleTransition from './ui/BattleTransition.vue'
import { initQuestRuntime } from './systems/questRuntime'

const gameHost = ref<HTMLElement | null>(null)
const showInv = ref(false)
const showQuests = ref(false)
const booting = ref(false)
let game: ReturnType<(typeof import('./engine/game'))['createGame']> | undefined
let disposeQuests: (() => void) | undefined

/** QA-6：Phaser 仅在点击「开始游戏」后动态加载，首屏不含引擎 */
async function startGame(): Promise<void> {
  if (game || booting.value || !gameHost.value) return
  booting.value = true
  const { createGame } = await import('./engine/game')
  game = createGame(gameHost.value)
  disposeQuests = initQuestRuntime()
  booting.value = false
}

onUnmounted(() => {
  game?.destroy(true)
  disposeQuests?.()
})
</script>

<template>
  <div class="stage">
    <div ref="gameHost" class="game-host" />
    <Hud @open-inventory="showInv = true" @open-quests="showQuests = true" />
    <Joystick />
    <InventoryPanel v-if="showInv" @close="showInv = false" />
    <QuestLog v-if="showQuests" @close="showQuests = false" />
    <DialogueBox />
    <BattlePanel />
    <AreaBanner />
    <QuestToast />
    <BattleTransition />
    <TitleSplash @start="startGame" />
  </div>
</template>

<style scoped>
.stage,
.game-host {
  position: fixed;
  inset: 0;
}
</style>
