export type MovementStrategy = 'approach' | 'retreat';
export type CombatStyle = 'melee' | 'ranged';

export interface CombatStyleProfile {
    label: string;
    attackRange: number;
    approachDistance: number;
    retreatDistance: number;
    defaultMovementStrategy: MovementStrategy;
}

export const COMBAT_STYLE_PROFILES: Readonly<Record<CombatStyle, CombatStyleProfile>> = {
    melee: {
        label: '近战',
        attackRange: 84,
        approachDistance: 56,
        retreatDistance: 112,
        defaultMovementStrategy: 'approach',
    },
    ranged: {
        label: '远程',
        attackRange: 156,
        approachDistance: 138,
        retreatDistance: 170,
        defaultMovementStrategy: 'retreat',
    },
};

export function getCombatStyleProfile(style: CombatStyle): CombatStyleProfile {
    return COMBAT_STYLE_PROFILES[style];
}
