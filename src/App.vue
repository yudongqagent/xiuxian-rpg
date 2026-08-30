<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import Hud from './ui/Hud.vue'
import Joystick from './ui/Joystick.vue'
import MeditateButton from './ui/MeditateButton.vue'
import Minimap from './ui/Minimap.vue'
import WorldMapPanel from './ui/WorldMapPanel.vue'
import BreakthroughPanel from './ui/BreakthroughPanel.vue'
import InventoryPanel from './ui/InventoryPanel.vue'
import DialogueBox from './ui/DialogueBox.vue'
import BattlePanel from './ui/BattlePanel.vue'
import AreaBanner from './ui/AreaBanner.vue'
import QuestLog from './ui/QuestLog.vue'
import SavePanel from './ui/SavePanel.vue'
import ShopPanel from './ui/ShopPanel.vue'
import QuestToast from './ui/QuestToast.vue'
import TitleSplash from './ui/TitleSplash.vue'
import BattleTransition from './ui/BattleTransition.vue'
import EndingPanel from './ui/EndingPanel.vue'
import { bindAudioEvents, initAudio } from './systems/audio'
import { initQuestRuntime } from './systems/questRuntime'
import { bus } from './engine/eventBus'

const gameHost = ref<HTMLElement | null>(null)
const showInv = ref(false)
const showQuests = ref(false)
const showSaves = ref(false)
const showMap = ref(false)
const showBreakthrough = ref(false)
const shopNpcId = ref<string | null>(null)
let unShop: (() => void) | undefined

/** 底部面板互斥：打开一个时关闭其余 */
function openPanel(which: 'inv' | 'quests' | 'saves' | 'map'): void {
  showInv.value = which === 'inv'
  showQuests.value = which === 'quests'
  showSaves.value = which === 'saves'
  showMap.value = which === 'map'
}
function onAppKey(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (shopNpcId.value) {
    shopNpcId.value = null
    e.preventDefault()
    return
  }
  if (showInv.value || showQuests.value || showSaves.value || showMap.value) {
    showInv.value = showQuests.value = showSaves.value = showMap.value = false
    e.preventDefault()
  }
}
const booting = ref(false)
let game: ReturnType<(typeof import('./engine/game'))['createGame']> | undefined
let disposeQuests: (() => void) | undefined
let disposeAudio: (() => void) | undefined

/** QA-6：Phaser 仅在点击「开始游戏」后动态加载，首屏不含引擎 */
async function startGame(): Promise<void> {
  if (game || booting.value || !gameHost.value) return
  booting.value = true
  const { createGame } = await import('./engine/game')
  game = createGame(gameHost.value)
  disposeQuests = initQuestRuntime()
  booting.value = false
}

onMounted(() => {
  // INV-5：对话中的「浏览商货」打开商店面板
  unShop = bus.on('shop:open', ({ npcId }) => {
    showInv.value = showQuests.value = showSaves.value = false
    shopNpcId.value = npcId
  })
  window.addEventListener('keydown', onAppKey)
  initAudio()
  disposeAudio = bindAudioEvents()
})
onUnmounted(() => {
  game?.destroy(true)
  disposeQuests?.()
  disposeAudio?.()
  unShop?.()
  window.removeEventListener('keydown', onAppKey)
})
</script>

<template>
  <div class="stage">
    <div ref="gameHost" class="game-host" />
    <Hud
      @open-inventory="openPanel('inv')"
      @open-quests="openPanel('quests')"
      @open-saves="openPanel('saves')"
      @open-map="openPanel('map')"
      @open-breakthrough="showBreakthrough = true"
    />
    <Joystick />
    <MeditateButton />
    <Minimap />
    <InventoryPanel v-if="showInv" @close="showInv = false" />
    <QuestLog v-if="showQuests" @close="showQuests = false" />
    <SavePanel v-if="showSaves" @close="showSaves = false" />
    <WorldMapPanel v-if="showMap" @close="showMap = false" />
    <BreakthroughPanel v-if="showBreakthrough" @close="showBreakthrough = false" />
    <ShopPanel v-if="shopNpcId" :npc-id="shopNpcId" @close="shopNpcId = null" />
    <DialogueBox />
    <BattlePanel />
    <AreaBanner />
    <QuestToast />
    <BattleTransition />
    <EndingPanel />
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
