import type { MonsterType } from './monster';
import type { MovementStrategy } from './combat';

/** 怪物技能类型 */
export type MonsterSkillType = 'active' | 'passive' | 'trigger';

/** 技能效果类型 */
export type MonsterSkillEffectType = 'damage' | 'heal' | 'buff' | 'summon' | 'projectile' | 'aoe';

/** 技能触发条件 */
export interface MonsterSkillCondition {
    type: 'always' | 'hpBelow' | 'hpAbove' | 'targetInRange' | 'cooldownReady' | 'phase';
    value?: number;
}

/** 技能效果 */
export interface MonsterSkillEffect {
    type: MonsterSkillEffectType;
    /** 伤害倍率（基于怪物攻击力） */
    damageMultiplier?: number;
    /** 治疗比例（基于最大生命值） */
    healRatio?: number;
    /** 增益属性名 */
    buffStat?: 'atk' | 'moveSpeed' | 'aggroRadius';
    /** 增益数值（倍率） */
    buffValue?: number;
    /** 增益持续时间（毫秒） */
    buffDuration?: number;
    /** 召唤怪物类型 */
    summonType?: MonsterType;
    /** 召唤数量 */
    summonCount?: number;
    /** 投射物速度 */
    projectileSpeed?: number;
    /** AOE半径 */
    radius?: number;
    /** 击退距离 */
    knockback?: number;
}

/** 技能视觉配置 */
export interface MonsterSkillVisual {
    /** 预警颜色 */
    warningColor?: number;
    /** 预警持续时间（毫秒） */
    warningDuration?: number;
    /** 技能图标纹理 */
    texture?: string;
    /** 粒子效果类型 */
    particleEffect?: 'hit' | 'fire' | 'poison' | 'ice' | 'dark';
    /** 投射物纹理 */
    projectileTexture?: string;
}

/** 怪物技能定义 */
export interface MonsterSkillDefinition {
    /** 技能唯一ID */
    id: string;
    /** 技能名称 */
    name: string;
    /** 技能描述 */
    description: string;
    /** 技能类型 */
    type: MonsterSkillType;
    /** 冷却时间（毫秒） */
    cooldownMs: number;
    /** 触发条件 */
    conditions: MonsterSkillCondition[];
    /** 技能效果 */
    effects: MonsterSkillEffect[];
    /** 优先级（数字越大优先级越高） */
    priority: number;
    /** 视觉配置 */
    visual?: MonsterSkillVisual;
}

/** 怪物技能运行时状态 */
export interface MonsterSkillState {
    /** 技能ID */
    skillId: string;
    /** 剩余冷却时间（毫秒） */
    cooldownRemaining: number;
    /** 上次释放时间戳 */
    lastCastTime: number;
}

/** Boss阶段定义 */
export interface MonsterPhase {
    /** 阶段编号 */
    phase: number;
    /** 血量阈值触发（0-1） */
    hpThreshold: number;
    /** 该阶段可用技能（覆盖默认） */
    skillOverrides?: string[];
    /** 移动策略覆盖 */
    movementStrategyOverride?: MovementStrategy;
    /** 仇恨半径倍率 */
    aggroRadiusMultiplier?: number;
    /** 攻击力倍率 */
    atkMultiplier?: number;
    /** 阶段转换消息 */
    message?: string;
}

/** 技能执行上下文 */
export interface SkillExecutionContext {
    /** 当前游戏时间戳 */
    time: number;
    /** 玩家位置 */
    playerX: number;
    playerY: number;
    /** 怪物所在场景引用（用于创建视觉效果） */
    scene?: Phaser.Scene;
}

/** 技能执行结果 */
export interface SkillExecutionResult {
    /** 是否成功执行 */
    success: boolean;
    /** 造成的伤害 */
    damage?: number;
    /** 治疗量 */
    heal?: number;
    /** 召唤的怪物 */
    summonedMonsters?: Array<{ type: MonsterType; x: number; y: number }>;
    /** 是否需要显示预警 */
    showWarning?: boolean;
    /** 预警位置和范围 */
    warningPosition?: { x: number; y: number; radius: number; color: number; duration: number };
}
