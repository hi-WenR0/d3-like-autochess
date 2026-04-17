import {
    type DungeonState,
    type ExploreState,
    getZoneForFloor,
} from '../models';

/** 创建初始地牢状态 */
export function createDungeonState(): DungeonState {
    return {
        currentFloor: 1,
        exploreState: 'exploring',
        monstersCleared: 0,
        monstersToClear: monstersForFloor(1),
        floorStartTime: Date.now(),
        randomEventTriggered: false,
    };
}

/** 每层需要击杀的怪物数 */
export function monstersForFloor(floor: number): number {
    return 5 + Math.floor(floor * 0.5);
}

/** 检查是否可以进入下一层 */
export function canProceedToNextFloor(state: DungeonState): boolean {
    return state.monstersCleared >= state.monstersToClear;
}

/** 进入下一层 */
export function proceedToNextFloor(state: DungeonState): void {
    state.currentFloor++;
    state.monstersCleared = 0;
    state.monstersToClear = monstersForFloor(state.currentFloor);
    state.exploreState = 'exploring';
    state.floorStartTime = Date.now();
    state.randomEventTriggered = false;
}

export function normalizeDungeonState(state: DungeonState): DungeonState {
    return {
        ...state,
        randomEventTriggered: state.randomEventTriggered === true,
    };
}

/** 设置探索状态 */
export function setExploreState(state: DungeonState, newState: ExploreState): void {
    state.exploreState = newState;
}

/** 怪物被击杀时更新进度 */
export function onMonsterKilled(state: DungeonState): void {
    state.monstersCleared++;
}

/** 获取当前区域信息 */
export function getCurrentZone(state: DungeonState) {
    return getZoneForFloor(state.currentFloor);
}

/** 是否为 Boss 层（每 5 层） */
export function isBossFloor(floor: number): boolean {
    return floor % 5 === 0;
}
