import type { CharacterData } from '../models/character';
import type { Consumable, ConsumableType, ActiveBuff } from '../models/consumable';
import { CONSUMABLE_DEFS, POTION_HEAL_RATIO } from '../models/consumable';
import { heal, getEffectiveStats } from './character-system';

let consumableIdCounter = 0;

/** 创建消耗品实例 */
export function createConsumable(type: ConsumableType, count = 1): Consumable {
    return {
        id: `cons_${++consumableIdCounter}_${Date.now()}`,
        type,
        count,
    };
}

/** 使用消耗品，返回是否成功 */
export function useConsumable(
    consumable: Consumable,
    character: CharacterData,
    activeBuffs: ActiveBuff[],
    now: number,
): { success: boolean; message: string } {
    const def = CONSUMABLE_DEFS[consumable.type];

    if (def.category === 'potion') {
        return usePotion(consumable, character, def.name);
    } else {
        return useBuff(consumable, character, activeBuffs, now, def.name);
    }
}

/** 使用药水 */
function usePotion(
    consumable: Consumable,
    character: CharacterData,
    name: string,
): { success: boolean; message: string } {
    const ratio = POTION_HEAL_RATIO[consumable.type] ?? 0;
    if (ratio <= 0) return { success: false, message: '无法使用' };

    const stats = getEffectiveStats(character);
    const healAmount = Math.floor(stats.maxHp * ratio);

    if (character.baseStats.hp >= stats.maxHp) {
        return { success: false, message: 'HP 已满，无需使用药水' };
    }

    consumable.count--;
    heal(character, healAmount);
    return { success: true, message: `使用${name}，回复 ${healAmount} HP` };
}

/** 使用增益卷轴/药剂 */
function useBuff(
    consumable: Consumable,
    _character: CharacterData,
    activeBuffs: ActiveBuff[],
    now: number,
    name: string,
): { success: boolean; message: string } {
    // 检查是否已有同类增益
    const existingIdx = activeBuffs.findIndex(b => b.type === consumable.type);
    if (existingIdx >= 0) {
        // 刷新时间
        const existing = activeBuffs[existingIdx];
        existing.endTime = now + getBuffDuration(consumable.type);
        consumable.count--;
        return { success: true, message: `${name}效果已刷新` };
    }

    const buff = createBuff(consumable.type, now);
    if (!buff) return { success: false, message: '无法使用' };

    activeBuffs.push(buff);
    consumable.count--;
    return { success: true, message: `使用${name}` };
}

/** 获取增益持续时间（毫秒） */
function getBuffDuration(type: ConsumableType): number {
    switch (type) {
        case 'scrollAtk': return 60_000;
        case 'scrollDef': return 60_000;
        case 'elixirBerserk': return 30_000;
        case 'elixirLuck': return 60_000;
        default: return 30_000;
    }
}

/** 创建增益效果 */
function createBuff(type: ConsumableType, now: number): ActiveBuff | null {
    const duration = getBuffDuration(type);
    const endTime = now + duration;

    switch (type) {
        case 'scrollAtk':
            return { type, name: '攻击卷轴', stat: 'atk', value: 30, endTime };
        case 'scrollDef':
            return { type, name: '防御卷轴', stat: 'def', value: 30, endTime };
        case 'elixirBerserk':
            return { type, name: '狂暴药剂', stat: 'attackSpeed', value: 50, endTime };
        case 'elixirLuck':
            return { type, name: '幸运药剂', stat: 'dropRate', value: 50, endTime };
        default:
            return null;
    }
}

/** 更新活跃增益（移除过期的），返回是否有过期 */
export function updateBuffs(activeBuffs: ActiveBuff[], now: number): string[] {
    const expired: string[] = [];
    const remaining: ActiveBuff[] = [];

    for (const buff of activeBuffs) {
        if (now >= buff.endTime) {
            expired.push(buff.name);
        } else {
            remaining.push(buff);
        }
    }

    activeBuffs.length = 0;
    activeBuffs.push(...remaining);

    return expired;
}

/** 计算活跃增益的总属性加成 */
export function getBuffBonuses(activeBuffs: ActiveBuff[]): { atk: number; def: number; attackSpeed: number; critRate: number; dropRate: number } {
    const bonuses = { atk: 0, def: 0, attackSpeed: 0, critRate: 0, dropRate: 0 };

    for (const buff of activeBuffs) {
        switch (buff.stat) {
            case 'atk': bonuses.atk += buff.value; break;
            case 'def': bonuses.def += buff.value; break;
            case 'attackSpeed': bonuses.attackSpeed += buff.value; break;
            case 'critRate': bonuses.critRate += buff.value; break;
            case 'dropRate': bonuses.dropRate += buff.value; break;
        }
    }

    return bonuses;
}

/** 自动使用药水逻辑（HP 低于阈值时自动使用最大回复药水） */
export function autoUsePotion(
    consumables: Consumable[],
    character: CharacterData,
    threshold = 0.3,
): { used: boolean; message: string } {
    const stats = getEffectiveStats(character);
    if (character.baseStats.hp / stats.maxHp >= threshold) {
        return { used: false, message: '' };
    }

    // 优先使用能回复到安全线以上的药水
    const hpDeficit = stats.maxHp - character.baseStats.hp;
    const potionPriority: ConsumableType[] = ['healPotionS', 'healPotionM', 'healPotionL', 'healPotionFull'];

    for (const potionType of potionPriority) {
        const ratio = POTION_HEAL_RATIO[potionType] ?? 0;
        const healAmount = Math.floor(stats.maxHp * ratio);
        if (healAmount < hpDeficit * 0.5) continue; // 太小的跳过

        const idx = consumables.findIndex(c => c.type === potionType && c.count > 0);
        if (idx >= 0) {
            consumables[idx].count--;
            heal(character, healAmount);
            const def = CONSUMABLE_DEFS[potionType];
            return { used: true, message: `自动使用${def.name}` };
        }
    }

    // 退而求其次，使用任何可用的
    for (const potionType of potionPriority) {
        const idx = consumables.findIndex(c => c.type === potionType && c.count > 0);
        if (idx >= 0) {
            const ratio = POTION_HEAL_RATIO[potionType] ?? 0;
            const healAmount = Math.floor(stats.maxHp * ratio);
            consumables[idx].count--;
            heal(character, healAmount);
            const def = CONSUMABLE_DEFS[potionType];
            return { used: true, message: `自动使用${def.name}` };
        }
    }

    return { used: false, message: '没有可用药水' };
}
