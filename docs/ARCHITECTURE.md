# 架构文档（Architecture）

> 技术栈：Vite + Vue 3 + TypeScript + Phaser 3 · 纯静态、零后端
> 本文描述系统的分层、数据流与关键决策。改架构前先读这里。

---

## 1. 分层总览

```
┌─────────────────────────────────────────────┐
│ UI 层 src/ui/*.vue        （Vue 3, DOM）     │  HUD / 摇杆 / 背包 / 对话
├─────────────────────────────────────────────┤
│ ▲▼ 仅通过 eventBus 双向通信，禁止互相持有引用 │
├─────────────────────────────────────────────┤
│ 世界层 src/scenes/*.ts     （Phaser）        │  地图渲染 / 移动碰撞 / 触发器
├─────────────────────────────────────────────┤
│ 规则层 src/systems/*.ts   （纯函数优先）      │  战斗公式 / 修炼突破 / 背包逻辑
├─────────────────────────────────────────────┤
│ 数据层 content/**/*.json + schemas.ts        │  一切游戏内容的唯一来源
├─────────────────────────────────────────────┤
│ 平台层 src/engine/*.ts                       │  存档(IndexedDB) / 事件总线
└─────────────────────────────────────────────┘
```

### 分层规则

| 层 | 可以依赖 | 禁止 |
|---|---|---|
| ui | systems, engine(eventBus) | 直接 import scenes / phaser |
| scenes | systems, engine | 直接操作 Vue 组件 |
| systems | schemas, content | 操作 DOM / Phaser 对象 |
| engine | 无内部依赖（最底层） | import 上层任何模块 |

**核心原则：UI 与世界互不感知。** 两边只认识 `eventBus` 里的事件名。

---

## 2. 关键数据流

### 2.1 输入流（玩家移动）

```
手指 → Joystick.vue → bus.emit('joystick:move', vec)
                     → WorldScene.update() 读向量 → player.setVelocity()
```

### 2.2 内容加载流

```
content/items/*.json → import(或 fetch) → ItemSchema.parse() → 内存注册表
                     → UI(背包列表) 与 systems(战斗加成) 同源消费
```

> 当前骨架用构建期打包；内容量大后切换为按区域 `fetch()` 懒加载，接口不变。

### 2.3 存档流

```
WorldScene(5s 定时) → SaveData(纯 JSON) → IndexedDB
启动时 loadSave() → 恢复坐标/背包/任务进度
```

SaveData 必须是**可序列化纯对象**——禁止存 Phaser 对象引用、类实例。

---

## 3. 事件总线契约 `engine/eventBus.ts`

- 所有跨层通信事件必须先在 `GameEvents` 类型中声明，带完整载荷类型
- 命名：`<来源>:<动作>`，如 `joystick:move`、`ui:toggle-inventory`、`player:position`
- `on()` 返回解绑函数，组件卸载/场景 shutdown 时必须调用（防泄漏）
- 高频事件（如 position）不得携带复杂对象

## 4. 场景生命周期约定（Phaser）

- 资源生成放 `BootScene`；场景订阅的事件在 `shutdown` 时统一解绑
- 场景间跳转只用 `scene.start(key)`，不直接 new
- 每个场景文件一个场景类，文件名 = 场景名

## 5. 部署链路

```
git push main → GitHub Actions:
  npm ci → npm run validate(zod) → npm run build(vue-tsc+vite)
  → wrangler pages deploy dist（Cloudflare Pages）
```

- 校验失败 = 部署失败，这是内容质量的最后防线
- 单文件 ≤ 100KB（Pages 限制）、首屏 JS gzip 目标 ≤ 400KB

## 6. 已定技术决策记录（ADR 摘要）

| # | 决策 | 理由 | 否决的备选 |
|---|---|---|---|
| 1 | Phaser+Vue 而非 Cocos/Godot | AI 写代码友好、Web 性能最佳、包体小 | Godot(Web 导出 30MB+/iOS 差) |
| 2 | DOM 做 UI 而非 Canvas 内 UI | 开发效率、文字排版、无障碍、自适应 | Phaser 内置 UI 组件 |
| 3 | 程序化贴图起步 | 零二进制资产、仓库全文本、AI 可维护 | 直接上美术素材 |
| 4 | IndexedDB 而非 localStorage | 容量大、异步不阻塞、结构化存储 | localStorage(5MB 限制) |
| 5 | zod 校验进 CI | AI 批量产内容的质量闸门 | 人工 review 全部 JSON |

后续重大变更须在此表追加记录。
