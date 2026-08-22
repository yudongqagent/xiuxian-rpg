# 内容创作指南（Content Authoring）

> 面向所有往 `content/` 添加数据的人（和 AI）。
> 流程：读本文 → 对照 schema → 写 JSON → `npm run validate` → 提交。

---

## 1. 通用规则

- **一个对象一个文件**：`content/<类型>/<id>.json`，文件名 = id
- id 用 snake_case、全局唯一、只含 `[a-z0-9_]`（schema 强制）
- 所有文本字段有 `.max()` 上限——超限即校验失败，不要绕过
- 引用其他对象一律用其 id 字符串（如 `"npc": "mo_dafu"`），并确认目标存在
- 文风遵循 DESIGN_PRINCIPLES.md §C 与 GDD 附录 A

## 2. 物品 `content/items/`

Schema 见 `systems/schemas.ts` 的 `ItemSchema`。要点：

| 字段 | 说明 |
|---|---|
| type | weapon / armor / consumable / material |
| grade | 凡品→法器→灵器→法宝→灵宝→仙器 |
| stats | atk/def/hp，按品阶给值（见 §6 数值锚点） |
| effect | 仅 consumable 需要；qi 为负表示毒副作用 |

**新增一件武器 checklist**：id 唯一 ✓ 名称≤20字 ✓ 描述≤200字且合文风 ✓ stats 符合品阶锚点 ✓

## 3. 功法 `content/skills/`

- kind：心法/剑诀/身法/炼体/神通
- realms 数组只列**可修炼的境界**（层数 ≥1），未开放境界直接不写该条目
- 心法描述需包含修炼感受描写一句（增强沉浸）

## 4. NPC `content/npcs/`

- regionId 必须指向已存在的区域（区域系统 M1 落地后加入校验）
- dialogues 至少 1 条；首条是初次见面语
- personality 决定任务对话语气，写对话前回看性格枚举

## 5. 任务 `content/quests/`（M1 起）

```jsonc
{
  "id": "qs_caixia_wolf",
  "name": "彩霞山的狼患",
  "type": "side",                    // main | side | daily | hidden
  "giver": "mo_dafu",                // 必须存在的 npc id
  "prerequisites": { "realm": "炼气3层", "quests": [] },
  "steps": [
    { "kind": "kill",   "target": "mob_gray_wolf", "count": 5 },
    { "kind": "talk",   "npc": "mo_dafu" },
    { "kind": "collect", "target": "item_id", "count": 3 },
    { "kind": "reach",  "region": "caixia_shan" }
  ],
  "rewards": { "lingshi": 50, "items": ["huiqi_san"], "exp_qi": 100 }
}
```

主线(id 前缀 `qm_`)必须挂进 GDD §6 十章大纲的对应章节。

## 6. 数值锚点（拍板基准，禁止越级跳档）

以"炼气一层·裸装·凡剑"攻击力 = **10** 为锚：

| 品阶 | 武器 atk 区间 | 备注 |
|---|---|---|
| 凡品 | 1~10 | 铁剑、木棍 |
| 法器 | 20~60 | 炼气期主力 |
| 灵器 | 100~300 | 筑基期 |
| 法宝 | 500~1500 | 结丹期 |
| 灵宝 | 3000+ | 元婴及以上，剧情限定 |

- 丹药回复量 ≈ 当前境界灵气上限的 15%~30%
- 大境界战力差约 ×8~10——越级挑战只能靠功法克制与丹药堆砌
- 改动本表须先改 GDD 并在提交信息注明 `balance:`

## 7. 批量产内容的工作流（AI 场景）

1. 一次批量 ≤ 30 条，同一类型
2. 生成后立即跑 `npm run validate`
3. 抽查 10% 文案质量（文风、重复度）
4. 提交信息示例：`content: 新增黄枫谷坊市货架物品 24 件`

## 8. 校验失败排查

| 报错 | 常见原因 |
|---|---|
| `too_small / too_big` | 数值超出 schema 上下限（如层数 0） |
| `invalid_string(regex)` | id 含大写/连字符/中文 |
| `unrecognized_keys` | 字段名拼错或多写了未定义字段 |
| 引用断裂（后续加入） | 引用的 item/npc id 不存在或已改名 |
