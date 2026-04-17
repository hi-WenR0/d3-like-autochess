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
 * 粒子效果配置
 */
export const PARTICLE_CONFIGS = {
    /** 受击闪光效果 */
    hit: {
        lifespan: 300,
        speed: { min: 100, max: 200 },
        scale: { start: 0.5, end: 0 },
        quantity: 8,
        alpha: { start: 1, end: 0 },
    },

    /** 普通怪物死亡效果 */
    deathNormal: {
        lifespan: 600,
        speed: { min: 50, max: 150 },
        scale: { start: 1, end: 0 },
        quantity: 20,
        alpha: { start: 1, end: 0 },
    },

    /** 精英怪死亡效果 */
    deathElite: {
        lifespan: 800,
        speed: { min: 80, max: 200 },
        scale: { start: 1.2, end: 0 },
        quantity: 30,
        tint: [0xffcc00, 0xffaa00],
        alpha: { start: 1, end: 0 },
    },

    /** 稀有怪死亡效果 */
    deathRare: {
        lifespan: 1000,
        speed: { min: 100, max: 250 },
        scale: { start: 1.5, end: 0 },
        quantity: 40,
        tint: [0x8800ff, 0xff00ff, 0x00ffff],
        alpha: { start: 1, end: 0 },
    },

    /** Boss死亡效果 */
    deathBoss: {
        lifespan: 1500,
        speed: { min: 100, max: 350 },
        scale: { start: 2, end: 0 },
        quantity: 60,
        tint: [0xff8800, 0xff4400, 0xffaa00, 0xffff00],
        alpha: { start: 1, end: 0 },
    },

    /** 技能预警效果 */
    skillWarning: {
        lifespan: 1000,
        speed: 0,
        scale: { start: 0.5, end: 1.2 },
        quantity: 1,
        alpha: { start: 0.6, end: 0.2 },
    },

    /** 火焰效果 */
    fire: {
        lifespan: 400,
        speed: { min: 50, max: 150 },
        scale: { start: 0.8, end: 0 },
        quantity: 15,
        tint: [0xff4400, 0xff8800, 0xffcc00],
        alpha: { start: 1, end: 0 },
    },

    /** 毒素效果 */
    poison: {
        lifespan: 500,
        speed: { min: 30, max: 100 },
        scale: { start: 0.6, end: 0 },
        quantity: 12,
        tint: [0x44ff44, 0x88ff44, 0x22ff22],
        alpha: { start: 1, end: 0 },
    },

    /** 冰霜效果 */
    ice: {
        lifespan: 600,
        speed: { min: 20, max: 80 },
        scale: { start: 0.7, end: 0 },
        quantity: 10,
        tint: [0x44ccff, 0x88ddff, 0xaaeeff],
        alpha: { start: 1, end: 0 },
    },

    /** 暗影效果 */
    dark: {
        lifespan: 700,
        speed: { min: 40, max: 120 },
        scale: { start: 0.9, end: 0 },
        quantity: 14,
        tint: [0x4400aa, 0x8800ff, 0x220066],
        alpha: { start: 1, end: 0 },
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
