/**
 * 任务系统 sanity checks：状态机迁移/目标计数/前置门槛/奖励结算。
 * 运行：npm run check:quest
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { QuestSchema, type Quest } from '../src/systems/schemas'
import {
  EMPTY_QUEST_STATE,
  acceptQuest,
  applyTrigger,
  buildStepViews,
  canAccept,
  failQuest,
  fromSaveData,
  meetsPrerequisites,
  meetsRealm,
  parseRealmOrdinal,
  resolveTracked,
  sumRewards,
  toSaveData,
  turnInQuest,
} from '../src/systems/quests'
import { realmLabel } from '../src/systems/player'

const QUEST_DIR = join(import.meta.dirname, '..', 'content', 'quests')

function loadQuests(): Record<string, Quest> {
  const record: Record<string, Quest> = {}
  for (const file of readdirSync(QUEST_DIR).filter((f) => f.endsWith('.json'))) {
    const q = QuestSchema.parse(JSON.parse(readFileSync(join(QUEST_DIR, file), 'utf-8')))
    record[q.id] = q
  }
  return record
}

const QUESTS = loadQuests()

let failures = 0
let passed = 0
function expect(label: string, cond: boolean): void {
  if (cond) {
    passed++
    console.log(`✓ ${label}`)
  } else {
    failures++
    console.error(`✗ ${label}`)
  }
}

// ── 境界序数 ────────────────────────────────────────────────
{
  const ladder = [
    '凡人',
    '炼气1层',
    '炼气3层',
    '炼气4层',
    '炼气5层',
    '炼气6层',
    '炼气7层',
    '炼气13层',
    '炼气圆满',
    '筑基初期',
    '筑基中期',
    '筑基后期',
    '筑基圆满',
    '结丹初期',
    '结丹后期',
    '元婴初期',
    '元婴中期',
    '元婴圆满',
    '化神初期',
    '化神圆满',
  ]
  let sorted = true
  for (let i = 1; i < ladder.length; i++) {
    if (parseRealmOrdinal(ladder[i]) <= parseRealmOrdinal(ladder[i - 1])) sorted = false
  }
  expect('境界序数全链严格递增', sorted)
  expect('未知境界不满足任何门槛', !meetsRealm('炼气1层', '不存在的境界'))
}

// ── 前置门槛（任务链 + 境界） ────────────────────────────────
{
  const none = new Set<string>()
  const withQm01 = new Set(['qm_01_rumen'])
  const qm01 = QUESTS['qm_01_rumen']
  const qm02 = QUESTS['qm_02_duoshen']
  expect('qm_01 无前置即可接', meetsPrerequisites(qm01, none, '凡人'))
  expect('qm_02 缺前置任务被锁', !meetsPrerequisites(qm02, none, '炼气9层'))
  expect('qm_02 境界不足被锁', !meetsPrerequisites(qm02, withQm01, '炼气2层'))
  expect('qm_02 双条件满足后解锁', meetsPrerequisites(qm02, withQm01, '炼气3层'))

  let chainOk = true
  const mainIds = Object.values(QUESTS)
    .filter((q) => q.type === 'main')
    .map((q) => q.id)
  for (let i = 1; i < Math.min(mainIds.length, 6); i++) {
    const cur = QUESTS[mainIds[i]]
    if (!cur.prerequisites.quests.includes(mainIds[i - 1])) chainOk = false
  }
  expect('主线前六章 prerequisites 环环相扣', chainOk)
}

// ── 非法迁移守卫 ────────────────────────────────────────────
{
  const fresh = { ...EMPTY_QUEST_STATE }
  expect('未接取不可交付', !turnInQuest(QUESTS, fresh, 'qm_01_rumen').ok)
  const dup = acceptQuest(fresh, QUESTS['qm_01_rumen']).state
  expect('重复接取被拒', !acceptQuest(dup, QUESTS['qm_01_rumen']).ok)
  expect('已完成不可再接', !canAccept({ ...dup, completed: ['qm_01_rumen'] }, 'qm_01_rumen'))
  const failed = failQuest(dup, 'qm_01_rumen')
  expect('失败后可重接', canAccept(failed, 'qm_01_rumen') && !failed.active['qm_01_rumen'])
}

// ── qm_01 全流程（顺序目标 + 终步对话自动完成） ───────────────
{
  let state = acceptQuest({ ...EMPTY_QUEST_STATE }, QUESTS['qm_01_rumen']).state
  const talk = (npcId: string) =>
    (state = applyTrigger(QUESTS, state, { kind: 'talk', npcId }).state)
  const collect = (itemId: string, count: number) =>
    (state = applyTrigger(QUESTS, state, { kind: 'collect', itemId, count }).state)

  collect('qi_xie_ling_cao', 5)
  expect('首步未完成前收集不计入', state.active['qm_01_rumen'].counts.every((c) => c === 0))
  talk('yue_tangzhu')
  expect('与月堂主交谈完成第一步', state.active['qm_01_rumen'].counts[0] === 1)

  let res = applyTrigger(QUESTS, state, { kind: 'collect', itemId: 'qi_xie_ling_cago', count: 5 })
  expect('错误物品 id 不推进', res.progressedQuestIds.length === 0)
  state = res.state
  state = applyTrigger(QUESTS, state, { kind: 'collect', itemId: 'qi_xie_ling_cao', count: 4 }).state
  expect('收集 4/5 不推进到第三步', state.active['qm_01_rumen'].counts[1] === 4)
  state = applyTrigger(QUESTS, state, { kind: 'collect', itemId: 'qi_xie_ling_cao', count: 3 }).state
  expect('超额收集收敛到需求量并推进', state.active['qm_01_rumen'].counts[1] === 5)
  res = applyTrigger(QUESTS, state, { kind: 'talk', npcId: 'mo_dafu' })
  state = res.state
  expect('终步与发布人交谈自动交付', res.autoCompletedIds.includes('qm_01_rumen'))
  expect('任务进入 completed', state.completed.includes('qm_01_rumen'))
}

// ── 多步支线 + 手动交付（qs_caixia_langhuan） ────────────────
{
  let state = acceptQuest({ ...EMPTY_QUEST_STATE }, QUESTS['qs_caixia_langhuan']).state
  for (let i = 0; i < 6; i++) {
    state = applyTrigger(QUESTS, state, { kind: 'kill', enemyId: 'hui_lang' }).state
  }
  expect('击杀超额计数封顶', state.active['qs_caixia_langhuan'].counts[0] === 5)
  expect('第二步未完成不进入待交付', !!state.active['qs_caixia_langhuan'])
  state = applyTrigger(QUESTS, state, { kind: 'talk', npcId: 'chaopeng_laoren' }).state
  expect('终步交谈后自动完成', state.completed.includes('qs_caixia_langhuan'))
}

// ── readyToTurnIn → 手动交付奖励（qm_02） ────────────────────
{
  let state = acceptQuest({ ...EMPTY_QUEST_STATE }, QUESTS['qm_02_duoshen']).state
  state = applyTrigger(QUESTS, state, { kind: 'kill', enemyId: 'yelang_bangzhong' }).state
  state = applyTrigger(QUESTS, state, { kind: 'kill', enemyId: 'yelang_bangzhong' }).state
  expect('击杀进度 2/5', state.active['qm_02_duoshen'].counts[0] === 2)
  for (let i = 2; i < 6; i++)
    state = applyTrigger(QUESTS, state, { kind: 'kill', enemyId: 'yelang_bangzhong' }).state
  state = applyTrigger(QUESTS, state, { kind: 'talk', npcId: 'li_feiyu' }).state
  expect('非终步交谈不完成任务', !!state.active['qm_02_duoshen'])
  state = applyTrigger(QUESTS, state, { kind: 'reach', regionId: 'caixia_shanmai' }).state
  expect('全部目标达成但需手动交付', !!state.active['qm_02_duoshen'])

  const early = turnInQuest(QUESTS, acceptQuest({ ...EMPTY_QUEST_STATE }, QUESTS['qm_02_duoshen']).state, 'qm_02_duoshen')
  expect('未达成交付条件时拒绝', !early.ok)
  const done = turnInQuest(QUESTS, state, 'qm_02_duoshen')
  expect('手动交付成功', done.ok && done.state.completed.includes('qm_02_duoshen'))
  expect(
    '交付奖励正确',
    !!done.rewards && done.rewards.lingshi === 100 && done.rewards.exp_qi === 300 && done.rewards.items[0] === 'ju_qi_san',
  )
}

// ── 主线六章端到端链路模拟 + 奖励汇总 ────────────────────────
{
  const CHAIN = [
    'qm_01_rumen',
    'qm_02_duoshen',
    'qm_03_baiyaoyuan',
    'qm_04_xuese_shilian',
    'qm_05_zhengmo_zhanyi',
    'qm_06_dongfu_chuancheng',
  ]
  const REALMS = ['炼气1层', '炼气3层', '炼气4层', '炼气圆满', '筑基初期', '筑基圆满']
  let state = { ...EMPTY_QUEST_STATE }
  CHAIN.forEach((questId, i) => {
    const quest = QUESTS[questId]
    expect(`第${i + 1}章前置满足`, meetsPrerequisites(quest, new Set(state.completed), REALMS[i]))
    const accepted = acceptQuest(state, quest)
    state = accepted.state
    for (const step of quest.steps) {
      switch (step.kind) {
        case 'kill':
          for (let n = 0; n < step.count; n++)
            state = applyTrigger(QUESTS, state, { kind: 'kill', enemyId: step.target }).state
          break
        case 'collect':
          state = applyTrigger(QUESTS, state, { kind: 'collect', itemId: step.target, count: step.count }).state
          break
        case 'talk':
          state = applyTrigger(QUESTS, state, { kind: 'talk', npcId: step.npc }).state
          break
        case 'reach':
          state = applyTrigger(QUESTS, state, { kind: 'reach', regionId: step.region }).state
      }
    }
    const manual = quest.steps[quest.steps.length - 1].kind !== 'talk'
    if (manual) {
      const res = turnInQuest(QUESTS, state, questId)
      state = res.state
      if (!res.ok) failures++
    }
  })
  expect(
    '六章主线全部完成',
    CHAIN.every((id) => state.completed.includes(id)),
  )
  const total = sumRewards(CHAIN.map((id) => QUESTS[id]))
  expect(
    '链路奖励汇总正确（灵石3820/修为19850）',
    total.lingshi === 3820 && total.expQi === 19850 && total.items.length === 6,
  )
}

// ── 追踪目标与存档往返 ──────────────────────────────────────
{
  let state = acceptQuest({ ...EMPTY_QUEST_STATE }, QUESTS['qm_01_rumen']).state
  state = acceptQuest(state, QUESTS['qs_caixia_langhuan']).state
  expect('追踪指向最新接取', resolveTracked(state) === 'qs_caixia_langhuan')

  const saved = toSaveData(state)
  let restored = fromSaveData(saved, new Set(Object.keys(QUESTS)))
  expect(
    '存档往返保留双任务',
    !!restored.active['qm_01_rumen'] && !!restored.active['qs_caixia_langhuan'],
  )
  restored = applyTrigger(QUESTS, restored, { kind: 'kill', enemyId: 'hui_lang' }).state
  expect('恢复后可继续推进', restored.active['qs_caixia_langhuan'].counts[0] === 1)
  expect('未知任务 id 被丢弃', fromSaveData({ active: [{ id: 'ghost_quest', counts: [1] }], completed: [] }, new Set(Object.keys(QUESTS))).active['ghost_quest'] === undefined)

  const views = buildStepViews(QUESTS['qm_04_xuese_shilian'], { counts: [1, 3, 0, 0] }, (_k, id) => id)
  expect('步骤视图当前项唯一且文本含计数', views.filter((v) => v.current).length === 1 && views[1].text.includes('3/3') && views[1].done)

  // 境界解析：realmLabel 产出中文数字层（炼气三层），必须与阿拉伯数字层可比（主线断链修复回归）
  expect('中文数字层解析', parseRealmOrdinal('炼气三层') === 103 && parseRealmOrdinal('炼气十三层') === 113)
  expect('中文层数达标判定', meetsRealm('炼气3层', '炼气三层') && !meetsRealm('炼气3层', '炼气二层'))
}

// ===== 回归：玩家境界与筑基前置（fix-realm）=====
{
  expect('realmLabel(13)=炼气十三层', realmLabel(13) === '炼气十三层')
  expect('realmLabel(14)=筑基初期', realmLabel(14) === '筑基初期')
  expect('realmLabel(17)=筑基圆满', realmLabel(17) === '筑基圆满')
  expect('realmLabel(18)=结丹初期', realmLabel(18) === '结丹初期')
  expect('realmLabel(22)=元婴初期', realmLabel(22) === '元婴初期')
  expect('realmLabel(26)=化神初期', realmLabel(26) === '化神初期')
  expect('realmLabel(30)=化神圆满·渡劫', realmLabel(30) === '化神圆满·渡劫')
  expect('筑基初期序数 > 炼气十三层', parseRealmOrdinal('筑基初期') > parseRealmOrdinal('炼气十三层'))
  const q5 = QUESTS['qm_05_zhengmo_zhanyi']
  if (q5) {
    const done4 = new Set(['qm_01_rumen', 'qm_02_duoshen', 'qm_03_baiyaoyuan', 'qm_04_xuese_shilian'])
    expect('炼气圆满不满足 qm_05', !meetsPrerequisites(q5, done4, realmLabel(13)))
    expect('筑基初期满足 qm_05', meetsPrerequisites(q5, done4, realmLabel(14)))
  }
}

console.log(`\n${passed} 项通过，${failures} 项失败`)
if (failures > 0) process.exit(1)
