import { bus } from '../engine/eventBus'
import type { Quest } from './schemas'
import {
  EMPTY_QUEST_STATE,
  acceptQuest,
  applyTrigger,
  buildStepViews,
  canAccept,
  currentStepIndex,
  fromSaveData,
  meetsPrerequisites,
  resolveTracked,
  toSaveData,
  turnInQuest,
  type QuestSaveData,
  type QuestState,
  type QuestStatus,
  type QuestTrigger,
  type StepView,
} from './quests'
import { QUEST_IDS, allQuests, getQuest, questsByGiver } from './questContent'
import { grantRewards } from './rewards'
import { getPlayer, realmLabel } from './player'
import type { NameKind } from './contentNames'

const DEFAULT_PLAYER_REALM = '炼气1层'
const NAME_KIND_BY_STEP: Record<Quest['steps'][number]['kind'], NameKind> = {
  kill: 'enemy',
  collect: 'item',
  talk: 'npc',
  reach: 'region',
}

type NameResolver = (kind: NameKind, id: string) => string

let resolveName: NameResolver = (_kind, id) => id

/** 名称表按需异步加载（独立 chunk，避免首屏内联全量内容 JSON） */
void import('./contentNames').then((m) => {
  resolveName = m.resolveName
  for (const questId of Object.keys(state.active)) {
    bus.emit('quest:updated', { questId, status: getStatus(questId) })
  }
})

let state: QuestState = { ...EMPTY_QUEST_STATE }
let playerRealm = DEFAULT_PLAYER_REALM
let disposer: (() => void) | null = null

function notify(text: string, kind: 'info' | 'success' = 'info'): void {
  bus.emit('quest:notify', { text, kind })
}

function emitUpdated(questId: string, status: QuestStatus): void {
  bus.emit('quest:updated', { questId, status })
}

const queue: QuestTrigger[] = []
let draining = false

export function dispatchTrigger(ev: QuestTrigger): void {
  queue.push(ev)
  drain()
}

function drain(): void {
  if (draining) return
  draining = true
  try {
    while (queue.length > 0) applyTriggerEvent(queue.shift()!)
  } finally {
    draining = false
  }
}

function applyTriggerEvent(ev: QuestTrigger): void {
  const res = applyTrigger(allQuestRecord(), state, ev)
  state = res.state
  // 任何有进展的任务都要广播状态，否则 HUD 追踪条/任务日志停留在旧文本
  for (const questId of res.progressedQuestIds) {
    if (res.readyToTurnInIds.includes(questId) || res.autoCompletedIds.includes(questId)) continue
    emitUpdated(questId, 'active')
  }
  for (const questId of res.stepCompletedIds) {
    if (!res.autoCompletedIds.includes(questId) && !res.readyToTurnInIds.includes(questId)) {
      const step = currentObjectiveLine(questId)
      if (step) notify(`「${questName(questId)}」${step}`)
    }
  }
  for (const questId of res.readyToTurnInIds) {
    emitUpdated(questId, 'readyToTurnIn')
    notify(`「${questName(questId)}」已完成目标，回去交付吧`, 'success')
  }
  for (const questId of res.autoCompletedIds) completeQuest(questId)
}

let cachedRecord: Record<string, Quest> | null = null
function allQuestRecord(): Record<string, Quest> {
  if (!cachedRecord) {
    cachedRecord = Object.fromEntries(allQuests().map((q) => [q.id, q]))
  }
  return cachedRecord
}

function questName(questId: string): string {
  return getQuest(questId)?.name ?? questId
}

function completeQuest(questId: string): void {
  const quest = getQuest(questId)
  if (!quest) return
  emitUpdated(questId, 'completed')
  grantRewards(quest.rewards)
  const itemNames = quest.rewards.items.map((id) => resolveName('item', id)).join('、')
  notify(
    `任务完成「${quest.name}」 灵石+${quest.rewards.lingshi} 修为+${quest.rewards.exp_qi}${itemNames ? ` ${itemNames}` : ''}`,
    'success',
  )
}

export function requestOffer(questId: string): boolean {
  const quest = getQuest(questId)
  if (!quest || !canAccept(state, questId)) return false
  if (!meetsPrerequisites(quest, new Set(state.completed), playerRealm)) return false
  const res = acceptQuest(state, quest)
  if (!res.ok) return false
  state = res.state
  state.tracked = questId
  emitUpdated(questId, 'active')
  notify(`接取任务「${quest.name}」`)
  return true
}

export function requestTurnIn(questId: string): boolean {
  const res = turnInQuest(allQuestRecord(), state, questId)
  if (!res.ok) return false
  state = res.state
  completeQuest(questId)
  return true
}

export interface DialogueAction {
  kind: 'offer' | 'turnin'
  questId: string
  label: string
}

export function getQuestDialogueActions(npcId: string): DialogueAction[] {
  const actions: DialogueAction[] = []
  for (const quest of questsByGiver(npcId)) {
    if (quest.type === 'hidden') continue
    if (isReadyToTurnInById(quest.id)) {
      actions.push({ kind: 'turnin', questId: quest.id, label: `交付任务「${quest.name}」` })
    } else if (
      canAccept(state, quest.id) &&
      meetsPrerequisites(quest, new Set(state.completed), playerRealm)
    ) {
      actions.push({ kind: 'offer', questId: quest.id, label: `接取任务「${quest.name}」` })
    }
  }
  return actions
}

function isReadyToTurnInById(questId: string): boolean {
  const progress = state.active[questId]
  const quest = getQuest(questId)
  return !!quest && !!progress && currentStepIndex(quest, progress) < 0
}

export function getStatus(questId: string): QuestStatus {
  if (state.completed.includes(questId)) return 'completed'
  if (state.failed.includes(questId)) return 'failed'
  if (state.active[questId]) {
    const quest = getQuest(questId)
    return quest && isReadyToTurnInById(questId) ? 'readyToTurnIn' : 'active'
  }
  return 'notStarted'
}

export interface ActiveQuestView {
  quest: Quest
  steps: StepView[]
  readyToTurnIn: boolean
}

export function getActiveQuests(): ActiveQuestView[] {
  return Object.keys(state.active).map((questId) => viewActive(questId))
}

function viewActive(questId: string): ActiveQuestView {
  const quest = getQuest(questId)!
  return {
    quest,
    steps: buildStepViews(quest, state.active[questId], stepNameOf),
    readyToTurnIn: isReadyToTurnInById(questId),
  }
}

function stepNameOf(kind: Quest['steps'][number]['kind'], id: string): string {
  return resolveName(NAME_KIND_BY_STEP[kind], id)
}

export function getAvailableQuests(): Quest[] {
  const completedSet = new Set(state.completed)
  return allQuests().filter(
    (q) =>
      q.type !== 'hidden' &&
      canAccept(state, q.id) &&
      meetsPrerequisites(q, completedSet, playerRealm),
  )
}

export function getCompletedQuests(): Quest[] {
  return state.completed.map((id) => getQuest(id)).filter((q): q is Quest => !!q)
}

export interface TrackedQuestView extends ActiveQuestView {
  objectiveLine: string
}

export function getTrackedQuest(): TrackedQuestView | null {
  const trackedId = resolveTracked(state)
  if (!trackedId || !state.active[trackedId]) return null
  const view = viewActive(trackedId)
  return { ...view, objectiveLine: currentObjectiveLine(trackedId) ?? '' }
}

function currentObjectiveLine(questId: string): string | null {
  const quest = getQuest(questId)
  const progress = state.active[questId]
  if (!quest || !progress) return null
  if (currentStepIndex(quest, progress) < 0) return null
  const [view] = buildStepViews(quest, progress, stepNameOf).filter((s) => s.current)
  return view ? view.text : null
}

export function setPlayerRealm(realm: string): void {
  playerRealm = realm
}

export function getPlayerRealm(): string {
  return playerRealm
}

export function isQuestCompleted(questId: string): boolean {
  return state.completed.includes(questId)
}

export interface TrackedTarget {
  kind: 'talk' | 'kill' | 'collect' | 'reach'
  id: string
}

/** 当前追踪目标的机器可读定位（自动寻路用） */
export function getTrackedTarget(): TrackedTarget | null {
  const trackedId = resolveTracked(state)
  const quest = trackedId ? getQuest(trackedId) : null
  if (!trackedId || !quest || !state.active[trackedId]) return null
  if (isReadyToTurnInById(quest.id)) return { kind: 'talk', id: quest.giver }
  const idx = currentStepIndex(quest, state.active[trackedId])
  if (idx < 0) return null
  const step = quest.steps[idx]
  switch (step.kind) {
    case 'talk':
      return { kind: 'talk', id: step.npc }
    case 'kill':
      return { kind: 'kill', id: step.target }
    case 'collect':
      return { kind: 'collect', id: step.target }
    case 'reach':
      return { kind: 'reach', id: step.region }
  }
}

/** 主线断链引导：当前无进行中任务时，指向第一个可接取的任务与其发布人 */
export function getNextMainQuestHint(): { questId: string; questName: string; giverName: string } | null {
  const completedSet = new Set(state.completed)
  const next = allQuests()
    .filter((q) => q.type === 'main' && canAccept(state, q.id) && meetsPrerequisites(q, completedSet, playerRealm))
    .sort((a, b) => a.id.localeCompare(b.id))[0]
  if (!next) return null
  return { questId: next.id, questName: next.name, giverName: resolveName('npc', next.giver) }
}

export function snapshotQuests(): QuestSaveData {
  return toSaveData(state)
}

export function restoreQuests(data: QuestSaveData | undefined): void {
  state = fromSaveData(data, QUEST_IDS)
  // 恢复后广播，HUD 追踪条/任务日志才能立即呈现存档中的进度
  for (const questId of Object.keys(state.active)) {
    bus.emit('quest:updated', { questId, status: getStatus(questId) })
  }
}

export function initQuestRuntime(): () => void {
  if (disposer) return disposer
  // 境界与玩家等级联动（此前从未同步，导致筑基前置永远无法满足）
  setPlayerRealm(realmLabel(getPlayer().level))
  const unsubs = [
    bus.on('player:stats', () => setPlayerRealm(realmLabel(getPlayer().level))),
    bus.on('dialogue:open', ({ npcId }) => dispatchTrigger({ kind: 'talk', npcId })),
    bus.on('battle:end', ({ win, enemyId }) => {
      if (win && enemyId) dispatchTrigger({ kind: 'kill', enemyId })
    }),
    bus.on('item:acquired', ({ itemId, count }) =>
      dispatchTrigger({ kind: 'collect', itemId, count: count ?? 1 }),
    ),
    bus.on('area:enter', ({ regionId }) => {
      if (regionId) dispatchTrigger({ kind: 'reach', regionId })
    }),
    bus.on('quest:offer', ({ questId }) => requestOffer(questId)),
    bus.on('quest:turnin', ({ questId }) => requestTurnIn(questId)),
  ]
  disposer = () => {
    unsubs.forEach((u) => u())
    disposer = null
  }
  return disposer
}
