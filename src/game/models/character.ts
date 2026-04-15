/** 角色基础属性 */
export interface CharacterStats {
    hp: number;
    maxHp: number;
    atk: number;
    def: number;
    attackSpeed: number;    // 每秒攻击次数
    critRate: number;       // 0-100%
    critDamage: number;     // 暴击伤害倍率 (e.g. 150 = 1.5x)
    moveSpeed: number;      // 像素/秒
}

export type CharacterBaseClass = 'berserker' | 'ranger' | 'mage';

export type CharacterSpecialization =
    | 'slayer'
    | 'warlord'
    | 'bloodguard'
    | 'sharpshooter'
    | 'trapper'
    | 'beastmaster'
    | 'elementalist'
    | 'arcanist'
    | 'summoner';

export type CharacterAdvancementState = 'base' | 'eligible' | 'specialized';

export interface CharacterGrowth {
    maxHp: number;
    atk: number;
    def: number;
}

export interface CharacterBaseClassDef {
    id: CharacterBaseClass;
    label: string;
    description: string;
    color: string;
    startingStats: CharacterStats;
    growth: CharacterGrowth;
    specializations: CharacterSpecializationDef[];
}

export interface CharacterSpecializationBonuses {
    hp?: number;
    atk?: number;
    def?: number;
    attackSpeedPct?: number;
    critRate?: number;
    critDamage?: number;
    moveSpeed?: number;
}

export interface CharacterSpecializationDef {
    id: CharacterSpecialization;
    label: string;
    description: string;
    passiveName: string;
    passiveDescription: string;
    bonuses: CharacterSpecializationBonuses;
}

/** 角色完整数据 */
export interface CharacterData {
    id: string;
    name: string;
    baseClass: CharacterBaseClass;
    specialization: CharacterSpecialization | null;
    advancementState: CharacterAdvancementState;
    level: number;
    exp: number;
    expToNextLevel: number;
    statPoints: number;     // 可分配属性点
    allocatedStats: AllocatedStats;
    baseStats: CharacterStats;
    gold: number;
    currentFloor: number;   // 当前地牢层数 (1-based)
}

/** 玩家手动分配的属性点 */
export interface AllocatedStats {
    hp: number;
    atk: number;
    def: number;
    attackSpeed: number;
    critRate: number;
    critDamage: number;
    moveSpeed: number;
}

/** 每点属性点带来的增益 */
export const STAT_PER_POINT: Readonly<Required<AllocatedStats>> = {
    hp: 10,
    atk: 3,
    def: 2,
    attackSpeed: 0.02,
    critRate: 0.5,
    critDamage: 3,
    moveSpeed: 2,
};

export const ADVANCEMENT_REQUIREMENT_LEVEL = 10;

export const BASE_CLASS_CONFIG: Readonly<Record<CharacterBaseClass, CharacterBaseClassDef>> = {
    berserker: {
        id: 'berserker',
        label: '狂战士',
        description: '高生命、高攻击的近战起手，升级收益偏向生存与压制。',
        color: '#e74c3c',
        startingStats: {
            hp: 240,
            maxHp: 240,
            atk: 18,
            def: 6,
            attackSpeed: 0.95,
            critRate: 5,
            critDamage: 155,
            moveSpeed: 98,
        },
        growth: {
            maxHp: 20,
            atk: 3,
            def: 1,
        },
        specializations: [
            {
                id: 'slayer',
                label: '屠戮者',
                description: '偏爆发和斩杀号角。',
                passiveName: '嗜血追击',
                passiveDescription: '提升攻击与暴击伤害，强化斩杀能力。',
                bonuses: { atk: 10, critDamage: 25 },
            },
            {
                id: 'warlord',
                label: '战吼统帅',
                description: '偏团队增幅和压场。',
                passiveName: '战意统御',
                passiveDescription: '提升防御、生命与攻击，构筑更稳的压场输出。',
                bonuses: { hp: 40, atk: 6, def: 4 },
            },
            {
                id: 'bloodguard',
                label: '血怒守卫',
                description: '偏续航和反打。',
                passiveName: '血怒壁垒',
                passiveDescription: '提升生命、防御与少量攻速，强化站场能力。',
                bonuses: { hp: 80, def: 6, attackSpeedPct: 8 },
            },
        ],
    },
    ranger: {
        id: 'ranger',
        label: '游侠',
        description: '高攻速、高暴击率的灵活输出，升级收益偏向节奏与机动。',
        color: '#27ae60',
        startingStats: {
            hp: 190,
            maxHp: 190,
            atk: 14,
            def: 4,
            attackSpeed: 1.2,
            critRate: 8,
            critDamage: 150,
            moveSpeed: 112,
        },
        growth: {
            maxHp: 12,
            atk: 2,
            def: 1,
        },
        specializations: [
            {
                id: 'sharpshooter',
                label: '神射手',
                description: '偏远程单点与爆头。',
                passiveName: '致命瞄准',
                passiveDescription: '提升暴击率、暴击伤害与攻击，偏单体爆发。',
                bonuses: { atk: 8, critRate: 6, critDamage: 20 },
            },
            {
                id: 'trapper',
                label: '陷阱大师',
                description: '偏控制和区域压制。',
                passiveName: '战场布控',
                passiveDescription: '提升攻速、移速与少量防御，偏节奏和拉扯。',
                bonuses: { attackSpeedPct: 14, moveSpeed: 12, def: 3 },
            },
            {
                id: 'beastmaster',
                label: '兽王猎手',
                description: '偏召唤协同与持续输出。',
                passiveName: '狩猎本能',
                passiveDescription: '提升生命、攻击与移速，强化持续追猎。',
                bonuses: { hp: 50, atk: 7, moveSpeed: 10 },
            },
        ],
    },
    mage: {
        id: 'mage',
        label: '法师',
        description: '高暴击伤害与均衡属性的施法者，升级收益偏向输出上限。',
        color: '#3498db',
        startingStats: {
            hp: 180,
            maxHp: 180,
            atk: 16,
            def: 4,
            attackSpeed: 1.05,
            critRate: 6,
            critDamage: 165,
            moveSpeed: 102,
        },
        growth: {
            maxHp: 10,
            atk: 3,
            def: 1,
        },
        specializations: [
            {
                id: 'elementalist',
                label: '元素术士',
                description: '偏元素爆发与范围伤害。',
                passiveName: '元素共鸣',
                passiveDescription: '提升攻击、暴击伤害与少量攻速，偏爆发输出。',
                bonuses: { atk: 12, critDamage: 18, attackSpeedPct: 6 },
            },
            {
                id: 'arcanist',
                label: '奥术学者',
                description: '偏资源循环与法术强化。',
                passiveName: '奥术迭代',
                passiveDescription: '提升攻击、暴击率与移速，偏循环与手感。',
                bonuses: { atk: 8, critRate: 5, moveSpeed: 8 },
            },
            {
                id: 'summoner',
                label: '召唤先知',
                description: '偏召唤体与战场控制。',
                passiveName: '先知护持',
                passiveDescription: '提升生命、防御与暴击伤害，偏稳健成长。',
                bonuses: { hp: 70, def: 5, critDamage: 15 },
            },
        ],
    },
};

export function getBaseClassDef(baseClass: CharacterBaseClass): CharacterBaseClassDef {
    return BASE_CLASS_CONFIG[baseClass];
}

export function getSpecializationDef(
    baseClass: CharacterBaseClass,
    specialization: CharacterSpecialization | null,
): CharacterSpecializationDef | null {
    if (!specialization) return null;
    return BASE_CLASS_CONFIG[baseClass].specializations.find(spec => spec.id === specialization) ?? null;
}

/** 每级所需经验公式 */
export function expForLevel(level: number): number {
    return Math.floor(100 * Math.pow(1.15, level - 1));
}
