/**
 * 战斗系统 sanity checks：确定性 Rng 驱动，断言失败即退出码 1。
 * 运行：npm run check:combat
 */
import {
  ENRAGE_ATK_MULT,
  ENRAGE_THRESHOLD,
  GRADE_POWER,
  PLAYER_BASE_STATS,
  POISON_DMG,
  POISON_TURNS,
  attemptFlee,
  castSkill,
  createBattle,
  expReward,
  fleeChance,
  playerAttack,
  rollLoot,
  skillEffect,
  useItem,
  type BattleState,
} from '../src/systems/combat'
import {
  addItem,
  createPlayer,
  effectiveStats,
  equipItem,
  expToNext,
  fromPlayerSave,
  grantExp,
  realmLabel,
  removeItem,
  respawnPenalty,
  statsForLevel,
  unequipItem,
} from '../src/systems/player'
import type { Enemy, Item } from '../src/systems/schemas'
import { ItemSchema, SkillSchema } from '../src/systems/schemas'
import { decodeSave, encodeSave, type SaveData } from '../src/engine/save'
import { canCraft, craft } from '../src/systems/alchemy'
import { buyItem, sellItem } from '../src/systems/player'
import type { Recipe } from '../src/systems/schemas'
import huodanShuJson from '../content/skills/huodan_shu.json'
import changchunGongJson from '../content/skills/changchun_gong.json'
import zhayanJianfaJson from '../content/skills/zhayan_jianfa.json'

const huodanShu = SkillSchema.parse(huodanShuJson)
const changchunGong = SkillSchema.parse(changchunGongJson)
const zhayanJianfa = SkillSchema.parse(zhayanJianfaJson)

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

const spider: Enemy = {
  id: 'du_zhu',
  name: '毒蛛',
  description: 'test',
  stats: { hp: 26, atk: 5, def: 2, speed: 4 },
  exp: 16,
  special: 'poison',
}

const dummy: Enemy = {
  id: 'test_dummy',
  name: '木桩妖',
  description: 'test',
  stats: { hp: 1000, atk: 0, def: 0, speed: 0 },
}

const bigBoss: Enemy = {
  id: 'test_boss',
  name: '测试凶兽',
  description: 'test',
  stats: { hp: 1000, atk: 9, def: 0, speed: 0 },
  special: 'enrage',
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

// 技能品阶伤害分层：黄品火弹术(1.8 显式) vs 凡品眨眼剑法(1.5 按 grade 推导)
{
  expect(
    '品阶倍率表锚定',
    GRADE_POWER['凡品'] === 1.5 && GRADE_POWER['黄品'] === 1.8 && GRADE_POWER['玄品'] === 2.3,
  )
  const huodan = skillEffect(huodanShu)
  const zhayan = skillEffect(zhayanJianfa)
  expect('火弹术=黄品伤害 耗灵8 倍率1.8', huodan.kind === 'damage' && huodan.cost === 8 && huodan.power === 1.8)
  expect('眨眼剑法缺省推导=凡品伤害 耗灵8 倍率1.5', zhayan.kind === 'damage' && zhayan.cost === 8 && zhayan.power === 1.5)

  const s1 = createBattle(dummy)
  const d1 = dummy.stats.hp - castSkill(s1, zhayanJianfa, alwaysMax).enemy.hp
  expect('凡品技能最大伤害=(10-0)*1.5*1.075≈16', d1 === Math.round(10 * 1.5 * 1.075))

  const s2 = createBattle(dummy)
  const d2 = dummy.stats.hp - castSkill(s2, huodanShu, alwaysMax).enemy.hp
  expect('黄品技能最大伤害=(10-0)*1.8*1.075≈19', d2 === Math.round(10 * 1.8 * 1.075))
  expect('黄品伤害严格高于凡品', d2 > d1)
  expect('施法扣减对应灵气', s1.player.qi - castSkill(s1, zhayanJianfa, alwaysMin).player.qi === 8)
}

// 回复功法（心法缺省推导为回复）：回血、耗灵；满血时不溢出
{
  const hurt = createBattle(wolf)
  hurt.player.hp = 20
  const after = castSkill(hurt, changchunGong, alwaysMin)
  expect(
    '回复功法耗灵并回血',
    after.player.hp > 20 && hurt.player.qi - after.player.qi === skillEffect(changchunGong).cost,
  )
  const full = createBattle(dummy)
  full.player.hp = full.player.maxHp
  const capped = castSkill(full, changchunGong, alwaysMin)
  expect('满血时回复不溢出(木桩反击为最低1)', capped.player.hp === capped.player.maxHp - 1)
}

// 灵气不足：不放技能但回合照常推进（受反击）
{
  let s = createBattle(wolf)
  while (s.player.qi >= 8 && !s.over) s = castSkill(s, huodanShu, alwaysMin)
  const qiBefore = s.player.qi
  const hpBefore = s.player.hp
  s = castSkill(s, huodanShu, alwaysMin)
  expect('灵气不足时灵气不变', s.player.qi === qiBefore)
  expect('灵气不足仍受敌方反击', s.player.hp < hpBefore || s.over)
}

// 毒蛛：开局意图提示 → 毒牙上毒 → 每回合 DOT 固定掉血并递减 → 毒可致死
{
  const s = createBattle(spider)
  expect('开局显示敌方意图', s.enemy.intent.length > 0)
  expect('奇数回合意图为毒牙嘶咬', s.enemy.intent.includes('毒'))
  let next = playerAttack(s, alwaysMax)
  expect('中毒进入倒计时', !next.over && next.player.poison === POISON_TURNS)
  expect('敌方行动后意图轮换为普攻', !next.enemy.intent.includes('毒'))
  const hpAfterBite = next.player.hp
  next = playerAttack(next, alwaysMax)
  expect(
    '每回合毒素固定掉血(毒3+普攻反击)',
    hpAfterBite - next.player.hp === POISON_DMG + Math.round((spider.stats.atk - spider.stats.def / 2) * 1.075),
  )
  expect('毒倒计时递减', next.player.poison === POISON_TURNS - 1)

  const doomed = createBattle(spider)
  doomed.player.hp = 6
  let dead = playerAttack(doomed, alwaysMax)
  dead = playerAttack(dead, alwaysMax)
  expect('毒素可致死且判负', dead.over && !dead.win && dead.player.hp === 0)
}

// Boss 狂暴：血量跌破 30% 后 atk 提升 ENRAGE_ATK_MULT 倍，仅触发一次；意图同步变化
{
  const s = createBattle(bigBoss)
  expect('满血时未狂暴', s.enemy.atk === bigBoss.stats.atk)
  s.enemy.hp = Math.ceil(bigBoss.stats.hp * ENRAGE_THRESHOLD) + 1
  const after = playerAttack(s, alwaysMax)
  expect(
    '跌破30%触发狂暴且攻击提升',
    after.enemy.atk === Math.round(bigBoss.stats.atk * ENRAGE_ATK_MULT),
  )
  expect('狂暴后意图提示暴烈', after.enemy.intent.includes('狂怒') || after.over)
  expect('再次攻击不重复叠加', after.over || playerAttack(after, alwaysMax).enemy.atk === after.enemy.atk)
}

// 经验曲线：递增、升级结算与余量滚存、境界称谓、属性成长、敌人经验来源
{
  expect('经验需求随等级递增', expToNext(1) < expToNext(2) && expToNext(2) < expToNext(3))
  expect('一级升二级需30经验', expToNext(1) === 30)
  const p0 = createPlayer()
  const r1 = grantExp(p0, expToNext(1) + 5)
  expect('升级且余量滚存', r1.levelsGained === 1 && r1.player.level === 2 && r1.player.exp === 5)
  const s1 = statsForLevel(1)
  const s2 = statsForLevel(2)
  expect('升级属性成长', s2.maxHp > s1.maxHp && s2.atk > s1.atk && s2.def >= s1.def && s2.speed >= s1.speed)
  const wounded = { ...p0, hp: 1 }
  expect('升级回复部分气血', grantExp(wounded, expToNext(1)).player.hp > wounded.hp)
  expect(
    '境界称谓派生自等级',
    realmLabel(1) === '炼气一层' &&
      realmLabel(3) === '炼气三层' &&
      realmLabel(12) === '炼气十二层' &&
      realmLabel(13) === '炼气十三层·圆满' &&
      realmLabel(99) === '炼气十三层·圆满',
  )
  expect(
    '敌人经验取自模板或按stats推导',
    expReward(spider) === 16 && expReward(wolf) === Math.round((30 + 12 + 2) / 5),
  )
}

// 掉落表边界：必掉(chance=1)/不掉(chance=0)/概率掷点/空表
{
  const table = [
    { item: 'yaodan', chance: 1 },
    { item: 'xi_sui_dan', chance: 0.5 },
    { item: 'never', chance: 0 },
  ]
  expect('rng=0 时必掉+半掉命中', rollLoot(table, () => 0).join(',') === 'yaodan,xi_sui_dan')
  expect('rng≥0.5 时只掉必掉项', rollLoot(table, () => 0.5).join(',') === 'yaodan')
  expect('空表不掉落', rollLoot(undefined, () => 0).length === 0)
}

// 背包增删 + 战败宽惩罚 + 旧档兼容
{
  const p = addItem(createPlayer(), 'huiqi_san', 2)
  expect('物品入库计数', p.inventory['huiqi_san'] === 5)
  const q = removeItem(p, 'huiqi_san', 5)
  expect('物品出清后移除键', q.inventory['huiqi_san'] === undefined)
  expect('数量不足时不消耗', removeItem(p, 'huiqi_san', 99).inventory['huiqi_san'] === 5)
  const beaten = respawnPenalty({ ...createPlayer(), hp: 3 })
  expect('战败气血折半而非归零', beaten.hp === Math.ceil(statsForLevel(beaten.level).maxHp / 2))
  const legacy = fromPlayerSave(undefined)
  expect('旧档兼容：无player字段按全新开局', legacy.level === 1 && legacy.skills.includes('huodan_shu'))
  const carried = fromPlayerSave({
    level: 3,
    exp: 7,
    hp: 999,
    qi: -5,
    inventory: { yaodan: 2 },
    skills: ['changchun_gong'],
  })
  expect(
    '读档钳制非法数值并合并缺省',
    carried.level === 3 &&
      carried.exp === 7 &&
      carried.hp === statsForLevel(3).maxHp &&
      carried.qi === 0 &&
      carried.inventory['yaodan'] === 2 &&
      carried.skills.includes('huodan_shu'),
  )
}

// 战斗用道具：回血生效且消耗一回合（受反击）
{
  const potion: Item = {
    id: 'huichun_san',
    name: '回春散',
    type: 'consumable',
    grade: '凡品',
    description: '',
    stats: {},
    effect: { hp: 30 },
  }
  const s = createBattle(wolf)
  s.player.hp = 10
  const after = useItem(s, potion, alwaysMin)
  expect('丹药回血且回合推进受反击', after.player.hp > 10 && after.player.hp < after.player.maxHp)
}

// 击杀流程：连续攻击至敌方归零 → over=true, win=true
{
  let s: BattleState = createBattle(wolf, {}, alwaysMin)
  while (!s.over) s = playerAttack(s, alwaysMin)
  expect('击杀后战斗结束且胜利', s.over && s.win && s.enemy.hp === 0)
}

// 战败流程：构造远强于玩家的敌人
{
  const demon: Enemy = { ...wolf, id: 'test_demon', stats: { hp: 1000, atk: 60, def: 30, speed: 99 } }
  const s = createBattle(demon, {}, alwaysMax)
  expect('速度高者开局抢先手', s.player.hp < s.player.maxHp)

  let dead: BattleState = createBattle(demon, {}, alwaysMax)
  while (!dead.over) dead = playerAttack(dead, alwaysMax)
  expect('战败时 over 且未胜利', dead.over && !dead.win && dead.player.hp === 0)
}

// 逃跑：成功率随速度差，成功即结束(fled)；失败受反击
{
  const fastPlayerState = createBattle(wolf)
  expect('逃跑率=基础+速度差加成', Math.abs(fleeChance(fastPlayerState) - 0.65) < 1e-9)
  const fled = attemptFlee(createBattle(wolf), () => 0.1)
  expect('低随机值逃跑成功', fled.over && fled.fled)
  const stuck = attemptFlee(createBattle(wolf), () => 0.99)
  expect('逃跑失败继续战斗并受反击', !stuck.over && stuck.player.hp < stuck.player.maxHp)
}

// ===== INV-3：装备系统 =====
{
  const LOOKUP = (id: string) => EQUIP_FIXTURES[id]
  const EQUIP_FIXTURES: Record<string, Item> = {
    tie_jian: ItemSchema.parse({ id: 'tie_jian', name: '铁剑', type: 'weapon', grade: '凡品', description: '', stats: { atk: 6 } }),
    tie_jia: ItemSchema.parse({ id: 'tie_jia', name: '铁甲', type: 'armor', grade: '凡品', description: '', stats: { def: 3, hp: 5 } }),
  }
  let p = createPlayer()
  const base = effectiveStats(p.level, p.equipped, LOOKUP)
  expect('无装备时属性=基础属性', base.atk === statsForLevel(1).atk && base.def === statsForLevel(1).def)

  p = addItem(addItem(p, 'tie_jian'), 'tie_jia')
  p = equipItem(p, 'weapon', 'tie_jian')
  p = equipItem(p, 'armor', 'tie_jia')
  const equipped = effectiveStats(p.level, p.equipped, LOOKUP)
  expect('武器攻+6生效', equipped.atk === statsForLevel(1).atk + 6)
  expect('防具防+3/血+5生效', equipped.def === statsForLevel(1).def + 3 && equipped.maxHp === statsForLevel(1).maxHp + 5)

  const before = createBattle(wolf, { stats: base, hp: base.maxHp, qi: 40 })
  const after = createBattle(wolf, { stats: equipped, hp: equipped.maxHp, qi: 40 })
  const dmgBase = playerAttack(before, () => 0.5).enemy.hp
  const dmgEq = playerAttack(after, () => 0.5).enemy.hp
  expect('装备提升实际伤害', dmgEq < dmgBase)

  p = unequipItem(p, 'weapon')
  expect('卸下后攻回退', effectiveStats(p.level, p.equipped, LOOKUP).atk === statsForLevel(1).atk)

  const notOwned = equipItem(p, 'weapon', 'qingyun_jian')
  expect('未持有物品不可装备', notOwned.equipped.weapon === null)

  const saved = fromPlayerSave({ level: 2, exp: 0, hp: 50, qi: 40, inventory: {}, skills: [], equipped: { weapon: 'tie_jian', armor: null } })
  expect('存档往返保留装备', saved.equipped.weapon === 'tie_jian')
  const legacy = fromPlayerSave(undefined)
  expect('旧档装备缺省为空', legacy.equipped.weapon === null && legacy.equipped.armor === null)
}

// ===== ENG-6：存档码编解码 =====
{
  const sample: SaveData = {
    version: 2,
    playerId: 'mortal-001',
    x: 640,
    y: 896,
    mapId: 'shanji',
    inventory: [],
    savedAt: 1755800000000,
    player: { level: 3, exp: 12, hp: 61, qi: 48, inventory: { tie_jian: 1 }, skills: ['huodan_shu'], equipped: { weapon: 'tie_jian', armor: null } },
    quests: { active: [{ id: 'qm_01_rumen', counts: [1, 0, 0] }], completed: [], failed: [], tracked: 'qm_01_rumen' },
  }
  const code = encodeSave(sample)
  expect('存档码前缀与三段式', code.startsWith('XJ1.') && code.split('.').length === 3)
  const back = decodeSave(code)
  expect('存档码往返还原', back !== null && back.x === 640 && back.mapId === 'shanji')
  expect(
    '存档码保留成长/装备/任务',
    back?.player?.level === 3 &&
      back.player.equipped?.weapon === 'tie_jian' &&
      back.quests?.tracked === 'qm_01_rumen',
  )
  expect('篡改校验失败', decodeSave(code.slice(0, -2) + 'zz') === null)
  expect('非存档码返回 null', decodeSave('hello world') === null)
}

// ===== INV-4：炼丹 =====
{
  const recipe: Recipe = {
    id: 'r_huichun_san',
    name: '炼制回春散',
    inputs: [
      { item: 'qi_xie_ling_cao', count: 3 },
      { item: 'yaodan', count: 1 },
    ],
    output: { item: 'huichun_san', count: 2 },
    description: '',
  }
  // 显式空背包夹具（起始物品不影响断言）
  let p: ReturnType<typeof createPlayer> = { ...createPlayer(), inventory: {} }
  expect('材料不足不可合成', !canCraft(p, recipe))
  const failed = craft(p, recipe)
  expect('合成失败不改背包', !failed.ok && (failed.player.inventory['qi_xie_ling_cao'] ?? 0) === (p.inventory['qi_xie_ling_cao'] ?? 0))

  p = addItem(addItem(addItem(p, 'qi_xie_ling_cao'), 'qi_xie_ling_cao'), 'yaodan')
  expect('仍差一味材料', !canCraft(p, recipe))
  p = addItem(p, 'qi_xie_ling_cao')
  expect('材料齐备可合成', canCraft(p, recipe))

  const before = p.inventory['huichun_san'] ?? 0
  const result = craft(p, recipe)
  expect('合成成功产出丹药', result.ok && (result.player.inventory['huichun_san'] ?? 0) === before + 2)
  expect('合成消耗材料', (result.player.inventory['qi_xie_ling_cao'] ?? 0) === 0 && (result.player.inventory['yaodan'] ?? 0) === 0)
}

// ===== INV-5：坊市买卖 =====
{
  let p = createPlayer()
  p = { ...p, lingshi: 10, inventory: { ...p.inventory, qi_xie_ling_cao: 2 } }
  const bought = buyItem(p, 'huiqi_san', 8)
  expect('购买扣灵石并入包', bought.lingshi === 2 && (bought.inventory['huiqi_san'] ?? 0) === (p.inventory['huiqi_san'] ?? 0) + 1)
  const poor = buyItem(p, 'huichun_san', 12)
  expect('灵石不足拒绝购买', poor.lingshi === p.lingshi && poor === p)
  const sold = sellItem(bought, 'qi_xie_ling_cao', 3)
  expect('出售得款并减库存', sold.lingshi === bought.lingshi + 3 && (sold.inventory['qi_xie_ling_cao'] ?? 0) === 1)
  let armed: ReturnType<typeof createPlayer> = {
    ...createPlayer(),
    lingshi: 0,
    inventory: { ...createPlayer().inventory, tie_jian: 1 },
    equipped: { weapon: 'tie_jian', armor: null },
  }
  armed = sellItem(armed, 'tie_jian', 5)
  expect('卖出已装备武器自动卸下', armed.equipped.weapon === null && armed.lingshi === 5)
}

if (failures > 0) {
  console.error(`\n${failures} 项检查未通过`)
  process.exit(1)
}
console.log('\n全部战斗逻辑检查通过 ✅')
