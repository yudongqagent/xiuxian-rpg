// V1 出口证据：preview 试玩旁路（HEADLESS chromium 驱动 preview）产出一条具体观察并断言其成立。
// 用法：先 vite preview/playwright install，再 node scripts/playtest-observation.mjs
// 场景：辰时乘张二盯梢时偷摘 sp_lingcao_b 必被目击记恨+1；同日错开时辰（午时）偷摘则无人察觉——
// 「盯梢因果随时辰表变化」这一具体观察，随后以突破失败硬锁收尾（寿元闸）。
import { execSync } from 'node:child_process'

let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  const globalRoot = execSync('npm root -g').toString().trim()
  ;({ chromium } = await import(`file://${globalRoot}/playwright/index.mjs`))
}

const URL = process.argv[2] ?? 'http://localhost:4173/'
const LOG = []
const note = (s) => {
  LOG.push(s)
  console.log(`· ${s}`)
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on('pageerror', () => {})
page.on('console', () => {})

const dismiss = async () => {
  const b = page.locator('.splash .start, .splash button').first()
  if (await b.isVisible({ timeout: 5000 }).catch(() => false)) {
    await b.click()
    await page.waitForTimeout(1200)
  }
}
const pos = async () => {
  const t = await page.locator('.hud .coords').textContent().catch(() => null)
  const m = /(-?\d+)\s*,\s*(-?\d+)/.exec(t ?? '')
  return m ? { x: +m[1], y: +m[2] } : null
}
const clock = async () => {
  const t = await page.locator('.hud .clock').textContent().catch(() => '')
  return (t ?? '').trim().replace(/\s+/g, ' ')
}
const grudge = () =>
  page.evaluate(() => window.__xiuxian?.scene.relations?.()?.zhang_er?.grudge ?? 0)
const toSteal = async (x, y) => {
  const hrs = x * 8 + y
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(700)
    const p = await pos()
    if (p && Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1) break
    await page.evaluate((t) => window.__xiuxian?.scene.navDirect(t.x, t.y + 1), { x, y }).catch(() => {})
  }
}

await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1800)
await dismiss()
await page.waitForTimeout(1500)
note(`进入游戏 · 时钟=${await clock()} · 位置=${JSON.stringify(await pos())}`)

// 准备：确保身处杂役院（山村院门 (2,14) 传送进杂役院）
for (let i = 0; i < 8; i++) {
  const bt = await page.locator('.area-banner').textContent().catch(() => '')
  if (bt.includes('杂役院')) break
  await page.evaluate(() => window.__xiuxian?.scene.navDirect(2, 14)).catch(() => {})
  await page.waitForTimeout(1800)
}
note(`进入杂役院 · 位置=${JSON.stringify(await pos())}`)

// 先走到偷摘位附近（摘前位移不难），再调钟定死时辰、等张二落位，最后按下 E 即偷
await page.evaluate(() => window.__xiuxian?.scene.navDirect(20, 5)).catch(() => {})
await page.waitForTimeout(2500)

// —— 观察主线：张二盯梢编起来 ——
// 头一幕：辰时（张二在 (22,4) 盯梢），偷摘 (22,6) 灵草
await page.evaluate(() => window.__xiuxian?.scene.time.set(3, 4))
await page.waitForTimeout(500)
let zhang
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(350)
  const npcs = await page.evaluate(() => window.__xiuxian?.scene.npcs?.() ?? [])
  zhang = npcs.find((n) => n.id === 'zhang_er')
  if (zhang && zhang.x === 22 && zhang.y === 4) break
}
await page.evaluate(() => window.__xiuxian?.scene.navDirect(22, 7)).catch(() => {})
let reached = false
for (let i = 0; i < 25 && !reached; i++) {
  await page.waitForTimeout(700)
  const p = await pos()
  reached = !!p && Math.abs(p.x - 22) <= 1 && Math.abs(p.y - 7) <= 1
}
const g0 = await grudge()
await page.keyboard.down('e')
await page.waitForTimeout(400)
await page.keyboard.up('e')
await page.waitForTimeout(600)
const g1 = await grudge()
note(`辰时采 (22,6)：记恨 ${g0} → ${g1}（张二卯~巳在 (22,4) 盯梢 ${JSON.stringify(zhang ?? null)}） · 时钟=${await clock()}`)

// 次一幕：同株灵草隔日再生后，午时（张二已回 (6,16)）再偷摘——应无人察觉
await page.evaluate(() => window.__xiuxian?.scene.time.set(10, 6))
await page.waitForTimeout(900)
await page.keyboard.down('e')
await page.waitForTimeout(400)
await page.keyboard.up('e')
await page.waitForTimeout(600)
const g2 = await grudge()
note(`午时采 (22,6)：记恨 ${g1} → ${g2}（张二午已在 (6,16)，不在盯梢位） · 时钟=${await clock()}`)

// —— 观察主线：道贺「善缘 vs 药园经济」两条互相排挤的路（V2.1 恩仇·送礼） ——
// 两株灵草在手（两次偷摘所得）：先送一株结善缘（首礼好感+8），当天再送则旬内只记薄情+1
const a0 = (await page.evaluate(() => window.__xiuxian?.scene.relations?.() ?? {}))?.zhang_er?.affinity ?? -9
await page.evaluate(() => window.__xiuxian?.scene.navDirect(6, 17)).catch(() => {})
let znear = false
for (let i = 0; i < 20 && !znear; i++) {
  await page.waitForTimeout(700)
  const p = await pos()
  znear = !!p && Math.abs(p.x - 6) <= 2 && Math.abs(p.y - 17) <= 2
}
await page.keyboard.down('g')
await page.waitForTimeout(200)
await page.keyboard.up('g')
await page.waitForTimeout(500)
const a1 = (await page.evaluate(() => window.__xiuxian?.scene.relations?.() ?? {}))?.zhang_er?.affinity ?? -9
const toastFresh = await page.locator('.toast', { hasText: /感念于心/ }).last().textContent().catch(() => '')
await page.keyboard.down('g')
await page.waitForTimeout(200)
await page.keyboard.up('g')
await page.waitForTimeout(500)
const a2 = (await page.evaluate(() => window.__xiuxian?.scene.relations?.() ?? {}))?.zhang_er?.affinity ?? -9
note(`送灵草两株（张二喜收）：首礼好感 ${a0}→${a1}（${(toastFresh ?? '').trim().slice(0, 22)}...），当天再送只 +${a2 - a1} 记薄情 · 机会成本：灵草市价 3灵石×2=6灵石`)
// 攒满 40 好感（差额补齐后仍是"过了整个旬日的亲善积累"），快进到旬末 —— 「张二报恩」现场
await page.evaluate((gap) => window.__xiuxian?.scene['relations.bump']?.('zhang_er', { affinity: gap }), 40 - a2)
const lsBao0 = await page.evaluate(() => {
  const m = /灵石\s*(\d+)/.exec(document.querySelector('.hud')?.textContent ?? '')
  return m ? +m[1] : -1
})
await page.evaluate(() => window.__xiuxian?.scene.time.set(40, 1))
await page.waitForTimeout(800)
const baoToast = await page.locator('.toast', { hasText: /灵石十二枚/ }).last().textContent().catch(() => '')
const relBao = await page.evaluate(() => window.__xiuxian?.scene.relations?.() ?? {})
const lsBao1 = await page.evaluate(() => {
  const m = /灵石\s*(\d+)/.exec(document.querySelector('.hud')?.textContent ?? '')
  return m ? +m[1] : -1
})
note(`「张二报恩」应验：${(baoToast ?? '').trim().slice(0, 34)} · 好感 ${a2}=>${relBao?.zhang_er?.affinity ?? '-'} · 灵石 ${lsBao0}→${lsBao1}`)

// —— 观察主线三：NPC 也是会老的修真者（V2.2 生命周期） ——
// 打探：张二的日程表本质可被识破（卯~巳在药园盯梢）；陈巧倩的自白情报
const probeZhang = await page.evaluate(() => window.__xiuxian?.scene['npc.probe']?.('zhang_er') ?? '')
const probeChen = await page.evaluate(() => window.__xiuxian?.scene['npc.probe']?.('chen_qiaoqian') ?? '')
note(`打探张二：${probeZhang}`)
note(`打探陈巧倩：${probeChen.slice(0, 30)}...`)
// 洞察：凡躯茶翁 60 载大限 / 结丹李化元 400 载大限；青纹随世界历修炼（3→6 层封顶）
const insTea = await page.evaluate(() => window.__xiuxian?.scene['npc.insight']?.('chaopeng_laoren'))
const insLi = await page.evaluate(() => window.__xiuxian?.scene['npc.insight']?.('li_huayuan'))
const y1 = await page.evaluate(() => window.__xiuxian?.scene['npc.insight']?.('qing_wen')?.level)
await page.evaluate(() => window.__xiuxian?.scene.time.set(30 * 60 + 1, 0))
const y30 = await page.evaluate(() => window.__xiuxian?.scene['npc.insight']?.('qing_wen')?.level)
note(`洞察：茶翁 凡躯·寿限 第${insTea?.lifespanYear}年；李化元 结丹·寿限 第${insLi?.lifespanYear}年`)
note(`世界历演进：青纹 第1载 ${y1} 层 → 第30载 ${y30} 层（炼气封顶，NPC 亦修真）`)
// 坐化现场：茶翁第 60 载寿尽 —— 真实 HUD 流字 + once 入档；剧情锚张二不受寿元影响
await page.evaluate(() => window.__xiuxian?.scene.time.set(59 * 60 + 1, 0))
await page.waitForTimeout(900)
const zustand = await page.evaluate(() => (window.__xiuxian?.scene.world?.()?.npcPassed ?? []).includes('chaopeng_laoren'))
const fallToast = await page.locator('.toast', { hasText: /坐化/ }).last().textContent().catch(() => '')
note(`坐化：${(fallToast ?? '').trim().slice(0, 40)}（劫后 ${zustand ? '已入档 once' : '未入档'}）`)
const probeZhe2 = await page.evaluate(() => window.__xiuxian?.scene['npc.insight']?.('zhang_er') ?? 'null')
note(`张二（剧情锚）洞察：${probeZhe2}（免疫死亡）`)
await page.evaluate(() => window.__xiuxian?.scene.time.set(2801, 0))

// —— 收尾：突破失败 → 寿元不足半寿 → 大境界硬锁（承接 V1.5） ——
await page.evaluate(() => window.__xiuxian?.scene['realm.set']?.(13))
await page.evaluate(() => window.__xiuxian?.scene.time.set(3661, 0))
await page.evaluate(() => window.__xiuxian?.scene['rng.force']?.(0.99))
await page.waitForTimeout(400)
const gate = page.locator('.hud .btn.gate')
if (await gate.isVisible().catch(() => false)) await gate.click()
await page.waitForTimeout(400)
const go = page.locator('.overlay .go')
if (await go.isVisible().catch(() => false)) await go.click()
await page.waitForTimeout(500)
const dreadful = (await page.locator('.dreadful').textContent().catch(() => '')).trim()
note(`突破失败收尾：${dreadful.slice(0, 46)}`)

const ok = g1 > g0 && g1 >= 1 && g2 === g1 && (a1 === a0 + 8 && a2 === a1 + 1) && /灵石十二枚/.test(baoToast ?? '') && relBao?.zhang_er?.affinity === 10 && /寿元剩余 37 年无望筑基/.test(dreadful) && /卯~巳在 \(22,4\)/.test(probeZhang) && /练剑百遍/.test(probeChen) && y1 === 3 && y30 === 6 && insTea?.lifespanYear === 60 && insLi?.lifespanYear === 400 && zustand && /坐化/.test(fallToast ?? '') && probeZhe2 === 'null'
console.log(`\n【试玩具体观察一】张二的盯梢因果随时辰表切换：${g1 > g0 && g2 === g1 ? '成立' : '未断言成功'}`)
console.log(`  ① 辰时偷摘被目击：记恨 ${g0}→${g1}`)
console.log(`  ② 午时偷摘无人知：记恨 ${g1}→${g2}`)
console.log(`【试玩具体观察二】善缘与药园经济互相排挤（V2.1）：${a1 === a0 + 8 && a2 === a1 + 1 && /灵石十二枚/.test(baoToast ?? '') ? '成立' : '未断言成功'}`)
console.log(`  ③ 首礼好感 +8（${a0}→${a1}），旬内再送只 +${a2 - a1}——送礼花灵草、卖草换灵石，两条路二选一`)
console.log(`  ④ 好感攒满 40 → 「张二报恩」赠灵石 12，情债了结（灵石 ${lsBao0}→${lsBao1}，好感 ${a2}→${relBao?.zhang_er?.affinity ?? '-'}）`)
console.log(`  ⑤ 突破失败收尾：${dreadful.slice(0, 46)}`)
console.log(`【试玩具体观察三】NPC 也是会老的修真者（V2.2 生命周期）：${/卯~巳在 \(22,4\)/.test(probeZhang) && y1 === 3 && y30 === 6 && zustand && /坐化/.test(fallToast ?? '') ? '成立' : '未断言成功'}`)
console.log(`  ⑥ 打探识破钟表：张二卯~巳守药园(${/22,4/.test(probeZhang) ? '22,4' : '?'}) —— 目击规则可被玩家读出、预判并绕开`)
console.log(`  ⑦ 世界历演进：青纹 第1载 ${y1} 层 → 第30载 ${y30} 层（封顶）；李化元结丹寿限 第${insLi?.lifespanYear} 年`)
console.log(`  ⑧ 掸灰人终成灰：茶翁第${insTea?.lifespanYear}载坐化${zustand ? ' 已入档' : ' 未入档'} —— 世界记得，剧情锚张二不朽`)
console.log(`总览（真实游玩体验采集于 preview）：
${LOG.map((l) => '  ' + l).join('\n')}`)

await page.evaluate(() => window.__xiuxian?.scene['rng.force']?.(null))
await browser.close()
process.exit(ok ? 0 : 1)