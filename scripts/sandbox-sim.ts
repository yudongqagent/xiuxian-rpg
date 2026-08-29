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

console.log(`\nSANDBOX-SIM: ${passed} 项通过, ${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)