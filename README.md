# Phaser 4 地牢爬行 RPG

一个完整的**地牢爬行 + 放置 RPG**游戏，使用 Phaser 4、Vite 和 TypeScript 构建。具有自动探索、深度装备词条系统、五个地牢区域和离线进度功能。

**注意：** 此项目基于官方 Phaser Vite TypeScript 模板，已升级到 Phaser 4.0.0。

### 版本

此模板已更新至：

- [Phaser 4.0.0](https://github.com/phaserjs/phaser)
- [Vite 6.3.1](https://github.com/vitejs/vite)
- [TypeScript 5.7.2](https://github.com/microsoft/TypeScript)

![screenshot](screenshot.png)

## 要求

需要 [Node.js](https://nodejs.org) 来安装依赖并通过 `npm` 运行脚本。

## 可用命令

| 命令 | 描述 |
|---------|-------------|
| `npm install` | 安装项目依赖 |
| `npm run dev` | 启动开发服务器（带匿名使用统计） |
| `npm run build` | 在 `dist` 文件夹中创建生产构建（带匿名使用统计） |
| `npm run dev-nolog` | 启动开发服务器（不发送匿名数据） |
| `npm run build-nolog` | 在 `dist` 文件夹中创建生产构建（不发送匿名数据） |

开发服务器默认运行在 `http://localhost:8080`。

## 开始使用

克隆仓库后，在项目目录中运行 `npm install`。然后，可以通过运行 `npm run dev` 启动本地开发服务器。

服务器运行后，可以编辑 `src` 文件夹中的任何文件。Vite 会自动重新编译代码并重新加载浏览器。

## 项目结构

```
src/
├── main.ts              # 应用程序入口点（DOM 加载）
├── vite-env.d.ts       # Vite 类型定义
└── game/
    ├── main.ts         # 游戏入口点：配置并启动 Phaser 游戏
    ├── scenes/         # Phaser 游戏场景
    │   ├── Boot.ts
    │   ├── Preloader.ts
    │   ├── MainMenu.ts
    │   ├── Game.ts
    │   └── GameOver.ts
    ├── models/         # 数据模型（角色、地牢等）
    └── systems/        # 游戏系统（战斗、背包等）
```

### 关键文件

| 路径 | 描述 |
|------|-------------|
| `index.html` | 包含游戏的基本 HTML 页面 |
| `public/assets/` | 游戏精灵图、音频等，运行时直接提供 |
| `public/style.css` | 全局布局样式 |
| `src/main.ts` | 应用程序引导（DOM 加载） |
| `src/game/main.ts` | 游戏入口点：配置并启动 Phaser 游戏 |
| `src/game/scenes/` | 所有 Phaser 游戏场景的文件夹 |
| `src/game/models/` | 游戏实体的数据模型 |
| `src/game/systems/` | 游戏系统和逻辑 |

## 游戏功能

此项目包含一个完整的**地牢爬行 + 放置 RPG**游戏，具有深入的游戏机制和系统。

### 游戏类型
- **地牢爬行** + **放置/自动战斗** 2D RPG
- 玩家专注于装备优化、属性分配和系统管理，同时角色自动探索、战斗和收集战利品
- 支持离线进度、自动保存和无限地牢区域

### 核心玩法
1. **自动探索与战斗**
   - 角色自动在地牢中移动，寻找并攻击最近的怪物
   - 每 500 毫秒发生一次战斗，自动计算伤害、暴击、吸血、闪避等
   - 五种角色状态：探索、战斗、拾取、休息、下楼

2. **角色成长**
   - 通过击败怪物获得经验和金币，升级以获取属性点
   - 属性点可分配到 HP、ATK、DEF、攻击速度、暴击率、暴击伤害、移动速度
   - 装备提供基础属性和特殊词条

3. **装备收集与词条系统**
   - 装备有 9 个槽位（头盔、护甲、武器、项链、戒指等）
   - 五种稀有度等级：普通（灰色）、魔法（蓝色）、稀有（橙色）、传奇（橙色）、神话（金色）
   - 三种词条类别：攻击（穿透、吸血）、防御（HP 恢复、伤害减免）、特殊（连击、旋风斩、守护者、掠夺者等）
   - 更高稀有度的装备拥有更多词条和更强效果

4. **地牢进度**
   - 五个地牢区域：荒芜矿坑、幽暗森林、熔岩深渊、深渊领域、无尽深渊
   - 每层需要击败固定数量的怪物才能前进，每第 5 层是首领层
   - 首领掉落更多和更高稀有度的装备

### 关键游戏系统

| 系统 | 描述 |
|--------|-------------|
| **角色系统** (`src/game/models/character.ts`) | 角色数据、属性分配、升级公式、有效属性计算 |
| **装备系统** (`src/game/models/equipment.ts`) | 装备槽位、稀有度配置、基础属性范围、出售价格 |
| **词条系统** (`src/game/models/affix.ts`) | 词条定义、类别、权重、随机化规则 |
| **怪物系统** (`src/game/models/monster.ts`) | 怪物类型（普通、精英、稀有、首领）、属性成长、生成权重 |
| **地牢系统** (`src/game/models/dungeon.ts`) | 区域定义、探索状态、楼层进度 |
| **背包系统** (`src/game/models/inventory.ts`) | 40 格背包、物品堆叠、按稀有度出售 |
| **消耗品系统** (`src/game/models/consumable.ts`) | 药水、卷轴、药剂定义、堆叠限制、购买价格 |
| **战斗系统** (`src/game/systems/combat-system.ts`) | 伤害计算、穿透、吸血、闪避、连击、旋风斩效果 |
| **装备穿戴系统** (`src/game/systems/equip-system.ts`) | 装备槽位管理、属性加成计算 |
| **掉落系统** (`src/game/systems/loot-system.ts`) | 装备生成、稀有度随机化、词条随机化、名称生成 |
| **商店系统** (`src/game/systems/shop-system.ts`) | 消耗品购买、一键出售装备 |
| **存档系统** (`src/game/systems/save-system.ts`) | LocalStorage 自动保存、离线进度计算（最多 24 小时） |
| **消耗品使用系统** (`src/game/systems/consumable-system.ts`) | 药水治疗、增益卷轴、自动使用药水逻辑 |

### 关键游戏机制

- **词条效果**
  - **穿透**：无视怪物部分防御
  - **吸血**：根据造成的伤害回复生命
  - **HP 恢复**：每秒恢复固定 HP
  - **伤害减免**：减少受到的伤害
  - **闪避**：完全避免一次伤害
  - **连击**：概率再次攻击
  - **旋风斩**：概率对周围所有怪物造成伤害
  - **守护者**：死亡时概率以 50% HP 复活
  - **掠夺者**：概率额外掉落一件装备
  - **狂战士**：HP 低于 30% 时大幅增加攻击
  - **不朽**：死亡后进入冷却，冷却结束后复活

- **离线进度**
  根据离线时长、角色等级和当前地牢楼层计算经验和金币奖励（50% 效率）

- **自动保存**
  每 30 秒自动保存进度，页面关闭时也会保存

- **UI 面板**
  主游戏界面包含 HUD（HP 条、楼层数、金币、状态、属性显示），底部导航栏打开：
  - **背包**：查看/装备物品
  - **装备栏**：查看已装备物品
  - **属性**：查看角色属性、分配属性点、查看词条效果
  - **消耗品**：使用药水/卷轴/药剂、查看活跃增益
  - **商店**：购买消耗品、一键按稀有度出售装备
  - **存档**：手动保存
  - **重置**：确认后重置所有进度

## 资源处理

Vite 支持通过 JavaScript 模块 `import` 语句加载资源。

此模板支持嵌入资源和从静态文件夹加载资源。要嵌入资源，可以在使用它的 JavaScript 文件顶部导入：

```js
import logoImg from './assets/logo.png'
```

要加载静态文件，如音频文件、视频等，请将它们放入 `public/assets` 文件夹中。然后可以在 Phaser 的 Loader 调用中使用此路径：

```js
preload ()
{
    //  这是导入的捆绑图像的示例。
    //  请记住在此文件顶部导入它
    this.load.image('logo', logoImg);

    //  这是从 public/assets 文件夹加载静态图像的示例：
    this.load.image('background', 'assets/bg.png');
}
```

当您发出 `npm run build` 命令时，所有静态资源会自动复制到 `dist/assets` 文件夹。

## 部署到生产环境

运行 `npm run build` 命令后，您的代码将构建为单个捆绑包并保存到 `dist` 文件夹中，连同项目导入的任何其他资源或存储在公共资源文件夹中的资源。

为了部署您的游戏，您需要将 `dist` 文件夹的所有内容上传到面向公众的 Web 服务器。

## 自定义模板

### Vite

如果您想自定义构建，例如添加插件（用于加载 CSS 或字体），可以修改 `vite/config.*.mjs` 文件以进行跨项目更改，或者可以在 `package.json` 内的特定 npm 任务中修改和/或创建新的配置文件并定位它们。请参阅 [Vite 文档](https://vitejs.dev/) 了解更多信息。

### TypeScript

此项目使用严格的 TypeScript 配置，`tsconfig.json` 中具有以下设置：

- `target`: ES2020
- `strict`: true
- `noUnusedLocals`: true
- `noUnusedParameters`: true
- `noFallthroughCasesInSwitch`: true

更改代码后始终运行类型检查：

```bash
npx tsc --noEmit
```

## 关于 log.js

如果您检查我们的节点脚本，会发现有一个名为 `log.js` 的文件。此文件向一个名为 `gryzor.co` 的域发出单个静默 API 调用。该域归 Phaser Studio Inc. 所有。域名是对我们最喜欢的复古游戏之一的致敬。

我们向此 API 发送以下 3 个数据：正在使用的模板名称（vue、react 等）。构建是 'dev' 还是 'prod'，最后是使用的 Phaser 版本。

绝不收集或发送任何个人数据。我们不知道您的项目文件、设备、浏览器或任何其他信息。请随时检查 `log.js` 文件以确认这一点。

为什么我们要这样做？因为开源意味着我们没有关于正在使用哪些模板的可见指标。我们努力为 Phaser 开发人员维护大量多样化的模板，这是我们确定这项工作是否实际奏效的小型匿名方式。简而言之，它有助于我们确保为您构建工具。

但是，如果您不想发送任何数据，可以使用以下命令：

开发：

```bash
npm run dev-nolog
```

构建：

```bash
npm run build-nolog
```

或者，要完全禁用日志，只需删除 `log.js` 文件，并从 `package.json` 的 `scripts` 部分移除对其的调用：

之前：

```json
"scripts": {
    "dev": "node log.js dev & dev-template-script",
    "build": "node log.js build & build-template-script"
},
```

之后：

```json
"scripts": {
    "dev": "dev-template-script",
    "build": "build-template-script"
},
```

以上任一操作都将停止 `log.js` 运行。如果您确实决定这样做，请至少加入我们的 Discord 并告诉我们您正在使用哪个模板！或发送一封简短的电子邮件。任何方式都将非常有帮助，谢谢您。

## Phaser 4 资源

- [Phaser 4 文档](https://docs.phaser.io/)
- [Phaser 4 示例](https://labs.phaser.io/)
- [Phaser 4 迁移指南](https://phaser.io/skills/v4-migration)

## 加入 Phaser 社区！

我们喜欢看到像您这样的开发人员使用 Phaser 创建的作品！这真的激励我们不断改进。所以请加入我们的社区并展示您的工作 😄

**访问：** [Phaser 网站](https://phaser.io) 并在 [Phaser Twitter](https://twitter.com/phaser_) 上关注<br />
**游玩：** 一些令人惊叹的游戏 [#madewithphaser](https://twitter.com/search?q=%23madewithphaser&src=typed_query&f=live)<br />
**学习：** [API 文档](https://newdocs.phaser.io)、[支持论坛](https://phaser.discourse.group/) 和 [StackOverflow](https://stackoverflow.com/questions/tagged/phaser-framework)<br />
**Discord：** 加入我们的 [Discord](https://discord.gg/phaser)<br />
**代码：** 2000+ [示例](https://labs.phaser.io)<br />
**阅读：** [Phaser World](https://phaser.io/community/newsletter) 新闻通讯<br />

由 [Phaser Studio](mailto:support@phaser.io) 创建。由咖啡、动漫、像素和爱驱动。

Phaser 徽标和角色 &copy; 2011 - 2025 Phaser Studio Inc.

保留所有权利。