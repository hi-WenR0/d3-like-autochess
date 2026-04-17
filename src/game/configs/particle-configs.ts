/** 粒子效果配置 */
export interface ParticleConfig {
    lifespan: number;
    speed: { min: number; max: number } | number;
    scale: { start: number; end: number };
    quantity: number;
    tint?: number | readonly number[];
    alpha?: { start: number; end: number };
    blendMode?: string;
}

/**
 * 粒子效果配置（优化版）
 * 降低视觉强度，保持辨识度
 */
export const PARTICLE_CONFIGS = {
    /** 受击闪光效果 */
    hit: {
        lifespan: 200,
        speed: { min: 80, max: 150 },
        scale: { start: 0.35, end: 0 },
        quantity: 5,
        alpha: { start: 0.8, end: 0 },
    },

    /** 普通怪物死亡效果 */
    deathNormal: {
        lifespan: 400,
        speed: { min: 40, max: 120 },
        scale: { start: 0.7, end: 0 },
        quantity: 12,
        alpha: { start: 0.8, end: 0 },
    },

    /** 精英怪死亡效果 */
    deathElite: {
        lifespan: 500,
        speed: { min: 60, max: 150 },
        scale: { start: 0.9, end: 0 },
        quantity: 18,
        tint: [0xffcc00, 0xffaa00],
        alpha: { start: 0.8, end: 0 },
    },

    /** 稀有怪死亡效果 */
    deathRare: {
        lifespan: 600,
        speed: { min: 80, max: 180 },
        scale: { start: 1.0, end: 0 },
        quantity: 24,
        tint: [0x8800ff, 0xff00ff, 0x00ffff],
        alpha: { start: 0.8, end: 0 },
    },

    /** Boss死亡效果 */
    deathBoss: {
        lifespan: 1000,
        speed: { min: 80, max: 250 },
        scale: { start: 1.4, end: 0 },
        quantity: 35,
        tint: [0xff8800, 0xff4400, 0xffaa00, 0xffff00],
        alpha: { start: 0.8, end: 0 },
    },

    /** 技能预警效果 */
    skillWarning: {
        lifespan: 800,
        speed: 0,
        scale: { start: 0.4, end: 1.0 },
        quantity: 1,
        alpha: { start: 0.35, end: 0.12 },
    },

    /** 火焰效果 */
    fire: {
        lifespan: 350,
        speed: { min: 40, max: 120 },
        scale: { start: 0.6, end: 0 },
        quantity: 10,
        tint: [0xff4400, 0xff8800, 0xffcc00],
        alpha: { start: 0.8, end: 0 },
    },

    /** 毒素效果 */
    poison: {
        lifespan: 400,
        speed: { min: 25, max: 80 },
        scale: { start: 0.45, end: 0 },
        quantity: 8,
        tint: [0x44ff44, 0x88ff44, 0x22ff22],
        alpha: { start: 0.8, end: 0 },
    },

    /** 冰霜效果 */
    ice: {
        lifespan: 450,
        speed: { min: 18, max: 60 },
        scale: { start: 0.5, end: 0 },
        quantity: 7,
        tint: [0x44ccff, 0x88ddff, 0xaaeeff],
        alpha: { start: 0.8, end: 0 },
    },

    /** 暗影效果 */
    dark: {
        lifespan: 500,
        speed: { min: 30, max: 100 },
        scale: { start: 0.65, end: 0 },
        quantity: 10,
        tint: [0x4400aa, 0x8800ff, 0x220066],
        alpha: { start: 0.8, end: 0 },
    },
} as const;

/**
 * 根据怪物类型获取死亡效果配置
 */
export function getDeathParticleConfig(type: 'normal' | 'elite' | 'rare' | 'boss'): ParticleConfig {
    switch (type) {
        case 'elite':
            return PARTICLE_CONFIGS.deathElite;
        case 'rare':
            return PARTICLE_CONFIGS.deathRare;
        case 'boss':
            return PARTICLE_CONFIGS.deathBoss;
        default:
            return PARTICLE_CONFIGS.deathNormal;
    }
}

/**
 * 获取技能粒子效果配置
 */
export function getSkillParticleConfig(effectType: 'hit' | 'fire' | 'poison' | 'ice' | 'dark'): ParticleConfig {
    return PARTICLE_CONFIGS[effectType] ?? PARTICLE_CONFIGS.hit;
}
