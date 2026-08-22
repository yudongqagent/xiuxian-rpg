/**
 * 回合制战斗纯函数集。数值锚点：GDD §10「炼气一层裸装凡剑 = 攻 10」。
 * 所有函数 (input) => output，随机源经 Rng 注入以便测试；文案集中在 LOG。
 */
import type { Enemy } from './schemas'

export type Rng = () => number

export const PLAYER_BASE_STATS = {
  hp: 50,
  qi: 40,
  atk: 10,
  def: 2,
  speed: 5,
} as const

const SKILL_COST = 8
const SKILL_MULTIPLIER = 1.8
const DAMAGE_VARIANCE = 0.15
const MIN_DAMAGE = 1
const FLEE_BASE_CHANCE = 0.6
const FLEE_SPEED_BONUS = 0.05
const FLEE_MIN_CHANCE = 0.2
const FLEE_MAX_CHANCE = 0.9

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export const LOG = {
  battleStart: (player: string, enemy: string) => `${player}与${enemy}对峙，战斗开始`,
  playerHit: (enemy: string, dmg: number) => `你挥剑击中${enemy}，造成${dmg}点伤害`,
  skillCast: (dmg: number) => `灵力激荡，法术轰出${dmg}点伤害`,
  skillNoQi: () => '灵气不足，无法施展法术',
  enemyHit: (enemy: string, dmg: number) => `${enemy}扑袭而来，你受到${dmg}点伤害`,
  fleeSuccess: () => '你足下生风，脱出战团',
  fleeFail: () => '逃跑失败，被对方缠住',
  win: (enemy: string) => `${enemy}哀鸣一声，倒地不起`,
  lose: () => '你伤重难支，眼前一黑……',
} as const

export interface Combatant {
  name: string
  hp: number
  maxHp: number
  qi: number
  maxQi: number
  atk: number
  def: number
  speed: number
}

export interface BattleState {
  player: Combatant
  enemy: Combatant
  log: string[]
  over: boolean
  win: boolean
}

export type BattleAction = 'attack' | 'skill' | 'flee'

function makePlayer(): Combatant {
  return {
    name: '张铁柱',
    hp: PLAYER_BASE_STATS.hp,
    maxHp: PLAYER_BASE_STATS.hp,
    qi: PLAYER_BASE_STATS.qi,
    maxQi: PLAYER_BASE_STATS.qi,
    atk: PLAYER_BASE_STATS.atk,
    def: PLAYER_BASE_STATS.def,
    speed: PLAYER_BASE_STATS.speed,
  }
}

export function createBattle(template: Enemy, rng: Rng = Math.random): BattleState {
  const state: BattleState = {
    player: makePlayer(),
    enemy: {
      name: template.name,
      hp: template.stats.hp,
      maxHp: template.stats.hp,
      qi: 0,
      maxQi: 0,
      atk: template.stats.atk,
      def: template.stats.def,
      speed: template.stats.speed,
    },
    log: [LOG.battleStart('张铁柱', template.name)],
    over: false,
    win: false,
  }
  if (state.enemy.speed > state.player.speed) enemyStrike(state, rng)
  return state
}

function rollDamage(atk: number, def: number, multiplier: number, rng: Rng): number {
  const base = (atk - def / 2) * multiplier
  const variance = 1 - DAMAGE_VARIANCE / 2 + rng() * DAMAGE_VARIANCE
  return Math.max(MIN_DAMAGE, Math.round(base * variance))
}

function enemyStrike(state: BattleState, rng: Rng): void {
  const dmg = rollDamage(state.enemy.atk, state.player.def, 1, rng)
  state.player.hp = Math.max(0, state.player.hp - dmg)
  state.log.push(LOG.enemyHit(state.enemy.name, dmg))
  if (state.player.hp === 0) {
    state.over = true
    state.win = false
    state.log.push(LOG.lose())
  }
}

/** 玩家回合行动后结算敌方反击。返回新状态，不修改入参。 */
function resolveRound(state: BattleState, rng: Rng): BattleState {
  if (state.over) return state
  const next = structuredClone(state)
  enemyStrike(next, rng)
  return next
}

export function playerAttack(state: BattleState, rng: Rng = Math.random): BattleState {
  if (state.over) return state
  const next = structuredClone(state)
  const dmg = rollDamage(next.player.atk, next.enemy.def, 1, rng)
  next.enemy.hp = Math.max(0, next.enemy.hp - dmg)
  next.log.push(LOG.playerHit(next.enemy.name, dmg))
  if (next.enemy.hp === 0) {
    next.over = true
    next.win = true
    next.log.push(LOG.win(next.enemy.name))
    return next
  }
  enemyStrike(next, rng)
  return next
}

export function playerSkill(state: BattleState, rng: Rng = Math.random): BattleState {
  if (state.over) return state
  const next = structuredClone(state)
  if (next.player.qi < SKILL_COST) {
    next.log.push(LOG.skillNoQi())
    return resolveRound(next, rng)
  }
  next.player.qi -= SKILL_COST
  const dmg = rollDamage(next.player.atk, next.enemy.def, SKILL_MULTIPLIER, rng)
  next.enemy.hp = Math.max(0, next.enemy.hp - dmg)
  next.log.push(LOG.skillCast(dmg))
  if (next.enemy.hp === 0) {
    next.over = true
    next.win = true
    next.log.push(LOG.win(next.enemy.name))
    return next
  }
  enemyStrike(next, rng)
  return next
}

export function fleeChance(state: BattleState): number {
  const bonus = (state.player.speed - state.enemy.speed) * FLEE_SPEED_BONUS
  return clamp(FLEE_BASE_CHANCE + bonus, FLEE_MIN_CHANCE, FLEE_MAX_CHANCE)
}

export function attemptFlee(state: BattleState, rng: Rng = Math.random): BattleState {
  if (state.over) return state
  const next = structuredClone(state)
  if (rng() < fleeChance(state)) {
    next.over = true
    next.win = false
    next.log.push(LOG.fleeSuccess())
    return next
  }
  next.log.push(LOG.fleeFail())
  enemyStrike(next, rng)
  return next
}
