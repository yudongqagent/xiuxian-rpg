/**
 * 涌现/世界模拟回归（门禁 G3b，REDESIGN §13）。
 * V0 骨架：模拟 N 个游戏日推进时间轴，断言无死锁/无非法状态/存档快照保真；
 * V2 起在此基础上叠加 NPC 日程/关系图/事件队列的因果模拟。
 * 用法：npm run check:sandbox
 */
import {
  SHICHEN_PER_DAY,
  advanceTime,
  createWorldTime,
  fromWorldSnapshot,
  seasonName,
  timeLabel,
  tilesToShichen,
  toWorldSnapshot,
  yearOf,
  type WorldTimeData,
} from '../src/systems/time'
import {
  createGatherWorldState,
  gatherAt,
  isGatherAvailable,
  type GatherWorldState,
} from '../src/systems/gather'
import {
  AFFINITY_PER_THEFT,
  DEBT_AFFINITY,
  ENMITY_GRUDGE,
  GRUDGE_PER_THEFT,
  MENTOR_AFFINITY,
  RIVAL_GRUDGE,
  bumpRelation,
  createNpcRelationsState,
  giftAffinityGain,
  npcSpotAt,
  relationOf,
  relationTypeFor,
  type NpcRelationsState,
} from '../src/systems/relations'
import type { WorldEvent } from '../src/systems/schemas'
import { EnemySchema, RecipeSchema } from '../src/systems/schemas'
import {
  absentWorkDays,
  eventTriggered,
  getReputation,
  reputationLabel,
  resolveConsequences,
  sellPriceFactor,
  buyPriceFactor,
  setReputation,
} from '../src/systems/worldEvents'
import {
  addItem,
  attemptBreakthrough,
  buyItem,
  createPlayer,
  expToNext,
  fromPlayerSave,
  gateAt,
  grantExp,
  meditateTick,
  removeItem,
  respawnPenalty,
  sellItem,
  setRngOverride,
  statsForLevel,
  syncAfterBattle,
  type PlayerState,
} from '../src/systems/player'
import { createBattle, expReward, playerAttack, rollLoot } from '../src/systems/combat'
import { canCraft, craft } from '../src/systems/alchemy'
import { applyBuyPrice, bestSellPrice } from '../src/systems/market'
import {
  INIT_AGE,
  ageOf,
  createAgingState,
  cultivateMonths,
  getAging,
  hopelessRemaining,
  isRealmLocked,
  lifespanAt,
  lifespanExhausted,
  lockRealm,
  markEnded,
  remainingYears,
  setAging,
  subscribeAging,
} from '../src/systems/lifespan'
import huiLangJson from '../content/enemies/hui_lang.json'
import rHuichunSanJson from '../content/recipes/r_huichun_san.json'
import zayiyuanShiqieJson from '../content/events/zayiyuan_shiqie.json'
import wanbaolouJson from '../content/shops/wanbaolou_zhanggui.json'
import maguanshiJson from '../content/shops/ma_guanshi.json'
import jinguangJson from '../content/shops/jin_guang_shangren.json'

let passed = 0
let failed = 0
const check = (name: string, ok: boolean, detail = ''): void => {
  if (ok) passed++
  else failed++
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

// 1. 基础推进：一个时辰一格，跨日进位
{
  let t = createWorldTime()
  check('开局第1天子时', t.day === 1 && t.shichen === 0, JSON.stringify(t))
  t = advanceTime(t, 1)
  check('推进1时辰为丑时', t.day === 1 && t.shichen === 1, JSON.stringify(t))
  t = advanceTime(t, SHICHEN_PER_DAY - 1)
  check('推到当日子时末（满一日进位）', t.day === 2 && t.shichen === 0, JSON.stringify(t))
}

// 2. 大步推进 N 日不失控（无死锁/无非法）
{
  let t = createWorldTime()
  const totalDays = 90
  t = advanceTime(t, totalDays * SHICHEN_PER_DAY)
  check(`推进 ${totalDays} 日`, t.day === 1 + totalDays && t.shichen === 0, JSON.stringify(t))
  check('始终在合法时辰区间', t.shichen >= 0 && t.shichen < SHICHEN_PER_DAY, String(t.shichen))
}

// 3. 季节与年份推导
{
  const t = createWorldTime()
  check('第1天春季', seasonName(t) === '春', seasonName(t))
  const t15 = advanceTime(t, 15 * SHICHEN_PER_DAY)
  check('第16天入夏', seasonName(t15) === '夏', `${seasonName(t15)} · ${timeLabel(t15)}`)
  const tYear = advanceTime(t, 60 * SHICHEN_PER_DAY)
  check('第61天第2年', yearOf(tYear) === 2 && seasonName(tYear) === '春', timeLabel(tYear))
}

// 4. 负向推进回退合法（跨日回退）
{
  const t = { day: 2, shichen: 0 }
  const back = advanceTime(t, -1)
  check('第2天子时回退1时辰=第1天末尾', back.day === 1 && back.shichen === SHICHEN_PER_DAY - 1, JSON.stringify(back))
}

// 5. 存档快照保真：toWorldSnapshot → fromWorldSnapshot 无损往返
{
  const t = { day: 37, shichen: 5 }
  const restored = fromWorldSnapshot(toWorldSnapshot(t))
  check('时间快照往返无损', restored.day === 37 && restored.shichen === 5, JSON.stringify(restored))
}

// 6. 旧档兼容：无 world 字段 / 非法字段兜底为开局时间
{
  const fresh = fromWorldSnapshot(undefined)
  check('无世界快照兜底开局', fresh.day === 1 && fresh.shichen === 0, JSON.stringify(fresh))
  const bad = fromWorldSnapshot({ time: { day: 0, shichen: 99 } } as never)
  check('非法字段钳制', bad.day === 1 && bad.shichen === 0, JSON.stringify(bad))
}

// 7. 模拟世界连续运行 N 日：每时辰随机动作（推进/回退/快照保真），全程状态合法
{
  let t = createWorldTime()
  let snap = toWorldSnapshot(t)
  const days = 30
  const steps = days * SHICHEN_PER_DAY
  let deadlock = false
  for (let i = 0; i < steps; i++) {
    const r = (i * 7 + 3) % 5 // 确定性伪随机，稳定可回归
    t = advanceTime(t, r === 0 ? 0 : r === 1 ? SHICHEN_PER_DAY : r === 2 ? -1 : i % 3 === 0 ? 2 : 1)
    if (t.day < 1 || t.shichen < 0 || t.shichen >= SHICHEN_PER_DAY) deadlock = true
    if (i % 11 === 0) snap = toWorldSnapshot(t) // 周期快照
    if (deadlock) break
  }
  check('30日连续模拟无死锁', !deadlock && t.day >= 1, `最终 ${timeLabel(t)}`)
  const restored = fromWorldSnapshot(snap)
  check('模拟过程快照可恢复', restored.day === snap.time.day && restored.shichen === snap.time.shichen, timeLabel(restored))
}

// 8. V1.1 时间成本：移动/战斗/传送消耗均有锚（纯函数回归）
{
  check('行走40格=1时辰', tilesToShichen(40) === 1 && tilesToShichen(120) === 3, String(tilesToShichen(120)))
  check('不足40格不结算', tilesToShichen(39) === 0, String(tilesToShichen(39)))
  check('负值钳制为0', tilesToShichen(-5) === 0, String(tilesToShichen(-5)))
}

// 9. V1.2 采集点：可采判断 / 再生标记 / 跨日再采（纯函数回归）
{
  const ws = { byMap: {} }
  const t = createWorldTime() // 第1日 子时 = 绝对时辰 0
  const gather = [{ id: 'sp_lingcao', cost: 1, regen: 24, label: '灵草', x: 0, y: 0, itemId: 'qi_xie_ling_cao' }]
  check('缺省态可采', isGatherAvailable(ws, 'zayiyuan', 'sp_lingcao', t), 'fresh')
  const after = gatherAt(ws, 'zayiyuan', 'sp_lingcao', 24, t)
  check('采集后立即不可采', after.byMap.zayiyuan.sp_lingcao === 24 && !isGatherAvailable(after, 'zayiyuan', 'sp_lingcao', t), String(after.byMap.zayiyuan.sp_lingcao))
  const d1 = { day: 2, shichen: 0 } // 第2日子时（距采集过了 8 时辰），仍不可采
  check('24时辰再生中（第2日仍被占）', !isGatherAvailable(after, 'zayiyuan', 'sp_lingcao', d1), '24>8')
  const d4 = { day: 4, shichen: 0 } // 第4日子时（距采集过了 24 时辰）= 可采
  check('再生到期可采（第4日）', isGatherAvailable(after, 'zayiyuan', 'sp_lingcao', d4), '24<=24')
  const unaffected = gatherAt(ws, 'qixuanmen', 'other', 5, t)
  check('不同地图状态互不串扰', unaffected.byMap.zayiyuan === undefined, JSON.stringify(unaffected.byMap))
}

// 10. V1.3 关系图：记恨写回 + 钳制 + 目击半径内偷摘（纯函数回归）
{
  const state = createNpcRelationsState()
  check('初始中性关系', relationOf(state, 'zhang_er').grudge === 0 && relationOf(state, 'zhang_er').affinity === 0, JSON.stringify(relationOf(state, 'zhang_er')))
  const after = bumpRelation(state, 'zhang_er', { grudge: GRUDGE_PER_THEFT })
  check('偷摘一次记恨+1', relationOf(after, 'zhang_er').grudge === 1, JSON.stringify(relationOf(after, 'zhang_er')))
  const clamped = bumpRelation(after, 'zhang_er', { grudge: 999 })
  check('记恨钳制在100', relationOf(clamped, 'zhang_er').grudge === 100, String(relationOf(clamped, 'zhang_er').grudge))
  const neg = bumpRelation(state, 'zhang_er', { grudge: -5 })
  check('记恨负值钳制为0', relationOf(neg, 'zhang_er').grudge === 0, String(relationOf(neg, 'zhang_er').grudge))
  check('记恨不改好感', relationOf(after, 'zhang_er').affinity === 0, String(relationOf(after, 'zhang_er').affinity))
  const multi = bumpRelation(state, 'zhang_er', { grudge: 3 }).zhang_er
  check('记恨+3=3', multi.grudge === 3, JSON.stringify(multi))
}

// 11. V1.3 日程查表：时辰 → 点位；无匹配/空日程回退 null（纯函数回归）
{
  const schedule = {
    卯: [22, 4],
    辰: [22, 4],
    午: [6, 16],
  } as Parameters<typeof npcSpotAt>[0]
  check('卯时点位', JSON.stringify(npcSpotAt(schedule, { day: 1, shichen: 3 })) === '{"x":22,"y":4}', JSON.stringify(npcSpotAt(schedule, { day: 1, shichen: 3 })))
  check('辰时点位', JSON.stringify(npcSpotAt(schedule, { day: 1, shichen: 4 })) === '{"x":22,"y":4}', JSON.stringify(npcSpotAt(schedule, { day: 1, shichen: 4 })))
  check('午时回后段点位', JSON.stringify(npcSpotAt(schedule, { day: 1, shichen: 6 })) === '{"x":6,"y":16}', JSON.stringify(npcSpotAt(schedule, { day: 1, shichen: 6 })))
  check('日程首条前（子时）回退null', npcSpotAt(schedule, { day: 1, shichen: 0 }) === null, String(npcSpotAt(schedule, { day: 1, shichen: 0 })))
  check('空日程/无日程回退null', npcSpotAt({}, { day: 1, shichen: 0 }) === null && npcSpotAt(undefined, { day: 1, shichen: 0 }) === null)
}

// 12. V1.4 事件风暴首例「杂役院失窃」：收工记录/条件求值/后果结算（纯函数回归）
{
  const evFixtures: WorldEvent = {
    id: 'zayiyuan_shiqie',
    name: '杂役院失窃',
    nominee: 'zhang_er',
    once: true,
    trigger: { absentDays: 7, grudgeOf: 'zhang_er', grudgeAt: 2 },
    consequences: { lingshi: 20, reputation: -20 },
    toast: '{npc}告发你旷工多日……罚你二十灵石',
  }

  // 旷工计数：从未上工 → 自第 1 日起算；某日采药 → 从该日起算
  check('从未上工：第1天旷工0天', absentWorkDays(undefined, 1) === 0, `absent=${absentWorkDays(undefined, 1)}`)
  check('旷工满7天（7天前上工）', absentWorkDays(13, 20) === 7, `absent=${absentWorkDays(13, 20)}`)
  check('当日上工不旷', absentWorkDays(20, 20) === 0, `absent=${absentWorkDays(20, 20)}`)
  check('今日早于上工日钳制为0', absentWorkDays(25, 20) === 0, `absent=${absentWorkDays(25, 20)}`)

  // 条件求值：旷工≥7 且 记恨>2
  const rel1 = { zhang_er: { affinity: 0, grudge: 1 } }
  const rel3 = { zhang_er: { affinity: 0, grudge: 3 } }
  const ctxAuto = { day: 20, lastWorkDay: 13, relations: rel1 }
  const ctxGentle = { day: 20, lastWorkDay: 19, relations: rel3 }
  const ctxBoth = { day: 20, lastWorkDay: 13, relations: rel3 }
  check('旷工不足不触发', !eventTriggered(evFixtures, ctxGentle), '施行温和')
  check('记恨不足不触发', !eventTriggered(evFixtures, ctxAuto), '记恨1')
  check('旷工+记恨齐备触发', eventTriggered(evFixtures, ctxBoth), '触发')

  // 后果结算
  const cons = resolveConsequences(evFixtures)
  check('扣灵石20', cons.lingshiDelta === -20, `delta=${cons.lingshiDelta}`)
  check('风评-20', cons.reputationDelta === -20, `delta=${cons.reputationDelta}`)
}

// 13. V1.4 坊市风评存储与物价系数（GDD §3 声望→坊市物价）
{
  setReputation(0)
  check('默认风评0', getReputation() === 0, `rep=${getReputation()}`)
  setReputation(-20)
  check('负风评写入', getReputation() === -20, `rep=${getReputation()}`)
  setReputation(-999)
  check('下钳-100', getReputation() === -100, `rep=${getReputation()}`)
  setReputation(999)
  check('上钳100', getReputation() === 100, `rep=${getReputation()}`)
  check('风评标签（0）', reputationLabel(0) === '不温不火', reputationLabel(0))
  setReputation(-30)
  check('负风评买贵', buyPriceFactor(getReputation()) > 1, `buy=${buyPriceFactor(getReputation())}`)
  check('负风评卖贱', sellPriceFactor(getReputation()) < 1, `sell=${sellPriceFactor(getReputation())}`)
  setReputation(50)
  check('正风评买贱', buyPriceFactor(getReputation()) < 1, `buy=${buyPriceFactor(getReputation())}`)
  check('正风评卖贵', sellPriceFactor(getReputation()) > 1, `sell=${sellPriceFactor(getReputation())}`)
}
// 清理：避免把测试注入的有副作用风评带进后续断言
setReputation(0)

// 14. V1.5 寿元推进（世界历驱动）：境界→寿元表 / 年龄 / 剩余年限 / 无望判定（纯函数回归）
{
  check('出身 22 岁', ageOf(1) === INIT_AGE && INIT_AGE === 22, `age=${ageOf(1)}`)
  check('60 游戏日 = 1 岁', ageOf(61) === 23 && ageOf(3661) === 83, `age(3661)=${ageOf(3661)}`)
  check('第 83 载炼气余 37 年（验收锚）', remainingYears(13, 3661) === 37, `remaining=${remainingYears(13, 3661)}`)
  check('境界寿元表（炼气/筑基/化神）', lifespanAt(1) === 120 && lifespanAt(14) === 200 && lifespanAt(25) === 1500, `120/200/1500`)
  check('剩余不足半寿 → 破境无望（37年）', hopelessRemaining(13, 3661) === true, `hopeless=${hopelessRemaining(13, 3661)}`)
  check('余寿充足不判无望（82年）', hopelessRemaining(13, 991) === false, `hopeless=${hopelessRemaining(13, 991)}`)
  check('寿元耗尽才终结', lifespanExhausted(1, 5881) === true && lifespanExhausted(1, 5880) === false, `ex(${lifespanExhausted(1, 5881)})`)
  check('负日/开局不超出身', ageOf(0) === 22 && remainingYears(1, 1) === lifespanAt(1) - INIT_AGE, `age(0)=${ageOf(0)}`)
}

// 15. V1.5 闭关参悟 + 突破 RNG 覆写（纯函数回归）：闭关修为遵守圆满门限；突破可确定性回归
{
  const mkGatePlayer = () => {
    const base = grantExp(fromPlayerSave(undefined), 99999).player
    const s = statsForLevel(13)
    return addItem({ ...base, hp: s.maxHp, qi: s.maxQi, exp: expToNext(13) }, 'zhu_ji_dan')
  }
  const med = cultivateMonths(fromPlayerSave(undefined), 12, 1)
  check('闭关一载修为 +48', med.expGain === 48, `expGain=${med.expGain}`)
  const gated = cultivateMonths(mkGatePlayer(), 1200, 1)
  check('闭关冲破门限时修为封顶（不越境界）', gated.player.level === 13 && gated.player.exp === expToNext(13), `L${gated.player.level} exp=${gated.player.exp}`)

  setRngOverride(() => 0.99)
  const fail = attemptBreakthrough(mkGatePlayer(), gateAt(13)!, undefined)
  check('强制失败：耗丹重伤不堕落', fail.success === false && fail.player.level === 13 && !(fail.player.inventory.zhu_ji_dan > 0), `level=${fail.player.level}`)
  setRngOverride(() => 0)
  const win = attemptBreakthrough(mkGatePlayer(), gateAt(13)!, undefined)
  check('强制成功：晋升筑基一层', win.success === true && win.player.level === 14, `level=${win.player.level}`)
  setRngOverride(null)
  const free = attemptBreakthrough(mkGatePlayer(), gateAt(13)!, undefined)
  check('RNG 覆写复位（随机回归）', typeof free.success === 'boolean' && free.chance >= 0 && free.chance <= 0.95, `chance=${free.chance}`)
}

// 16. V1.5 aging 存储：硬锁/终结写回 + 订阅（同风评存储做法）
{
  const s = createAgingState()
  check('初始无锁未终结', s.lockedRealms.length === 0 && s.ended === false, JSON.stringify(s))
  const locked = lockRealm(s, '筑基')
  check('硬锁筑基', isRealmLocked(locked, '筑基') === true && isRealmLocked(locked, '结丹') === false, JSON.stringify(locked.lockedRealms))
  check('重复锁定不重复记录', lockRealm(locked, '筑基').lockedRealms.length === 1, JSON.stringify(locked.lockedRealms))
  check('终结标记幂等', markEnded(markEnded(s)).ended === true, 'idempotent')
  let fired = 0
  const unsub = subscribeAging(() => fired++)
  setAging(locked)
  setAging(markEnded(locked))
  unsub()
  check('aging 存储写入/订阅/读回', fired === 2 && isRealmLocked(getAging(), '筑基') && getAging().ended, `fired=${fired} state=${JSON.stringify(getAging())}`)
  setAging(createAgingState())
  check('aging 复位', getAging().lockedRealms.length === 0 && getAging().ended === false, JSON.stringify(getAging()))
}

// 17. V1.6 涌现行为矩阵（DEVELOPMENT_PROCESS §5.3 出口证据）：5 策略 × 30 日因果分流
// 机械规则全部复用既有纯函数与配置内容：采集再生 gather.ts / 战斗 combat.ts / 炼丹 alchemy.ts /
// 坊市价格 worldEvents+shop / 关系 relations / 时间 time / 事件 content/events/zayiyuan_shiqie.json。
// 诚实标注的场外假定：战斗/采集各耗 1 时辰，炼丹与售卖 0 时辰（工艺不占时辰）；战点取彩霞山灰狼
// （shanji 野怪点，灵气密度 1.5，战斗恢复秒回），采集点取杂役院（qixuan_men 密度 1.0）；不计跨图往返。
{
  const enemy = EnemySchema.parse(huiLangJson as never)
  const EVENT = zayiyuanShiqieJson as unknown as WorldEvent
  const RECIPE = RecipeSchema.parse(rHuichunSanJson as never)
  const STOCKS = {
    [String(wanbaolouJson['id'])]: { wares: wanbaolouJson['wares'] },
    [String(maguanshiJson['id'])]: { wares: maguanshiJson['wares'] },
    [String(jinguangJson['id'])]: { wares: jinguangJson['wares'] },
  }

  const RNG: () => number = (() => {
    let seed = 0x51ab7e
    return () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
  })()

  const GATHER_POINTS = [
    { id: 'sp_lingcao_a', item: 'qi_xie_ling_cao', regen: 24, watched: false },
    { id: 'sp_lingcao_b', item: 'qi_xie_ling_cao', regen: 24, watched: true },
    { id: 'sp_lingru', item: 'qiannian_lingru', regen: 72, watched: false },
    { id: 'sp_lingzhi', item: 'bai_nian_ling_zhi', regen: 48, watched: false },
  ] as const
  const WATCHED: ReadonlySet<number> = new Set([3, 4, 5])
  const YAO_FARM = ['qi_xie_ling_cao', 'bai_nian_ling_zhi', 'qiannian_lingru'] as const

  interface SimCtx {
    p: PlayerState
    g: GatherWorldState
    rel: NpcRelationsState
    work: number | undefined
    rep: number
    grudge: number
    events: string[]
    herbs: number
  }

  function fresh(): SimCtx {
    return {
      p: fromPlayerSave(undefined),
      g: createGatherWorldState(),
      rel: createNpcRelationsState(),
      work: undefined,
      rep: 0,
      grudge: 0,
      events: [],
      herbs: 0,
    }
  }

  function sellAt(ctx: SimCtx, itemId: string): void {
    ctx.p = sellItem(ctx.p, itemId, bestSellPrice(STOCKS, itemId, ctx.rep))
  }

  function sellAll(ctx: SimCtx, itemIds: readonly string[]): void {
    for (const id of itemIds) while ((ctx.p.inventory[id] ?? 0) > 0) sellAt(ctx, id)
  }

  /** 按优先级采集（rank 高分者优先）：内卷策略在张二盯梢时段优先偷摘被盯的灵草 */
  function gatherBest(
    ctx: SimCtx,
    t: WorldTimeData,
    rank: (pt: (typeof GATHER_POINTS)[number]) => number,
  ): boolean {
    let best: (typeof GATHER_POINTS)[number] | undefined
    let bestScore = -Infinity
    for (const pt of GATHER_POINTS) {
      if (!isGatherAvailable(ctx.g, 'zayiyuan', pt.id, t)) continue
      const score = rank(pt)
      if (score <= 0) continue
      if (score > bestScore) {
        bestScore = score
        best = pt
      }
    }
    if (!best) return false
    return finishGather(ctx, best, t)
  }

  function finishGather(
    ctx: SimCtx,
    pt: (typeof GATHER_POINTS)[number],
    t: WorldTimeData,
  ): boolean {
    ctx.g = gatherAt(ctx.g, 'zayiyuan', pt.id, pt.regen, t)
    ctx.p = addItem(ctx.p, pt.item, 1)
    ctx.herbs += 1
    if (pt.watched && WATCHED.has(t.shichen)) {
      ctx.rel = bumpRelation(ctx.rel, 'zhang_er', { grudge: GRUDGE_PER_THEFT })
      ctx.grudge = relationOf(ctx.rel, 'zhang_er').grudge
    }
    ctx.work = t.day
    return true
  }

  function fightHuiLang(ctx: SimCtx): void {
    const st = statsForLevel(ctx.p.level)
    let b = createBattle(enemy, { stats: st, hp: ctx.p.hp, qi: ctx.p.qi }, RNG)
    let guard = 0
    while (!b.over && guard++ < 120) b = playerAttack(b, RNG)
    if (b.win) {
      ctx.p = syncAfterBattle(ctx.p, b.player.hp, b.player.qi)
      ctx.p = grantExp(ctx.p, expReward(enemy)).player
      for (const drop of rollLoot(enemy.loot, RNG)) ctx.p = addItem(ctx.p, drop, 1)
    } else {
      ctx.p = respawnPenalty(ctx.p)
    }
    if (ctx.p.hp < 20) {
      const price = applyBuyPrice(12, ctx.rep)
      if (ctx.p.lingshi >= price) {
        ctx.p = buyItem(ctx.p, 'huichun_san', price)
        ctx.p = removeItem(ctx.p, 'huichun_san', 1)
        ctx.p = { ...ctx.p, hp: Math.min(statsForLevel(ctx.p.level).maxHp, ctx.p.hp + 30) }
      }
    }
  }

  function simulate(
    name: string,
    pre: (ctx: SimCtx, t: WorldTimeData) => void,
    want: (ctx: SimCtx, t: WorldTimeData) => 'idle' | 'gather' | 'fight' | 'craft',
    rank: (pt: (typeof GATHER_POINTS)[number], t: WorldTimeData) => number = () => 1,
  ): SimCtx {
    const ctx = fresh()
    for (let day = 1; day <= 30; day++) {
      for (let s = 0; s < 8; s++) {
        const t: WorldTimeData = { day, shichen: s }
        pre(ctx, t)
        const what = want(ctx, t)
        if (what === 'gather') gatherBest(ctx, t, (pt) => rank(pt, t))
        else if (what === 'fight') fightHuiLang(ctx)
        else if (what === 'craft') {
          if (canCraft(ctx.p, RECIPE)) ctx.p = craft(ctx.p, RECIPE).player
        }
      }
      if (!ctx.events.includes(EVENT.id) && eventTriggered(EVENT, { day, lastWorkDay: ctx.work, relations: ctx.rel })) {
        const seq = resolveConsequences(EVENT)
        ctx.p = { ...ctx.p, lingshi: Math.max(0, ctx.p.lingshi + seq.lingshiDelta) }
        ctx.rep += seq.reputationDelta
        setReputation(ctx.rep)
        ctx.events.push(EVENT.id)
      }
    }
    return ctx
  }

  const noPre = () => {}
  const results: Array<SimCtx & { name: string }> = []

  // 啃老：赖在屋里睡大觉——不采不战不炼丹，旷工日日累积（记恨为 0，事件差一条腿）
  results.push({
    name: '啃老',
    ...simulate('啃老', noPre, () => 'idle'),
  })

  // 挖药：药园勤农，全采集点可采即采，全部现卖，只避开张二盯梢时辰（不结记恨，上工记录不断）
  const avoidWatch = (pt: (typeof GATHER_POINTS)[number], t: WorldTimeData): number =>
    pt.watched && WATCHED.has(t.shichen) ? -1 : 1
  results.push({
    name: '挖药',
    ...simulate('挖药', (ctx) => sellAll(ctx, YAO_FARM), () => 'gather', avoidWatch),
  })

  // 抢人：彩霞山灰狼营战士，每时辰一杀；掉落丹药卖出，残血购回春散续命
  results.push({
    name: '抢人',
    ...simulate(
      '抢人',
      (ctx) => sellAll(ctx, ['yaodan']),
      () => 'fight',
    ),
  })

  // 炼丹：采药不售，攒三株炼回春散再出坊市（工艺 0 时辰——相对直接卖原料反而亏 3 灵石/炉）
  results.push({
    name: '炼丹',
    ...simulate(
      '炼丹',
      (ctx) => {
        if (canCraft(ctx.p, RECIPE)) ctx.p = craft(ctx.p, RECIPE).player
        sellAll(ctx, ['huichun_san', 'bai_nian_ling_zhi', 'qiannian_lingru'])
      },
      () => 'gather',
      avoidWatch,
    ),
  })

  // 内卷：药园卷王——头 10 天昼夜连轴：非盯梢时辰不碰被盯的灵草（留到卯~巳张二在场时偷摘，记恨+1/次；
  // 重生周期与时辰相锁，偷摘一次后每逢盯梢时段必可见），攒够家底后第 11 天起躺平（不再上工、不再回流药园）
  // → 旷工满 7 日 + 记恨 >2 → 第 17~18 日被张二告发「杂役院失窃」
  results.push({
    name: '内卷',
    ...simulate(
      '内卷',
      (ctx) => sellAll(ctx, YAO_FARM),
      (ctx, t) => (t.day <= 10 ? 'gather' : 'idle'),
      (pt, t) => (pt.watched ? (WATCHED.has(t.shichen) ? 2 : -1) : 1),
    ),
  })

  console.log('\n—— V1.6 涌现行为矩阵：5 策略 × 30 日结局分流 ——')
  for (const o of results) {
    console.log(
      `${o.name.padEnd(4)} 等级=${o.p.level} 修为=${o.p.exp} 灵石=${o.p.lingshi} 风评=${o.rep} 记恨=${o.grudge} 采集=${o.herbs} 事件=[${o.events.join(',')}] 持有=[${Object.entries(o.p.inventory)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${k}x${n}`)
        .join(' ')}]`,
    )
  }

  const fingers = results.map((o) =>
    [
      o.p.level,
      o.p.exp,
      o.p.lingshi,
      o.rep,
      o.grudge,
      o.events.join(','),
      o.herbs,
      o.p.inventory.huichun_san ?? 0,
      o.p.inventory.qi_xie_ling_cao ?? 0,
    ].join('|'),
  )
  const distinct = new Set(fingers)
  const juan = results.find((o) => o.name === '内卷')!
  const grand = results.find((o) => o.name === '抢人')!
  const nong = results.find((o) => o.name === '挖药')!
  const alch = results.find((o) => o.name === '炼丹')!
  check('·V1.6 五种策略结局两两不同', distinct.size === 5, `fingerprints=${distinct.size}`)
  check('·V1.6 抢人等级全场第一（战斗毕业）', grand.p.level >= 8 && results.every((o) => o.p.level <= grand.p.level), `L${grand.p.level}`)
  check('·V1.6 啃老躺平：修为仍为 0、无事件', (() => { const k = results.find((o) => o.name === '啃老')!; return k.p.level === 1 && k.p.exp === 0 && k.events.length === 0 && k.p.lingshi === 20 })(), `灵石=${results.find((o) => o.name === '啃老')!.p.lingshi}`)
  check('·V1.6 炼丹 < 卖原料：药农灵石占优', alch.p.lingshi < nong.p.lingshi && alch.p.inventory.huichun_san === undefined, `炼丹 ${alch.p.lingshi} < 挖药 ${nong.p.lingshi}`)
  check('·V1.6 内卷被告发：唯一触发失窃', juan.events.length === 1 && juan.events[0] === 'zayiyuan_shiqie' && juan.rep === -20 && juan.grudge >= 3, `事件=${juan.events.join(',')} 风评=${juan.rep} 记恨=${juan.grudge}`)
  setReputation(0)
}

// V2.1 恩仇系统（REDESIGN §6.1）：类型推导优先级 / 送礼衰减 / 事件三族条件 / 后果清算
{
  const none = relationTypeFor({ affinity: 0, grudge: 0 })
  check('·V2.1 恩仇类型推导：中性', none === undefined, `type=${none}`)
  check('·V2.1 恩仇类型推导：情债(debt)≥30好感', relationTypeFor({ affinity: DEBT_AFFINITY, grudge: 0 }) === 'debt', '')
  check('·V2.1 恩仇类型推导：师恩(mentor)≥60好感', relationTypeFor({ affinity: 88, grudge: 3 }) === 'mentor', '')
  check('·V2.1 恩仇类型推导：结怨(rival)盖过师恩', relationTypeFor({ affinity: 88, grudge: RIVAL_GRUDGE }) === 'rival', '')
  check('·V2.1 恩仇类型推导：成仇(enemy)盖过一切', relationTypeFor({ affinity: 88, grudge: ENMITY_GRUDGE }) === 'enemy', '')

  let rels = createNpcRelationsState()
  rels = bumpRelation(rels, 'zhang_er', { affinity: DEBT_AFFINITY })
  check('·V2.1 bumpRelation 越阈自动结情债', relationOf(rels, 'zhang_er').type === 'debt', `type=${relationOf(rels, 'zhang_er').type}`)
  rels = bumpRelation(rels, 'zhang_er', { affinity: DEBT_AFFINITY })
  check('·V2.1 bumpRelation 双送成师恩', relationOf(rels, 'zhang_er').affinity === MENTOR_AFFINITY && relationOf(rels, 'zhang_er').type === 'mentor', `affinity=${relationOf(rels, 'zhang_er').affinity}`)

  const first = giftAffinityGain(undefined, 3)
  const repeat = giftAffinityGain({ affinity: 8, grudge: 0, lastGiftDay: 3 }, 3)
  const spaced = giftAffinityGain({ affinity: 9, grudge: 0, lastGiftDay: 10 }, 17)
  check('·V2.1 送礼首礼全量+8', first.affinity === 8 && first.fresh, `affinity=${first.affinity}`)
  check('·V2.1 送礼七日内重复只+1', repeat.affinity === 1 && !repeat.fresh, `affinity=${repeat.affinity}`)
  check('·V2.1 送礼间隔满七日恢复+8', spaced.affinity === 8 && spaced.fresh, `affinity=${spaced.affinity}`)

  let theft = createNpcRelationsState()
  theft = bumpRelation(theft, 'zhang_er', { grudge: GRUDGE_PER_THEFT, affinity: AFFINITY_PER_THEFT })
  check('·V2.1 偷摘目击写回：记恨+1 好感-2', theft.zhang_er.grudge === 1 && theft.zhang_er.affinity === -2, `grudge=${theft.zhang_er.grudge} affinity=${theft.zhang_er.affinity}`)

  const baoen: WorldEvent = {
    id: 'en_zhang_er_baoen', name: '报恩', nominee: 'zhang_er', once: true,
    trigger: { affinityOf: 'zhang_er', affinityAt: 40 },
    consequences: { grantLingshi: 12, relations: { npcId: 'zhang_er', affinityDelta: -30 } },
    toast: '',
  }
  const baoenStrict = { ...baoen, trigger: { affinityOf: 'zhang_er', affinityAt: 45 } }
  const ctxBao = { day: 30, lastWorkDay: 29, relations: bumpRelation(createNpcRelationsState(), 'zhang_er', { affinity: 42 }) }
  const ctxBaoLow = { ...ctxBao, relations: bumpRelation(createNpcRelationsState(), 'zhang_er', { affinity: 39 }) }
  check('·V2.1 报恩按好感触发（手提≥阈）', eventTriggered(baoen, ctxBao) && !eventTriggered(baoenStrict, ctxBao) && !eventTriggered(baoen, ctxBaoLow), '')

  const xunchou: WorldEvent = {
    id: 'en_zhang_er_xunchou', name: '寻仇', nominee: 'zhang_er', once: true,
    trigger: { grudgeOf: 'zhang_er', grudgeAt: 6 },
    consequences: { lingshi: 15, reputation: -5, relations: { npcId: 'zhang_er', grudgeDelta: -6 } },
    toast: '',
  }
  const ctxChou = { day: 30, lastWorkDay: 29, relations: bumpRelation(createNpcRelationsState(), 'zhang_er', { grudge: 7 }) }
  check('·V2.1 寻仇按记恨触发（>阈）', eventTriggered(xunchou, ctxChou), '')

  const baoRes = resolveConsequences(baoen)
  check('·V2.1 报恩后果：赠灵石12 还人情-30', baoRes.grantLingshiDelta === 12 && baoRes.relationsDelta?.affinityDelta === -30 && baoRes.lingshiDelta === 0, `grant=${baoRes.grantLingshiDelta}`)
  const chouRes = resolveConsequences(xunchou)
  check('·V2.1 寻仇后果：扣15 风评-5 清记恨6', chouRes.lingshiDelta === -15 && chouRes.reputationDelta === -5 && chouRes.relationsDelta?.grudgeDelta === -6, `Δ灵石=${chouRes.lingshiDelta} Δ风评=${chouRes.reputationDelta}`)

  const ctxShiqie = { day: 30, lastWorkDay: 22, relations: bumpRelation(createNpcRelationsState(), 'zhang_er', { grudge: 3 }) }
  check('·V2.1 失窃族兼容（旷工8+记恨3）', eventTriggered(zayiyuanShiqieJson as unknown as WorldEvent, ctxShiqie), '')
}

console.log(`\nSANDBOX-SIM: ${passed} 项通过, ${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)