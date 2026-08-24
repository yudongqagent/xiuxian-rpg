/**
 * M4 音频：程序化 WebAudio（零二进制资源）。
 * - 五声音阶环境 BGM（古琴感 pluck 循环，随区域切换根音）
 * - SFX：攻击/法术/受伤/升级/任务完成/购买/出售
 * - 静音开关持久化 localStorage；首次用户手势后解锁 AudioContext
 */
import { bus } from '../engine/eventBus'

let ctx: AudioContext | undefined
let master: GainNode | undefined
let bgmTimer: number | undefined
let bgmStep = 0
let muted = localStorage.getItem('xj-muted') === '1'
let rootIdx = 0

/** 五声音阶（宫商角徵羽）频率比，基频 A3 */
const PENTATONIC = [0, 2, 4, 7, 9]
const ROOTS = [220, 196, 246.94] // A3 / G3 / B3 —— 村庄/山道/妖谷 情绪
const BGM_INTERVAL = 900

function ensureCtx(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    master ??= ctx.createGain()
    master.gain.value = muted ? 0 : 0.5
    master.connect(ctx.destination)
    return ctx
  } catch {
    return null
  }
}

function pluck(freq: number, dur = 0.6, gain = 0.18, type: OscillatorType = 'triangle'): void {
  if (muted) return
  const c = ensureCtx()
  if (!c || !master) return
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(gain, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur)
  osc.connect(g).connect(master)
  osc.start()
  osc.stop(c.currentTime + dur)
}

function noiseBurst(dur = 0.12, gain = 0.12): void {
  if (muted) return
  const c = ensureCtx()
  if (!c || !master) return
  const len = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = c.createBufferSource()
  src.buffer = buf
  const g = c.createGain()
  g.gain.value = gain
  src.connect(g).connect(master)
  src.start()
}

function bgmTick(): void {
  const root = ROOTS[rootIdx % ROOTS.length]
  const degree = PENTATONIC[bgmStep % PENTATONIC.length]
  const octave = bgmStep % 8 < 4 ? 1 : 2
  const freq = root * Math.pow(2, degree / 12) * octave
  pluck(freq, 1.4, 0.05, 'sine')
  if (bgmStep % 4 === 0) pluck(root / 2, 2.2, 0.04, 'sine')
  bgmStep++
}

function startBgm(): void {
  if (bgmTimer !== undefined) return
  bgmTimer = window.setInterval(() => {
    if (!document.hidden && !muted) bgmTick()
  }, BGM_INTERVAL)
}

export function isMuted(): boolean {
  return muted
}

export function toggleMute(): boolean {
  muted = !muted
  localStorage.setItem('xj-muted', muted ? '1' : '0')
  if (master) master.gain.value = muted ? 0 : 0.5
  if (!muted) pluck(440, 0.25, 0.15)
  return muted
}

/** 首次手势解锁并启动 BGM（浏览器自动播放策略） */
export function initAudio(): void {
  const unlock = () => {
    if (ensureCtx()) startBgm()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

const SFX = {
  attack: () => noiseBurst(0.09, 0.14),
  skill: () => {
    pluck(660, 0.3, 0.16, 'sawtooth')
    pluck(880, 0.4, 0.1, 'sine')
  },
  hurt: () => pluck(140, 0.25, 0.18, 'square'),
  levelUp: () => {
    ;[523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => pluck(f, 0.5, 0.16), i * 120))
  },
  questDone: () => {
    ;[659, 784, 1047].forEach((f, i) => window.setTimeout(() => pluck(f, 0.45, 0.14), i * 130))
  },
  buy: () => {
    pluck(988, 0.15, 0.14)
    window.setTimeout(() => pluck(1319, 0.2, 0.12), 90)
  },
  sell: () => {
    pluck(784, 0.15, 0.14)
    window.setTimeout(() => pluck(587, 0.2, 0.12), 90)
  },
  portal: () => pluck(392, 0.8, 0.12, 'sine'),
}

export function bindAudioEvents(): () => void {
  const unsubs = [
    bus.on('battle:action', (a) => (a === 'attack' ? SFX.attack() : a === 'skill' ? SFX.skill() : undefined)),
    bus.on('battle:start', () => SFX.hurt()),
    bus.on('area:enter', () => {
      rootIdx++
      SFX.portal()
    }),
    bus.on('quest:notify', ({ kind }) => {
      if (kind === 'success') SFX.questDone()
    }),
    bus.on('item:acquired', () => SFX.buy()),
  ]
  // 升级：监听 player:stats 且等级变化（简单节流：记录上次等级）
  let lastLevel = 0
  const unStats = bus.on('player:stats', () => {
    void import('./player').then(({ getPlayer }) => {
      const lv = getPlayer().level
      if (lastLevel && lv > lastLevel) SFX.levelUp()
      lastLevel = lv
    })
  })
  unsubs.push(unStats)
  return () => unsubs.forEach((u) => u())
}
