# 凡人仙途（xiuxian-rpg）

修仙题材开放世界 RPG · 移动浏览器优先 · 纯静态部署

## 快速开始

```bash
npm install
npm run dev        # 手机与电脑同一 WiFi 下，用手机访问终端显示的地址即可试玩
npm run validate   # 内容校验（zod schema + 引用完整性）
npm run build      # 类型检查 + 生产构建 → dist/
```

## 发布

- push 到 `main` 后 GitHub Actions 自动执行 校验→构建→部署
- 默认部署到 **Cloudflare Pages**（需在仓库 Secrets 配置
  `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`）
- 也可切换为 **GitHub Pages**：见 `.github/workflows/deploy.yml` 中注释部分

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
  scenes/    游戏场景（Boot 程序化贴图 / World 示例地图）
  ui/        Vue 覆盖层（HUD、虚拟摇杆、背包）
  systems/   zod schemas —— 所有内容的契约
content/     游戏数据（物品/功法/NPC/地图），一物一 JSON 文件
scripts/     内容完整性校验脚本
docs/GDD.md  游戏设计文档 ★ 先读这个再写代码
```

## AI 协作约定

1. 新增内容前先更新 `systems/schemas.ts`
2. 内容一律放 `content/`，一个对象一个文件，id 用 snake_case
3. 提交前跑 `npm run validate && npm run build`
4. 文风遵循 GDD 附录 A 术语表
