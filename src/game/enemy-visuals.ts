import type { MonsterType } from './models';

export const ENEMY_SPRITE_FRAME_SIZE = 32;

export const ENEMY_ANIM_STATES = ['idle', 'walk', 'attack', 'hurt', 'death'] as const;
export type EnemyAnimState = typeof ENEMY_ANIM_STATES[number];

export const ENEMY_FACINGS = ['down', 'side', 'up'] as const;
export type EnemyFacing = typeof ENEMY_FACINGS[number];

const ENEMY_FACING_PREFIX: Record<EnemyFacing, string> = {
    down: 'D',
    side: 'S',
    up: 'U',
};

const ENEMY_STATE_SUFFIX: Record<EnemyAnimState, string> = {
    idle: 'Idle',
    walk: 'Walk',
    attack: 'Attack',
    hurt: 'Hurt',
    death: 'Death',
};

export const ENEMY_ANIMATION_FRAME_COUNT: Record<EnemyAnimState, number> = {
    idle: 4,
    walk: 6,
    attack: 4,
    hurt: 2,
    death: 8,
};

export const ENEMY_ANIMATION_FRAME_RATE: Record<EnemyAnimState, number> = {
    idle: 6,
    walk: 10,
    attack: 10,
    hurt: 8,
    death: 10,
};

export const ENEMY_SPRITE_SCALE: Record<MonsterType, number> = {
    normal: 1.0,
    elite: 1.5,
    rare: 2.25,
    boss: 3.3,
};

export function getEnemySpritesheetKey(type: MonsterType, facing: EnemyFacing, state: EnemyAnimState): string {
    return `enemy-${type}-${facing}-${state}`;
}

export function getEnemySpritesheetPath(type: MonsterType, facing: EnemyFacing, state: EnemyAnimState): string {
    return `enemies/${type}/${ENEMY_FACING_PREFIX[facing]}_${ENEMY_STATE_SUFFIX[state]}.png`;
}

export function getEnemyAnimationKey(type: MonsterType, facing: EnemyFacing, state: EnemyAnimState): string {
    return `anim-enemy-${type}-${facing}-${state}`;
}
