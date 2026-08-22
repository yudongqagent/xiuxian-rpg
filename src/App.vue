<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import Hud from './ui/Hud.vue'
import Joystick from './ui/Joystick.vue'
import InventoryPanel from './ui/InventoryPanel.vue'
import DialogueBox from './ui/DialogueBox.vue'
import BattlePanel from './ui/BattlePanel.vue'
import { createGame } from './engine/game'

const gameHost = ref<HTMLElement | null>(null)
const showInv = ref(false)
let game: ReturnType<typeof createGame> | undefined

onMounted(() => {
  if (gameHost.value) game = createGame(gameHost.value)
})
onUnmounted(() => game?.destroy(true))
</script>

<template>
  <div class="stage">
    <div ref="gameHost" class="game-host" />
    <Hud @open-inventory="showInv = true" />
    <Joystick />
    <InventoryPanel v-if="showInv" @close="showInv = false" />
    <DialogueBox />
    <BattlePanel />
  </div>
</template>

<style scoped>
.stage,
.game-host {
  position: fixed;
  inset: 0;
}
</style>
