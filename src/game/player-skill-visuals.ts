import type { CharacterBaseClass } from './models';

export type PlayerSkillVisualKind = 'meleeSlash' | 'meleeTarget' | 'aoeSelf' | 'aoeTarget' | 'rangedLine';
export type PlayerSkillVisualAssetType = 'frames' | 'spritesheet';

export interface PlayerSkillVisualDefinition {
    skillId: string;
    baseClass: CharacterBaseClass;
    folder: string;
    assetType?: PlayerSkillVisualAssetType;
    filePrefix?: string;
    frameCount: number;
    frameRate: number;
    scale: number;
    kind: PlayerSkillVisualKind;
    depthOffset?: number;
    offsetDistance?: number;
    offsetY?: number;
    rotationOffset?: number;
    originX?: number;
    originY?: number;
    frameWidth?: number;
    frameHeight?: number;
    alpha?: number;
}

const PLAYER_SKILL_ROOTS: Partial<Record<CharacterBaseClass, string>> = {
    berserker: 'kuangzhanshi/skills',
    ranger: 'youxia/skills',
};

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
    {
        skillId: 'ranger-volley',
        baseClass: 'ranger',
        folder: '\u6e38\u4fa0\u7a7f\u98ce\u7bad\uff08\u975espritesheet\uff09',
        filePrefix: 'Explosion_',
        frameCount: 5,
        frameRate: 18,
        scale: 0.3,
        kind: 'rangedLine',
        rotationOffset: -Math.PI / 2,
        originX: 0.5,
        originY: 0,
    },
    {
        skillId: 'ranger-burst-volley',
        baseClass: 'ranger',
        folder: '\u6e38\u4fa0\u7206\u88c2\u7bad\u96e8',
        assetType: 'spritesheet',
        frameCount: 9,
        frameRate: 18,
        frameWidth: 48,
        frameHeight: 48,
        scale: 2.2,
        kind: 'aoeTarget',
    },
    {
        skillId: 'sharpshooter-headshot',
        baseClass: 'ranger',
        folder: '\u795e\u5c04\u624b\u7206\u5934\u72d9\u51fb',
        assetType: 'spritesheet',
        frameCount: 6,
        frameRate: 20,
        frameWidth: 40,
        frameHeight: 40,
        scale: 2,
        kind: 'aoeTarget',
    },
    {
        skillId: 'sharpshooter-piercing-line',
        baseClass: 'ranger',
        folder: '\u795e\u5c04\u624b\u8d2f\u661f\u7bad\uff08\u975espritesheet\uff09',
        frameCount: 5,
        frameRate: 18,
        scale: 0.52,
        kind: 'rangedLine',
        originX: 0,
        originY: 0.5,
    },
    {
        skillId: 'trapper-burst',
        baseClass: 'ranger',
        folder: '\u9677\u9631\u5927\u5e08\u8bf1\u6355\u7206\u53d1\uff08\u975espritesheet\uff09',
        filePrefix: 'Explosion_blue_oval',
        frameCount: 10,
        frameRate: 20,
        scale: 0.7333333333333334,
        kind: 'aoeTarget',
    },
    {
        skillId: 'trapper-chain-mines',
        baseClass: 'ranger',
        folder: '\u9677\u9631\u5927\u5e08\u8fde\u9501\u7206\u96f7\uff08\u975espritesheet\uff09',
        filePrefix: 'Explosion_two_colors',
        frameCount: 10,
        frameRate: 20,
        scale: 0.8625,
        kind: 'aoeTarget',
        offsetY: -20,
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

export function getPlayerSkillVisualTextureKey(skillId: string): string {
    return `player-skill-${skillId}-texture`;
}

export function getPlayerSkillVisualAssetType(definition: PlayerSkillVisualDefinition): PlayerSkillVisualAssetType {
    return definition.assetType ?? 'frames';
}

export function getPlayerSkillVisualFramePath(definition: PlayerSkillVisualDefinition, frame: number): string {
    const skillRoot = PLAYER_SKILL_ROOTS[definition.baseClass];
    if (!skillRoot) {
        throw new Error(`Missing player skill visual root for class: ${definition.baseClass}`);
    }
    const prefix = definition.filePrefix ?? '';
    return `${skillRoot}/${definition.folder}/${prefix}${frame}.png`;
}

export function getPlayerSkillVisualSpritesheetPath(definition: PlayerSkillVisualDefinition): string {
    const skillRoot = PLAYER_SKILL_ROOTS[definition.baseClass];
    if (!skillRoot) {
        throw new Error(`Missing player skill visual root for class: ${definition.baseClass}`);
    }
    return `${skillRoot}/${definition.folder}/spritesheet.png`;
}
