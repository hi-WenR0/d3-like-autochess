/** 词条类型 */
export type AffixCategory = 'offensive' | 'defensive' | 'special';

/** 词条 ID */
export type AffixId =
    | 'strength' | 'berserk' | 'crit' | 'critDamage' | 'attackSpeed' | 'penetration' | 'lifeSteal'
    | 'vitality' | 'toughness' | 'hpRegen' | 'damageReduction' | 'evasion'
    | 'combo' | 'whirlwind' | 'rebirth' | 'predator' | 'berserker' | 'immortal'
    | 'skillDamage' | 'triggerCooldown' | 'activeCooldown' | 'healingSkillPower' | 'elementalSkillDamage';

/** 词条定义 */
export interface AffixDef {
    id: AffixId;
    name: string;
    category: AffixCategory;
    weight: number;         // 随机权重
    minValue: number;
    maxValue: number;
    restrictedRarity?: Rarity[];  // 限制出现的稀有度
}

import type { Rarity } from './equipment';

/** 攻击类词条 */
export const OFFENSIVE_AFFIXES: ReadonlyArray<AffixDef> = [
    { id: 'strength',     name: '力量',     category: 'offensive', weight: 100, minValue: 5,   maxValue: 50  },
    { id: 'berserk',      name: '狂暴',     category: 'offensive', weight: 40,  minValue: 10,  maxValue: 30, restrictedRarity: ['rare', 'legendary', 'mythic'] },
    { id: 'crit',         name: '暴击',     category: 'offensive', weight: 40,  minValue: 2,   maxValue: 15, restrictedRarity: ['rare', 'legendary', 'mythic'] },
    { id: 'critDamage',   name: '暴击伤害', category: 'offensive', weight: 40,  minValue: 10,  maxValue: 80, restrictedRarity: ['rare', 'legendary', 'mythic'] },
    { id: 'attackSpeed',  name: '攻速',     category: 'offensive', weight: 30,  minValue: 5,   maxValue: 25, restrictedRarity: ['rare', 'legendary', 'mythic'] },
    { id: 'penetration',  name: '穿透',     category: 'offensive', weight: 15,  minValue: 10,  maxValue: 50, restrictedRarity: ['legendary', 'mythic'] },
    { id: 'lifeSteal',    name: '吸血',     category: 'offensive', weight: 15,  minValue: 1,   maxValue: 10, restrictedRarity: ['legendary', 'mythic'] },
];

/** 防御类词条 */
export const DEFENSIVE_AFFIXES: ReadonlyArray<AffixDef> = [
    { id: 'vitality',         name: '体质',     category: 'defensive', weight: 100, minValue: 20,  maxValue: 200 },
    { id: 'toughness',        name: '坚韧',     category: 'defensive', weight: 100, minValue: 5,   maxValue: 40  },
    { id: 'hpRegen',          name: '生命回复', category: 'defensive', weight: 30,  minValue: 1,   maxValue: 20, restrictedRarity: ['rare', 'legendary', 'mythic'] },
    { id: 'damageReduction',  name: '伤害减免', category: 'defensive', weight: 25,  minValue: 2,   maxValue: 15, restrictedRarity: ['rare', 'legendary', 'mythic'] },
    { id: 'evasion',          name: '闪避',     category: 'defensive', weight: 25,  minValue: 2,   maxValue: 12, restrictedRarity: ['rare', 'legendary', 'mythic'] },
];

/** 特殊词条（仅传奇/神话） */
export const SPECIAL_AFFIXES: ReadonlyArray<AffixDef> = [
    { id: 'combo',                name: '连击',     category: 'special', weight: 20, minValue: 20,  maxValue: 20,  restrictedRarity: ['legendary', 'mythic'] },
    { id: 'skillDamage',          name: '技能增幅', category: 'special', weight: 18, minValue: 6,   maxValue: 18,  restrictedRarity: ['rare', 'legendary', 'mythic'] },
    { id: 'whirlwind',            name: '旋风斩',   category: 'special', weight: 15, minValue: 15,  maxValue: 15,  restrictedRarity: ['legendary', 'mythic'] },
    { id: 'activeCooldown',       name: '主动冷却', category: 'special', weight: 12, minValue: 5,   maxValue: 15,  restrictedRarity: ['rare', 'legendary', 'mythic'] },
    { id: 'healingSkillPower',    name: '技能治疗', category: 'special', weight: 12, minValue: 8,   maxValue: 25,  restrictedRarity: ['rare', 'legendary', 'mythic'] },
    { id: 'triggerCooldown',      name: '触发冷却', category: 'special', weight: 12, minValue: 6,   maxValue: 18,  restrictedRarity: ['legendary', 'mythic'] },
    { id: 'rebirth',              name: '复活甲',   category: 'special', weight: 10, minValue: 30,  maxValue: 30,  restrictedRarity: ['legendary', 'mythic'] },
    { id: 'predator',             name: '掠夺者',   category: 'special', weight: 10, minValue: 10,  maxValue: 10,  restrictedRarity: ['legendary', 'mythic'] },
    { id: 'elementalSkillDamage', name: '元素技能', category: 'special', weight: 10, minValue: 8,   maxValue: 25,  restrictedRarity: ['legendary', 'mythic'] },
    { id: 'berserker',            name: '狂战士',   category: 'special', weight: 8,  minValue: 100, maxValue: 100, restrictedRarity: ['legendary', 'mythic'] },
    { id: 'immortal',             name: '不朽',     category: 'special', weight: 5,  minValue: 120, maxValue: 120, restrictedRarity: ['mythic'] },
];

/** 全部词条表 */
export const ALL_AFFIXES: ReadonlyArray<AffixDef> = [
    ...OFFENSIVE_AFFIXES,
    ...DEFENSIVE_AFFIXES,
    ...SPECIAL_AFFIXES,
];

/** 词条实例（附着在装备上） */
export interface Affix {
    id: AffixId;
    name: string;
    category: AffixCategory;
    value: number;  // 随机后的实际数值
}
