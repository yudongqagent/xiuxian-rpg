import type { Quest, QuestStep } from './schemas'

/** 任务状态机：notStarted → active → readyToTurnIn → completed（failed 可重接） */
export type QuestStatus = 'notStarted' | 'active' | 'readyToTurnIn' | 'completed' | 'failed'

export interface ActiveQuest {
  counts: number[]
}

export interface QuestState {
  active: Record<string, ActiveQuest>
  completed: string[]
  failed: string[]
  tracked: string | null
}

export interface QuestSaveData {
  active: Array<{ id: string; counts: number[] }>
  completed: string[]
  failed?: string[]
  tracked?: string | null
}

export const EMPTY_QUEST_STATE: QuestState = {
  active: {},
  completed: [],
  failed: [],
  tracked: null,
}

const STAGE_BASE: Record<string, number> = {
  炼气: 100,
  筑基: 200,
  结丹: 300,
  元婴: 400,
  化神: 500,
}
const SUB_OFFSET: Record<string, number> = { 初期: 1, 中期: 2, 后期: 3, 圆满: 14 }

export function parseRealmOrdinal(realm: string): number {
  if (realm === '凡人') return 0
  for (const [stage, base] of Object.entries(STAGE_BASE)) {
    if (!realm.startsWith(stage)) continue
    const rest = realm.slice(stage.length)
    if (rest === '') return base + 1
    const layers = /^(\d{1,2})层$/.exec(rest)
    if (layers) return base + Number(layers[1])
    return base + (SUB_OFFSET[rest] ?? 0)
  }
  return -1
}

export function meetsRealm(required: string | undefined, current: string): boolean {
  if (!required) return true
  return parseRealmOrdinal(current) >= parseRealmOrdinal(required)
}

export function meetsPrerequisites(
  quest: Quest,
  completedQuestIds: ReadonlySet<string>,
  playerRealm: string,
): boolean {
  if (!meetsRealm(quest.prerequisites.realm, playerRealm)) return false
  return quest.prerequisites.quests.every((id) => completedQuestIds.has(id))
}

export type QuestTrigger =
  | { kind: 'kill'; enemyId: string }
  | { kind: 'collect'; itemId: string; count: number }
  | { kind: 'talk'; npcId: string }
  | { kind: 'reach'; regionId: string }

function stepRequired(step: QuestStep): number {
  return step.kind === 'kill' || step.kind === 'collect' ? step.count : 1
}

function stepMatches(step: QuestStep, ev: QuestTrigger): boolean {
  switch (step.kind) {
    case 'kill':
      return ev.kind === 'kill' && step.target === ev.enemyId
    case 'collect':
      return ev.kind === 'collect' && step.target === ev.itemId
    case 'talk':
      return ev.kind === 'talk' && step.npc === ev.npcId
    case 'reach':
      return ev.kind === 'reach' && step.region === ev.regionId
  }
}

export interface TriggerResult {
  state: QuestState
  progressedQuestIds: string[]
  stepCompletedIds: string[]
  readyToTurnInIds: string[]
  autoCompletedIds: string[]
}

function cloneState(s: QuestState): QuestState {
  return {
    active: Object.fromEntries(Object.entries(s.active).map(([k, v]) => [k, { counts: [...v.counts] }])),
    completed: [...s.completed],
    failed: [...s.failed],
    tracked: s.tracked,
  }
}

export function applyTrigger(
  quests: Readonly<Record<string, Quest>>,
  prev: QuestState,
  ev: QuestTrigger,
): TriggerResult {
  const state = cloneState(prev)
  const progressed: string[] = []
  const stepDone: string[] = []
  const readyTurnIn: string[] = []
  const autoCompleted: string[] = []

  for (const [questId, progress] of Object.entries(state.active)) {
    const quest = quests[questId]
    if (!quest) continue
    const idx = currentStepIndex(quest, progress)
    if (idx < 0) continue
    const step = quest.steps[idx]
    if (!stepMatches(step, ev)) continue
    const req = stepRequired(step)
    const gain = ev.kind === 'collect' ? Math.max(1, ev.count) : 1
    progress.counts[idx] = Math.min(req, progress.counts[idx] + gain)
    progressed.push(questId)
    if (progress.counts[idx] < req) continue
    stepDone.push(questId)
    if (idx < quest.steps.length - 1) continue
    if (step.kind === 'talk') {
      finishActiveQuest(state, questId)
      autoCompleted.push(questId)
    } else {
      readyTurnIn.push(questId)
    }
  }
  return {
    state,
    progressedQuestIds: progressed,
    stepCompletedIds: stepDone,
    readyToTurnInIds: readyTurnIn,
    autoCompletedIds: autoCompleted,
  }
}

function finishActiveQuest(state: QuestState, questId: string): void {
  delete state.active[questId]
  if (!state.completed.includes(questId)) state.completed.push(questId)
  if (state.tracked === questId) state.tracked = newestActiveId(state.active)
}

export function currentStepIndex(quest: Quest, progress: ActiveQuest | undefined): number {
  if (!progress) return -1
  for (let i = 0; i < quest.steps.length; i++) {
    if ((progress.counts[i] ?? 0) < stepRequired(quest.steps[i])) return i
  }
  return -1
}

export function isReadyToTurnIn(quest: Quest, progress: ActiveQuest | undefined): boolean {
  return !!progress && currentStepIndex(quest, progress) < 0
}

export function canAccept(state: QuestState, questId: string): boolean {
  return !state.active[questId] && !state.completed.includes(questId)
}

export interface ActionOutcome {
  state: QuestState
  ok: boolean
}

export function acceptQuest(prev: QuestState, quest: Quest): ActionOutcome {
  if (!canAccept(prev, quest.id)) return { state: prev, ok: false }
  const state = cloneState(prev)
  state.failed = state.failed.filter((id) => id !== quest.id)
  state.active[quest.id] = { counts: quest.steps.map(() => 0) }
  return { state, ok: true }
}

export interface TurnInOutcome extends ActionOutcome {
  rewards?: { lingshi: number; exp_qi: number; items: string[] }
}

export function turnInQuest(
  quests: Readonly<Record<string, Quest>>,
  prev: QuestState,
  questId: string,
): TurnInOutcome {
  const progress = prev.active[questId]
  const quest = quests[questId]
  if (!quest || !isReadyToTurnIn(quest, progress)) return { state: prev, ok: false }
  const state = cloneState(prev)
  finishActiveQuest(state, questId)
  return {
    state,
    ok: true,
    rewards: {
      lingshi: quest.rewards.lingshi,
      exp_qi: quest.rewards.exp_qi,
      items: [...quest.rewards.items],
    },
  }
}

export function failQuest(prev: QuestState, questId: string): QuestState {
  if (!prev.active[questId]) return prev
  const state = cloneState(prev)
  delete state.active[questId]
  if (!state.failed.includes(questId)) state.failed.push(questId)
  if (state.tracked === questId) state.tracked = newestActiveId(state.active)
  return state
}

function newestActiveId(active: Record<string, ActiveQuest>): string | null {
  const ids = Object.keys(active)
  return ids.length > 0 ? ids[ids.length - 1] : null
}

export function resolveTracked(state: QuestState): string | null {
  if (state.tracked && state.active[state.tracked]) return state.tracked
  return newestActiveId(state.active)
}

export interface RewardSummary {
  lingshi: number
  expQi: number
  items: string[]
}

export function sumRewards(quests: readonly Quest[]): RewardSummary {
  return quests.reduce<RewardSummary>(
    (acc, q) => ({
      lingshi: acc.lingshi + q.rewards.lingshi,
      expQi: acc.expQi + q.rewards.exp_qi,
      items: [...acc.items, ...q.rewards.items],
    }),
    { lingshi: 0, expQi: 0, items: [] },
  )
}

export interface StepView {
  text: string
  done: boolean
  current: boolean
  count: number
  required: number
  kind: QuestStep['kind']
}

export function buildStepViews(
  quest: Quest,
  progress: ActiveQuest | undefined,
  nameOf: (kind: QuestStep['kind'], id: string) => string,
): StepView[] {
  const curIdx = currentStepIndex(quest, progress)
  return quest.steps.map((step, i) => {
    const required = stepRequired(step)
    const count = Math.min(progress?.counts[i] ?? 0, required)
    let text: string
    switch (step.kind) {
      case 'kill':
        text = `消灭 ${nameOf('kill', step.target)}`
        break
      case 'collect':
        text = `收集 ${nameOf('collect', step.target)}`
        break
      case 'talk':
        text = `与 ${nameOf('talk', step.npc)} 交谈`
        break
      case 'reach':
        text = `前往 ${nameOf('reach', step.region)}`
    }
    if (required > 1) text += ` ${count}/${required}`
    return { text, done: count >= required, current: i === curIdx, count, required, kind: step.kind }
  })
}

export function toSaveData(state: QuestState): QuestSaveData {
  return {
    active: Object.entries(state.active).map(([id, p]) => ({ id, counts: [...p.counts] })),
    completed: [...state.completed],
    failed: [...state.failed],
    tracked: state.tracked,
  }
}

export function fromSaveData(data: QuestSaveData | undefined, knownQuestIds: ReadonlySet<string>): QuestState {
  const state: QuestState = { active: {}, completed: [], failed: [], tracked: null }
  if (!data) return state
  for (const entry of data.active ?? []) {
    if (!knownQuestIds.has(entry.id) || state.active[entry.id]) continue
    state.active[entry.id] = { counts: entry.counts.map((c) => Math.max(0, c)) }
  }
  state.completed = (data.completed ?? []).filter((id, i, arr) => knownQuestIds.has(id) && arr.indexOf(id) === i)
  state.failed = (data.failed ?? []).filter(
    (id) => knownQuestIds.has(id) && !state.completed.includes(id) && !state.active[id],
  )
  state.tracked = data.tracked && state.active[data.tracked] ? data.tracked : null
  return state
}
