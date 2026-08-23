# 全项目开发与测试追踪器（TRACKER）

> 建立日期：2026-08-22 · 维护规则：**每完成一项立即更新状态与证据列**
> 目标：按 GDD §11 里程碑交付完整游戏，所有模块均有对应测试门禁并通过
> 状态图例：✅ 完成且已验证 · 🚧 进行中（分支名） · ⬜ 未开始 · ❌ 受阻/待决

---

## 一、验证门禁（所有 ✅ 的前提）

| 门禁 | 命令 | 说明 |
|---|---|---|
| G1 内容校验 | `npm run validate` | zod schema + 跨引用完整性（物品/功法/人物/区域/妖兽/对话/任务/地图） |
| G2 类型检查+构建 | `npm run build` | vue-tsc 严格类型检查 + vite 生产构建 |
| G3 战斗逻辑单测 | `npm run check:combat` | 纯函数战斗系统回归（数值锚点、DOT、怒气、掉落等） |
| G4 本地 E2E | `node scripts/qa-local.mjs` | Playwright 无头浏览器全流程：启动/HUD/渲染/移动/对话/战斗/地图切换/存读档 |
| G5 线上 QA | `node scripts/qa-live.mjs [--force]`（qa-automation 工作树） | 部署后线上冒烟，输出 test-result.md |
| G6 发布流程 | push main → CI → GitHub Pages | 校验失败禁止部署 |

> G4 于 M1 集成期落地为仓库脚本；落地前以临时 Playwright 脚本执行同等检查。

---

## 二、模块追踪矩阵

### A. 引擎层 `src/engine/`

| ID | 模块项 | 里程碑 | 状态 | 验证 | 证据/分支 |
|---|---|---|---|---|---|
| ENG-1 | Phaser 初始化（RESIZE 自适应 + Arcade 物理） | M0 | ✅ | G2/G4 | main |
| ENG-2 | 类型安全事件总线（Vue↔Phaser 唯一通道） | M0 | ✅ | G2/G4 | main |
| ENG-3 | IndexedDB 存档 + 5s 自动保存 + 启动恢复 | M0 | ✅ | G4/G5 | main |
| ENG-4 | 存档向后兼容扩展（mapId / player 成长字段） | M1 | 🚧 world-maps + combat-depth | G3/G4 | 两分支均 additive 可选字段 |
| ENG-5 | 多存档位 ×3 + 手动存档 UI（存档面板/读取淡入恢复） | M2 | ✅（提前交付） | G4 | feat-saves：s1-s3 保存/读取 E2E 实测，meta 含时间·境界·地图 |
| ENG-6 | 导出存档码 / 导入（XJ1 三段式 + djb2 校验，防篡改） | M2 | ✅（提前交付） | G3/G4 | feat-savecode：编解码单测 5 项 + E2E 导出/篡改拒绝/导入实测 |
| ENG-7 | PWA（离线缓存、添加到主屏） | M4 | ⬜ | G6 | — |

### B. 图形与表现层 `src/scenes/` `src/systems/mapTiles*`

| ID | 模块项 | 里程碑 | 状态 | 验证 | 证据/分支 |
|---|---|---|---|---|---|
| GFX-1 | 程序化基础贴图（草/路/水/树/玩家/NPC） | M0 | ✅ | G4 | main |
| GFX-2 | 世界渲染无黑屏（tilemap 修复） | M0 | ✅ | G5 | fix-tilemap-layer 已发布 |
| GFX-3 | 角色 4 方向行走动画帧 | M1 | ✅ | G4 截图比对 | rich-graphics@3eba309 已并入 |
| GFX-4 | 动态环境（水面波光/树摇/传送门脉冲/尘土粒子） | M1 | ✅ | G4 截图+像素比对 | 同上 |
| GFX-5 | 场景装饰物（房屋/桥/墙）与区域色调氛围+暗角 | M1 | ✅ | G4/G5 | world-maps + rich-graphics |
| GFX-6 | 区域进入横幅 + 平滑过场淡入淡出 | M1 | ✅ | G4 | qa-local 12/12 |
| GFX-7 | 音效/BGM（含战斗音） | M4 | ⬜ | G5 抽查 | — |

### C. 世界与地图 `content/maps/` `src/systems/maps.ts`

| ID | 模块项 | 里程碑 | 状态 | 验证 | 证据/分支 |
|---|---|---|---|---|---|
| MAP-1 | 地图 JSON DSL + schema + 校验（行走性/portal/引用） | M1 | ✅ | G1/G4 | world-maps@a943bd8 |
| MAP-2 | 七玄门山村（新手村）手作地图 | M1 | ✅ | G1/G4 | world-maps |
| MAP-3 | 小径山道（连接图） | M1 | ✅ | G1/G4 | world-maps |
| MAP-4 | 密林妖谷（妖兽区） | M1 | ✅ | G1/G4 | world-maps |
| MAP-5 | portal 场景切换 + 出生点定位 + 存档恢复地图 | M1 | ✅ | G4 | qa-local 12/12 |
| MAP-6 | Tiled 编辑器导入管线 | M1+ | ⬜（JSON DSL 先行替代） | G1 | — |
| MAP-7 | 人界篇全域地图量产（10+ 区域） | M3 | ⬜（region 数据已有，地图待做） | G1/G4 | 31e3db3 提供 region |

### D. NPC 与对话 `src/systems/dialogues.ts` `src/ui/DialogueBox.vue`

| ID | 模块项 | 里程碑 | 状态 | 验证 | 证据/分支 |
|---|---|---|---|---|---|
| DIA-1 | 对话树 JSON DSL + zod schema + 校验 | M1 | ✅ | G1 | npc-dialogue 已并入 main |
| DIA-2 | NPC 交互（E 键/点击 + 距离提示） | M1 | ✅ | G4 | 同上 |
| DIA-3 | 对话浮层（选项/继续/键盘操作） | M1 | ✅（修复响应式缺陷后） | G4 | main @81a94ef |
| DIA-4 | 对话内容量产（全部可交互 NPC 有对话） | M3 | 🚧 村庄 4 NPC + 山道老人已绑定，其余待地图铺开 | G1/G4 | world-maps |

### E. 战斗系统 `src/systems/combat.ts` `src/ui/BattlePanel.vue`

| ID | 模块项 | 里程碑 | 状态 | 验证 | 证据/分支 |
|---|---|---|---|---|---|
| CBT-1 | 回合制核心（攻/法术/逃跑、速度先手、GDD 攻10 锚点） | M1 | ✅ | G3 | turn-combat 已并入 main |
| CBT-2 | 战斗触发（妖兽游荡接触）+ 战斗面板 UI | M1 | ✅（修复 Proxy/structuredClone 缺陷后） | G3/G4 | main @81a94ef |
| CBT-3 | 功法技能实装（品阶威力档位、回复/增益类） | M1 | ✅ | G3 | combat-depth@312d311，46/46 单测 |
| CBT-4 | 战斗中用物品（消耗品回血回灵） | M1 | ✅ | G3 | 同上 |
| CBT-5 | 妖兽多样性 + Boss（怒气机制）+ 掉落表 | M1 | ✅ | G1/G3 | 山魈/毒蛛(中毒DOT)/野猪王(狂暴)+掉落 |
| CBT-6 | 经验/升级成长曲线 + 境界显示联动 HUD | M2 | ✅（提前交付） | G3/G4 | expToNext=30+(lvl-1)×20，HUD 境界联动 |
| CBT-7 | 异常状态（毒蛛中毒 DOT） | M2 | ✅（提前交付） | G3 | 同上 |
| CBT-8 | 连携技（攻击后接法术 ×1.5 威力，物品/逃跑打断，战斗面板连携就绪提示） | M3 | ✅（提前交付） | G3 | feat-combo：6 项单测 + 面板动效 |

### F. 任务系统 `content/quests/`

| ID | 模块项 | 里程碑 | 状态 | 验证 | 证据/分支 |
|---|---|---|---|---|---|
| QST-1 | 任务 schema（主线 qm_/支线 qs_）+ 16 条内容校验 | M1 | ✅ | G1 | main 31e3db3 |
| QST-2 | 任务运行时（接取/进度/完成/奖励状态机） | M1 | ✅ | G3 | quest-engine@2b59ceb，check:quest 40/40 |
| QST-3 | 触发器接线（对话/击杀/采集/到达 → 进度事件） | M1 | ✅ | G4 | bus 触发统一队列 |
| QST-4 | 任务日志 UI（三 Tab）+ HUD 追踪条 + toast | M1 | ✅ | G4 | qa-local 实测接取 qm_01 |
| QST-5 | 主线前六章链路校验（前置环环相扣） | M1 | ✅（E2E 覆盖首章；二~六章待内容地图后全通） | G3/G4 | check:quest 链路用例 |
| QST-6 | 四章主线 + 30 支线内容量产 | M3 | 🚧 内容池已扩充（16 条），持续补充 | G1 | 31e3db3 |

### G. 物品/背包/装备/炼丹 `InventoryPanel.vue` `systems/player.ts`

| ID | 模块项 | 里程碑 | 状态 | 验证 | 证据/分支 |
|---|---|---|---|---|---|
| INV-1 | 储物袋面板骨架（假数据双 Tab） | M0 | ✅ | G4 | main |
| INV-2 | 真实背包接入（掉落/奖励入包 + 存档持久化） | M2 | ✅（提前交付核心） | G3 | player.inventory + item:acquired |
| INV-3 | 装备栏（武器/防具 → 属性加成） | M2 | ✅（提前交付） | G3/G4 | feat-equip：穿着/卸下/存档兼容，8 项单测 + E2E 实测攻10→16 |
| INV-4 | 炼丹配方与炼丹界面（配方 schema+校验、纯函数合成、背包炼丹 Tab） | M2 | ✅（提前交付） | G1/G3/G4 | feat-alchemy：2 丹方，7 项单测，E2E 实测炼制/缺料标红 |
| INV-5 | 商店/坊市买卖（金光商人摊位：购入/五折卖出/灵石货币） | M3 | ✅（提前交付） | G1/G3/G4 | feat-shop：4 项单测 + E2E 买卖/互斥面板/Esc 关闭 |

### H. 内容数据 `content/`

| ID | 模块项 | 里程碑 | 状态 | 验证 | 证据/分支 |
|---|---|---|---|---|---|
| DAT-1 | 示例四件套 + 六大区域扩充 | M0/M1 | ✅ | G1 | 467d435 |
| DAT-2 | 人界篇大扩充（10 区域/8NPC/5功法/11物品/9妖兽/16任务） | M1/M3 | ✅ | G1 | 31e3db3 |
| DAT-3 | 妖兽图鉴数值平衡（对照 GDD 锚点） | M2 | ✅ 首批 4 只入档（灰狼/铁背狼/野狼帮众/雾影莽），持续补充 | G1/G3 | combat-depth + 31e3db3 |
| DAT-4 | 内容量产收尾（30 支线/四章主线全量） | M3 | ⬜ | G1 | — |

### I. QA 与工程管线

| ID | 模块项 | 里程碑 | 状态 | 验证 | 证据/分支 |
|---|---|---|---|---|---|
| QA-1 | validate 管线拦截非法内容 | M0 | ✅（曾实际拦截 1 次） | G1 | 4081b8b |
| QA-2 | CI：校验→构建→GitHub Pages 部署 | M0 | ✅ | G6 | bb43598 |
| QA-3 | 本地 E2E 脚本入库 `scripts/qa-local.mjs`（12 检查项） | M1 | ✅ | G4 | release-m1@bde70f8，`npm run qa:local` 12/12 |
| QA-4 | 线上 QA 自动化 + 版本去重 | M0+ | ✅ | G5 | qa-automation 工作树 |
| QA-5 | 性能预算（首屏 JS gzip ≤420KB，60fps 移动端） | M4 | ✅ 首屏 gzip 65KB（全量 422KB 按需） | G2/G5 | perf-codesplit 实测 |
| QA-6 | 引擎懒加载：点击「开始游戏」后动态 import Phaser | M2 | ✅（提前交付） | G2/G4 | game+phaser 转为按需 chunk，qa-local 13/13 |

---

## 三、里程碑总览（对齐 GDD §11）

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0 骨架 | 引擎/UI 覆盖层/存档/内容管线/CI | ✅ 已发布（线上 QA 8/8） |
| M1 可玩垂直切片 | 多地图世界+对话+战斗+任务链+存档 UI | ✅ 四分支已集成，G1–G4 全绿（ENG-5 多存档位除外，移 M2） |
| M2 成长闭环 | 背包实装/装备/炼丹/修炼突破 | ⬜（combat-depth 已铺垫成长系统） |
| M3 内容量产 | 三大区域+四章主线+30 支线+坊市 | ⬜（数据池先行扩充至人界篇） |
| M4 公测版 | PWA+音效+调优+itch.io 发布 | ⬜ |

---

## 四、集成与发布记录

| 日期 | 动作 | 结果 |
|---|---|---|
| 2026-08-22 | fix-tilemap-layer 发布 | 线上崩溃修复，QA 8/8（index-CletcCPk.js） |
| 2026-08-22 | 并入 unify-grade-system / npc-dialogue / turn-combat；修 DialogueBox 响应式 + BattlePanel Proxy 克隆缺陷 | 发布 index-2RV9EKdU.js，QA 8/8 |
| 2026-08-22 | main 收到外部内容扩充 31e3db3（未推送，随下次发布带出） | validate 通过 |
| 2026-08-22 | 建立 TRACKER；启动 quest-engine / rich-graphics；集成 world-maps / combat-depth | 见后续记录 |

| 2026-08-22 | bugfix-gameplay：修复无对话 NPC 软锁 / 逃跑贴身重入战斗 / 对话中触发战斗；对话面板 ✕/Esc 关闭 | 已并入 |
| 2026-08-22 | release-gfx 并入 gfx-scene + gfx-battle-ui（TRACKER-GFX 全部 13 项 ✅）；qa-local 升级 13 项 13/13；新增标题画面与对话头像等 | 已发布 |

| 2026-08-22 | perf-codesplit：Phaser 懒加载落地，首屏 gzip 65KB；qa-local 适配重载流程 13/13 | 已发布 |

| 2026-08-22 | hotfix-battle：修复遭遇铁背狼/雾影莽/野狼帮众必软锁（模板全量化+兜底）；防御三层（bus 单处理器隔离 / battle:opened 确认 + 1.5s 看门狗强制解锁 / 战斗与转场期间暂停自动存档）；对抗性 playtest 报告 10 项发现全部入库 | 已发布 |

### 对抗性 playtest 发现（2026-08-22，生产环境实测）

| ID | 严重度 | 问题 | 状态 |
|---|---|---|---|
| PT-1 | critical | 遭遇未登记妖兽即软锁（BattlePanel 手工注册表缺 3 只） | ✅ hotfix-battle |
| PT-2 | critical | qm_01 第一步 NPC 岳堂主无地图摆放，主线死锁 | ✅ 村内(17,14) 入位，E2E 实测交谈推进到收集步 |
| PT-3 | major | 水面可行走（'~' 无碰撞体） | ✅ 隐形静态体阻挡（桥保留），E2E 实测被挡 |
| PT-4 | major | 七叶灵草无可获取来源（毒蛛不在任何地图刷新） | ✅ 山道补 毒蛛×2（40% 掉落） |
| PT-5 | minor | 任务面板被对话面板遮挡（z-order） | ✅ 面板 z-index 30 |
| PT-6 | minor | 切窗后按键状态残留（blur 未清键） | ✅ blur/visibilitychange 清空输入 |
| PT-7 | minor | 战斗中重载→落点即再入战斗（自动存档暂停已缓解） | ✅ 缓解(hotfix) |
| PT-8 | minor | 逃跑成功需二次点击且击退过远 | ✅ 0.7s 自动收面板 + 击退减半 |
| PT-9 | nit | 宽屏下地图右缘露天空隙 | ✅ 相机 zoom 铺满（resize 自适应） |
| PT-10 | nit | 简报笔误 五叶/七叶灵草 | ✅ 文档层面 |

| 2026-08-22 | fix-progression：PT-2/3/4/5/6/8 修复；顺带修任务引擎缺陷——中途步骤推进不发 quest:updated 导致追踪条/日志停留旧文本 | 已发布 |

| 2026-08-22 | feat-saves：ENG-5 三手动档+存档面板；PT-9 相机铺满修复 | 已发布 |

| 2026-08-22 | feat-equip：INV-3 装备系统落地（含起始铁剑教学），战斗/HUD/背包全链路接入 | 已发布 |

| 2026-08-22 | feat-savecode：ENG-6 存档码导出/导入落地（面板导出码+按档位导入，校验防篡改） | 已发布 |

| 2026-08-22 | feat-alchemy：INV-4 炼丹落地（配方 DSL+校验+合成 Tab）；M2 全部完成 | 已发布 |

| 2026-08-22 | feat-shop：INV-5 坊市落地（灵石货币/买卖/商贩入村/面板互斥与 Esc）；修复对话无选项节点时商店按钮不显示 | 已发布 |

| 2026-08-22 | feat-regions：地图 DSL 增加 regionId 并随 area:enter 上报——qm_02「抵达彩霞山脉」可达，主线第二章节链路打通；山道瀑布点亮 GFX2-B4 | 已发布 |

| 2026-08-22 | feat-combo：CBT-8 连携技落地（combat 纯函数 + 面板提示）；系统类条目全部完成，剩余为内容量产 | 已发布 |

> 集成约定：功能分支一律从最新 main 切出；集成在 release-* 工作树完成，冲突解决后跑满 G1–G4 再快进 main 发布。

| 2026-08-22 | release-m1 集成四分支：world-maps→combat-depth→quest-engine→rich-graphics；修 5 处冲突 + 3 处集成缺陷（validate 地图块丢失、WorldScene 括号、area:enter 可选 regionId）；qa-local.mjs 入库并 12/12 通过 | 待发布 |
