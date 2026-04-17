import type { MonsterSkillDefinition, MonsterPhase } from '../models';

/**
 * 精英怪技能定义
 */
export const ELITE_SKILLS: Record<string, MonsterSkillDefinition[]> = {
    'skeleton-captain': [
        {
            id: 'rally-cry',
            name: '召集令',
            description: '号召附近的怪物一起进攻',
            type: 'active',
            cooldownMs: 15000,
            conditions: [{ type: 'targetInRange', value: 200 }],
            effects: [{ type: 'buff', buffStat: 'aggroRadius', buffValue: 1.3, buffDuration: 8000 }],
            priority: 5,
            visual: { warningColor: 0xffaa00, warningDuration: 500 },
        },
        {
            id: 'power-strike',
            name: '重击',
            description: '蓄力后发动强力一击',
            type: 'active',
            cooldownMs: 10000,
            conditions: [{ type: 'targetInRange', value: 80 }],
            effects: [{ type: 'damage', damageMultiplier: 1.8, knockback: 50 }],
            priority: 3,
            visual: { warningColor: 0xff4444, warningDuration: 800 },
        },
    ],
    'shadow-hunter': [
        {
            id: 'shadow-step',
            name: '暗影步',
            description: '瞬间接近目标',
            type: 'active',
            cooldownMs: 12000,
            conditions: [{ type: 'always' }],
            effects: [{ type: 'damage', damageMultiplier: 1.3 }],
            priority: 4,
            visual: { warningColor: 0x8800ff, warningDuration: 600 },
        },
        {
            id: 'venom-strike',
            name: '毒刃',
            description: '施加毒素伤害',
            type: 'active',
            cooldownMs: 8000,
            conditions: [{ type: 'targetInRange', value: 60 }],
            effects: [{ type: 'damage', damageMultiplier: 1.5 }],
            priority: 3,
            visual: { particleEffect: 'poison' },
        },
    ],
    'corrosive-beast': [
        {
            id: 'acid-spray',
            name: '酸液喷射',
            description: '向目标喷射腐蚀酸液',
            type: 'active',
            cooldownMs: 10000,
            conditions: [{ type: 'targetInRange', value: 180 }],
            effects: [{ type: 'projectile', damageMultiplier: 1.4, projectileSpeed: 200 }],
            priority: 4,
            visual: { warningColor: 0x44ff44, warningDuration: 700, particleEffect: 'poison' },
        },
        {
            id: 'corrosive-armor',
            name: '腐蚀护甲',
            description: '提升自身防御',
            type: 'passive',
            cooldownMs: 20000,
            conditions: [{ type: 'hpBelow', value: 0.5 }],
            effects: [{ type: 'buff', buffStat: 'atk', buffValue: 1.2, buffDuration: 10000 }],
            priority: 2,
        },
    ],
    'bloody-attendant': [
        {
            id: 'blood-frenzy',
            name: '血之狂暴',
            description: '进入狂暴状态，提升攻击力',
            type: 'active',
            cooldownMs: 18000,
            conditions: [{ type: 'hpBelow', value: 0.6 }],
            effects: [{ type: 'buff', buffStat: 'atk', buffValue: 1.5, buffDuration: 12000 }],
            priority: 5,
            visual: { warningColor: 0xff0000, warningDuration: 500 },
        },
        {
            id: 'life-drain',
            name: '生命汲取',
            description: '吸取目标生命',
            type: 'active',
            cooldownMs: 12000,
            conditions: [{ type: 'targetInRange', value: 120 }],
            effects: [
                { type: 'damage', damageMultiplier: 1.2 },
                { type: 'heal', healRatio: 0.15 },
            ],
            priority: 4,
            visual: { particleEffect: 'dark' },
        },
    ],
};

/**
 * Boss技能定义
 */
export const BOSS_SKILLS: Record<string, MonsterSkillDefinition[]> = {
    'mine-warden': [
        {
            id: 'ground-slam',
            name: '地裂',
            description: '猛击地面，造成范围伤害',
            type: 'active',
            cooldownMs: 8000,
            conditions: [{ type: 'targetInRange', value: 100 }],
            effects: [{ type: 'aoe', damageMultiplier: 1.6, radius: 120 }],
            priority: 5,
            visual: { warningColor: 0xff6600, warningDuration: 1000 },
        },
        {
            id: 'summon-miners',
            name: '召唤矿工',
            description: '召唤骷髅矿工协助战斗',
            type: 'active',
            cooldownMs: 20000,
            conditions: [{ type: 'hpBelow', value: 0.8 }],
            effects: [{ type: 'summon', summonType: 'normal', summonCount: 3 }],
            priority: 4,
        },
        {
            id: 'enrage',
            name: '狂暴',
            description: '进入狂暴状态，大幅提升攻击力',
            type: 'trigger',
            cooldownMs: 30000,
            conditions: [{ type: 'hpBelow', value: 0.3 }],
            effects: [{ type: 'buff', buffStat: 'atk', buffValue: 1.8, buffDuration: 20000 }],
            priority: 6,
            visual: { warningColor: 0xff0000, warningDuration: 1500 },
        },
    ],
    'forest-king': [
        {
            id: 'nature-wrath',
            name: '自然之怒',
            description: '召唤自然之力打击目标',
            type: 'active',
            cooldownMs: 10000,
            conditions: [{ type: 'always' }],
            effects: [{ type: 'projectile', damageMultiplier: 1.4, projectileSpeed: 180 }],
            priority: 4,
            visual: { particleEffect: 'poison' },
        },
        {
            id: 'summon-beasts',
            name: '召唤野兽',
            description: '召唤森林野兽',
            type: 'active',
            cooldownMs: 18000,
            conditions: [{ type: 'hpBelow', value: 0.7 }],
            effects: [{ type: 'summon', summonType: 'normal', summonCount: 4 }],
            priority: 3,
        },
        {
            id: 'root-bind',
            name: '根须缠绕',
            description: '释放根须束缚目标',
            type: 'active',
            cooldownMs: 12000,
            conditions: [{ type: 'targetInRange', value: 150 }],
            effects: [{ type: 'aoe', damageMultiplier: 1.2, radius: 80 }],
            priority: 5,
        },
    ],
    'lava-heart': [
        {
            id: 'lava-burst',
            name: '熔岩爆发',
            description: '喷发熔岩造成大范围伤害',
            type: 'active',
            cooldownMs: 8000,
            conditions: [{ type: 'always' }],
            effects: [{ type: 'aoe', damageMultiplier: 1.5, radius: 150 }],
            priority: 5,
            visual: { warningColor: 0xff4400, warningDuration: 1200, particleEffect: 'fire' },
        },
        {
            id: 'fireball',
            name: '火球',
            description: '发射追踪火球',
            type: 'active',
            cooldownMs: 6000,
            conditions: [{ type: 'targetInRange', value: 250 }],
            effects: [{ type: 'projectile', damageMultiplier: 1.3, projectileSpeed: 220 }],
            priority: 3,
            visual: { particleEffect: 'fire' },
        },
        {
            id: 'summon-fire-elemental',
            name: '召唤火元素',
            description: '召唤小型火元素',
            type: 'active',
            cooldownMs: 25000,
            conditions: [{ type: 'hpBelow', value: 0.5 }],
            effects: [{ type: 'summon', summonType: 'elite', summonCount: 2 }],
            priority: 4,
        },
    ],
    'abyss-lord': [
        {
            id: 'void-slash',
            name: '虚空斩',
            description: '撕裂空间造成伤害',
            type: 'active',
            cooldownMs: 7000,
            conditions: [{ type: 'targetInRange', value: 100 }],
            effects: [{ type: 'damage', damageMultiplier: 2.0 }],
            priority: 5,
            visual: { warningColor: 0x8800ff, warningDuration: 900, particleEffect: 'dark' },
        },
        {
            id: 'shadow-vortex',
            name: '暗影漩涡',
            description: '创造暗影漩涡吸收目标',
            type: 'active',
            cooldownMs: 15000,
            conditions: [{ type: 'always' }],
            effects: [{ type: 'aoe', damageMultiplier: 1.4, radius: 100 }],
            priority: 4,
            visual: { particleEffect: 'dark' },
        },
        {
            id: 'summon-shadows',
            name: '召唤暗影',
            description: '召唤暗影仆从',
            type: 'active',
            cooldownMs: 20000,
            conditions: [{ type: 'hpBelow', value: 0.6 }],
            effects: [{ type: 'summon', summonType: 'elite', summonCount: 2 }],
            priority: 3,
        },
        {
            id: 'dark-empowerment',
            name: '黑暗强化',
            description: '大幅提升攻击和仇恨范围',
            type: 'trigger',
            cooldownMs: 30000,
            conditions: [{ type: 'hpBelow', value: 0.25 }],
            effects: [
                { type: 'buff', buffStat: 'atk', buffValue: 2.0, buffDuration: 15000 },
                { type: 'buff', buffStat: 'aggroRadius', buffValue: 1.5, buffDuration: 15000 },
            ],
            priority: 6,
        },
    ],
    'eternal-judge': [
        {
            id: 'judgment',
            name: '审判',
            description: '对目标进行审判',
            type: 'active',
            cooldownMs: 10000,
            conditions: [{ type: 'targetInRange', value: 200 }],
            effects: [{ type: 'projectile', damageMultiplier: 1.8, projectileSpeed: 200 }],
            priority: 5,
            visual: { warningColor: 0xffffff, warningDuration: 1000 },
        },
        {
            id: 'final-verdict',
            name: '最终裁决',
            description: '发动毁灭性打击',
            type: 'active',
            cooldownMs: 20000,
            conditions: [{ type: 'hpBelow', value: 0.5 }],
            effects: [{ type: 'aoe', damageMultiplier: 2.5, radius: 180 }],
            priority: 6,
            visual: { warningColor: 0xffcc00, warningDuration: 2000 },
        },
        {
            id: 'summon-judges',
            name: '召唤判官',
            description: '召唤审判者协助',
            type: 'active',
            cooldownMs: 25000,
            conditions: [{ type: 'hpBelow', value: 0.7 }],
            effects: [{ type: 'summon', summonType: 'rare', summonCount: 1 }],
            priority: 4,
        },
        {
            id: 'eternal-bind',
            name: '永恒束缚',
            description: '束缚目标，降低移动速度',
            type: 'active',
            cooldownMs: 12000,
            conditions: [{ type: 'always' }],
            effects: [{ type: 'aoe', damageMultiplier: 1.3, radius: 100 }],
            priority: 3,
        },
    ],
};

/**
 * Boss阶段配置
 */
export const BOSS_PHASES: Record<string, MonsterPhase[]> = {
    'mine-warden': [
        { phase: 1, hpThreshold: 1.0, skillOverrides: ['ground-slam'], message: '矿坑守卫苏醒了！' },
        { phase: 2, hpThreshold: 0.75, skillOverrides: ['ground-slam', 'summon-miners'], message: '矿坑守卫召唤了援军！' },
        { phase: 3, hpThreshold: 0.50, skillOverrides: ['ground-slam', 'summon-miners', 'enrage'], aggroRadiusMultiplier: 1.5, atkMultiplier: 1.3, message: '矿坑守卫进入狂暴状态！' },
    ],
    'forest-king': [
        { phase: 1, hpThreshold: 1.0, skillOverrides: ['nature-wrath'], message: '森林之王现身了！' },
        { phase: 2, hpThreshold: 0.70, skillOverrides: ['nature-wrath', 'summon-beasts', 'root-bind'], message: '森林之王召唤了野兽！' },
        { phase: 3, hpThreshold: 0.35, skillOverrides: ['nature-wrath', 'summon-beasts', 'root-bind'], aggroRadiusMultiplier: 1.4, atkMultiplier: 1.4, message: '森林之王愤怒了！' },
    ],
    'lava-heart': [
        { phase: 1, hpThreshold: 1.0, skillOverrides: ['lava-burst', 'fireball'], message: '熔岩之心开始燃烧！' },
        { phase: 2, hpThreshold: 0.65, skillOverrides: ['lava-burst', 'fireball', 'summon-fire-elemental'], message: '熔岩之心召唤了火元素！' },
        { phase: 3, hpThreshold: 0.30, skillOverrides: ['lava-burst', 'fireball', 'summon-fire-elemental'], aggroRadiusMultiplier: 1.6, atkMultiplier: 1.5, message: '熔岩之心爆发了！' },
    ],
    'abyss-lord': [
        { phase: 1, hpThreshold: 1.0, skillOverrides: ['void-slash', 'shadow-vortex'], message: '深渊领主降临了！' },
        { phase: 2, hpThreshold: 0.60, skillOverrides: ['void-slash', 'shadow-vortex', 'summon-shadows'], message: '深渊领主召唤了暗影！' },
        { phase: 3, hpThreshold: 0.25, skillOverrides: ['void-slash', 'shadow-vortex', 'summon-shadows', 'dark-empowerment'], aggroRadiusMultiplier: 1.8, atkMultiplier: 1.6, message: '深渊领主释放了真正力量！' },
    ],
    'eternal-judge': [
        { phase: 1, hpThreshold: 1.0, skillOverrides: ['judgment', 'eternal-bind'], message: '永恒判官开始审判！' },
        { phase: 2, hpThreshold: 0.55, skillOverrides: ['judgment', 'eternal-bind', 'summon-judges'], message: '永恒判官召唤了助手！' },
        { phase: 3, hpThreshold: 0.25, skillOverrides: ['judgment', 'eternal-bind', 'summon-judges', 'final-verdict'], aggroRadiusMultiplier: 1.5, atkMultiplier: 2.0, message: '永恒判官宣读最终裁决！' },
    ],
};

/**
 * 获取怪物的技能定义
 */
export function getMonsterSkills(catalogId: string, type: 'normal' | 'elite' | 'rare' | 'boss'): MonsterSkillDefinition[] {
    if (type === 'elite') {
        return ELITE_SKILLS[catalogId] ?? [];
    }
    if (type === 'boss') {
        return BOSS_SKILLS[catalogId] ?? [];
    }
    return [];
}

/**
 * 获取Boss的阶段配置
 */
export function getBossPhases(catalogId: string): MonsterPhase[] {
    return BOSS_PHASES[catalogId] ?? [];
}
