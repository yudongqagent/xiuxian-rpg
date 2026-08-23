<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import Hud from './ui/Hud.vue'
import Joystick from './ui/Joystick.vue'
import InventoryPanel from './ui/InventoryPanel.vue'
import DialogueBox from './ui/DialogueBox.vue'
import BattlePanel from './ui/BattlePanel.vue'
import QuestLog from './ui/QuestLog.vue'
import QuestToast from './ui/QuestToast.vue'
import { createGame } from './engine/game'
import { initQuestRuntime } from './systems/questRuntime'

const gameHost = ref<HTMLElement | null>(null)
const showInv = ref(false)
const showQuests = ref(false)
let game: ReturnType<typeof createGame> | undefined
let disposeQuests: (() => void) | undefined

onMounted(() => {
  if (gameHost.value) game = createGame(gameHost.value)
  disposeQuests = initQuestRuntime()
})
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
    <QuestToast />
  </div>
</template>

<style scoped>
.stage,
.game-host {
  position: fixed;
  inset: 0;
}
</style>
