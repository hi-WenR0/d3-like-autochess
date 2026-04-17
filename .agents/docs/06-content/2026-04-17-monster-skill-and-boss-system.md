# 功能开发文档：怪物技能系统、Boss阶段机制与视觉增强

## 1. 基本信息

- 日期：2026-04-17
- 负责人：AI Agent
- 分类：06-content
- 关联功能：怪物系统、战斗系统、视觉效果
- 状态：Completed

## 2. 目标与范围

- 目标：
  - 为精英和Boss怪物添加特殊技能系统
  - 实现Boss阶段转换机制，提供更具挑战性的战斗体验
  - 基于战斗模拟器结果进行数值平衡调整
  - 增强视觉反馈系统（受击、死亡动画、特效）

- 本次范围（In Scope）：
  - 怪物技能数据模型与执行系统
  - Boss血量阶段转换逻辑
  - 技能视觉效果（预警、投射物、粒子）
  - 受击闪光与死亡粒子效果
  - 数值调整与平衡验证

- 非本次范围（Out of Scope）：
  - 怪物精灵图接入（已有独立文档）
  - 复杂的AI路径规划
  - 怪物间的技能协同
  - 多人团队副本机制

## 3. 需求与验收标准

- 功能需求：
  1. 怪物技能系统
     - 精英怪拥有1-2个技能，Boss拥有3-5个技能
     - 技能类型：主动攻击、增益Buff、召唤随从、范围AOE
     - 技能冷却机制，避免无脑释放
  
  2. Boss阶段机制
     - Boss在特定血量百分比触发阶段转换
     - 每个阶段可改变技能配置和行为模式
     - 阶段转换有视觉和文字提示
  
  3. 数值平衡
     - 基于战斗模拟器调整怪物属性倍率
     - Boss战时长控制在合理范围（30-90秒）
  
  4. 视觉增强
     - 怪物受击时显示白色闪光
     - 不同稀有度怪物死亡有不同粒子效果
     - Boss技能有预警圈和释放特效

- 验收标准（可检查）：
  - [ ] 精英怪可使用至少1个技能
  - [ ] Boss在75%/50%/25%血量触发阶段转换
  - [ ] 技能释放有视觉预警和效果
  - [ ] 受击闪光正常显示（白色tint，100ms）
  - [ ] Boss死亡有特殊粒子爆发
  - [ ] 战斗模拟器显示平衡改善

## 4. 方案设计

- 玩法/交互设计：
  - 精英怪：每10-15秒释放一次技能，提升战斗节奏
  - Boss：三阶段机制，随血量降低逐渐增强攻击
  - 技能预警：地面显示红色圆环，1秒后触发
  - 视觉反馈：击中瞬间闪白，死亡时粒子四散

- 技术设计：

### 4.1 怪物技能系统

**数据模型** (`src/game/models/monster-skill.ts`)：

```typescript
export type MonsterSkillType = 'active' | 'passive' | 'trigger';
export type MonsterSkillEffectType = 'damage' | 'heal' | 'buff' | 'summon' | 'projectile';

export interface MonsterSkillCondition {
    type: 'always' | 'hpBelow' | 'targetInRange' | 'cooldownReady';
    value?: number;
}

export interface MonsterSkillEffect {
    type: MonsterSkillEffectType;
    damageMultiplier?: number;
    healRatio?: number;
    buffStat?: string;
    buffValue?: number;
    buffDuration?: number;
    summonType?: MonsterType;
    summonCount?: number;
    projectileSpeed?: number;
    radius?: number;
}

export interface MonsterSkillDefinition {
    id: string;
    name: string;
    description: string;
    type: MonsterSkillType;
    cooldownMs: number;
    conditions: MonsterSkillCondition[];
    effects: MonsterSkillEffect[];
    priority: number;
    visual?: {
        warningColor?: number;
        warningDuration?: number;
        texture?: string;
        particleEffect?: string;
    };
}

export interface MonsterSkillState {
    skillId: string;
    cooldownRemaining: number;
    lastCastTime: number;
}
```

**技能执行系统** (`src/game/systems/monster-skill-system.ts`)：

```typescript
export function executeMonsterSkill(
    monster: Monster,
    skill: MonsterSkillDefinition,
    target: { x: number; y: number },
    context: SkillExecutionContext
): SkillExecutionResult;

export function canCastSkill(monster: Monster, skill: MonsterSkillDefinition): boolean;

export function updateMonsterSkillCooldowns(monsters: Monster[], dt: number): void;
```

### 4.2 Boss阶段机制

**扩展Monster接口** (`src/game/models/monster.ts`)：

```typescript
export interface MonsterPhase {
    phase: number;
    hpThreshold: number;  // 0.75, 0.50, 0.25
    skillOverrides?: string[];
    movementStrategyOverride?: MovementStrategy;
    aggroRadiusMultiplier?: number;
    message?: string;
}

// 在Monster接口中添加：
export interface Monster {
    // ... 现有字段
    currentPhase?: number;
    phases?: MonsterPhase[];
    skillState?: MonsterSkillState[];
}
```

**Boss配置示例**：

```typescript
const BOSS_PHASES: Record<string, MonsterPhase[]> = {
    'mine-warden': [
        { phase: 1, hpThreshold: 1.0, skillOverrides: ['ground-slam'] },
        { phase: 2, hpThreshold: 0.75, skillOverrides: ['ground-slam', 'summon-miners'], message: '矿坑守卫召唤了援军！' },
        { phase: 3, hpThreshold: 0.50, skillOverrides: ['ground-slam', 'summon-miners', 'enrage'], aggroRadiusMultiplier: 1.5, message: '矿坑守卫进入狂暴状态！' },
    ],
};
```

### 4.3 视觉增强系统

**粒子配置** (`src/game/configs/particle-configs.ts`)：

```typescript
export const PARTICLE_CONFIGS = {
    hit: {
        lifespan: 300,
        speed: { min: 100, max: 200 },
        scale: { start: 0.5, end: 0 },
        quantity: 8,
    },
    deathNormal: {
        lifespan: 600,
        speed: { min: 50, max: 150 },
        scale: { start: 1, end: 0 },
        quantity: 20,
    },
    deathBoss: {
        lifespan: 1200,
        speed: { min: 100, max: 300 },
        scale: { start: 2, end: 0 },
        quantity: 60,
        tint: [0xff8800, 0xff4400, 0xffaa00],
    },
    skillWarning: {
        lifespan: 1000,
        speed: 0,
        scale: { start: 0.5, end: 1 },
        quantity: 1,
    },
};
```

**Game.ts中的视觉函数**：

```typescript
// 受击闪光（在playerAttackMonster后调用）
private showHitFlash(monster: Monster): void {
    const container = this.monsterSprites.get(monster.id);
    if (container) {
        const bodySprite = container.getData('bodySprite');
        bodySprite.setTint(0xffffff);
        this.time.delayedCall(100, () => bodySprite.clearTint());
    }
}

// Boss技能预警
private showSkillWarning(x: number, y: number, radius: number, color: number = 0xff4444): void {
    const circle = this.add.circle(x, y, 0, color, 0.3)
        .setDepth(DEPTH.WORLD_EFFECT_BELOW);
    
    this.tweens.add({
        targets: circle,
        radius: radius,
        duration: 1000,
        onComplete: () => circle.destroy(),
    });
}

// 死亡粒子
private showDeathEffect(monster: Monster): void {
    const config = monster.type === 'boss' 
        ? PARTICLE_CONFIGS.deathBoss 
        : PARTICLE_CONFIGS.deathNormal;
    
    const emitter = this.add.particles(monster.x, monster.y, 'particle', config);
    this.time.delayedCall(1500, () => emitter.destroy());
}
```

- 数据结构与配置：
  - 精英技能列表：`ELITE_SKILLS`（每个精英2个技能）
  - Boss技能列表：`BOSS_SKILLS`（每个Boss3-5个技能）
  - 阶段配置：`BOSS_PHASES`（每个Boss3个阶段）

- 兼容性与迁移影响：
  - 现有怪物生成逻辑保持不变，技能和阶段为可选字段
  - 旧存档怪物无技能状态，自动初始化为空
  - 视觉增强为纯表现层，不影响游戏逻辑

## 5. 实现计划

- 任务拆分：
  
  **阶段一：怪物技能基础**
  1. 创建 `monster-skill.ts` 数据模型
  2. 创建 `monster-skill-system.ts` 执行逻辑
  3. 扩展 Monster 接口添加 skillState
  4. 为精英怪配置首批技能（8个）
  5. 在 Game.ts 中集成技能执行（每帧检查冷却）
  
  **阶段二：Boss阶段系统**
  6. 定义 MonsterPhase 接口
  7. 扩展 Monster 接口添加 currentPhase, phases
  8. 创建 Boss阶段配置（5个Boss）
  9. 在战斗循环中检测血量阈值触发阶段转换
  10. 添加阶段转换消息显示
  
  **阶段三：视觉增强**
  11. 创建 `particle-configs.ts` 粒子配置
  12. 添加受击闪光效果（修改现有伤害函数）
  13. 添加死亡粒子效果
  14. 添加Boss技能预警圆环
  15. 创建粒子纹理资源（或使用简单形状）
  
  **阶段四：数值平衡**
  16. 运行战斗模拟器基准测试
  17. 调整怪物技能伤害倍率
  18. 调整Boss阶段属性加成
  19. 验证战斗时长和难度曲线

- 预计改动文件：
  - 新增: `src/game/models/monster-skill.ts`
  - 新增: `src/game/systems/monster-skill-system.ts`
  - 新增: `src/game/configs/particle-configs.ts`
  - 修改: `src/game/models/monster.ts`（添加字段）
  - 修改: `src/game/models/index.ts`（导出新类型）
  - 修改: `src/game/scenes/Game.ts`（集成技能、视觉）
  - 修改: `src/game/systems/monster-system.ts`（配置技能）
  - 新增: `.agents/docs/06-content/2026-04-17-monster-skill-and-boss-system.md`

- 风险点与回滚方案：
  - 风险1：Boss技能过强导致玩家频繁死亡
    - 缓解：初期设置较低伤害倍率，后续根据测试调整
    - 回滚：可临时禁用Boss技能，仅保留基础攻击
  
  - 风险2：粒子效果影响性能
    - 缓解：限制同屏粒子数量，使用对象池
    - 回滚：提供设置选项关闭粒子效果
  
  - 风险3：阶段转换卡顿
    - 缓解：阶段数据预加载，避免运行时资源加载
    - 回滚：简化阶段转换，仅改变属性不加技能

## 6. 测试计划

- 手工测试步骤：
  
  **怪物技能测试**
  1. 进入地牢，找到精英怪
  2. 观察精英怪是否释放技能（冷却、效果）
  3. 验证技能伤害数值正确
  4. 检查技能视觉效果正常显示
  
  **Boss阶段测试**
  5. 找到Boss，观察初始行为
  6. 将Boss血量降至75%，验证第一阶段转换
  7. 检查阶段转换消息显示
  8. 验证新技能解锁和使用
  9. 继续降至50%和25%，重复验证
  
  **视觉效果测试**
  10. 攻击怪物，观察受击白色闪光（100ms）
  11. 击杀普通怪，观察灰色粒子爆发
  12. 击杀精英怪，观察较大粒子效果
  13. 击杀Boss，观察大型彩色粒子爆发
  14. 观察Boss技能预警圆环（1秒）
  
  **数值平衡验证**
  15. 运行战斗模拟器（`scripts/balance_simulator.py`）
  16. 验证Boss战时长在30-90秒范围
  17. 验证玩家死亡率合理（不过高）
  18. 对比调整前后的胜率变化

- 边界情况：
  - 怪物技能在冷却中无法释放
  - Boss在同一血量阈值不会重复触发阶段
  - 多个怪物同时释放技能时不冲突
  - 粒子效果在怪物移除后正确清理
  - Boss死亡时取消所有预警效果

- 性能影响检查：
  - 同屏10+怪物技能执行不卡顿
  - Boss战粒子数量限制（<100个活跃粒子）
  - 技能预警圆环动画流畅（60fps）
  - 内存无明显增长（无泄漏）

## 7. 变更记录

- 2026-04-17: 创建文档，记录怪物技能系统、Boss阶段机制与视觉增强设计方案
