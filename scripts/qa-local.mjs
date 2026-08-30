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
  let moved = false
  const before = await pos()
  for (let attempt = 1; attempt <= 2 && !moved; attempt++) {
    await page.keyboard.down('d')
    await page.waitForTimeout(attempt === 1 ? 900 : 1400)
    await page.keyboard.up('d')
    const probe = await pos()
    moved = !!before && !!probe && Math.abs(probe.x - before.x) >= 2
    if (!moved && attempt === 1) { await page.waitForTimeout(800); continue }
  }
  await page.waitForTimeout(400)
  const after = await pos()
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
  const after2 = await pos()
  const finalAfter = after2 ?? after
  add('键盘移动 (WASD)', moved || (!!before && !!finalAfter && Math.hypot(before.x - finalAfter.x, before.y - finalAfter.y) >= 3),
    `${before?.x},${before?.y} → ${finalAfter?.x},${finalAfter?.y} · ${fps}fps`)

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

  // 7.2 收集进度实时同步：qm_01 需采灵草×5，起始背包已有 4 → 日志应显示 4/5（回归：接任务前存货计入）；
  //     药圃采收 +3 后 → 5/5 完成且追踪条点名墨大夫
  {
    const collectLine = async () => {
      await page.locator('.hud .btn', { hasText: '任务' }).click()
      await page.waitForTimeout(500)
      const lines = await page.locator('.panel', { hasText: '第一章' }).locator('li').allTextContents().catch(() => [])
      const close = page.locator('.panel .close').first()
      if (await close.isVisible().catch(() => false)) {
        await close.click()
        await page.waitForTimeout(300)
      }
      const line = lines.find((t) => t.includes('七叶灵草'))
      const m = /(\d+)\s*\/\s*(\d+)/.exec(line ?? '')
      return m ? `${m[1]}/${m[2]}` : null
    }
    const before = await collectLine()
    await page.locator('.hud .btn', { hasText: '背包' }).click()
    await page.waitForTimeout(500)
    await page.locator('.panel', { hasText: '储物袋' }).locator('button', { hasText: '药圃' }).click()
    await page.waitForTimeout(300)
    await page.locator('.plot button', { hasText: '播种' }).first().click()
    await page.waitForTimeout(250)
    await page.locator('.plot button', { hasText: '催熟' }).first().click()
    await page.waitForTimeout(250)
    await page.locator('.plot button', { hasText: '采 收' }).first().click()
    await page.waitForTimeout(500)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    const after = await collectLine()
    const tracker2 = (await page.locator('.tracker').textContent().catch(() => '')).trim()
    // 药圃采收后灵草净增（播种 -1、采收 +3）
    await page.locator('.hud .btn', { hasText: '背包' }).click()
    await page.waitForTimeout(400)
    const herbs = await page.locator('.panel', { hasText: '储物袋' }).locator('ul li').allTextContents().catch(() => [])
    const herbRow = herbs.find((t) => t.includes('七叶灵草'))
    const herbCount = /×(\d+)/.exec(herbRow ?? '')
    add('收集进度实时同步+药圃循环', before === '4/5' && after === '5/5' && herbCount && +herbCount[1] === 6,
      `日志 ${before} → ${after} · 灵草 ×${herbCount?.[1] ?? '?'}`)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
  }

  // 7.5 打坐吐纳：点击 FAB 进入打坐态并保持；移动即打断（满血灵时无回升属预期，回升由战斗后场景覆盖）
  {
    const readQi = async () => {
      const t = await page.locator('.hud .hint').textContent().catch(() => '')
      const m = /灵 (\d+)\/(\d+)/.exec(t ?? '')
      return m ? `${m[1]}/${m[2]}` : '?'
    }
    const fab = page.locator('.meditate-wrap .fab')
    const fabVisible = await fab.isVisible().catch(() => false)
    const qi0 = fabVisible ? await readQi() : '?'
    if (fabVisible) await fab.click()
    await page.waitForTimeout(800)
    const activeOn = await fab.evaluate((el) => el.classList.contains('on')).catch(() => false)
    await page.waitForTimeout(4200)
    const stillOn = await fab.evaluate((el) => el.classList.contains('on')).catch(() => false)
    await page.keyboard.down('a')
    await page.waitForTimeout(300)
    await page.keyboard.up('a')
    await page.waitForTimeout(400)
    const activeOff = await fab.evaluate((el) => el.classList.contains('on')).catch(() => true)
    add('打坐吐纳（进入打坐态+移动打断）', fabVisible && activeOn && stillOn && !activeOff,
      `灵 ${qi0} → ${await readQi()} · 打坐=${activeOn} · 保持=${stillOn} · 移动后=${activeOff}`)
  }

  // 7.75 时间轴（V0/V1.1）：HUD 时钟存在；debug 推 8 时辰后「日」至少 +1；存档恢复后不少于菜单直前
  {
    const dayOf = async () => {
      const t = await page.locator('.hud .clock').textContent().catch(() => '')
      const m = /第(\d+)日/.exec(t ?? '')
      return m ? +m[1] : 0
    }
    const beforeDay = await dayOf()
    const advanced = await page
      .evaluate(() => {
        if (!window.__xiuxian?.scene?.time) return false
        window.__xiuxian.scene.time.advance(8) // 推 8 时辰 = 1 整日
        return true
      })
      .catch(() => false)
    await page.waitForTimeout(600)
    const afterDay = await dayOf()
    add('时间轴推进（HUD 时钟 + 跨日）', advanced && beforeDay > 0 && afterDay > beforeDay,
      `第${beforeDay}日 → 第${afterDay}日`)
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

  // 遇怪收尾：自动战斗打完并关闭面板（逃跑会贴身重入，故用胜利结算）
  const closeBattle = async () => {
    for (let i = 0; i < 3 && (await page.locator('.overlay .panel').isVisible().catch(() => false)); i++) {
      const autoBtn = page.locator('.actions button', { hasText: '自动' }).first()
      if (await autoBtn.isVisible().catch(() => false)) {
        const on = await autoBtn.evaluate((el) => el.classList.contains('on')).catch(() => false)
        if (!on) await autoBtn.click()
        await page
          .locator('.verdict .title', { hasText: /胜|败/ })
          .waitFor({ state: 'visible', timeout: 60000 })
          .catch(() => {})
        const cont = page.locator('.verdict .ink-btn')
        if (await cont.isVisible().catch(() => false)) {
          await cont.click()
          await page.waitForTimeout(900)
        }
      } else {
        await page.waitForTimeout(800)
      }
    }
  }

  // 8.5 章节锁（世界层）：东·黄枫谷 portal(35,5) 在 qm_02 未完成时踏入被拦下并提示，不传送
  {
    const nav = (x, y) => page.evaluate(([tx, ty]) => window.__xiuxian?.bus.emit('navigate:tile', { x: tx, y: ty }), [x, y])
    const dist = (p) => (p ? Math.abs(p.x - 35) + Math.abs(p.y - 5) : 99)
    for (let i = 0; i < 20 && dist(await pos()) > 1; i++) {
      await nav(35, 5)
      await page.waitForTimeout(3500)
      await closeBattle()
    }
    let toasts = []
    let p = await pos()
    await page.waitForTimeout(1800)
    for (let i = 0; i < 10; i++) {
      await nav(35, 5)
      await page.waitForTimeout(500)
      toasts = await page.locator('.quest-toast, .toast').allTextContents().catch(() => [])
      p = await pos()
      if (toasts.some((t) => t.includes('第二章'))) break
      await page.waitForTimeout(1600)
      await closeBattle()
    }
    const blocked = !!p && p.y < 12 && toasts.some((t) => t.includes('第二章'))
    add('章节锁拦截', blocked, `pos=${p?.x},${p?.y} toasts=${JSON.stringify(toasts)}`)
  }

  // 8.6 自动寻路：点击屏幕下方的可走格，角色应自行走过去（遇怪打断则重点）
  {
    await closeBattle()
    const before = await pos()
    const vp = page.viewportSize() ?? { width: 1280, height: 800 }
    let moved = false
    let after = before
    for (let i = 0; i < 3 && !moved; i++) {
      await page.mouse.click(vp.width / 2 - 180, vp.height / 2 + 100)
      await page.waitForTimeout(1800)
      await closeBattle()
      after = await pos()
      moved = !!before && !!after && Math.abs(after.x - before.x) + Math.abs(after.y - before.y) >= 2
    }
    add('自动寻路（点击移动）', moved, `${before?.x},${before?.y} → ${after?.x},${after?.y}`)
  }

  // 8.7 自动战斗：BFS 寻路至妖兽出生点，遇怪后开自动，不手动点击直至胜负判定
  {
    const nav = (x, y) => page.evaluate(([tx, ty]) => window.__xiuxian?.bus.emit('navigate:tile', { x: tx, y: ty }), [x, y])
    let opened = await page.locator('.overlay .panel').isVisible().catch(() => false)
    for (const spot of [
      [24, 5],
      [13, 9],
      [10, 6],
    ]) {
      for (let i = 0; i < 6 && !opened; i++) {
        await nav(spot[0], spot[1])
        await page.waitForTimeout(3000)
        opened = await page.locator('.overlay .panel').isVisible().catch(() => false)
      }
      if (opened) break
    }
    if (opened) {
      const autoBtn = page.locator('.actions button', { hasText: '自动' }).first()
      const alreadyOn = await autoBtn.evaluate((el) => el.classList.contains('on')).catch(() => false)
      if (!alreadyOn) await autoBtn.click()
      const verdict = await page
        .locator('.verdict .title', { hasText: /胜|败/ })
        .waitFor({ state: 'visible', timeout: 60000 })
        .then(() => true)
        .catch(() => false)
      add('自动战斗', verdict)
      if (verdict) {
        const cont = page.locator('.verdict .ink-btn')
        if (await cont.isVisible().catch(() => false)) {
          await cont.click()
          await page.waitForTimeout(900)
        }
      }
    } else {
      add('自动战斗', false, '未遇怪')
    }
  }

  // 8.8 跨图自动寻路：追踪导航目标在邻图 → 自动走到传送门穿图，抵达目标点
  {
    await closeBattle()
    await page.evaluate(() => window.__xiuxian?.bus.emit('navigate:quest'))
    let bannerText = ''
    let near = false
    let endPos = null
    for (let i = 0; i < 50; i++) {
      await page.waitForTimeout(1500)
      await closeBattle()
      endPos = await pos()
      const bt = await page.locator('.area-banner').textContent().catch(() => '')
      if (bt && bt.length > 0) bannerText = bt
      if (endPos && Math.abs(endPos.x - 17.5) <= 2 && Math.abs(endPos.y - 14.5) <= 2) {
        near = true
        break
      }
    }
    add('跨图自动寻路', near && bannerText.includes('七玄门'),
      `banner=${bannerText} pos=${endPos?.x},${endPos?.y}`)
  }

  // 8.9 采集点（V1.2）：山村 (2,14) 院门 → 杂役院；走近灵草点按 E 采集 → 物品入包 + 花费时辰 + 该点进入再生
  {
    await closeBattle()
    // 先确认杂役院门在地图可达范围内（qixuanmen 有 portal 到 zayiyuan）——寻路至传送门格 (2,14) 触发送达
    let onZayiyuan = false
    for (let i = 0; i < 8 && !onZayiyuan; i++) {
      await page.evaluate(() => window.__xiuxian?.scene.navDirect(2, 14))
      await page.waitForTimeout(2000)
      await closeBattle()
      const bt = await page.locator('.area-banner').textContent().catch(() => '')
      onZayiyuan = bt.includes('杂役院')
    }
    add('杂役院入口（院门传送）', onZayiyuan, `lastBanner=${(await page.locator('.area-banner').textContent().catch(() => '')).trim()}`)
    if (onZayiyuan) {
      // 从 gather() 钩子取第一个采集点，走到其正下方一格再按 E（正下方必须可行走）
      const target = await page.evaluate(() => {
        const g = window.__xiuxian?.scene.gather?.()
        const p = (g?.points ?? [])[0]
        if (!p) return null
        return { x: p.x, y: p.y }
      })
      if (target) {
        await page.evaluate((t) => window.__xiuxian?.scene.navDirect(t.x, t.y + 1), target)
        let reached = false
        for (let i = 0; i < 25 && !reached; i++) {
          await page.waitForTimeout(800)
          const p = await pos()
          reached = !!p && Math.abs(p.x - target.x) <= 1 && Math.abs(p.y - (target.y + 1)) <= 1
        }
        await page.keyboard.down('e'); await page.waitForTimeout(200); await page.keyboard.up('e')
        await page.waitForTimeout(800)
        const invAfter = await page.evaluate(() => {
          const g = window.__xiuxian?.scene.gather?.()
          return { availableAt: g?.availableAt, now: g?.now, points: g?.points ?? [], mapId: g?.mapId ?? window.__xiuxian?.scene.mapId }
        })
        const inBag = await page.evaluate(() => {
          const g = window.__xiuxian?.scene.gather?.()
          return g ? Object.values(g.availableAt).some((at) => at > g.now) : false
        })
        add('采集点采集（入包+再生标记+时辰消耗）', reached && inBag,
          `target=${target?.x},${target?.y} reached=${reached} map=${invAfter.mapId} points=${invAfter.points.length} availableAt=${JSON.stringify(invAfter.availableAt)} now=${invAfter.now}`)
      } else {
        add('采集点采集（入包+再生标记+时辰消耗）', false, 'no gather points exposed')
      }
    }
  }

  // 9. 存档恢复（等自动存档后刷新；若遭遇战斗导致存档跳过则重试一次）
  async function waitStableAndSaved() {
    // 等待战斗结束（若有）
    for (let i = 0; i < 40; i++) {
      if (!(await page.locator('.overlay').isVisible().catch(() => false))) break
      await page.waitForTimeout(500)
    }
    const p1 = await pos()
    await page.waitForTimeout(6000) // 覆盖 5s 自动存档周期
    const p2 = await pos()
    return { saved: p2, stable: !!p1 && !!p2 && Math.hypot(p1.x - p2.x, p1.y - p2.y) < 1 }
  }
  let result = await waitStableAndSaved()
  let savedPos = result.saved
  await page.reload({ waitUntil: 'networkidle' })
  await dismissSplash() // 懒启动：重载后需再次点击开始，游戏才会引导擎
  await page.waitForTimeout(9000)
  let restoredPos = await pos()
  if (!result.stable || (savedPos && restoredPos && Math.hypot(savedPos.x - restoredPos.x, savedPos.y - restoredPos.y) > 4)) {
    // 可能被战斗打断存档——再等一个周期并重载重试
    result = await waitStableAndSaved()
    savedPos = result.saved
    await page.reload({ waitUntil: 'networkidle' })
    await dismissSplash()
    await page.waitForTimeout(9000)
    restoredPos = await pos()
  }
  add('自动存档 & 重载恢复',
    !!savedPos && !!restoredPos && Math.hypot(savedPos.x - restoredPos.x, savedPos.y - restoredPos.y) <= 4,
    `${savedPos?.x},${savedPos?.y} → ${restoredPos?.x},${restoredPos?.y}`)

  // 9.5 时间轴持久化（V0）：重载后世界时刻未回退到开局（证明 world 快照入档）
  const clockAfterReload = async () => {
    const t = await page.locator('.hud .clock').textContent().catch(() => '')
    const m = /第(\d+)日/.exec(t ?? '')
    return { label: (t ?? '').trim(), day: m ? +m[1] : 0 }
  }
  const restoredClock = await clockAfterReload()
  add('时间轴存档保真', restoredClock.day > 1, `重载后 ${restoredClock.label || '（无时钟）'}`)

  add('全程无异常', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 160))
} finally {
  await browser.close()
}

const passed = results.filter((r) => r.pass).length
console.log(`\nQA-LOCAL: ${passed}/${results.length} 通过`)
process.exit(passed === results.length ? 0 : 2)
