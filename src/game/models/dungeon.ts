/** 地牢区域定义 */
export interface DungeonZone {
    name: string;
    startFloor: number;
    endFloor: number;
    monsterLevelRange: [number, number];
    backgroundColor: number;   // Phaser 颜色值
}

/** 五大地牢区域 */
export const DUNGEON_ZONES: ReadonlyArray<DungeonZone> = [
    { name: '荒芜矿坑', startFloor: 1,  endFloor: 5,  monsterLevelRange: [1, 10],  backgroundColor: 0x2d2d2d },
    { name: '幽暗森林', startFloor: 6,  endFloor: 10, monsterLevelRange: [11, 20], backgroundColor: 0x1a3a1a },
    { name: '熔岩深渊', startFloor: 11, endFloor: 15, monsterLevelRange: [21, 35], backgroundColor: 0x3a1a0a },
    { name: '深渊领域', startFloor: 16, endFloor: 20, monsterLevelRange: [36, 50], backgroundColor: 0x0a0a2a },
    { name: '无尽深渊', startFloor: 21, endFloor: 9999, monsterLevelRange: [51, 9999], backgroundColor: 0x050505 },
];

/** 根据层数获取区域 */
export function getZoneForFloor(floor: number): DungeonZone {
    for (const zone of DUNGEON_ZONES) {
        if (floor >= zone.startFloor && floor <= zone.endFloor) {
            return zone;
        }
    }
    return DUNGEON_ZONES[DUNGEON_ZONES.length - 1];
}

/** 角色探索状态 */
export type ExploreState = 'exploring' | 'fighting' | 'looting' | 'resting' | 'transitioning';

/** 地牢运行时数据 */
export interface DungeonState {
    currentFloor: number;
    exploreState: ExploreState;
    monstersCleared: number;       // 当前层已击杀怪物数
    monstersToClear: number;       // 当前层需击杀怪物数
    floorStartTime: number;        // 进入当前层的时间戳
}
