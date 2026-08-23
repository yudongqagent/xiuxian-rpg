// 本地 E2E 全流程冒烟（门禁 G4）
// 用法：node scripts/qa-local.mjs [baseUrl]（默认 http://localhost:4173/，需先 vite preview/build）
// 覆盖：启动 HUD / 世界渲染 / WASD 移动 / 区域横幅 / 对话+任务接取 / 任务追踪 / 地图传送 / 存档恢复
// 依赖：全局 playwright（与 qa-automation/scripts/qa-live.mjs 相同解析方式）
import { execSync } from 'node:child_process'

let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  const globalRoot = execSync('npm root -g').toString().trim()
  ;({ chromium } = await import(`file://${globalRoot}/playwright/index.mjs`))
}

const URL = process.argv[2] ?? 'http://localhost:4173/'
const results = []
const add = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon/.test(m.text())) pageErrors.push(m.text())
})

const pos = async () => {
  const t = await page.locator('.hud .coords').textContent().catch(() => null)
  const m = /(-?\d+)\s*,\s*(-?\d+)/.exec(t ?? '')
  return m ? { x: +m[1], y: +m[2] } : null
}
const held = new Set()
async function dismissSplash() {
  const startBtn = page.locator('.splash .start, .splash button').first()
  if (await startBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await startBtn.click()
    await page.waitForTimeout(1200)
  }
}
async function navTo(tx, ty, tol = 0.9) {
  for (let i = 0; i < 200; i++) {
    const p = await pos()
    if (!p) break
    const dx = tx - p.x, dy = ty - p.y
    if (Math.abs(dx) < tol && Math.abs(dy) < tol) break
    const want = { d: dx > 0.35, a: dx < -0.35, s: dy > 0.35, w: dy < -0.35 }
    for (const [k, down] of Object.entries(want)) {
      if (down && !held.has(k)) { await page.keyboard.down(k); held.add(k) }
      if (!down && held.has(k)) { await page.keyboard.up(k); held.delete(k) }
    }
    await page.waitForTimeout(110)
  }
  for (const k of [...held]) { await page.keyboard.up(k); held.delete(k) }
  await page.waitForTimeout(300)
}

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })

  // 标题画面：若存在则点击「开始游戏」进入（懒加载 Phaser 由此触发）
  {
    const t0 = Date.now()
    await dismissSplash()
    if (Date.now() - t0 > 500) add('标题画面 → 开始', true)
  }

  // 0. 区域横幅（进入默认地图七玄门山村时短暂展示，轮询捕捉；同时等待场景就绪）
  const bannerSeen = await page
    .locator('.area-banner')
    .waitFor({ state: 'visible', timeout: 15000 })
    .then(() => true)
    .catch(() => false)
  add('区域横幅显示', bannerSeen)
  await page.waitForTimeout(6000)

  // 1. 启动 & HUD
  const hudVisible = await page.locator('.hud').isVisible().catch(() => false)
  add('启动加载 HUD', hudVisible)

  // 2. 无运行时异常
  add('无运行时异常', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 160))

  // 3. 世界渲染像素检查
  const shot = await page.screenshot({ clip: { x: 200, y: 60, width: 1000, height: 620 } })
  const litRatio = await page.evaluate(async (src) => {
    const img = new Image()
    img.src = src
    await new Promise((r, j) => ((img.onload = r), (img.onerror = j)))
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let n = 0, lit = 0
    for (let i = 0; i < d.length; i += 16) {
      if ((d[i] + d[i + 1] + d[i + 2]) / 3 > 14) lit++
      n++
    }
    return lit / n
  }, `data:image/png;base64,${shot.toString('base64')}`)
  add('世界场景渲染', litRatio > 0.05, `${(litRatio * 100).toFixed(1)}% 非黑像素`)

  // 4. WASD 移动（预热后测量，规避首帧解码/着色器卡顿）
  await page.keyboard.down('d'); await page.waitForTimeout(250); await page.keyboard.up('d')
  await page.waitForTimeout(400)
  const before = await pos()
  const fps = await page.evaluate(() => new Promise((res) => {
    let n = 0
    const t0 = performance.now()
    const tick = () => {
      n++
      if (performance.now() - t0 < 1000) requestAnimationFrame(tick)
      else res(n)
    }
    requestAnimationFrame(tick)
  }))
  await page.keyboard.down('d')
  await page.waitForTimeout(1400)
  await page.keyboard.up('d')
  const after = await pos()
  add('键盘移动 (WASD)', !!before && !!after && Math.hypot(before.x - after.x, before.y - after.y) >= 3,
    `${before?.x},${before?.y} → ${after?.x},${after?.y} · ${fps}fps`)

  // 6. 对话 + 任务接取（墨大夫在 (7,7)，qm_01 发布人）——低帧率下重试多次
  let dialogueOpen = false
  for (let attempt = 0; attempt < 4 && !dialogueOpen; attempt++) {
    await navTo(7.5, 8.4)
    await page.keyboard.down('e'); await page.waitForTimeout(180); await page.keyboard.up('e')
    await page.waitForTimeout(700)
    dialogueOpen = await page.locator('.dialogue').isVisible().catch(() => false)
    if (!dialogueOpen) {
      // 微调站位再试
      await page.keyboard.down('w'); await page.waitForTimeout(200); await page.keyboard.up('w')
      await page.waitForTimeout(200)
    }
  }
  add('对话面板打开', dialogueOpen)
  if (dialogueOpen) {
    const questBtn = page.locator('.dialogue button.quest', { hasText: '接取任务' }).first()
    const hasQuest = await questBtn.isVisible().catch(() => false)
    if (hasQuest) {
      await questBtn.click()
      await page.waitForTimeout(500)
      const toast = await page.locator('.quest-toast, .toast').first().isVisible().catch(() => false)
      const tracker = await page.locator('.tracker').isVisible().catch(() => false)
      add('任务接取（对话选项）', true, 'qm_01')
      add('HUD 任务追踪条', tracker || toast)
    } else {
      add('任务接取（对话选项）', false, '墨大夫对话中无接取按钮（可能已接取）')
    }
    // 关闭对话
    for (let i = 0; i < 10; i++) {
      if (!(await page.locator('.dialogue').isVisible().catch(() => false))) break
      const cont = page.locator('.dialogue .continue')
      if (await cont.isVisible().catch(() => false)) await cont.click()
      else {
        const anyBtn = page.locator('.dialogue button').first()
        await anyBtn.click()
      }
      await page.waitForTimeout(250)
    }
  }

  // 7. 任务日志 UI
  await page.locator('.hud .btn', { hasText: '任务' }).click()
  await page.waitForTimeout(400)
  const questLogOpen = await page.locator('.panel, .quest-log').first().isVisible().catch(() => false)
  add('任务日志面板', questLogOpen)
  if (questLogOpen) {
    const closeBtn = page.locator('.panel .close, .quest-log .close').first()
    if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click()
    await page.waitForTimeout(300)
  }

  // 8. 地图传送（村南 portal (18,27) → 山道）：踏入即触发，检测坐标跃迁与新区域横幅
  const posBeforePortal = await pos()
  let teleported = false
  held.clear()
  for (let i = 0; i < 160 && !teleported; i++) {
    const p = await pos()
    if (!p) break
    if (Math.abs(p.x - 18.5) < 2 && p.y < 12) { teleported = true; break } // 已落点山道北部
    const dx = 18.5 - p.x, dy = 27.45 - p.y
    if (Math.abs(dx) < 0.35 && Math.abs(dy) < 0.35) break
    const want = { d: dx > 0.35, a: dx < -0.35, s: dy > 0.35, w: dy < -0.35 }
    for (const [k, down] of Object.entries(want)) {
      if (down && !held.has(k)) { await page.keyboard.down(k); held.add(k) }
      if (!down && held.has(k)) { await page.keyboard.up(k); held.delete(k) }
    }
    await page.waitForTimeout(110)
  }
  for (const k of [...held]) { await page.keyboard.up(k); held.delete(k) }
  const bannerAfter = teleported
    ? true
    : await page.locator('.area-banner').waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false)
  await page.waitForTimeout(1500)
  const coordsAfter = await pos()
  add('地图传送切换', teleported && !!coordsAfter,
    `${posBeforePortal?.x},${posBeforePortal?.y} → ${coordsAfter?.x},${coordsAfter?.y}`)

  // 9. 存档恢复（等自动存档后刷新，位置应保持）
  await page.waitForTimeout(6000)
  const savedPos = await pos()
  await page.reload({ waitUntil: 'networkidle' })
  await dismissSplash() // 懒启动：重载后需再次点击开始，游戏才会引导擎
  await page.waitForTimeout(9000)
  const restoredPos = await pos()
  add('自动存档 & 重载恢复',
    !!savedPos && !!restoredPos && Math.hypot(savedPos.x - restoredPos.x, savedPos.y - restoredPos.y) <= 4,
    `${savedPos?.x},${savedPos?.y} → ${restoredPos?.x},${restoredPos?.y}`)

  add('全程无异常', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 160))
} finally {
  await browser.close()
}

const passed = results.filter((r) => r.pass).length
console.log(`\nQA-LOCAL: ${passed}/${results.length} 通过`)
process.exit(passed === results.length ? 0 : 2)
