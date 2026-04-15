/** 消耗品类型 */
export type ConsumableType = 'healPotionS' | 'healPotionM' | 'healPotionL' | 'healPotionFull' | 'scrollAtk' | 'scrollDef' | 'elixirBerserk' | 'elixirLuck';

/** 消耗品类别 */
export type ConsumableCategory = 'potion' | 'scroll' | 'elixir';

/** 消耗品定义 */
export interface ConsumableDef {
    id: ConsumableType;
    name: string;
    description: string;
    category: ConsumableCategory;
    maxStack: number;
    buyPrice: number;
    sellPrice: number;
}

/** 消耗品实例（在背包中） */
export interface Consumable {
    id: string;             // 唯一实例 ID
    type: ConsumableType;
    count: number;          // 堆叠数量
}

/** 消耗品数据表 */
export const CONSUMABLE_DEFS: Record<ConsumableType, ConsumableDef> = {
    healPotionS: {
        id: 'healPotionS',
        name: '小回复药水',
        description: '回复 30% 最大HP',
        category: 'potion',
        maxStack: 20,
        buyPrice: 10,
        sellPrice: 5,
    },
    healPotionM: {
        id: 'healPotionM',
        name: '中回复药水',
        description: '回复 50% 最大HP',
        category: 'potion',
        maxStack: 15,
        buyPrice: 30,
        sellPrice: 15,
    },
    healPotionL: {
        id: 'healPotionL',
        name: '大回复药水',
        description: '回复 80% 最大HP',
        category: 'potion',
        maxStack: 10,
        buyPrice: 80,
        sellPrice: 40,
    },
    healPotionFull: {
        id: 'healPotionFull',
        name: '完全回复药水',
        description: '回复 100% 最大HP',
        category: 'potion',
        maxStack: 5,
        buyPrice: 200,
        sellPrice: 100,
    },
    scrollAtk: {
        id: 'scrollAtk',
        name: '攻击卷轴',
        description: 'ATK+30% 持续 60 秒',
        category: 'scroll',
        maxStack: 10,
        buyPrice: 50,
        sellPrice: 25,
    },
    scrollDef: {
        id: 'scrollDef',
        name: '防御卷轴',
        description: 'DEF+30% 持续 60 秒',
        category: 'scroll',
        maxStack: 10,
        buyPrice: 50,
        sellPrice: 25,
    },
    elixirBerserk: {
        id: 'elixirBerserk',
        name: '狂暴药剂',
        description: '攻速+50% 暴击+20% 持续 30 秒',
        category: 'elixir',
        maxStack: 5,
        buyPrice: 150,
        sellPrice: 75,
    },
    elixirLuck: {
        id: 'elixirLuck',
        name: '幸运药剂',
        description: '掉落率+50% 持续 60 秒',
        category: 'elixir',
        maxStack: 5,
        buyPrice: 200,
        sellPrice: 100,
    },
};

/** 活跃增益效果 */
export interface ActiveBuff {
    type: ConsumableType;
    name: string;
    stat: string;       // 'atk' | 'def' | 'attackSpeed' | 'critRate' | 'dropRate'
    value: number;      // 增益值（百分比）
    endTime: number;    // 到期时间戳(ms)
}

/** 药水回复比例 */
export const POTION_HEAL_RATIO: Record<string, number> = {
    healPotionS: 0.3,
    healPotionM: 0.5,
    healPotionL: 0.8,
    healPotionFull: 1.0,
};
