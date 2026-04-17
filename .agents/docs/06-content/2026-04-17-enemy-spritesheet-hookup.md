# 功能开发文档：敌人 spritesheet 接入

## 1. 基本信息

- 日期：2026-04-17
- 负责人：Codex
- 分类：06-content
- 关联功能：敌人视觉资源接入
- 状态：In Development

## 2. 目标与范围

- 目标：将 `public/assets/enemies` 下的 4 套敌人 spritesheet 接入游戏，让敌人不再只用纯色方块显示。
- 本次范围（In Scope）：
  - 为 `normal / elite / rare / boss` 四类敌人加载 spritesheet
  - 按怪物类别绑定对应资源
  - 敌人支持基础方向与 `idle / walk` 动画
- 非本次范围（Out of Scope）：
  - 不为每个具体怪物单独分配独立资源
  - 不重做怪物受击、死亡演出逻辑

## 3. 需求与验收标准

- 功能需求：
  - 普通、精英、稀有、Boss 各自使用对应文件夹下的 spritesheet
  - 同类别的具体怪物暂时共用同一套资源
  - 敌人移动时切换为行走动画，静止时显示待机动画
- 验收标准（可检查）：
  - 地图内敌人显示为像素角色贴图而非色块
  - 不同品质敌人能看出资源差异
  - 敌人朝向和移动动画正常播放

## 4. 方案设计

- 玩法/交互设计：
  - 维持现有血条、名字、碰撞与战斗逻辑，仅替换可视表现
- 技术设计：
  - 新增 `enemy-visuals.ts` 统一管理 key、路径、帧数和动画 key
  - `Preloader` 批量加载 4 类敌人资源
  - `Game` 在渲染怪物时创建 sprite，并在同步阶段根据速度更新朝向与动画
- 数据结构与配置：
  - 不修改存档
  - 不修改怪物生成表，仅按 `monster.type` 选贴图
- 兼容性与迁移影响：
  - 现有敌人逻辑保持不变
  - 若资源缺失，可回退到旧的占位体渲染方案

## 5. 实现计划

- 任务拆分：
  - 新增文档
  - 新增敌人视觉配置模块
  - 接入预加载
  - 替换怪物渲染
  - 运行验证
- 预计改动文件：
  - `src/game/enemy-visuals.ts`
  - `src/game/scenes/Preloader.ts`
  - `src/game/scenes/Game.ts`
  - `.agents/docs/06-content/2026-04-17-enemy-spritesheet-hookup.md`
  - `.agents/docs/07-engine-tech/2026-04-15-features-tracking-migrated.md`
- 风险点与回滚方案：
  - 风险：spritesheet 帧数或尺寸与代码假设不匹配
  - 回滚：保留旧的血条与容器结构，可快速切回纯色 body

## 6. 测试计划

- 手工测试步骤：
  - 进入地牢确认 4 类敌人均能正常显示
  - 敌人移动时播放 walk，停下时播放 idle
  - 左右移动时侧面贴图可翻转
- 边界情况：
  - 同类不同怪物共用同一套资源时不报错
  - Boss 层资源正常显示
- 性能影响检查：
  - 敌人数量正常时无明显掉帧

## 7. 变更记录

- 2026-04-17：创建文档。
