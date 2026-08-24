# 凡人仙途（xiuxian-rpg）

修仙题材开放世界 RPG · 移动浏览器优先 · 纯静态部署

## 快速开始

```bash
npm install
npm run dev          # 手机与电脑同一 WiFi 下，用手机访问终端显示的地址即可试玩
npm run validate     # 内容校验（zod schema + 跨引用完整性）
npm run build        # 类型检查 + 生产构建 → dist/
npm run check:combat # 战斗/装备/存档码纯函数回归（79 项）
npm run check:quest  # 任务引擎回归（46 项）
npm run qa:local     # Playwright 本地 E2E 全流程（14 项，需先 build）
npm run pack:itch    # 打包 itch.io HTML5 上传包
```

## 在线试玩

**https://yudongqagent.github.io/xiuxian-rpg/**（push 到 `main` 后 CI 自动 校验→构建→部署 GitHub Pages；支持 PWA 离线与添加主屏）

## 打包 itch.io

```bash
npm run build && npm run pack:itch   # 产出 release/xiuxian-rpg-itch.zip
# 上传：itch.io → View page → Edit game → HTML5 upload
```

## 游戏内容（公测版）

- **六章主线**（神手谷拜师 → 正魔之战 → 洞府传承）：七张互通地图、境界门槛炼气→筑基全通
- **16 条支线**：材料收集/讨伐/寻人，来源与 NPC 全部可及
- **回合战斗**：攻击/功法/物品/逃跑，连携技（攻击后法术 ×1.5）、妖兽仇恨追击、Boss 怒气、掉落
- **成长**：经验升级（炼气→筑基）、装备穿脱、炼丹合成、坊市买卖（灵石）
- **系统**：三手动档+自动档、存档码导出导入、打坐吐纳、任务日志与追踪、PWA 离线、程序化音画

## 文档索引（开发前必读顺序）

| 文档 | 内容 |
|---|---|
| [docs/GDD.md](docs/GDD.md) | 游戏设计文档：玩法、境界、剧情、里程碑 |
| [docs/DESIGN_PRINCIPLES.md](docs/DESIGN_PRINCIPLES.md) | 设计支柱与工程取舍准则、冲突裁决 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 分层架构、数据流、事件总线契约、ADR |
| [docs/CODING_GUIDELINES.md](docs/CODING_GUIDELINES.md) | TS/Vue/Phaser 编码规范、性能红线 |
| [docs/CONTENT_AUTHORING.md](docs/CONTENT_AUTHORING.md) | content/ 数据创作指南与数值锚点 |
| [docs/PROGRESS.md](docs/PROGRESS.md) | 开发进度与技术债清单 |

## 目录结构

```
src/
  engine/    Phaser 初始化、事件总线、存档(IndexedDB)
  scenes/    游戏场景（Boot 程序化贴图 / World 多地图 / fx 视觉动效）
  ui/        Vue 覆盖层（HUD、摇杆、背包、炼丹、战斗、对话、任务、商店、存档）
  systems/   纯函数系统（combat/player/quests/alchemy/maps/shop）+ zod schemas
content/     游戏数据（物品/功法/NPC/妖兽/地图/对话/任务/配方/商店），一物一 JSON 文件
scripts/     内容完整性校验脚本
docs/GDD.md  游戏设计文档 ★ 先读这个再写代码
```

## AI 协作约定

1. 新增内容前先更新 `systems/schemas.ts`
2. 内容一律放 `content/`，一个对象一个文件，id 用 snake_case
3. 提交前跑 `npm run validate && npm run build`
4. 文风遵循 GDD 附录 A 术语表
