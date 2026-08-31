import { z } from 'zod'
import { SHICHEN_NAMES } from './time'

/** 所有 content/ 下数据的契约。AI 生成新内容必须符合 schema，CI 自动校验。 */

/** 器物品阶（GDD §4.2 装备与炼器，数值锚点见 CONTENT_AUTHORING §6） */
export const ItemGrade = z.enum([
  '凡品',
  '法器',
  '灵器',
  '法宝',
  '灵宝',
  '仙器',
])

/** 功法品阶（GDD §4.1：凡品 < 黄品 < 玄品 < 地品 < 天品） */
export const GongfaGrade = z.enum([
  '凡品',
  '黄品',
  '玄品',
  '地品',
  '天品',
])

export const ItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(20),
  type: z.enum(['weapon', 'armor', 'consumable', 'material']),
  grade: ItemGrade,
  description: z.string().max(200),
  /** 战斗属性加成 */
  stats: z
    .object({
      atk: z.number().int().min(0).default(0),
      def: z.number().int().min(0).default(0),
      hp: z.number().int().min(0).default(0),
    })
    .partial()
    .default({}),
  /** 消耗品效果 */
  effect: z
    .object({
      qi: z.number().int(), // 灵气恢复量，可为负(毒)
      hp: z.number().int(),
    })
    .partial()
    .optional(),
})

export const SkillSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(20),
  kind: z.enum(['心法', '剑诀', '身法', '炼体', '神通']),
  grade: GongfaGrade,
  /** 各境界可修炼层数 */
  realms: z.array(
    z.object({
      realm: z.string(),
      layers: z.number().int().min(1),
    }),
  ),
  description: z.string().max(300),
  /** 战斗效果；缺省时由 kind/grade 推导（伤害/回复/增益） */
  battle: z
    .object({
      kind: z.enum(['damage', 'heal', 'buff']),
      cost: z.number().int().min(0).max(99),
      power: z.number().min(0).max(99).optional(),
      amount: z.number().int().min(0).max(999).optional(),
      turns: z.number().int().min(1).max(9).optional(),
    })
    .optional(),
})

/** NPC 日程表：时辰名 → [x,y] 点位（V1.3，REDESIGN §6.2） */
export const NpcScheduleSchema = z.record(
  z.enum(SHICHEN_NAMES),
  z.tuple([z.number().int().min(0), z.number().int().min(0)]),
)
export type NpcSchedule = z.infer<typeof NpcScheduleSchema>

export const NpcSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(20),
  title: z.string().optional(),
  regionId: z.string(),
  personality: z.enum(['仁善', '狡诈', '冷傲', '豪爽', '神秘']),
  dialogues: z.array(z.string()).min(1),
  /** 每日日程（V1.3）：时辰名 → [x,y] 点位；空或缺省 = 静态站位（此字段用于 NPC 关键点位移动） */
  schedule: NpcScheduleSchema.optional(),
  /** 目击半径（格）：柳锁行为，如张二在药园盯梢（V1.3 记恨池） */
  watchRadius: z.number().int().min(1).max(12).optional(),
  /** 收礼清单（V2.1 恩仇·送礼）：itemId 列表；玩家持有其一并走进 NPC 即可按 G 赠出（validate 校验存在性） */
  likes: z.array(z.string().regex(/^[a-z0-9_]+$/)).min(1).optional(),
  /** 打探文案（V2.2）：按 H 询问此 NPC 时弹出的情报；缺省自动概括其日程（攻守：日程在实战里可被打探） */
  probe: z.string().min(1).max(120).optional(),
  /** 世界级生命周期（V2.2，REDESIGN §6.2）：NPC 亦修真——随世界历修炼、至寿元大限坐化；缺省 = 剧情锚/不朽 NPC（免疫死亡，§6.1） */
  cultivate: z
    .object({
      /** 境界名（展示用，如 炼气/筑基/结丹） */
      realm: z.string().min(1).max(8),
      /** 开局修炼层数（1 起） */
      level: z.number().int().min(1).max(99),
      /** 修炼上限层数（到顶后停徒修为） */
      cap: z.number().int().min(1).max(99),
      /** 寿元大限（世界年）：自游戏第 1 日计，届满即坐化 */
      lifespanYears: z.number().int().min(40).max(5000),
      /** 每升 1 层所需世界年（缺省 5） */
      growthYears: z.number().int().min(1).max(99).optional(),
    })
    .optional(),
})

export const RegionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(20),
  description: z.string().max(200),
  /** 建议进入的境界带，如 "凡人~炼气" */
  levelBand: z.string().min(1).max(20),
  /** 相邻区域 id 列表（双向对称） */
  adjacent: z.array(z.string()).default([]),
  /** 灵气浓度（打坐恢复倍率）：凡人聚居 1.0，灵山 2.0，洞府灵脉最高 3.0 */
  qiDensity: z.number().min(0.5).max(3).default(1),
  /** 危险度带（V2.3，REDESIGN §5.1/§6.3）：软护栏——不锁门，靠「信息差传闻 + 战败送回安全区」引导；缺省 = 安全区 */
  danger: z
    .object({
      /** 坊间传闻（首次进入的软拦提示文案：妖兽线索/幸存者告诫） */
      intel: z.string().min(1).max(80),
      /** 建议最低境界层数（玩家 level 低于此值 → 入场传闻警示 once + 战败被抬回安全区） */
      levelMin: z.number().int().min(1).max(99),
    })
    .optional(),
})

export const DialogueChoiceSchema = z.object({
  text: z.string().min(1).max(60),
  /** 目标节点 id；null 表示对话结束 */
  next: z.string().nullable().default(null),
})

export const DialogueNodeSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  speaker: z.string().min(1).max(20),
  text: z.string().min(1).max(200),
  /** 缺省或空数组 = 结束节点 */
  choices: z.array(DialogueChoiceSchema).max(9).optional(),
})

export const DialogueSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  npcId: z.string().regex(/^[a-z0-9_]+$/),
  entry: z.string().min(1),
  nodes: z.array(DialogueNodeSchema).min(1).max(50),
})

export const EnemySchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(20),
  description: z.string().max(200),
  stats: z.object({
    hp: z.number().int().min(1),
    atk: z.number().int().min(0),
    def: z.number().int().min(0),
    speed: z.number().int().min(0).max(99),
  }),
  /** 击杀经验；缺省时按 stats 推导 */
  exp: z.number().int().min(0).max(9999).optional(),
  /** 特殊行为：毒伤 DOT / 低血狂暴 */
  special: z.enum(['poison', 'enrage']).optional(),
  /** 掉落表，chance ∈ [0,1] */
  loot: z
    .array(
      z.object({
        item: z.string(),
        chance: z.number().min(0).max(1),
      }),
    )
    .max(6)
    .optional(),
})

export const QuestStepSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('kill'),
    /** 敌人 id（content/enemies） */
    target: z.string(),
    count: z.number().int().min(1),
  }),
  z.object({
    kind: z.literal('talk'),
    /** NPC id（content/npcs） */
    npc: z.string(),
  }),
  z.object({
    kind: z.literal('collect'),
    /** 物品 id（content/items） */
    target: z.string(),
    count: z.number().int().min(1),
  }),
  z.object({
    kind: z.literal('reach'),
    /** 区域 id（content/world） */
    region: z.string(),
  }),
])

/** INV-5：商店（NPC 摊位 wares） */
/** 事件风暴（V1.4，REDESIGN §6.1）：世界条件齐备即触发 → 一次性后果结算 */
export const WorldEventSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(20),
  /** 告发者/主事 NPC id（供文案与图标记；validate 校验存在性） */
  nominee: z.string().regex(/^[a-z0-9_]+$/),
  /** 只触发一次（防刷屏；重复游玩需新档） */
  once: z.boolean().default(true),
  trigger: z
    .object({
      /** 连续旷工日数阈值：lastWorkDay 距今日 ≥ 此值 */
      absentDays: z.number().int().min(1).max(999).optional(),
      /** 记恨来源 NPC id（validate 校验存在性）；与 grudgeAt 成对 */
      grudgeOf: z.string().regex(/^[a-z0-9_]+$/).optional(),
      /** 记恨须严格大于此值（如 grudgeAt=2 表示记恨>2） */
      grudgeAt: z.number().int().min(0).max(100).optional(),
      /** 好感来源 NPC id（V2.1 报恩）；与 affinityAt 成对 */
      affinityOf: z.string().regex(/^[a-z0-9_]+$/).optional(),
      /** 好感须不小于此值（V2.1 报恩阈值，如 affinityAt=40） */
      affinityAt: z.number().int().min(0).max(100).optional(),
    })
    .superRefine((t, ctx) => {
      const conds = [t.absentDays !== undefined, t.grudgeOf !== undefined, t.affinityOf !== undefined]
      if (!conds.some(Boolean)) {
        ctx.addIssue({ code: 'custom', message: 'trigger 至少需要旷工/记恨/好感三者之一作为触发条件' })
      }
      if ((t.grudgeOf !== undefined) !== (t.grudgeAt !== undefined)) {
        ctx.addIssue({ code: 'custom', message: 'grudgeOf 与 grudgeAt 必须成对出现' })
      }
      if ((t.affinityOf !== undefined) !== (t.affinityAt !== undefined)) {
        ctx.addIssue({ code: 'custom', message: 'affinityOf 与 affinityAt 必须成对出现' })
      }
    }),
  consequences: z
    .object({
      /** 扣灵石（正数=扣；clamp≥0） */
      lingshi: z.number().int().min(1).max(99999).optional(),
      /** 赠灵石（V2.1 报恩；正数=赠） */
      grantLingshi: z.number().int().min(1).max(99999).optional(),
      /** 坊市风评变化（负=下降；clamp -100..100） */
      reputation: z.number().int().min(-100).max(100).optional(),
      /** 关系清算（V2.1）：对某 NPC 扭转好感/记恨（寻仇清记恨、报恩还人情） */
      relations: z
        .object({
          npcId: z.string().regex(/^[a-z0-9_]+$/),
          affinityDelta: z.number().int().min(-100).max(100).optional(),
          grudgeDelta: z.number().int().min(-100).max(100).optional(),
        })
        .optional(),
    })
    .superRefine((c, ctx) => {
      const effects = [
        c.lingshi !== undefined,
        c.grantLingshi !== undefined,
        c.reputation !== undefined,
        c.relations !== undefined,
      ]
      if (!effects.some(Boolean)) {
        ctx.addIssue({ code: 'custom', message: 'consequences 至少需要一项效果' })
      }
    }),
  /** 触发文案（≤200 字，古典白话；{npc} 会被替换为告发者名） */
  toast: z.string().min(1).max(200),
  /** 触发后追加的系统提示 */
  after: z.string().min(1).max(100).optional(),
})

export type WorldEvent = z.infer<typeof WorldEventSchema>

export const ShopSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(30),
  wares: z
    .array(z.object({ item: z.string().regex(/^[a-z0-9_]+$/), price: z.number().int().min(1) }))
    .min(1)
    .max(24),
})

export type Shop = z.infer<typeof ShopSchema>

/** INV-4：炼丹配方（inputs → output） */
export const RecipeSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(30),
  inputs: z
    .array(z.object({ item: z.string().regex(/^[a-z0-9_]+$/), count: z.number().int().min(1) }))
    .min(1)
    .max(6),
  output: z.object({
    item: z.string().regex(/^[a-z0-9_]+$/),
    count: z.number().int().min(1),
  }),
  description: z.string().max(120),
})

export type Recipe = z.infer<typeof RecipeSchema>

export const QuestSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(40),
  type: z.enum(['main', 'side', 'daily', 'hidden']),
  /** 发布任务的 NPC id */
  giver: z.string(),
  prerequisites: z
    .object({
      realm: z.string().optional(),
      quests: z.array(z.string()).default([]),
    })
    .default({}),
  steps: z.array(QuestStepSchema).min(1).max(12),
  rewards: z
    .object({
      lingshi: z.number().int().min(0).default(0),
      items: z.array(z.string()).default([]),
      exp_qi: z.number().int().min(0).default(0),
    })
    .default({}),
})

/** 地图字符图例（DSL 契约，WorldScene 与 validate 共用） */
export const TILE_LEGEND = {
  '.': '草地',
  ',': '小路',
  '~': '水面',
  T: '树（障碍）',
  '#': '墙/栅栏（障碍）',
  H: '房屋（障碍）',
  B: '桥',
  F: '花草',
  D: '门户/传送点',
} as const

export type TileChar = keyof typeof TILE_LEGEND

const TILE_CHARS = Object.keys(TILE_LEGEND) as TileChar[]

/** 可行走字符（其余为障碍或不可进入） */
export const WALKABLE_TILE_CHARS: ReadonlySet<string> = new Set(['.', ',', 'B', 'F', 'D'])

export const MapPortalSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  to: z.object({
    map: z.string().regex(/^[a-z0-9_]+$/),
    x: z.number().int().min(0),
    y: z.number().int().min(0),
  }),
  label: z.string().min(1).max(12),
  // V2.3 章节锁已删（全图可达，改危险度带软拦）：lockQuest/lockHint 不得再出现在地图传送点上
})

export const MapNpcPlacementSchema = z.object({
  npcId: z.string().regex(/^[a-z0-9_]+$/),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
})

export const MapEnemySpawnSchema = z.object({
  enemyId: z.string().regex(/^[a-z0-9_]+$/),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  /** 游荡半径（像素） */
  radius: z.number().int().min(16).max(512).default(96),
})

// ==== gfx-scene：场景道具（B2）====
export const PROP_TYPES = ['lantern', 'well', 'signpost', 'fence', 'stall'] as const

export const MapPropSchema = z.object({
  type: z.enum(PROP_TYPES),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
})

// ==== 2.0 采集点（V1.2，REDESIGN §5.1：采集→炼丹→交易 教学闭环）====
export const MapGatherPointSchema = z.object({
  /** 全局唯一点 id（同一图内），用于世界快照记录再生进度 */
  id: z.string().regex(/^[a-z0-9_]+$/),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  /** 产出物 id（content/items），须为 material 类 */
  itemId: z.string().regex(/^[a-z0-9_]+$/),
  /** 采集消耗时辰（锚：基础 1，珍稀类更贵配更慢再生） */
  cost: z.number().int().min(1).max(8).default(1),
  /** 再生周期（时辰），锚 REDESIGN "regen 3日"=24 时辰 */
  regen: z.number().int().min(1).max(480).default(24),
  /** 交互提示文案（≤16 字，供 HUD/采集点提示） */
  label: z.string().min(1).max(16),
})

export const GameMapSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/),
    /** 区域名，进场横幅展示 */
    name: z.string().min(1).max(20),
    width: z.number().int().min(8).max(200),
    height: z.number().int().min(8).max(200),
    rows: z.array(z.string()).min(8).max(200),
    spawn: z.object({ x: z.number().int().min(0), y: z.number().int().min(0) }),
    portals: z.array(MapPortalSchema).max(12).default([]),
    npcPlacements: z.array(MapNpcPlacementSchema).max(20).default([]),
    enemySpawns: z.array(MapEnemySpawnSchema).max(20).default([]),
    props: z.array(MapPropSchema).max(40).default([]),
    /** 2.0 采集点：采集→炼丹→交易 教学闭环（V1.2） */
    gather: z.array(MapGatherPointSchema).max(24).default([]),
    /** 可选：对应 content/world 区域 id，进入地图时随 area:enter 上报（任务 reach 目标用） */
    regionId: z.string().regex(/^[a-z0-9_]+$/).optional(),
  })
  .superRefine((m, ctx) => {
    const w = m.rows[0]?.length ?? -1
    if (m.rows.some((r) => r.length !== w)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'rows 行宽不一致' })
    }
    if (w !== m.width || m.rows.length !== m.height) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'width/height 与 rows 尺寸不符' })
    }
    const chars = new Set<string>(TILE_CHARS)
    m.rows.forEach((row, y) =>
      row.split('').forEach((c, x) => {
        if (!chars.has(c)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `非法图例字符 "${c}" @ (${x},${y})` })
        }
      }),
    )
    const inBounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < m.width && y < m.height
    ;[m.spawn, ...m.portals.map((p) => ({ x: p.x, y: p.y })), ...m.npcPlacements, ...m.props, ...m.gather].forEach((p) => {
      if (!inBounds(p.x, p.y)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `坐标 (${p.x},${p.y}) 越界` })
      }
    })
  })

export type MapPortal = z.infer<typeof MapPortalSchema>
export type MapGatherPoint = z.infer<typeof MapGatherPointSchema>
export type GameMap = z.infer<typeof GameMapSchema>

export type Item = z.infer<typeof ItemSchema>
export type Enemy = z.infer<typeof EnemySchema>
export type Skill = z.infer<typeof SkillSchema>
export type ItemGradeValue = z.infer<typeof ItemGrade>
export type GongfaGradeValue = z.infer<typeof GongfaGrade>
export type Npc = z.infer<typeof NpcSchema>
export type Region = z.infer<typeof RegionSchema>
export type Dialogue = z.infer<typeof DialogueSchema>
export type DialogueNode = z.infer<typeof DialogueNodeSchema>
export type DialogueChoice = z.infer<typeof DialogueChoiceSchema>
export type Quest = z.infer<typeof QuestSchema>
export type QuestStep = z.infer<typeof QuestStepSchema>
