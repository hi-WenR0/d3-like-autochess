# 暗黑 Like 自动挂机刷宝游戏 — 开发计划

基于 `design.md` 设计文档，结合 Phaser 4 + TypeScript 项目模板，按三阶段递进式开发。

---

## 第一阶段：核心循环（MVP 可玩）

| 序号 | 任务 | 说明 | 涉及文件/目录 |
|------|------|------|--------------|
| 1.1 | **数据模型层** | 定义角色属性、装备、怪物、词条等 TypeScript 接口与类型 | `src/game/models/` |
| 1.2 | **角色系统** | 实现角色属性（HP/ATK/DEF/AS/CR/CD/MS）、等级、经验值、属性点分配 | `src/game/models/character.ts`, `src/game/systems/character-system.ts` |
| 1.3 | **地牢场景与角色渲染** | 重写 `Game` 场景：暗黑风格地牢背景、角色精灵、自动移动寻路 | `src/game/scenes/Game.ts` |
| 1.4 | **怪物系统** | 怪物类型（普通/精英/稀有/Boss）、属性公式、生成与 AI | `src/game/models/monster.ts`, `src/game/systems/monster-system.ts` |
| 1.5 | **自动战斗逻辑** | 按优先级实现自动战斗（血量检测→攻击→拾取→探索→下楼） | `src/game/systems/combat-system.ts` |
| 1.6 | **装备掉落系统** | 基于怪物类型的掉落概率、稀有度权重、装备生成 | `src/game/models/equipment.ts`, `src/game/systems/loot-system.ts` |
| 1.7 | **背包系统** | 40 格背包、物品添加/移除/排序、容量检查 | `src/game/models/inventory.ts`, `src/game/systems/inventory-system.ts` |
| 1.8 | **基础 HUD** | HP 条、当前层数、金币显示、探索状态指示 | `src/game/ui/hud.ts` |

**阶段目标**：角色能在地牢中自动移动、打怪、掉装备、捡装备，形成核心循环。

---

## 第二阶段：深度玩法

| 序号 | 任务 | 说明 | 涉及文件/目录 |
|------|------|------|--------------|
| 2.1 | **装备词条系统** | 攻击/防御/特殊词条定义、权重随机、数值范围生成、词条强化 | `src/game/models/affix.ts`, `src/game/systems/affix-system.ts` |
| 2.2 | **装备穿戴与属性计算** | 9 槽位装备界面、穿戴/卸下、属性汇总计算（含词条加成） | `src/game/ui/equipment-panel.ts`, `src/game/systems/equip-system.ts` |
| 2.3 | **地牢层级系统** | 5 大区域（荒芜矿坑→幽暗森林→熔岩深渊→深渊领域→无尽深渊）、层数递进 | `src/game/models/dungeon.ts`, `src/game/systems/dungeon-system.ts` |
| 2.4 | **升级与成长** | 经验获取、升级属性提升、属性点自由分配 | 扩展 `character-system.ts` |
| 2.5 | **背包 UI** | 5x8 网格界面、装备详情面板、筛选/出售/分解功能 | `src/game/ui/inventory-panel.ts` |
| 2.6 | **装备详情 Tooltip** | 显示装备名称（稀有度着色）、基础属性、词条列表 | `src/game/ui/tooltip.ts` |

**阶段目标**：完整的装备-词条-成长体系，玩家可以优化搭配追求更强属性。

---

## 第三阶段：完善体验

| 序号 | 任务 | 说明 | 涉及文件/目录 |
|------|------|------|--------------|
| 3.1 | **物品稀有度与特效** | 传奇/神话装备发光特效、掉落动画、拾取提示 | `src/game/effects/` |
| 3.2 | **消耗品系统** | 药水（HP 回复）、增益卷轴（限时属性加成）、自动使用逻辑 | `src/game/models/consumable.ts`, `src/game/systems/consumable-system.ts` |
| 3.3 | **商店系统** | 金币货币、购买/出售装备和消耗品 | `src/game/ui/shop-panel.ts`, `src/game/systems/shop-system.ts` |
| 3.4 | **存档系统** | LocalStorage 持久化角色/装备/进度数据、自动保存 | `src/game/systems/save-system.ts` |
| 3.5 | **离线收益** | 计算离线期间自动战斗收益（50% 效率，上限 24h）、上线展示 | `src/game/systems/offline-system.ts` |
| 3.6 | **UI 美化与交互优化** | 暗黑风格主题、按钮/面板动画、底部导航栏（状态/背包/装备/词条/设置） | `src/game/ui/` 全面优化 |

**阶段目标**：游戏体验完善，可长时间挂机游玩，数据持久化不丢失。

---

## 项目目录结构规划

```
src/
├── main.ts                         # 入口
├── vite-env.d.ts
└── game/
    ├── main.ts                     # Game 配置与启动（扩展场景列表）
    ├── scenes/
    │   ├── Boot.ts                 # 启动（加载最小资源）
    │   ├── Preloader.ts            # 预加载（加载全部游戏资源）
    │   ├── MainMenu.ts             # 主菜单（开始游戏/继续游戏）
    │   ├── Game.ts                 # 主游戏场景（地牢+角色+战斗）
    │   ├── GameOver.ts             # 死亡结算
    │   └── UIOverlay.ts            # UI 叠加层场景（背包/装备等面板）
    ├── models/                     # 数据模型（纯 TypeScript 接口/类）
    │   ├── character.ts
    │   ├── monster.ts
    │   ├── equipment.ts
    │   ├── affix.ts
    │   ├── inventory.ts
    │   ├── consumable.ts
    │   └── dungeon.ts
    ├── systems/                    # 游戏逻辑系统
    │   ├── character-system.ts
    │   ├── combat-system.ts
    │   ├── monster-system.ts
    │   ├── loot-system.ts
    │   ├── inventory-system.ts
    │   ├── equip-system.ts
    │   ├── affix-system.ts
    │   ├── dungeon-system.ts
    │   ├── consumable-system.ts
    │   ├── shop-system.ts
    │   ├── save-system.ts
    │   └── offline-system.ts
    ├── ui/                         # UI 组件
    │   ├── hud.ts
    │   ├── inventory-panel.ts
    │   ├── equipment-panel.ts
    │   ├── tooltip.ts
    │   ├── shop-panel.ts
    │   └── status-panel.ts
    ├── effects/                    # 视觉特效
    │   └── rare-glow.ts
    └── data/                       # 静态数据表
        ├── affix-table.ts
        ├── equipment-table.ts
        └── monster-table.ts
```

---

## 关键技术决策

1. **UI 方案**：使用 Phaser 内置的 `GameObject`（`Container`/`Rectangle`/`Text`/`Image`）构建 UI，不引入 DOM UI 框架，保持纯游戏内渲染
2. **数据驱动**：装备、词条、怪物等数据放在 `data/` 目录的静态表中，方便调参
3. **场景架构**：`Game` 场景负责地牢渲染与游戏循环，`UIOverlay` 场景作为并行叠加层处理 UI 面板（利用 Phaser 多场景并行能力）
4. **无美术资源依赖**：Prototype 阶段使用简单几何图形/色块代替精灵，后续替换美术资源即可

---

## 开发顺序

```
1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7 → 1.8  (第一阶段完成，MVP)
 ↓
2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6                (第二阶段完成，深度玩法)
 ↓
3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6                (第三阶段完成，体验完善)
```

每个阶段完成后都应能独立运行和测试，确保增量可玩。
