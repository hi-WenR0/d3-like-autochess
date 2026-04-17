# 功能开发文档：Dungeon1 floor 背景接入

## 1. 基本信息

- 日期：2026-04-17
- 负责人：Codex
- 分类：06-content
- 关联功能：地牢战斗场景 floor 贴图背景
- 状态：In Development

## 2. 目标与范围

- 目标：将 `public/assets/Tiled_files/Dungeon1.json` 中的 floor 相关图层接入当前地牢战斗背景，替换代码生成的灰色方块地板。
- 本次范围（In Scope）：
  - 预加载 Dungeon1 tilemap 与相关 tileset 图片
  - 只渲染 floor / water floor / darker surface 这类底层 tile layers
  - 保持为静态背景，不处理动画 tile
- 非本次范围（Out of Scope）：
  - 不接入 Walls / Windows / Lights / traps / Objects 图层
  - 不接入地图碰撞、对象层或出生点

## 3. 需求与验收标准

- 功能需求：
  - 地牢背景显示 JSON 里的 floor 图
  - 玩家、敌人、掉落继续显示在背景上方
- 验收标准（可检查）：
  - 不再显示原灰色方块地板
  - floor 贴图在 1024x600 战斗区内正常显示
  - 回城/切楼层时背景不会重复叠加

## 4. 方案设计

- 玩法/交互设计：
  - 仅替换底图视觉，不改变玩法逻辑
- 技术设计：
  - `Preloader` 预加载 `Dungeon1.json` 和其 tileset 图片
  - `Game` 新增 tilemap floor layer 管理
  - floor 图层从 JSON 图层名筛选：`water_floor3`、`water_detailization2`、`water_detailization`、`Floor2_pool`、`Floor2_darker_surface`、`Floor`、`Floor_darker_surface`
- 数据结构与配置：
  - 不修改存档和地图原文件
- 兼容性与迁移影响：
  - 保留相机背景色兜底
  - 保留原有实体与 HUD 层级

## 5. 实现计划

- 任务拆分：
  - 新增文档
  - 预加载 Dungeon1 资源
  - 替换地牢背景创建逻辑
  - 补充背景清理与可见性控制
  - 运行验证

## 6. 测试计划

- 手工测试步骤：
  - 进入地牢确认 floor 背景正确显示
  - 回城后背景隐藏，再进地牢能正常恢复
  - 切换楼层时不叠层
- 边界情况：
  - 动画图块按静态首帧显示，不报错
  - floor 层范围超出战斗区时允许上下裁切

## 7. 变更记录

- 2026-04-17：创建文档。
