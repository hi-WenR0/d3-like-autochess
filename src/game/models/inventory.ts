import type { Equipment } from './equipment';
import type { Rarity } from './equipment';

/** 背包配置 */
export const INVENTORY_ROWS = 5;
export const INVENTORY_COLS = 8;
export const INVENTORY_CAPACITY = 200;

/** 物品类型 */
export type ItemType = 'equipment' | 'consumable' | 'material';

/** 背包物品 */
export interface InventoryItem {
    slotIndex: number;  // 格子索引 (0-(INVENTORY_CAPACITY-1))
    item: Equipment;    // 目前只有装备，后续扩展 consumable/material
    locked: boolean;    // 锁定后跳过批量出售与分解
}

/** 背包数据 */
export interface InventoryData {
    items: InventoryItem[];
    gold: number;
    dismantleEssence: number;
    autoDismantleEnabled: boolean;
    autoDismantleMaxRarity: Rarity;
}

/** 消耗品类型 */
export type ConsumableType = 'healPotionS' | 'healPotionM' | 'healPotionL' | 'healPotionFull' | 'scrollAtk' | 'scrollDef' | 'elixirBerserk' | 'elixirLuck';

/** 消耗品定义 */
export interface ConsumableDef {
    id: ConsumableType;
    name: string;
    description: string;
    stackable: boolean;
    maxStack: number;
}
