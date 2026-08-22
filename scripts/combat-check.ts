/**
 * 战斗系统 sanity checks：确定性 Rng 驱动，断言失败即退出码 1。
 * 运行：npm run check:combat
 */
import {
  PLAYER_BASE_STATS,
  attemptFlee,
  createBattle,
  fleeChance,
  playerAttack,
  playerSkill,
  type BattleState,
} from '../src/systems/combat'
import type { Enemy } from '../src/systems/schemas'

let failures = 0
function expect(label: string, cond: boolean): void {
  if (cond) console.log(`✓ ${label}`)
  else {
    failures++
    console.error(`✗ ${label}`)
  }
}

const wolf: Enemy = {
  id: 'hui_lang',
  name: '灰狼',
  description: 'test',
  stats: { hp: 30, atk: 6, def: 2, speed: 4 },
}

const alwaysMax = () => 1
const alwaysMin = () => 0

// 锚点：炼气一层 攻 10
expect('玩家攻击锚点为10', PLAYER_BASE_STATS.atk === 10)

// 伤害边界：atk10 vs def2 → base (10-1)=9，方差 ±7.5% → 8~10
{
  const s = createBattle(wolf)
  const lo = playerAttack(s, alwaysMin).enemy.hp
  const hi = playerAttack(s, alwaysMax).enemy.hp
  const dmgLo = wolf.stats.hp - lo
  const dmgHi = wolf.stats.hp - hi
  expect('普攻伤害在8~10之间', dmgLo >= 8 && dmgLo <= 10 && dmgHi >= 8 && dmgHi <= 10)
}

// 防御减免下限：至少造成 MIN_DAMAGE
{
  const tank: Enemy = { ...wolf, stats: { ...wolf.stats, def: 999 } }
  const s = createBattle(tank)
  const after = playerAttack(s, alwaysMin)
  expect('伤害下限为1', wolf.stats.hp - after.enemy.hp === 1)
}

// 技能：消耗灵气、伤害约1.8倍
{
  const s = createBattle(wolf)
  const after = playerSkill(s, alwaysMax)
  expect('技能消耗8点灵气', s.player.qi - after.player.qi === 8)
  const skillDmg = wolf.stats.hp - after.enemy.hp
  expect('技能伤害约16(±2)', skillDmg >= 14 && skillDmg <= 18)
}

// 灵气不足：不放技能但回合照常推进（受反击）
{
  let s = createBattle(wolf)
  while (s.player.qi >= 8 && !s.over) s = playerSkill(s, alwaysMin)
  const qiBefore = s.player.qi
  const hpBefore = s.player.hp
  s = playerSkill(s, alwaysMin)
  expect('灵气不足时灵气不变', s.player.qi === qiBefore)
  expect('灵气不足仍受敌方反击', s.player.hp < hpBefore || s.over)
}

// 击杀流程：连续攻击至敌方归零 → over=true, win=true
{
  let s: BattleState = createBattle(wolf, alwaysMin)
  while (!s.over) s = playerAttack(s, alwaysMin)
  expect('击杀后战斗结束且胜利', s.over && s.win && s.enemy.hp === 0)
}

// 战败流程：构造远强于玩家的敌人
{
  const demon: Enemy = { ...wolf, id: 'test_demon', stats: { hp: 1000, atk: 60, def: 30, speed: 99 } }
  const s = createBattle(demon, alwaysMax)
  expect('速度高者开局抢先手', s.player.hp < s.player.maxHp)

  let dead: BattleState = createBattle(demon, alwaysMax)
  while (!dead.over) dead = playerAttack(dead, alwaysMax)
  expect('战败时 over 且未胜利', dead.over && !dead.win && dead.player.hp === 0)
}

// 逃跑：成功率随速度差，成功即结束；失败受反击
{
  const fastPlayerState = createBattle(wolf)
  expect('逃跑率=基础+速度差加成', Math.abs(fleeChance(fastPlayerState) - 0.65) < 1e-9)
  const fled = attemptFlee(createBattle(wolf), () => 0.1)
  expect('低随机值逃跑成功', fled.over && !fled.win)
  const stuck = attemptFlee(createBattle(wolf), () => 0.99)
  expect('逃跑失败继续战斗并受反击', !stuck.over && stuck.player.hp < stuck.player.maxHp)
}

if (failures > 0) {
  console.error(`\n${failures} 项检查未通过`)
  process.exit(1)
}
console.log('\n全部战斗逻辑检查通过 ✅')
