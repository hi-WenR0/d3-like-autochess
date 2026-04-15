import type { Affix } from './affix';
import type { CharacterBaseClass } from './character';

/** 装备部位 */
export type EquipSlot = 'helmet' | 'armor' | 'gloves' | 'belt' | 'legs' | 'boots' | 'weapon' | 'necklace' | 'ring1' | 'ring2';

/** 所有装备部位列表 */
export const EQUIP_SLOTS: ReadonlyArray<EquipSlot> = [
    'helmet', 'armor', 'gloves', 'belt', 'legs', 'boots', 'weapon', 'necklace', 'ring1', 'ring2',
];

/** 可穿戴部位（ring1/ring2 统一为 ring） */
export type WearableSlot = 'helmet' | 'armor' | 'gloves' | 'belt' | 'legs' | 'boots' | 'weapon' | 'necklace' | 'ring';

/** 部位到穿戴槽位映射 */
export const SLOT_TO_WEARABLE: Record<EquipSlot, WearableSlot> = {
    helmet: 'helmet',
    armor: 'armor',
    gloves: 'gloves',
    belt: 'belt',
    legs: 'legs',
    boots: 'boots',
    weapon: 'weapon',
    necklace: 'necklace',
    ring1: 'ring',
    ring2: 'ring',
};

/** 武器类型 */
export type WeaponType = 'sword' | 'greatsword' | 'dagger' | 'staff' | 'bow';

/** 物品稀有度 */
export type Rarity = 'common' | 'magic' | 'rare' | 'legendary' | 'mythic';

/** 稀有度配置 */
export const RARITY_CONFIG: Record<Rarity, RarityDef> = {
    common:    { color: '#9d9d9d', dropWeight: 60,   minAffixes: 0, maxAffixes: 1 },
    magic:     { color: '#0070dd', dropWeight: 25,   minAffixes: 1, maxAffixes: 2 },
    rare:      { color: '#ff8000', dropWeight: 12,   minAffixes: 2, maxAffixes: 4 },
    legendary: { color: '#ff8000', dropWeight: 2.5,  minAffixes: 3, maxAffixes: 5 },
    mythic:    { color: '#e6cc80', dropWeight: 0.5,  minAffixes: 4, maxAffixes: 6 },
};

export interface RarityDef {
    color: string;
    dropWeight: number;
    minAffixes: number;
    maxAffixes: number;
}

/** 装备基础属性范围（用于数据表定义） */
export interface EquipBaseStatsRange {
    hp?: [number, number];
    atk?: [number, number];
    def?: [number, number];
    attackSpeed?: [number, number];
    critRate?: [number, number];
    critDamage?: [number, number];
    moveSpeed?: [number, number];
}

/** 装备基础属性（实例上的实际值） */
export interface EquipBaseStats {
    hp?: number;
    atk?: number;
    def?: number;
    attackSpeed?: number;
    critRate?: number;
    critDamage?: number;
    moveSpeed?: number;
}

/** 装备实例 */
export interface Equipment {
    id: string;
    name: string;
    slot: WearableSlot;
    rarity: Rarity;
    weaponType?: WeaponType;
    allowedClasses?: CharacterBaseClass[];
    baseStats: EquipBaseStats;
    affixes: Affix[];
    level: number;
}

export const WEAPON_CLASS_RESTRICTIONS: Readonly<Record<WeaponType, CharacterBaseClass[]>> = {
    sword: ['berserker'],
    greatsword: ['berserker'],
    dagger: ['ranger'],
    bow: ['ranger'],
    staff: ['mage'],
};

export function getAllowedClassesForEquipment(equipment: Equipment): CharacterBaseClass[] | undefined {
    if (equipment.slot !== 'weapon' || !equipment.weaponType) {
        return equipment.allowedClasses;
    }
    return equipment.allowedClasses ?? WEAPON_CLASS_RESTRICTIONS[equipment.weaponType];
}

/** 装备出售价格 */
export function sellPrice(equipment: Equipment): number {
    const base: Record<Rarity, number> = {
        common: 5,
        magic: 20,
        rare: 80,
        legendary: 300,
        mythic: 1000,
    };
    return Math.floor(base[equipment.rarity] * (1 + equipment.level * 0.1));
}
