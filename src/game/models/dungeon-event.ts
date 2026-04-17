import type { ConsumableType } from './consumable';

export type DungeonEventEffectType = 'gold' | 'healRatio' | 'damageRatio' | 'consumable' | 'buff';

export interface DungeonEventEffect {
    type: DungeonEventEffectType;
    value: number;
    consumableType?: ConsumableType;
    buffStat?: 'atk' | 'def' | 'attackSpeed' | 'critRate' | 'dropRate';
    buffValue?: number;
    label: string;
}

export interface DungeonEventChoice {
    id: string;
    label: string;
    resultText: string;
    effects: DungeonEventEffect[];
}

export interface DungeonEventDefinition {
    id: string;
    title: string;
    description: string;
    minFloor: number;
    weight: number;
    choices: DungeonEventChoice[];
}
