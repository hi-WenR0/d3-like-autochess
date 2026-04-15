import {
    type Equipment,
    type CharacterBaseClass,
    type Rarity,
    type WearableSlot,
    type WeaponType,
    type Affix,
    type AffixDef,
    type AffixId,
    RARITY_CONFIG,
    ALL_AFFIXES,
    type EquipBaseStatsRange,
    WEAPON_CLASS_RESTRICTIONS,
} from '../models';
import { type Monster, MONSTER_TYPE_CONFIG } from '../models';

/** 各部位基础属性范围表 */
const BASE_STATS_TABLE: Record<WearableSlot, EquipBaseStatsRange> = {
    helmet:   { hp: [10, 50], def: [5, 20] },
    armor:    { hp: [20, 100], def: [10, 40] },
    gloves:   { atk: [5, 15], attackSpeed: [5, 15] },
    belt:     { hp: [10, 30], def: [5, 15] },
    legs:     { def: [10, 30], moveSpeed: [5, 15] },
    boots:    { def: [5, 20], moveSpeed: [10, 25] },
    weapon:   { atk: [20, 100], attackSpeed: [10, 30] },
    necklace: { atk: [5, 20], critRate: [5, 15] },
    ring:     { atk: [10, 30], critDamage: [10, 40] },
};

/** 武器类型对应名称前缀 */
const WEAPON_NAMES: Record<WeaponType, string[]> = {
    sword:      ['铁剑', '长剑', '阔剑'],
    greatsword: ['巨剑', '双手剑', '斩马刀'],
    dagger:     ['匕首', '短刀', '暗刃'],
    staff:      ['法杖', '魔杖', '权杖'],
    bow:        ['短弓', '长弓', '弩'],
};

/** 部位名称前缀 */
const SLOT_NAMES: Record<WearableSlot, string[]> = {
    helmet:   ['铁盔', '皮帽', '战冠'],
    armor:    ['胸甲', '战袍', '锁子甲'],
    gloves:   ['手套', '护手', '拳套'],
    belt:     ['腰带', '束带', '锁链腰带'],
    legs:     ['护腿', '胫甲', '腿铠'],
    boots:    ['靴子', '战靴', '铁靴'],
    weapon:   [], // 由武器类型决定
    necklace: ['项链', '护符', '坠饰'],
    ring:     ['戒指', '指环', '秘环'],
};

/** 掉落概率：普通怪 30% 装备, 70% 金币/材料 */
export function shouldDropEquipment(monster: Monster): boolean {
    if (MONSTER_TYPE_CONFIG[monster.type].guaranteedDrop) return true;
    return Math.random() < 0.3;
}

/** Boss 掉落数量 */
export function bossDropCount(): number {
    return 3 + Math.floor(Math.random() * 3); // 3-5 件
}

/** 按稀有度权重随机 */
export function rollRarity(minRarity?: Rarity): Rarity {
    const rarities: Rarity[] = ['common', 'magic', 'rare', 'legendary', 'mythic'];
    const totalWeight = rarities.reduce((s, r) => s + RARITY_CONFIG[r].dropWeight, 0);
    let roll = Math.random() * totalWeight;

    let result: Rarity = 'common';
    for (const r of rarities) {
        roll -= RARITY_CONFIG[r].dropWeight;
        if (roll <= 0) {
            result = r;
            break;
        }
    }

    // 确保不低于最低稀有度
    if (minRarity) {
        const order: Rarity[] = ['common', 'magic', 'rare', 'legendary', 'mythic'];
        const minIdx = order.indexOf(minRarity);
        const resultIdx = order.indexOf(result);
        if (resultIdx < minIdx) result = minRarity;
    }

    return result;
}

/** 生成一件装备 */
export function generateEquipment(slot: WearableSlot, level: number, rarity: Rarity, weaponType?: WeaponType): Equipment {
    const resolvedWeaponType = slot === 'weapon' ? (weaponType ?? randomWeaponType()) : undefined;
    const baseStats = rollBaseStats(slot, level);
    const affixes = rollAffixes(rarity);
    const name = generateName(slot, rarity, resolvedWeaponType);
    const allowedClasses = resolveAllowedClasses(slot, resolvedWeaponType);

    return {
        id: generateItemId(),
        name,
        slot,
        rarity,
        weaponType: resolvedWeaponType,
        allowedClasses,
        baseStats,
        affixes,
        level,
    };
}

/** 随机装备部位 */
export function randomSlot(): WearableSlot {
    const slots: WearableSlot[] = ['helmet', 'armor', 'gloves', 'belt', 'legs', 'boots', 'weapon', 'necklace', 'ring'];
    return slots[Math.floor(Math.random() * slots.length)];
}

/** 随机武器类型 */
function randomWeaponType(): WeaponType {
    const types: WeaponType[] = ['sword', 'greatsword', 'dagger', 'staff', 'bow'];
    return types[Math.floor(Math.random() * types.length)];
}

function resolveAllowedClasses(slot: WearableSlot, weaponType?: WeaponType): CharacterBaseClass[] | undefined {
    if (slot !== 'weapon' || !weaponType) {
        return undefined;
    }
    return [...WEAPON_CLASS_RESTRICTIONS[weaponType]];
}

/** 随机基础属性值 */
function rollBaseStats(slot: WearableSlot, level: number): Equipment['baseStats'] {
    const template = BASE_STATS_TABLE[slot];
    const result: Equipment['baseStats'] = {};
    const levelScale = 1 + level * 0.05;

    for (const [key, range] of Object.entries(template)) {
        const [min, max] = range as [number, number];
        const scaledMin = Math.floor(min * levelScale);
        const scaledMax = Math.floor(max * levelScale);
        const value = scaledMin + Math.floor(Math.random() * (scaledMax - scaledMin + 1));
        (result as Record<string, number>)[key] = value;
    }

    return result;
}

/** 随机生成词条 */
function rollAffixes(rarity: Rarity): Affix[] {
    const config = RARITY_CONFIG[rarity];
    const count = config.minAffixes + Math.floor(Math.random() * (config.maxAffixes - config.minAffixes + 1));

    const eligible = ALL_AFFIXES.filter(a =>
        !a.restrictedRarity || a.restrictedRarity.includes(rarity)
    );

    const selected: AffixDef[] = [];
    const usedIds = new Set<AffixId>();

    for (let i = 0; i < count && eligible.length > 0; i++) {
        const available = eligible.filter(a => !usedIds.has(a.id));
        if (available.length === 0) break;

        const totalWeight = available.reduce((s, a) => s + a.weight, 0);
        let roll = Math.random() * totalWeight;

        for (const affix of available) {
            roll -= affix.weight;
            if (roll <= 0) {
                selected.push(affix);
                usedIds.add(affix.id);
                break;
            }
        }
    }

    return selected.map(def => ({
        id: def.id,
        name: def.name,
        category: def.category,
        value: def.minValue + Math.floor(Math.random() * (def.maxValue - def.minValue + 1)),
    }));
}

/** 生成装备名称 */
function generateName(slot: WearableSlot, rarity: Rarity, weaponType?: WeaponType): string {
    const rarityPrefix: Record<Rarity, string> = {
        common: '',
        magic: '魔法',
        rare: '稀有',
        legendary: '传奇',
        mythic: '神话',
    };

    let baseName: string;
    if (slot === 'weapon' && weaponType) {
        const names = WEAPON_NAMES[weaponType];
        baseName = names[Math.floor(Math.random() * names.length)];
    } else {
        const names = SLOT_NAMES[slot];
        baseName = names[Math.floor(Math.random() * names.length)];
    }

    return `${rarityPrefix[rarity]}${baseName}`;
}

let _itemIdCounter = 0;
function generateItemId(): string {
    return `eq_${Date.now()}_${++_itemIdCounter}`;
}
