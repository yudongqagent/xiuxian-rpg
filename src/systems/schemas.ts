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

export type Item = z.infer<typeof ItemSchema>
export type Skill = z.infer<typeof SkillSchema>
export type ItemGradeValue = z.infer<typeof ItemGrade>
export type GongfaGradeValue = z.infer<typeof GongfaGrade>
export type Npc = z.infer<typeof NpcSchema>
export type Region = z.infer<typeof RegionSchema>
