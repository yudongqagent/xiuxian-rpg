import { z } from 'zod'

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

export const NpcSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(20),
  title: z.string().optional(),
  regionId: z.string(),
  personality: z.enum(['仁善', '狡诈', '冷傲', '豪爽', '神秘']),
  dialogues: z.array(z.string()).min(1),
})

export const RegionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(20),
  description: z.string().max(200),
  /** 建议进入的境界带，如 "凡人~炼气" */
  levelBand: z.string().min(1).max(20),
  /** 相邻区域 id 列表（双向对称） */
  adjacent: z.array(z.string()).default([]),
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
    ;[m.spawn, ...m.portals.map((p) => ({ x: p.x, y: p.y })), ...m.npcPlacements].forEach((p) => {
      if (!inBounds(p.x, p.y)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `坐标 (${p.x},${p.y}) 越界` })
      }
    })
  })

export type MapPortal = z.infer<typeof MapPortalSchema>
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
