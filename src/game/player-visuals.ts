import type { CharacterBaseClass } from './models';

export type PlayerFacing = 'up' | 'side' | 'down';
export type PlayerAnimState = 'idle' | 'walk' | 'attack';

export const PLAYER_SPRITE_FRAME_SIZE = 32;
export const PLAYER_SPRITE_SCALE = 1.5;

export const PLAYER_CLASS_ASSET_DIR: Record<CharacterBaseClass, string> = {
    berserker: 'kuangzhanshi',
    ranger: 'youxia',
    mage: 'fashi',
};

export const PLAYER_PROJECTILE_TEXTURE_KEYS: Partial<Record<CharacterBaseClass, string>> = {
    ranger: 'player-projectile-ranger',
    mage: 'player-projectile-mage',
};

export const PLAYER_PROJECTILE_TEXTURE_PATHS: Partial<Record<CharacterBaseClass, string>> = {
    ranger: 'youxia/Arrow.png',
    mage: 'fashi/Fireball.png',
};

export const PLAYER_ANIMATION_FRAME_COUNT: Record<PlayerAnimState, number> = {
    idle: 4,
    walk: 6,
    attack: 4,
};

export const PLAYER_ANIMATION_FRAME_RATE: Record<PlayerAnimState, number> = {
    idle: 6,
    walk: 10,
    attack: 12,
};

const PLAYER_FACING_PREFIX: Record<PlayerFacing, string> = {
    up: 'U',
    side: 'S',
    down: 'D',
};

const PLAYER_STATE_SUFFIX: Record<PlayerAnimState, string> = {
    idle: 'Idle',
    walk: 'Walk',
    attack: 'Attack',
};

export const PLAYER_FACINGS: readonly PlayerFacing[] = ['up', 'side', 'down'];
export const PLAYER_ANIM_STATES: readonly PlayerAnimState[] = ['idle', 'walk', 'attack'];

export function getPlayerSpritesheetKey(
    baseClass: CharacterBaseClass,
    facing: PlayerFacing,
    state: PlayerAnimState,
): string {
    return `player-${baseClass}-${facing}-${state}`;
}

export function getPlayerAnimationKey(
    baseClass: CharacterBaseClass,
    facing: PlayerFacing,
    state: PlayerAnimState,
): string {
    return `${getPlayerSpritesheetKey(baseClass, facing, state)}-anim`;
}

export function getPlayerSpritesheetPath(
    baseClass: CharacterBaseClass,
    facing: PlayerFacing,
    state: PlayerAnimState,
): string {
    const assetDir = PLAYER_CLASS_ASSET_DIR[baseClass];
    const prefix = PLAYER_FACING_PREFIX[facing];
    const suffix = PLAYER_STATE_SUFFIX[state];
    return `${assetDir}/${prefix}_${suffix}.png`;
}
