import { z } from 'zod'

/** 所有 content/ 下数据的契约。AI 生成新内容必须符合 schema，CI 自动校验。 */

export const Grade = z.enum([
  '凡品',
  '法器',
  '灵器',
  '法宝',
  '灵宝',
  '仙器',
])

export const ItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(20),
  type: z.enum(['weapon', 'armor', 'consumable', 'material']),
  grade: Grade,
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
  grade: Grade,
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

export type Item = z.infer<typeof ItemSchema>
export type Skill = z.infer<typeof SkillSchema>
export type Npc = z.infer<typeof NpcSchema>
