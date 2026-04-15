import type { Equipment, EquipSlot } from '../models';

/** 已装备的装备映射 */
export type EquippedItems = Partial<Record<EquipSlot, Equipment>>;

/** 创建空装备栏 */
export function createEquippedItems(): EquippedItems {
    return {};
}

/** 穿戴装备到指定槽位 */
export function equipItem(equipped: EquippedItems, slot: EquipSlot, equipment: Equipment): Equipment | null {
    const previous = equipped[slot] ?? null;
    equipped[slot] = equipment;
    return previous; // 返回被替换的装备
}

/** 卸下指定槽位装备 */
export function unequipItem(equipped: EquippedItems, slot: EquipSlot): Equipment | null {
    const item = equipped[slot] ?? null;
    delete equipped[slot];
    return item;
}

/** 获取指定槽位装备 */
export function getEquipped(equipped: EquippedItems, slot: EquipSlot): Equipment | null {
    return equipped[slot] ?? null;
}

/** 获取所有已装备装备列表 */
export function getAllEquipped(equipped: EquippedItems): Equipment[] {
    return Object.values(equipped).filter((e): e is Equipment => e !== undefined);
}

/** 计算所有装备提供的属性加成 */
export function calculateEquipBonuses(equipped: EquippedItems): EquipBonuses {
    const bonuses: EquipBonuses = {
        hp: 0, atk: 0, def: 0,
        attackSpeed: 0, critRate: 0,
        critDamage: 0, moveSpeed: 0,
    };

    for (const equip of Object.values(equipped)) {
        if (!equip) continue;

        // 基础属性
        const stats = equip.baseStats;
        bonuses.hp += stats.hp ?? 0;
        bonuses.atk += stats.atk ?? 0;
        bonuses.def += stats.def ?? 0;
        bonuses.attackSpeed += stats.attackSpeed ?? 0;
        bonuses.critRate += stats.critRate ?? 0;
        bonuses.critDamage += stats.critDamage ?? 0;
        bonuses.moveSpeed += stats.moveSpeed ?? 0;

        // 词条加成
        for (const affix of equip.affixes) {
            applyAffixBonus(bonuses, affix.id, affix.value);
        }
    }

    return bonuses;
}

export interface EquipBonuses {
    hp: number;
    atk: number;
    def: number;
    attackSpeed: number;   // 百分比加成
    critRate: number;      // 百分比加成
    critDamage: number;    // 百分比加成
    moveSpeed: number;     // 百分比加成
}

/** 应用词条属性到加成对象 */
function applyAffixBonus(bonuses: EquipBonuses, affixId: string, value: number): void {
    switch (affixId) {
        case 'strength':        bonuses.atk += value; break;
        case 'berserk':         bonuses.atk += value; break;  // 百分比，后续在计算时处理
        case 'crit':            bonuses.critRate += value; break;
        case 'critDamage':      bonuses.critDamage += value; break;
        case 'attackSpeed':     bonuses.attackSpeed += value; break;
        case 'penetration':     break;  // 穿透在战斗时计算
        case 'lifeSteal':       break;  // 吸血在战斗时计算
        case 'vitality':        bonuses.hp += value; break;
        case 'toughness':       bonuses.def += value; break;
        case 'hpRegen':         break;  // 生命回复在更新循环中处理
        case 'damageReduction': break;  // 伤害减免在战斗时计算
        case 'evasion':         break;  // 闪避在战斗时计算
        case 'combo':           break;  // 特殊效果在战斗时计算
        case 'whirlwind':       break;
        case 'rebirth':         break;
        case 'predator':        break;
        case 'berserker':       break;
        case 'immortal':        break;
    }
}

/** 查找可用的戒指槽位（ring1 优先，其次 ring2） */
export function findAvailableRingSlot(equipped: EquippedItems): EquipSlot | null {
    if (!equipped.ring1) return 'ring1';
    if (!equipped.ring2) return 'ring2';
    return null;
}
