import type { CharacterBaseClass } from './models';

export type PlayerSkillVisualKind = 'meleeSlash' | 'meleeTarget' | 'aoeSelf' | 'aoeTarget';

export interface PlayerSkillVisualDefinition {
    skillId: string;
    baseClass: CharacterBaseClass;
    folder: string;
    filePrefix?: string;
    frameCount: number;
    frameRate: number;
    scale: number;
    kind: PlayerSkillVisualKind;
    depthOffset?: number;
    offsetDistance?: number;
    offsetY?: number;
    rotationOffset?: number;
    alpha?: number;
}

const BERSERKER_SKILL_ROOT = 'kuangzhanshi/skills';

export const PLAYER_SKILL_VISUALS: Readonly<PlayerSkillVisualDefinition[]> = [
    {
        skillId: 'berserker-cleave',
        baseClass: 'berserker',
        folder: '\u88c2\u5730\u65a9\uff08\u975espritesheet\uff09',
        frameCount: 8,
        frameRate: 18,
        scale: 0.38,
        kind: 'meleeTarget',
    },
    {
        skillId: 'berserker-earthshatter',
        baseClass: 'berserker',
        folder: '\u88c2\u5730\u9707\u51fb\uff08\u975espritesheet\uff09',
        filePrefix: 'Explosion_',
        frameCount: 10,
        frameRate: 20,
        scale: 0.315,
        kind: 'aoeSelf',
    },
    {
        skillId: 'slayer-execute',
        baseClass: 'berserker',
        folder: '\u5c60\u622e\u8005\u5904\u5211\u7a81\u88ad\uff08\u975espritesheet\uff09',
        frameCount: 10,
        frameRate: 20,
        scale: 0.28,
        kind: 'meleeTarget',
    },
    {
        skillId: 'slayer-blood-arc',
        baseClass: 'berserker',
        folder: '\u5c60\u622e\u8005\u8840\u72d0\u65a9\uff08\u975espritesheet\uff09',
        frameCount: 8,
        frameRate: 18,
        scale: 0.44,
        kind: 'meleeTarget',
    },
    {
        skillId: 'warlord-banner',
        baseClass: 'berserker',
        folder: '\u6218\u543c\u7edf\u5e05\u6218\u65d7\u51b2\u950b\uff08\u975espritesheet\uff09',
        frameCount: 5,
        frameRate: 16,
        scale: 0.38,
        kind: 'meleeSlash',
        offsetDistance: 36,
    },
    {
        skillId: 'warlord-banner-shock',
        baseClass: 'berserker',
        folder: '\u6218\u543c\u7edf\u5e05\u6218\u65d7\u9707\u8361\uff08\u975espritesheet\uff09',
        filePrefix: 'Explosion_',
        frameCount: 10,
        frameRate: 20,
        scale: 0.255,
        kind: 'aoeSelf',
        offsetY: -20,
    },
    {
        skillId: 'bloodguard-rage',
        baseClass: 'berserker',
        folder: '\u8840\u6012\u5b88\u536b\u8840\u6012\u53cd\u65a9\uff08\u975espritesheet\uff09',
        frameCount: 8,
        frameRate: 18,
        scale: 0.4,
        kind: 'meleeTarget',
        offsetDistance: 20,
        rotationOffset: Math.PI / 2,
    },
    {
        skillId: 'bloodguard-sanguine-rift',
        baseClass: 'berserker',
        folder: '\u8840\u6012\u5b88\u536b\u7329\u7ea2\u88c2\u5730\uff08\u975espritesheet\uff09',
        filePrefix: 'Explosion_',
        frameCount: 10,
        frameRate: 20,
        scale: 0.3,
        kind: 'aoeSelf',
        offsetY: -50,
    },
];

export function getPlayerSkillVisual(skillId: string): PlayerSkillVisualDefinition | null {
    return PLAYER_SKILL_VISUALS.find((entry) => entry.skillId === skillId) ?? null;
}

export function getPlayerSkillVisualFrameKey(skillId: string, frame: number): string {
    return `player-skill-${skillId}-frame-${frame}`;
}

export function getPlayerSkillVisualAnimationKey(skillId: string): string {
    return `player-skill-${skillId}-anim`;
}

export function getPlayerSkillVisualFramePath(definition: PlayerSkillVisualDefinition, frame: number): string {
    const prefix = definition.filePrefix ?? '';
    return `${BERSERKER_SKILL_ROOT}/${definition.folder}/${prefix}${frame}.png`;
}
