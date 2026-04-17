import {
    type CharacterBaseClass,
    type InventoryData as IInventoryData,
    type InventoryItem,
    type Equipment,
    type Rarity,
    type WearableSlot,
    INVENTORY_CAPACITY,
    getAllowedClassesForEquipment,
} from '../models';

export type InventoryData = IInventoryData;
export type InventorySortBy = 'slot' | 'rarity' | 'level';
export type InventorySortOrder = 'asc' | 'desc';

export interface InventoryQuery {
    rarity?: Rarity | 'all';
    slot?: WearableSlot | 'all';
    sortBy?: InventorySortBy;
    sortOrder?: InventorySortOrder;
}

const RARITY_ORDER: Record<Rarity, number> = {
    common: 0,
    magic: 1,
    rare: 2,
    legendary: 3,
    mythic: 4,
};

const DISMANTLE_ESSENCE_BY_RARITY: Record<Rarity, number> = {
    common: 1,
    magic: 3,
    rare: 10,
    legendary: 30,
    mythic: 80,
};

/** 创建空背包 */
export function createInventory(): InventoryData {
    return {
        items: [],
        gold: 0,
        dismantleEssence: 0,
        autoDismantleEnabled: false,
        autoDismantleMaxRarity: 'common',
    };
}

/** 添加物品到背包，返回是否成功 */
export function addItem(inventory: InventoryData, equipment: Equipment): boolean {
    if (inventory.items.length >= INVENTORY_CAPACITY) return false;

    const slotIndex = findFirstEmptySlot(inventory);
    if (slotIndex === -1) return false;

    inventory.items.push({ slotIndex, item: equipment, locked: false });
    return true;
}

export interface AddItemResult {
    action: 'added' | 'dismantled' | 'failed';
    essenceGained: number;
}

/** 添加物品（支持自动拆解） */
export function addItemWithAutoDismantle(inventory: InventoryData, equipment: Equipment): AddItemResult {
    if (shouldAutoDismantle(inventory, equipment)) {
        const essence = dismantleValue(equipment);
        inventory.dismantleEssence += essence;
        return { action: 'dismantled', essenceGained: essence };
    }

    const added = addItem(inventory, equipment);
    if (!added) {
        return { action: 'failed', essenceGained: 0 };
    }
    return { action: 'added', essenceGained: 0 };
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
        if (item.locked) continue;
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

/** 查询背包物品（筛选 + 排序） */
export function queryInventoryItems(inventory: InventoryData, query: InventoryQuery): InventoryItem[] {
    const rarityFilter = query.rarity ?? 'all';
    const slotFilter = query.slot ?? 'all';
    const sortBy = query.sortBy ?? 'slot';
    const sortOrder = query.sortOrder ?? 'asc';

    const result = inventory.items.filter((inventoryItem) => {
        if (rarityFilter !== 'all' && inventoryItem.item.rarity !== rarityFilter) {
            return false;
        }
        if (slotFilter !== 'all' && inventoryItem.item.slot !== slotFilter) {
            return false;
        }
        return true;
    });

    result.sort((a, b) => {
        let delta = 0;
        if (sortBy === 'slot') {
            delta = a.slotIndex - b.slotIndex;
        } else if (sortBy === 'rarity') {
            delta = RARITY_ORDER[a.item.rarity] - RARITY_ORDER[b.item.rarity];
            if (delta === 0) {
                delta = b.item.level - a.item.level;
            }
        } else {
            delta = a.item.level - b.item.level;
            if (delta === 0) {
                delta = RARITY_ORDER[a.item.rarity] - RARITY_ORDER[b.item.rarity];
            }
        }
        return sortOrder === 'asc' ? delta : -delta;
    });

    return result;
}

/** 手动拆解单件装备 */
export function dismantleOne(inventory: InventoryData, equipmentId: string): number {
    const index = inventory.items.findIndex(i => i.item.id === equipmentId);
    if (index === -1) return 0;

    const target = inventory.items[index];
    if (target.locked) return 0;

    const essence = dismantleValue(target.item);
    inventory.items.splice(index, 1);
    inventory.dismantleEssence += essence;
    return essence;
}

/** 手动拆解指定稀有度及以下装备 */
export function dismantleByRarity(inventory: InventoryData, maxRarity: Rarity): { count: number; essence: number } {
    const maxOrder = RARITY_ORDER[maxRarity];
    let count = 0;
    let essence = 0;

    const remain: InventoryItem[] = [];
    for (const item of inventory.items) {
        if (!item.locked && RARITY_ORDER[item.item.rarity] <= maxOrder) {
            count += 1;
            essence += dismantleValue(item.item);
        } else {
            remain.push(item);
        }
    }

    if (count > 0) {
        inventory.items = remain;
        inventory.dismantleEssence += essence;
    }

    return { count, essence };
}

/** 手动拆解当前职业无法装备的装备 */
export function dismantleUnequippable(inventory: InventoryData, baseClass: CharacterBaseClass): { count: number; essence: number } {
    let count = 0;
    let essence = 0;

    const remain: InventoryItem[] = [];
    for (const item of inventory.items) {
        const allowedClasses = getAllowedClassesForEquipment(item.item);
        const cannotEquip = allowedClasses !== undefined && !allowedClasses.includes(baseClass);
        if (!item.locked && cannotEquip) {
            count += 1;
            essence += dismantleValue(item.item);
        } else {
            remain.push(item);
        }
    }

    if (count > 0) {
        inventory.items = remain;
        inventory.dismantleEssence += essence;
    }

    return { count, essence };
}

/** 自动分解等级最低的前 N 件装备 */
export function autoDismantleLowestLevelItems(inventory: InventoryData, maxCount: number): { count: number; essence: number } {
    const candidates = inventory.items.filter((item) => !item.locked);
    if (maxCount <= 0 || candidates.length === 0) {
        return { count: 0, essence: 0 };
    }

    const selected = [...candidates]
        .sort((a, b) => {
            if (a.item.level !== b.item.level) {
                return a.item.level - b.item.level;
            }
            return a.slotIndex - b.slotIndex;
        })
        .slice(0, Math.min(maxCount, candidates.length));

    if (selected.length === 0) {
        return { count: 0, essence: 0 };
    }

    const selectedSlots = new Set(selected.map((item) => item.slotIndex));
    const essence = selected.reduce((sum, item) => sum + dismantleValue(item.item), 0);
    inventory.items = inventory.items.filter((item) => !selectedSlots.has(item.slotIndex));
    inventory.dismantleEssence += essence;

    return { count: selected.length, essence };
}

/** 是否触发自动拆解 */
export function shouldAutoDismantle(inventory: InventoryData, equipment: Equipment): boolean {
    if (!inventory.autoDismantleEnabled) return false;
    return RARITY_ORDER[equipment.rarity] <= RARITY_ORDER[inventory.autoDismantleMaxRarity];
}

export function toggleItemLock(inventory: InventoryData, equipmentId: string): boolean | null {
    const item = inventory.items.find((inventoryItem) => inventoryItem.item.id === equipmentId);
    if (!item) return null;

    item.locked = !item.locked;
    return item.locked;
}

/** 兼容旧存档字段 */
export function normalizeInventoryData(inventory: InventoryData): void {
    if (typeof inventory.dismantleEssence !== 'number') {
        inventory.dismantleEssence = 0;
    }
    if (typeof inventory.autoDismantleEnabled !== 'boolean') {
        inventory.autoDismantleEnabled = false;
    }
    if (inventory.autoDismantleMaxRarity === undefined) {
        inventory.autoDismantleMaxRarity = 'common';
    }
    inventory.items.forEach((item) => {
        item.locked = item.locked === true;
    });
}

function dismantleValue(equipment: Equipment): number {
    return DISMANTLE_ESSENCE_BY_RARITY[equipment.rarity];
}
