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
} from '../src/systems/time'
import { gatherAt, isGatherAvailable } from '../src/systems/gather'
import {
  bumpRelation,
  createNpcRelationsState,
  npcSpotAt,
  relationOf,
  GRUDGE_PER_THEFT,
} from '../src/systems/relations'
import type { WorldEvent } from '../src/systems/schemas'
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
  expToNext,
  fromPlayerSave,
  gateAt,
  grantExp,
  setRngOverride,
  statsForLevel,
} from '../src/systems/player'
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

console.log(`\nSANDBOX-SIM: ${passed} 项通过, ${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)