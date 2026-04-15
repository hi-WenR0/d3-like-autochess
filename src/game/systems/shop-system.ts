import type { ConsumableType, Consumable } from '../models/consumable';
import { CONSUMABLE_DEFS } from '../models/consumable';
import type { Equipment, Rarity } from '../models/equipment';
import { sellPrice } from '../models/equipment';
import type { InventoryData } from '../models/inventory';
import { createConsumable } from './consumable-system';

/** 装备出售价格倍率 */
const SELL_PRICE_MULTIPLIER = 0.5;

/** 购买消耗品 */
export function buyConsumable(
    character: { gold: number },
    consumables: Consumable[],
    type: ConsumableType,
): { success: boolean; message: string } {
    const def = CONSUMABLE_DEFS[type];
    if (character.gold < def.buyPrice) {
        return { success: false, message: '金币不足' };
    }

    // 检查堆叠
    const existing = consumables.find(c => c.type === type);
    if (existing && existing.count >= def.maxStack) {
        return { success: false, message: `${def.name}已达上限` };
    }

    character.gold -= def.buyPrice;
    if (existing) {
        existing.count++;
    } else {
        consumables.push(createConsumable(type));
    }

    return { success: true, message: `购买了 ${def.name}` };
}

/** 出售装备 */
export function sellEquipment(
    inventory: InventoryData,
    equipment: Equipment,
): { success: boolean; message: string; gold: number } {
    const price = sellPrice(equipment);
    const idx = inventory.items.findIndex(i => i.item.id === equipment.id);
    if (idx === -1) {
        return { success: false, message: '物品不在背包中', gold: 0 };
    }

    inventory.items.splice(idx, 1);
    inventory.gold += price;

    return { success: true, message: `出售 ${equipment.name} 获得 ${price} 金币`, gold: price };
}

/** 按稀有度批量出售 */
export function sellByRarityFromShop(
    inventory: InventoryData,
    maxRarity: Rarity,
): number {
    const order: Rarity[] = ['common', 'magic', 'rare', 'legendary', 'mythic'];
    const maxIdx = order.indexOf(maxRarity);

    let totalGold = 0;
    const toRemove: number[] = [];

    for (const item of inventory.items) {
        const idx = order.indexOf(item.item.rarity);
        if (idx <= maxIdx) {
            totalGold += Math.floor(sellPrice(item.item) * SELL_PRICE_MULTIPLIER);
            toRemove.push(item.slotIndex);
        }
    }

    inventory.items = inventory.items.filter(i => !toRemove.includes(i.slotIndex));
    inventory.gold += totalGold;

    return totalGold;
}

/** 商店可购买的消耗品列表 */
export function getShopConsumables(): ConsumableType[] {
    return ['healPotionS', 'healPotionM', 'healPotionL', 'healPotionFull', 'scrollAtk', 'scrollDef', 'elixirBerserk', 'elixirLuck'];
}

/** 背包是否可以买更多 */
export function canBuyMore(consumables: Consumable[], type: ConsumableType): boolean {
    const def = CONSUMABLE_DEFS[type];
    const existing = consumables.find(c => c.type === type);
    return !existing || existing.count < def.maxStack;
}
