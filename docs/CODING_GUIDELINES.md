# 编码规范（Coding Guidelines）

> 适用所有 TS/Vue 代码。AI 生成代码同样必须遵守，review 时逐条对照。

---

## 1. 语言与风格

- TypeScript `strict` 模式，**禁止 any**（确需时用 `unknown` + 收窄，并注释原因）
- 优先 `const`、箭头函数、解构；导出用具名导出，不用 default export（除 Vue SFC 与场景类）
- **禁止注释**——代码自解释。命名即文档：`calcBreakthroughChance()` 而非 `doCalc()`
- 魔数必须提为常量并集中在使用模块顶部：

```ts
const TILE = 32
const PLAYER_SPEED = 160
```

## 2. 命名约定

| 对象 | 规则 | 示例 |
|---|---|---|
| 文件 | 场景=大驼峰，其余=小驼峰 | `WorldScene.ts` / `save.ts` |
| 类型/类/枚举 | 大驼峰 | `SaveData` |
| 函数/变量 | 小驼峰，动词开头 | `loadSave()` |
| 常量 | 全大写下划线 | `MAX_QI` |
| content id | snake_case，全局唯一 | `qingyun_jian` |
| 事件名 | `<来源>:<动作>` | `joystick:move` |

## 3. 模块边界（详见 ARCHITECTURE.md §1）

- UI 不 import Phaser；Scenes 不操作 DOM
- 跨层通信只走 `bus`；新增事件先在 `GameEvents` 补类型
- `systems/` 内函数尽量纯函数：`(input) => output`，副作用集中到调用方

## 4. Vue 组件规范

- 一律 `<script setup lang="ts">` + scoped style
- props 用 `defineProps<{...}>()` 类型式声明；事件 `defineEmits`
- 订阅 bus 的组件必须在 `onUnmounted` 解绑
- 样式单位：布局用 px+flex 即可，安全区必加 `env(safe-area-inset-*)`

## 5. Phaser 场景规范

- 贴图/资源加载只在 BootScene 或各场景 `preload`
- 事件订阅收集进数组，`shutdown` 统一解绑：

```ts
this.unsubs.push(bus.on('joystick:move', ...))
this.events.on('shutdown', () => this.unsubs.forEach((u) => u()))
```

- 定时器/补间随场景销毁自动清理，不手动 stop
- 手感参数（补间时长/屏震幅度/受击闪白等）必须提为常量并集中在使用模块顶部，
  与魔数同规则（§1）——这是调参的入口，禁止内联字面量

## 6. 数据与校验

- 新内容类型 → 先写 zod schema（含 `.max()` 上限防 AI 失控长文）→ 再造数据
- 运行时消费外部数据前必须 `.parse()`，parse 结果类型直接 `z.infer`
- 禁止在业务代码里手写数据结构字面量冒充 content 数据

## 7. Git 与提交

- 提交信息：`type: 摘要`，type ∈ feat/fix/refactor/docs/chore/content
- 内容数据改动用 `content:` 前缀，如 `content: 新增彩霞山狼群遭遇表`
- 每次提交 CI 必须全绿；红着不许 merge
- PROGRESS.md 随里程碑节点更新，日常小改动不必

## 8. 性能红线（移动端）

| 项 | 上限 |
|---|---|
| 单张图片 | 100KB |
| 首屏 JS (gzip) | 400KB |
| 单帧 drawcall 关注值 | 100+ 时必须合图 |
| 同屏定时器 | 尽量合并（如坐标上报 250ms 一个） |

## 9. 测试策略与完成定义

- `npm run validate` 覆盖内容正确性（schema + 引用完整性）
- systems 层纯函数逐步补充 vitest 单测（战斗公式、突破概率优先）
- 玩法回归用 `node scripts/qa-local.mjs` 场景脚本：headless 浏览器 +
  模拟输入驱动真实游戏状态断言。**新增玩法特性必须补一个对应场景**
  （如"对话中触发战斗→战斗被拒绝"），场景脚本即回归资产
- **完成定义（Definition of Done）**，玩法特性四项全过才算完成：
  1. `npm run validate` + `npm run build` 全绿
  2. 对应 qa-local 场景通过
  3. 真机/浏览器手动试玩该特性
  4. 产出至少一条具体手感观察并处理（见 DESIGN_PRINCIPLES §D）

> 编译通过 ≠ 完成。类型正确只证明代码能跑，不证明玩法成立、手感合格。

## 10. AI 协作工作流

- **先规格后代码**：跨多文件的改动先写明方案（改哪些文件、新增哪些事件/schema、
  验收标准），确认后再动手；禁止边生成边定设计
- **小步提交**：一次提交聚焦一个系统；铺量式提交（多地图/多物品一把梭）先拆分
- **review 对照红线**：合并前逐条对照 DESIGN_PRINCIPLES §E 反模式表
- agent 犯了真实错误且文档未覆盖时，把教训补进对应文档或 AGENTS.md，
  防止下一个会话重蹈
