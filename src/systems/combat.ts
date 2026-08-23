/**
 * 回合制战斗纯函数集。数值锚点：GDD §10「炼气一层裸装凡剑 = 攻 10」。
 * 所有函数 (input) => output，随机源经 Rng 注入以便测试；文案集中在 LOG。
 */
import type { Enemy, GongfaGradeValue, Item, Skill } from './schemas'

export type Rng = () => number

export const PLAYER_BASE_STATS = {
  maxHp: 50,
  maxQi: 40,
  atk: 10,
  def: 2,
  speed: 5,
} as const

const SKILL_DEFAULT_COST = 8
const SKILL_HEAL_COST = 10
const SKILL_HEAL_AMOUNT = 18
const SKILL_BUFF_COST = 12
const SKILL_BUFF_AMOUNT = 4
const SKILL_BUFF_TURNS = 3
export const GRADE_POWER: Record<GongfaGradeValue, number> = {
  凡品: 1.5,
  黄品: 1.8,
  玄品: 2.3,
  地品: 3.0,
  天品: 4.0,
}

const DAMAGE_VARIANCE = 0.15
const MIN_DAMAGE = 1
const COMBO_MULTIPLIER = 1.5
const FLEE_BASE_CHANCE = 0.6
const FLEE_SPEED_BONUS = 0.05
const FLEE_MIN_CHANCE = 0.2
const FLEE_MAX_CHANCE = 0.9

export const POISON_TURNS = 2
export const POISON_DMG = 3
const POISON_BITE_MULT = 0.7
export const ENRAGE_THRESHOLD = 0.3
export const ENRAGE_ATK_MULT = 1.5

const MIN_EXP_FALLBACK = 5
const EXP_FALLBACK_DIVISOR = 5

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.min(v, max))
}

export type LogKind = 'player' | 'enemy' | 'system' | 'reward'

export interface LogEntry {
  text: string
  kind: LogKind
}

export const LOG = {
  battleStart: (player: string, enemy: string) => `${player}与${enemy}对峙，战斗开始`,
  playerHit: (enemy: string, dmg: number) => `你挥剑击中${enemy}，造成${dmg}点伤害`,
  skillCast: (name: string, dmg: number) => `${name}灵光大盛，轰出${dmg}点伤害`,
  comboCast: (skillName: string, dmg: number) => `连携！${skillName}威力大增，造成${dmg}点伤害`,
  skillHeal: (name: string, amount: number) => `${name}运转周天，回复${amount}点气血`,
  skillBuff: (name: string, amount: number, turns: number) =>
    `${name}灵光护体，攻击提升${amount}点，持续${turns}回合`,
  skillNoQi: () => '灵气不足，无法施展法术',
  itemUse: (name: string) => `服下${name}，药力化开`,
  enemyHit: (enemy: string, dmg: number) => `${enemy}扑袭而来，你受到${dmg}点伤害`,
  poisonApplied: (enemy: string) => `${enemy}毒牙入体，你中了尸毒！`,
  poisonTick: (dmg: number) => `毒素发作，损失${dmg}点气血`,
  enrage: (enemy: string) => `${enemy}目眦欲裂，狂性大发，攻势陡然暴烈！`,
  fleeSuccess: () => '你足下生风，脱出战团',
  fleeFail: () => '逃跑失败，被对方缠住',
  win: (enemy: string) => `${enemy}哀鸣一声，倒地不起`,
  lose: () => '你伤重难支，眼前一黑……',
} as const

interface CombatantBase {
  name: string
  hp: number
  maxHp: number
  qi: number
  maxQi: number
  atk: number
  def: number
  speed: number
}

export interface PlayerCombatant extends CombatantBase {
  poison: number
  atkBuff: number
  atkBuffTurns: number
}

export interface EnemyCombatant extends CombatantBase {
  special?: 'poison' | 'enrage'
  enraged: boolean
  /** 下一次敌方行动序号（从 1 起），决定意图与毒牙轮换 */
  turn: number
  intent: string
}

export interface BattleState {
  player: PlayerCombatant
  enemy: EnemyCombatant
  turn: number
  log: LogEntry[]
  /** CBT-8：玩家上一手动作（连携判定用） */
  lastAction?: 'attack' | 'skill' | 'item' | 'flee' | null
  over: boolean
  win: boolean
  fled: boolean
}

export type BattleAction = 'attack' | 'skill' | 'item' | 'flee'

export interface PlayerStatsInput {
  maxHp: number
  maxQi: number
  atk: number
  def: number
  speed: number
}

/** 战斗入口参数：等级派生属性 + 存档中的当前血/灵 */
export interface BattleOptions {
  name?: string
  stats?: PlayerStatsInput
  hp?: number
  qi?: number
}

/** 功法战斗效果（SkillSchema.battle 缺省时按 kind/grade 推导） */
export interface BattleSkillEffect {
  kind: 'damage' | 'heal' | 'buff'
  cost: number
  power?: number
  amount?: number
  turns?: number
}

export function skillEffect(skill: Skill): BattleSkillEffect {
  const b = skill.battle
  if (b) return b
  if (skill.kind === '心法') {
    return { kind: 'heal', cost: SKILL_HEAL_COST, amount: SKILL_HEAL_AMOUNT }
  }
  if (skill.kind === '身法' || skill.kind === '炼体') {
    return { kind: 'buff', cost: SKILL_BUFF_COST, amount: SKILL_BUFF_AMOUNT, turns: SKILL_BUFF_TURNS }
  }
  return { kind: 'damage', cost: SKILL_DEFAULT_COST, power: GRADE_POWER[skill.grade] }
}

export function expReward(template: Enemy): number {
  if (template.exp !== undefined) return template.exp
  return Math.max(
    MIN_EXP_FALLBACK,
    Math.round(
      (template.stats.hp + template.stats.atk * 2 + template.stats.def) / EXP_FALLBACK_DIVISOR,
    ),
  )
}

export function rollLoot(table: Array<{ item: string; chance: number }> | undefined, rng: Rng): string[] {
  if (!table) return []
  return table.filter((entry) => rng() < entry.chance).map((entry) => entry.item)
}

const INTENT_STRIKE = '蓄势欲扑'
const INTENT_POISON = '毒牙嘶咬（命中将中毒）'
const INTENT_ENRAGE_STRIKE = '狂怒猛冲（攻势暴烈）'

function nextEnemyAction(enemy: EnemyCombatant): 'strike' | 'poisonBite' {
  if (enemy.special === 'poison' && !enemy.enraged) {
    return enemy.turn % 2 === 1 ? 'poisonBite' : 'strike'
  }
  return 'strike'
}

function intentFor(enemy: EnemyCombatant): string {
  if (enemy.enraged) return INTENT_ENRAGE_STRIKE
  return nextEnemyAction(enemy) === 'poisonBite' ? INTENT_POISON : INTENT_STRIKE
}

function makePlayer(opts: BattleOptions): PlayerCombatant {
  const s = opts.stats ?? PLAYER_BASE_STATS
  return {
    name: opts.name ?? '张铁柱',
    maxHp: s.maxHp,
    hp: Math.min(opts.hp ?? s.maxHp, s.maxHp),
    maxQi: s.maxQi,
    qi: Math.min(opts.qi ?? s.maxQi, s.maxQi),
    atk: s.atk,
    def: s.def,
    speed: s.speed,
    poison: 0,
    atkBuff: 0,
    atkBuffTurns: 0,
  }
}

export function createBattle(
  template: Enemy,
  opts: BattleOptions = {},
  rng: Rng = Math.random,
): BattleState {
  const state: BattleState = {
    player: makePlayer(opts),
    enemy: {
      name: template.name,
      hp: template.stats.hp,
      maxHp: template.stats.hp,
      qi: 0,
      maxQi: 0,
      atk: template.stats.atk,
      def: template.stats.def,
      speed: template.stats.speed,
      special: template.special,
      enraged: false,
      turn: 1,
      intent: '',
    },
    turn: 1,
    log: [{ text: LOG.battleStart(opts.name ?? '张铁柱', template.name), kind: 'system' }],
    over: false,
    win: false,
    fled: false,
  }
  state.enemy.intent = intentFor(state.enemy)
  if (state.enemy.speed > state.player.speed) resolveEnemyPhase(state, rng)
  return state
}

function rollDamage(atk: number, def: number, multiplier: number, rng: Rng): number {
  const base = (atk - def / 2) * multiplier
  const variance = 1 - DAMAGE_VARIANCE / 2 + rng() * DAMAGE_VARIANCE
  return Math.max(MIN_DAMAGE, Math.round(base * variance))
}

function effectiveAtk(p: PlayerCombatant): number {
  return p.atk + p.atkBuff
}

function checkVictory(next: BattleState): boolean {
  if (next.enemy.hp > 0) return false
  next.over = true
  next.win = true
  next.log.push({ text: LOG.win(next.enemy.name), kind: 'reward' })
  return true
}

/** 敌方完整行动阶段：毒伤结算 → 狂暴判定 → 出手 → 意图更新 */
function resolveEnemyPhase(state: BattleState, rng: Rng): void {
  const e = state.enemy
  const p = state.player
  if (p.poison > 0) {
    p.poison -= 1
    p.hp = Math.max(0, p.hp - POISON_DMG)
    state.log.push({ text: LOG.poisonTick(POISON_DMG), kind: 'enemy' })
    if (p.hp === 0) {
      state.over = true
      state.win = false
      state.log.push({ text: LOG.lose(), kind: 'enemy' })
      return
    }
  }
  if (
    e.special === 'enrage' &&
    !e.enraged &&
    e.hp <= Math.ceil(e.maxHp * ENRAGE_THRESHOLD)
  ) {
    e.enraged = true
    e.atk = Math.round(e.atk * ENRAGE_ATK_MULT)
    state.log.push({ text: LOG.enrage(e.name), kind: 'system' })
  }
  if (nextEnemyAction(e) === 'poisonBite') {
    const dmg = rollDamage(e.atk, p.def, POISON_BITE_MULT, rng)
    p.hp = Math.max(0, p.hp - dmg)
    p.poison = POISON_TURNS
    state.log.push({ text: LOG.enemyHit(e.name, dmg), kind: 'enemy' })
    state.log.push({ text: LOG.poisonApplied(e.name), kind: 'enemy' })
  } else {
    const dmg = rollDamage(e.atk, p.def, 1, rng)
    p.hp = Math.max(0, p.hp - dmg)
    state.log.push({ text: LOG.enemyHit(e.name, dmg), kind: 'enemy' })
  }
  if (p.hp === 0) {
    state.over = true
    state.win = false
    state.log.push({ text: LOG.lose(), kind: 'enemy' })
    return
  }
  e.turn += 1
  state.turn += 1
  if (p.atkBuffTurns > 0) {
    p.atkBuffTurns -= 1
    if (p.atkBuffTurns === 0) p.atkBuff = 0
  }
  e.intent = intentFor(e)
}

/** 玩家回合行动后结算敌方反击。返回新状态，不修改入参。 */
function resolveRound(state: BattleState, rng: Rng): BattleState {
  if (state.over) return state
  const next = structuredClone(state)
  resolveEnemyPhase(next, rng)
  return next
}

export function playerAttack(state: BattleState, rng: Rng = Math.random): BattleState {
  if (state.over) return state
  const next = structuredClone(state)
  next.lastAction = 'attack'
  const dmg = rollDamage(effectiveAtk(next.player), next.enemy.def, 1, rng)
  next.enemy.hp = Math.max(0, next.enemy.hp - dmg)
  next.log.push({ text: LOG.playerHit(next.enemy.name, dmg), kind: 'player' })
  if (checkVictory(next)) return next
  resolveEnemyPhase(next, rng)
  return next
}

export function castSkill(state: BattleState, skill: Skill, rng: Rng = Math.random): BattleState {
  if (state.over) return state
  const next = structuredClone(state)
  const effect = skillEffect(skill)
  if (next.player.qi < effect.cost) {
    next.log.push({ text: LOG.skillNoQi(), kind: 'system' })
    return resolveRound(next, rng)
  }
  next.player.qi -= effect.cost
  const combo = next.lastAction === 'attack' && effect.kind === 'damage'
  next.lastAction = 'skill'
  if (effect.kind === 'damage') {
    const power = (effect.power ?? 1) * (combo ? COMBO_MULTIPLIER : 1)
    const dmg = rollDamage(effectiveAtk(next.player), next.enemy.def, power, rng)
    next.enemy.hp = Math.max(0, next.enemy.hp - dmg)
    next.log.push(
      combo
        ? { text: LOG.comboCast(skill.name, dmg), kind: 'player' }
        : { text: LOG.skillCast(skill.name, dmg), kind: 'player' },
    )
    if (checkVictory(next)) return next
  } else if (effect.kind === 'heal') {
    const amount = effect.amount ?? 0
    const healed = Math.min(amount, next.player.maxHp - next.player.hp)
    next.player.hp += healed
    next.log.push({ text: LOG.skillHeal(skill.name, healed), kind: 'player' })
  } else {
    const amount = effect.amount ?? SKILL_BUFF_AMOUNT
    const turns = effect.turns ?? SKILL_BUFF_TURNS
    next.player.atkBuff += amount
    next.player.atkBuffTurns = Math.max(next.player.atkBuffTurns, turns)
    next.log.push({ text: LOG.skillBuff(skill.name, amount, turns), kind: 'player' })
  }
  resolveEnemyPhase(next, rng)
  return next
}

export function useItem(state: BattleState, item: Item, rng: Rng = Math.random): BattleState {
  if (state.over) return state
  const next = structuredClone(state)
  next.lastAction = 'item'
  const eff = item.effect ?? {}
  if (eff.hp) next.player.hp = Math.min(next.player.maxHp, next.player.hp + eff.hp)
  if (eff.qi) next.player.qi = Math.min(next.player.maxQi, next.player.qi + eff.qi)
  next.log.push({ text: LOG.itemUse(item.name), kind: 'player' })
  resolveEnemyPhase(next, rng)
  return next
}

export function fleeChance(state: BattleState): number {
  const bonus = (state.player.speed - state.enemy.speed) * FLEE_SPEED_BONUS
  return clamp(FLEE_BASE_CHANCE + bonus, FLEE_MIN_CHANCE, FLEE_MAX_CHANCE)
}

export function attemptFlee(state: BattleState, rng: Rng = Math.random): BattleState {
  if (state.over) return state
  const next = structuredClone(state)
  next.lastAction = 'flee'
  if (rng() < fleeChance(state)) {
    next.over = true
    next.fled = true
    next.log.push({ text: LOG.fleeSuccess(), kind: 'system' })
    return next
  }
  next.log.push({ text: LOG.fleeFail(), kind: 'system' })
  resolveEnemyPhase(next, rng)
  return next
}
