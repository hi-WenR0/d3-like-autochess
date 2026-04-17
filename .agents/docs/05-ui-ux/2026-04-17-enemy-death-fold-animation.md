# 功能开发文档：敌人死亡折叠动画

## 1. 基本信息

- 日期：2026-04-17
- 负责人：AI Agent
- 分类：05-ui-ux
- 关联功能：视觉效果系统、怪物系统
- 状态：Completed

## 2. 目标与范围

- 目标：
  - 改进敌人死亡视觉效果，让图像精灵在死亡时产生折叠消失动画
  - 替代当前直接销毁的方式，增加视觉过渡感

- 本次范围（In Scope）：
  - 敌人精灵死亡时的 scaleY 折叠动画（0.5秒）
  - 折叠到一定阈值后销毁精灵
  - 与现有粒子死亡效果配合

- 非本次范围（Out of Scope）：
  - 玩家死亡动画
  - 其他对象的折叠效果
  - 复杂的骨骼动画

## 3. 需求与验收标准

- 功能需求：
  1. 敌人被击杀时，身体精灵开始 scaleY 折叠动画
  2. 折叠持续时间：500ms
  3. scaleY 从 1.0 逐渐缩小到 0.1 时销毁
  4. 同时保持现有粒子效果（爆炸粒子）
  5. 折叠中心点在精灵底部（origin.y = 1）

- 验收标准（可检查）：
  - [x] 普通怪死亡时有折叠动画
  - [x] 精英怪死亡时有折叠动画
  - [x] 稀有怪死亡时有折叠动画
  - [x] Boss死亡时有折叠动画
  - [x] 动画持续约0.5秒
  - [x] 粒子效果同时正常显示
  - [x] 精灵销毁时机正确

## 4. 方案设计

- 玩法/交互设计：
  - 敌人死亡时，图像从下往上"折叠"消失
  - 配合粒子效果，产生"被击碎"的感觉
  - 视觉上更加流畅，避免突兀消失

- 技术设计：

修改 `src/game/scenes/Game.ts` 中的 `onMonsterKilled` 方法：

```typescript
private onMonsterKilled(monster: Monster, result: CombatResult) {
    // ... 现有逻辑 ...

    // 死亡粒子效果
    this.showDeathEffect(monster);

    // 死亡折叠动画
    const sprite = this.monsterSprites.get(monster.id);
    if (sprite) {
        const bodySprite = sprite.getData('bodySprite') as Phaser.GameObjects.Sprite;
        if (bodySprite) {
            // 设置原点到底部，实现从下往上折叠
            bodySprite.setOrigin(0.5, 1);

            this.tweens.add({
                targets: bodySprite,
                scaleY: 0.1,
                duration: 500,
                ease: 'Power2',
                onComplete: () => {
                    sprite.destroy();
                    this.monsterSprites.delete(monster.id);
                },
            });
        } else {
            sprite.destroy();
            this.monsterSprites.delete(monster.id);
        }
    }

    // ... 物理体销毁等 ...
}
```

- 数据结构与配置：
  - 动画持续时间常量：`DEATH_FOLD_DURATION = 500`
  - 折叠阈值：`DEATH_FOLD_MIN_SCALE = 0.1`

- 兼容性与迁移影响：
  - 纯视觉效果，不影响游戏逻辑
  - 无需数据迁移
  - 需要确保 sprite 销毁时机正确，避免内存泄漏

## 5. 实现计划

- 任务拆分：

  1. 在 Game.ts 中添加死亡折叠动画逻辑
  2. 修改 onMonsterKilled 方法
  3. 处理容器中其他元素（血条、标签）的隐藏/销毁
  4. 测试各类型怪物的死亡效果
  5. 验证性能和视觉效果

- 预计改动文件：
  - 修改: `src/game/scenes/Game.ts`

- 风险点与回滚方案：
  - 风险1：动画过程中玩家可能继续行动，导致视觉冲突
    - 缓解：动画时间较短（0.5秒），影响有限
    - 回滚：直接销毁，跳过动画

  - 风险2：多怪同时死亡时可能有性能问题
    - 缓解：使用 Phaser 内置 tween，性能良好
    - 回滚：限制同时播放动画的怪兽数量

## 6. 测试计划

- 手工测试步骤：

  1. 进入地牢，击杀普通怪，观察折叠动画
  2. 击杀精英怪，验证动画和粒子效果配合
  3. 击杀Boss，观察大型怪物的折叠效果
  4. 快速连杀多只怪物，验证无性能问题
  5. 检查精灵是否正确销毁，无内存泄漏

- 边界情况：
  - 怪物死亡时正在播放攻击动画
  - Boss阶段转换时被击杀
  - 多只怪物几乎同时死亡

- 性能影响检查：
  - 同屏10+怪物死亡动画不卡顿
  - 内存无明显增长
  - 60fps稳定

## 7. 变更记录

- 2026-04-17: 创建文档，记录敌人死亡折叠动画需求
- 2026-04-17: 完成实现，添加 scaleY 折叠动画（500ms），配合粒子效果
