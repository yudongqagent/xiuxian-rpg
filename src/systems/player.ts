/**
 * 玩家成长与背包状态。纯函数负责推导/变换，末尾附带极小的可订阅存储，
 * 供 UI 层跨组件共享；持久化由调用方经 save.ts 完成。
 * 数值曲线锚定 GDD §10：炼气一层 攻 10。
 */
import { PLAYER_BASE_STATS } from './combat'
import { createGarden, type Garden } from './garden'
import type { PlayerSave } from '../engine/save'

export interface Equipped {
  weapon: string | null
  armor: string | null
}

export interface PlayerState {
  level: number
  exp: number
  hp: number
  qi: number
  /** INV-5：灵石（货币） */
  lingshi: number
  inventory: Record<string, number>
  skills: string[]
  /** INV-3：已装备武器/防具（itemId；物品仍保留在背包） */
  equipped: Equipped
  /** 掌天瓶药圃（additive，旧档缺省由 garden.ts 兜底创建） */
  garden: Garden
}

/** INV-3：基础属性 + 装备加成。lookup 由调用方注入（UI 用全量物品表，测试用夹具）。 */
export function effectiveStats(
  level: number,
  equipped: Equipped,
  lookup: (id: string) => { stats?: { atk?: number; def?: number; hp?: number } } | undefined,
): {
  maxHp: number
  maxQi: number
  atk: number
  def: number
  speed: number
} {
  const base = statsForLevel(level)
  let atk = base.atk
  let def = base.def
  let maxHp = base.maxHp
  for (const id of [equipped.weapon, equipped.armor]) {
    if (!id) continue
    const bonus = lookup(id)?.stats
    if (!bonus) continue
    atk += bonus.atk ?? 0
    def += bonus.def ?? 0
    maxHp += bonus.hp ?? 0
  }
  return { ...base, atk, def, maxHp }
}

/** 穿着：仅登记 slot→itemId；物品仍在背包（数量不减）。须持有该物品。 */
export function equipItem(p: PlayerState, slot: keyof Equipped, itemId: string): PlayerState {
  if (!((p.inventory[itemId] ?? 0) > 0)) return p
  return { ...p, equipped: { ...p.equipped, [slot]: itemId } }
}

export function unequipItem(p: PlayerState, slot: keyof Equipped): PlayerState {
  return { ...p, equipped: { ...p.equipped, [slot]: null } }
}

export const STARTING_SKILLS = ['huodan_shu'] as const
export const STARTING_LINGSHI = 20
export const STARTING_INVENTORY: Record<string, number> = {
  huiqi_san: 3,
  huichun_san: 2,
  tie_jian: 1,
  qi_xie_ling_cao: 4,
  xiao_lv_ping: 1,
}

const EXP_BASE = 30
const EXP_STEP = 20
const LEVEL_RESTORE_RATIO = 0.4
const MAX_LEVEL = 99

export function statsForLevel(level: number): {
  maxHp: number
  maxQi: number
  atk: number
  def: number
  speed: number
} {
  const l = level - 1
  return {
    maxHp: PLAYER_BASE_STATS.maxHp + l * 12,
    maxQi: PLAYER_BASE_STATS.maxQi + l * 8,
    atk: PLAYER_BASE_STATS.atk + l * 3,
    def: PLAYER_BASE_STATS.def + Math.floor(l * 0.7),
    speed: PLAYER_BASE_STATS.speed + Math.floor(l / 2),
  }
}

export function expToNext(level: number): number {
  return EXP_BASE + (level - 1) * EXP_STEP
}

const REALM_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三']
const REALM_MAX_LAYER = REALM_NUMERALS.length

/** 大境界门槛所在等级：该级修为圆满后须行突破仪式方可跨入下一大境界 */
export const BREAKTHROUGH_GATES: ReadonlySet<number> = new Set([13, 17, 21, 25])

const REALM_STAGES = ['初期', '中期', '后期', '圆满'] as const

/** 境界标签：炼气 1-13 层 → 筑基/结丹/元婴/化神 初期~圆满。字符串需与 quests.parseRealmOrdinal 兼容。 */
export function realmLabel(level: number): string {
  if (level <= REALM_MAX_LAYER) return `炼气${REALM_NUMERALS[level - 1]}层`
  const idx = level - REALM_MAX_LAYER - 1
  if (idx >= 16) return '化神圆满·渡劫'
  const realms = ['筑基', '结丹', '元婴', '化神'] as const
  const realm = realms[Math.floor(idx / 4)]
  const stage = REALM_STAGES[idx % 4]
  return `${realm}${stage}`
}

/** 大境界门槛信息：跨入的大境界名、所需丹药、基础成功率（GDD §2.1） */
export interface GateInfo {
  fromLevel: number
  realm: string
  pillId: string
  pillName: string
  baseChance: number
}

const GATE_INFO: Record<number, GateInfo> = {
  13: { fromLevel: 13, realm: '筑基', pillId: 'zhu_ji_dan', pillName: '筑基丹', baseChance: 0.6 },
  17: { fromLevel: 17, realm: '结丹', pillId: 'huangling_dan', pillName: '黄龙丹', baseChance: 0.55 },
  21: { fromLevel: 21, realm: '元婴', pillId: 'xi_sui_dan', pillName: '洗髓丹', baseChance: 0.5 },
  25: { fromLevel: 25, realm: '化神', pillId: 'xi_sui_dan', pillName: '洗髓丹×2', baseChance: 0.45 },
}

export function gateAt(level: number): GateInfo | null {
  return GATE_INFO[level] ?? null
}

/** 机缘加成：灵脉宝地突破额外成功率（GDD §2.1），regionId → 加成 */
const LUCKY_SPOTS: Record<string, number> = {
  shanggu_dongfu: 0.15,
  huangfeng_gu: 0.05,
}

export function breakthroughChance(gate: GateInfo, regionId: string | undefined, pillCount: number): number {
  const lucky = (regionId && LUCKY_SPOTS[regionId]) || 0
  const pillBonus = Math.min(pillCount - 1, 2) * 0.05
  return Math.min(0.95, gate.baseChance + lucky + pillBonus)
}

export function createPlayer(): PlayerState {
  const s = statsForLevel(1)
  return {
    level: 1,
    exp: 0,
    hp: s.maxHp,
    qi: s.maxQi,
    lingshi: STARTING_LINGSHI,
    inventory: { ...STARTING_INVENTORY },
    skills: [...STARTING_SKILLS],
    equipped: { weapon: null, armor: null },
    garden: createGarden(Date.now()),
  }
}

function restoreRatio(p: PlayerState): PlayerState {
  const s = statsForLevel(p.level)
  return {
    ...p,
    hp: Math.min(s.maxHp, p.hp + Math.ceil(s.maxHp * LEVEL_RESTORE_RATIO)),
    qi: Math.min(s.maxQi, p.qi + Math.ceil(s.maxQi * LEVEL_RESTORE_RATIO)),
  }
}

/** 结算经验并连升多级；每级回复部分气血/灵气，剩余经验滚入下一级。
 *  大境界门槛级（13/17/21/25）修为封顶于圆满值，须行突破仪式方可再进一步 */
export function grantExp(p: PlayerState, amount: number): { player: PlayerState; levelsGained: number } {
  let next: PlayerState = { ...p, inventory: { ...p.inventory }, skills: [...p.skills] }
  next.exp += amount
  let gained = 0
  while (next.level < MAX_LEVEL && next.exp >= expToNext(next.level)) {
    if (BREAKTHROUGH_GATES.has(next.level)) {
      next.exp = expToNext(next.level)
      break
    }
    next.exp -= expToNext(next.level)
    next.level += 1
    gained += 1
    next = restoreRatio(next)
  }
  if (next.level < MAX_LEVEL && BREAKTHROUGH_GATES.has(next.level)) {
    next.exp = Math.min(next.exp, expToNext(next.level))
  }
  return { player: next, levelsGained: gained }
}

export function addItem(p: PlayerState, itemId: string, count = 1): PlayerState {
  return {
    ...p,
    inventory: { ...p.inventory, [itemId]: (p.inventory[itemId] ?? 0) + count },
  }
}

export function removeItem(p: PlayerState, itemId: string, count = 1): PlayerState {
  const have = p.inventory[itemId] ?? 0
  if (have < count) return p
  const inv = { ...p.inventory }
  if (inv[itemId] === count) delete inv[itemId]
  else inv[itemId] = have - count
  return { ...p, inventory: inv }
}

/** INV-5：购买（价格由商店表提供）；灵石不足返回原状态 */
export function buyItem(p: PlayerState, itemId: string, price: number): PlayerState {
  if (p.lingshi < price) return p
  return { ...p, lingshi: p.lingshi - price, inventory: { ...p.inventory, [itemId]: (p.inventory[itemId] ?? 0) + 1 } }
}

/** INV-5：出售一件物品，得价 unitPrice */
export function sellItem(p: PlayerState, itemId: string, unitPrice: number): PlayerState {
  const have = p.inventory[itemId] ?? 0
  if (have <= 0) return p
  const inv = { ...p.inventory }
  if (inv[itemId] === 1) delete inv[itemId]
  else inv[itemId] = have - 1
  // 出售已装备的唯一武器/防具时自动卸下
  const equipped = { ...p.equipped }
  for (const slot of ['weapon', 'armor'] as const) {
    if (equipped[slot] === itemId && !(inv[itemId] > 0)) equipped[slot] = null
  }
  return { ...p, lingshi: p.lingshi + Math.max(1, unitPrice), inventory: inv, equipped }
}

export interface BreakthroughResult {
  player: PlayerState
  success: boolean
  chance: number
  reason?: 'not_gate' | 'exp_not_full' | 'qi_not_full' | 'no_pill'
}

/** 大境界突破仪式（GDD §2.1）：条件=修为圆满+灵气圆满+丹药；失败耗丹重伤，绝不降境界删档 */
export function attemptBreakthrough(
  p: PlayerState,
  gate: GateInfo,
  regionId: string | undefined,
  rng: () => number = Math.random,
): BreakthroughResult {
  const s = statsForLevel(p.level)
  if (p.level !== gate.fromLevel) return { player: p, success: false, chance: 0, reason: 'not_gate' }
  if (p.exp < expToNext(p.level)) return { player: p, success: false, chance: 0, reason: 'exp_not_full' }
  const pillNeed = gate.pillId === 'xi_sui_dan' && gate.realm === '化神' ? 2 : 1
  if ((p.inventory[gate.pillId] ?? 0) < pillNeed) {
    return { player: p, success: false, chance: 0, reason: 'no_pill' }
  }
  if (p.qi < s.maxQi) return { player: p, success: false, chance: 0, reason: 'qi_not_full' }
  const chance = breakthroughChance(gate, regionId, p.inventory[gate.pillId] ?? 0)
  const inv = { ...p.inventory }
  inv[gate.pillId] = (inv[gate.pillId] ?? 0) - pillNeed
  if (inv[gate.pillId] <= 0) delete inv[gate.pillId]
  if (rng() >= chance) {
    return {
      player: { ...p, inventory: inv, hp: Math.max(1, Math.ceil(s.maxHp * 0.3)), qi: 0 },
      success: false,
      chance,
    }
  }
  const advanced: PlayerState = { ...p, inventory: inv, level: p.level + 1, exp: 0 }
  const ns = statsForLevel(advanced.level)
  return {
    player: { ...advanced, hp: ns.maxHp, qi: ns.maxQi },
    success: true,
    chance,
  }
}

/** 战败惩罚（宽）：重伤回出生点，气血折半、灵气保留 */
export function respawnPenalty(p: PlayerState): PlayerState {
  const s = statsForLevel(p.level)
  return { ...p, hp: Math.ceil(s.maxHp / 2) }
}

/** 战斗结束后把战斗内的血/灵写回持久状态 */
export function syncAfterBattle(p: PlayerState, hp: number, qi: number): PlayerState {
  const s = statsForLevel(p.level)
  return { ...p, hp: clampInt(hp, 0, s.maxHp), qi: clampInt(qi, 0, s.maxQi) }
}

export const MEDITATE_QI_PER_TICK = 3
export const MEDITATE_HP_PER_TICK = 1
/** 吐纳亦产修为（GDD §8：挂机 ≪ 任务，故每两跳一修为，随灵气密度放大） */
export const MEDITATE_EXP_EVERY = 2

export interface MeditateResult {
  player: PlayerState
  hp: number
  qi: number
  exp: number
}

/** 打坐吐纳（GDD 附录 A：吐纳=恢复灵气的挂机动作）。按区域灵气密度放大，只回血灵不产修为（GDD §8：挂机 ≪ 任务） */
export function meditateTick(p: PlayerState, qiDensity: number, tick: number): MeditateResult {
  const s = statsForLevel(p.level)
  const qi = Math.min(s.maxQi - p.qi, Math.round(MEDITATE_QI_PER_TICK * qiDensity))
  const hp = Math.min(s.maxHp - p.hp, Math.round(MEDITATE_HP_PER_TICK * qiDensity))
  let player: PlayerState = { ...p, hp: p.hp + hp, qi: p.qi + qi }
  let exp = 0
  if (tick % MEDITATE_EXP_EVERY === 0) {
    exp = Math.max(1, Math.round(qiDensity / 2))
    player = grantExp(player, exp).player
  }
  if (qi <= 0 && hp <= 0 && exp <= 0) return { player: p, hp: 0, qi: 0, exp: 0 }
  return { player, hp, qi, exp }
}

function clampInt(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(v)))
}

export function toPlayerSave(p: PlayerState): PlayerSave {
  return {
    level: p.level,
    exp: p.exp,
    hp: p.hp,
    qi: p.qi,
    lingshi: p.lingshi,
    inventory: { ...p.inventory },
    skills: [...p.skills],
    equipped: { ...p.equipped },
    garden: { plots: p.garden.plots.map((pl) => (pl ? { ...pl } : null)), drops: p.garden.drops, bottleAt: p.garden.bottleAt },
  }
}

/** 旧档缺 player 字段时按全新炼气一层处理；字段逐一兜底，向后兼容 */
export function fromPlayerSave(s: PlayerSave | undefined): PlayerState {
  const fresh = createPlayer()
  if (!s) return fresh
  const level = clampInt(s.level ?? fresh.level, 1, MAX_LEVEL)
  const stats = statsForLevel(level)
  return {
    level,
    exp: Math.max(0, s.exp ?? 0),
    hp: clampInt(s.hp ?? stats.maxHp, 0, stats.maxHp),
    qi: clampInt(s.qi ?? stats.maxQi, 0, stats.maxQi),
    inventory: { ...fresh.inventory, ...(s.inventory ?? {}) },
    skills: Array.from(new Set([...fresh.skills, ...(s.skills ?? [])])),
    equipped: {
      weapon: s.equipped?.weapon ?? null,
      armor: s.equipped?.armor ?? null,
    },
    lingshi: Math.max(0, s.lingshi ?? STARTING_LINGSHI),
    garden: s.garden ?? fresh.garden,
  }
}

type Listener = () => void
const listeners = new Set<Listener>()
let current: PlayerState = createPlayer()

export function getPlayer(): PlayerState {
  return current
}

export function setPlayer(next: PlayerState): void {
  current = next
  listeners.forEach((fn) => fn())
}

export function updatePlayer(fn: (p: PlayerState) => PlayerState): void {
  setPlayer(fn(current))
}

export function subscribePlayer(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
