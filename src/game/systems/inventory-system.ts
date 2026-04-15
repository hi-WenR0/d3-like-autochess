import {
    type InventoryData as IInventoryData,
    type Equipment,
    INVENTORY_CAPACITY,
} from '../models';

export type InventoryData = IInventoryData;

/** 创建空背包 */
export function createInventory(): InventoryData {
    return { items: [], gold: 0 };
}

/** 添加物品到背包，返回是否成功 */
export function addItem(inventory: InventoryData, equipment: Equipment): boolean {
    if (inventory.items.length >= INVENTORY_CAPACITY) return false;

    const slotIndex = findFirstEmptySlot(inventory);
    if (slotIndex === -1) return false;

    inventory.items.push({ slotIndex, item: equipment });
    return true;
}

/** 移除物品 */
export function removeItem(inventory: InventoryData, slotIndex: number): Equipment | null {
    const idx = inventory.items.findIndex(i => i.slotIndex === slotIndex);
    if (idx === -1) return null;

    const item = inventory.items[idx];
    inventory.items.splice(idx, 1);
    return item.item;
}

/** 获取物品 */
export function getItem(inventory: InventoryData, slotIndex: number): Equipment | null {
    const item = inventory.items.find(i => i.slotIndex === slotIndex);
    return item?.item ?? null;
}

/** 背包是否已满 */
export function isFull(inventory: InventoryData): boolean {
    return inventory.items.length >= INVENTORY_CAPACITY;
}

/** 背包使用数量 */
export function count(inventory: InventoryData): number {
    return inventory.items.length;
}

/** 查找第一个空格子 */
function findFirstEmptySlot(inventory: InventoryData): number {
    const usedSlots = new Set(inventory.items.map(i => i.slotIndex));
    for (let i = 0; i < INVENTORY_CAPACITY; i++) {
        if (!usedSlots.has(i)) return i;
    }
    return -1;
}

/** 按稀有度筛选物品 */
export function filterByRarity(inventory: InventoryData, rarity: string): Equipment[] {
    return inventory.items
        .filter(i => i.item.rarity === rarity)
        .map(i => i.item);
}

/** 一键出售指定稀有度及以下的装备 */
export function sellByRarity(inventory: InventoryData, maxRarity: string, sellPriceFn: (eq: Equipment) => number): number {
    const order = ['common', 'magic', 'rare', 'legendary', 'mythic'];
    const maxIdx = order.indexOf(maxRarity);

    let totalGold = 0;
    const toRemove: number[] = [];

    for (const item of inventory.items) {
        const idx = order.indexOf(item.item.rarity);
        if (idx <= maxIdx) {
            totalGold += sellPriceFn(item.item);
            toRemove.push(item.slotIndex);
        }
    }

    inventory.items = inventory.items.filter(i => !toRemove.includes(i.slotIndex));
    inventory.gold += totalGold;

    return totalGold;
}
