/** 怪物类型 */
export type MonsterType = 'normal' | 'elite' | 'rare' | 'boss';
export type MovementStrategy = 'approach' | 'retreat';

/** 怪物类型配置 */
export const MONSTER_TYPE_CONFIG: Record<MonsterType, MonsterTypeDef> = {
    normal: { hpMultiplier: 1.0,   atkMultiplier: 1.0,   skillCount: 0, guaranteedDrop: false, minDropRarity: 'common', movementStrategy: 'approach', moveSpeedMultiplier: 1.0 },
    elite:  { hpMultiplier: 1.5,   atkMultiplier: 1.2,   skillCount: 2, guaranteedDrop: true,  minDropRarity: 'magic', movementStrategy: 'approach', moveSpeedMultiplier: 1.05 },
    rare:   { hpMultiplier: 2.0,   atkMultiplier: 1.5,   skillCount: 3, guaranteedDrop: true,  minDropRarity: 'rare', movementStrategy: 'retreat', moveSpeedMultiplier: 0.95 },
    boss:   { hpMultiplier: 5.0,   atkMultiplier: 2.0,   skillCount: 5, guaranteedDrop: true,  minDropRarity: 'legendary', movementStrategy: 'approach', moveSpeedMultiplier: 0.9 },
};

export interface MonsterTypeDef {
    hpMultiplier: number;
    atkMultiplier: number;
    skillCount: number;
    guaranteedDrop: boolean;
    minDropRarity: string;
    movementStrategy: MovementStrategy;
    moveSpeedMultiplier: number;
}

/** 怪物基础属性（第 1 层的基准值） */
export const MONSTER_BASE_STATS = {
    hp: 50,
    atk: 8,
    exp: 20,
    gold: 5,
    moveSpeed: 72,
};

/** 根据层数计算怪物属性 */
export function monsterStatsForFloor(floor: number, type: MonsterType): MonsterStats {
    const cfg = MONSTER_TYPE_CONFIG[type];
    const base = MONSTER_BASE_STATS;
    return {
        maxHp: Math.floor(base.hp * (1 + floor * 0.15) * cfg.hpMultiplier),
        hp: Math.floor(base.hp * (1 + floor * 0.15) * cfg.hpMultiplier),
        atk: Math.floor(base.atk * (1 + floor * 0.12) * cfg.atkMultiplier),
        exp: Math.floor(base.exp * (1 + floor * 0.1)),
        gold: Math.floor(base.gold * (1 + floor * 0.1)),
        moveSpeed: Math.floor(base.moveSpeed * cfg.moveSpeedMultiplier),
    };
}

/** 怪物运行时属性 */
export interface MonsterStats {
    maxHp: number;
    hp: number;
    atk: number;
    exp: number;
    gold: number;
    moveSpeed: number;
}

/** 怪物实例 */
export interface Monster {
    id: string;
    name: string;
    type: MonsterType;
    floor: number;
    stats: MonsterStats;
    movementStrategy: MovementStrategy;
    x: number;
    y: number;
}

/** 怪物生成权重 */
export const MONSTER_SPAWN_WEIGHTS: Record<MonsterType, number> = {
    normal: 80,
    elite: 15,
    rare: 4,
    boss: 1,
};
