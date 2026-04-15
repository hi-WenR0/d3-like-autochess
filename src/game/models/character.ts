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

/** 角色完整数据 */
export interface CharacterData {
    id: string;
    name: string;
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

/** 每级所需经验公式 */
export function expForLevel(level: number): number {
    return Math.floor(100 * Math.pow(1.15, level - 1));
}
