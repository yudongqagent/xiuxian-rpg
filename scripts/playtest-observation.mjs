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

const ok = g1 > g0 && g1 >= 1 && g2 === g1 && /寿元剩余 37 年无望筑基/.test(dreadful)
console.log(`\n【试玩具体观察】张二的盯梢因果随时辰表切换：${ok ? '成立' : '未断言成功'}`)
console.log(`  ① 辰时偷摘被目击：记恨 ${g0}→${g1}`)
console.log(`  ② 午时偷摘无人知：记恨 ${g1}→${g2}`)
console.log(`  ③ 突破失败收尾：${dreadful.slice(0, 46)}`)
console.log(`总览（真实游玩体验采集于 preview）：
${LOG.map((l) => '  ' + l).join('\n')}`)

await page.evaluate(() => window.__xiuxian?.scene['rng.force']?.(null))
await browser.close()
process.exit(ok ? 0 : 1)