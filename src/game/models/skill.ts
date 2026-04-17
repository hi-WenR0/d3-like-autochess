import type { CharacterBaseClass, CharacterData, CharacterSpecialization } from './character';

export type SkillType = 'active' | 'passive' | 'trigger';

export type SkillSlotType = 'basicActive' | 'specializationActive' | 'passive1' | 'passive2' | 'trigger';

export interface SkillLoadout {
    basicActive: string | null;
    specializationActive: string | null;
    passive1: string | null;
    passive2: string | null;
    trigger: string | null;
}

export type SkillCastCondition =
    | { type: 'always' }
    | { type: 'targetHpBelow'; ratio: number }
    | { type: 'playerHpBelow'; ratio: number }
    | { type: 'enemyCountNearby'; count: number; radius: number }
    | { type: 'targetInRange'; range: number }
    | { type: 'missingBuff'; buffId: string };

export type SkillEffect =
    | { type: 'damage'; multiplier: number }
    | { type: 'heal'; ratio: number }
    | { type: 'buff'; stat: 'atk' | 'def' | 'attackSpeed' | 'critRate'; value: number; durationMs: number }
    | { type: 'execute'; threshold: number; bonusMultiplier: number }
    | { type: 'passiveStat'; stat: 'atk' | 'def' | 'maxHp' | 'critRate' | 'critDamage' | 'moveSpeed'; value: number };

export interface SkillDefinition {
    id: string;
    label: string;
    description: string;
    type: SkillType;
    slot: SkillSlotType | 'passive';
    requiredClass: CharacterBaseClass;
    requiredSpecialization?: CharacterSpecialization;
    unlockLevel: number;
    cooldownMs: number;
    priority: number;
    conditions: SkillCastCondition[];
    effects: SkillEffect[];
    tags: string[];
    damageMultiplier: number;
    critRateBonus?: number;
    critDamageBonus?: number;
    healRatio?: number;
}

export const EMPTY_SKILL_LOADOUT: Readonly<SkillLoadout> = {
    basicActive: null,
    specializationActive: null,
    passive1: null,
    passive2: null,
    trigger: null,
};

export const CLASS_SKILLS: Readonly<SkillDefinition[]> = [
    {
        id: 'berserker-cleave',
        label: '裂地斩',
        description: '狂战士重击前方敌人，造成更高伤害。',
        type: 'active',
        slot: 'basicActive',
        requiredClass: 'berserker',
        unlockLevel: 1,
        cooldownMs: 6500,
        priority: 30,
        conditions: [{ type: 'always' }],
        effects: [{ type: 'damage', multiplier: 1.8 }],
        tags: ['melee', 'basic'],
        damageMultiplier: 1.8,
        critDamageBonus: 15,
    },
    {
        id: 'berserker-frenzy',
        label: '战斗狂热',
        description: '长期近战磨炼带来稳定攻击与暴击伤害。',
        type: 'passive',
        slot: 'passive',
        requiredClass: 'berserker',
        unlockLevel: 5,
        cooldownMs: 0,
        priority: 0,
        conditions: [{ type: 'always' }],
        effects: [
            { type: 'passiveStat', stat: 'atk', value: 6 },
            { type: 'passiveStat', stat: 'critDamage', value: 10 },
        ],
        tags: ['passive', 'damage'],
        damageMultiplier: 1,
    },
    {
        id: 'ranger-volley',
        label: '穿风箭',
        description: '游侠精准射击，提升暴击率与伤害。',
        type: 'active',
        slot: 'basicActive',
        requiredClass: 'ranger',
        unlockLevel: 1,
        cooldownMs: 6000,
        priority: 30,
        conditions: [{ type: 'always' }],
        effects: [{ type: 'damage', multiplier: 1.6 }],
        tags: ['ranged', 'basic'],
        damageMultiplier: 1.6,
        critRateBonus: 18,
        critDamageBonus: 10,
    },
    {
        id: 'ranger-eagle-eye',
        label: '鹰眼节奏',
        description: '保持距离和节奏，提升暴击率与机动。',
        type: 'passive',
        slot: 'passive',
        requiredClass: 'ranger',
        unlockLevel: 5,
        cooldownMs: 0,
        priority: 0,
        conditions: [{ type: 'always' }],
        effects: [
            { type: 'passiveStat', stat: 'critRate', value: 4 },
            { type: 'passiveStat', stat: 'moveSpeed', value: 8 },
        ],
        tags: ['passive', 'crit'],
        damageMultiplier: 1,
    },
    {
        id: 'mage-burst',
        label: '奥术冲击',
        description: '法师释放高强度法术冲击。',
        type: 'active',
        slot: 'basicActive',
        requiredClass: 'mage',
        unlockLevel: 1,
        cooldownMs: 6200,
        priority: 30,
        conditions: [{ type: 'always' }],
        effects: [{ type: 'damage', multiplier: 1.7 }],
        tags: ['ranged', 'basic'],
        damageMultiplier: 1.7,
        critDamageBonus: 18,
    },
    {
        id: 'mage-focus',
        label: '秘法专注',
        description: '稳定施法姿态，提升攻击与暴击伤害。',
        type: 'passive',
        slot: 'passive',
        requiredClass: 'mage',
        unlockLevel: 5,
        cooldownMs: 0,
        priority: 0,
        conditions: [{ type: 'always' }],
        effects: [
            { type: 'passiveStat', stat: 'atk', value: 5 },
            { type: 'passiveStat', stat: 'critDamage', value: 15 },
        ],
        tags: ['passive', 'spell'],
        damageMultiplier: 1,
    },
    {
        id: 'slayer-execute',
        label: '处刑突袭',
        description: '屠戮者对濒危目标发动更致命一击。',
        type: 'active',
        slot: 'specializationActive',
        requiredClass: 'berserker',
        requiredSpecialization: 'slayer',
        unlockLevel: 10,
        cooldownMs: 5600,
        priority: 60,
        conditions: [{ type: 'targetHpBelow', ratio: 0.4 }],
        effects: [{ type: 'damage', multiplier: 2.1 }, { type: 'execute', threshold: 0.4, bonusMultiplier: 1.15 }],
        tags: ['execute', 'specialization'],
        damageMultiplier: 2.1,
        critDamageBonus: 25,
    },
    {
        id: 'warlord-banner',
        label: '战旗冲锋',
        description: '战吼统帅以更稳健的重击压制敌人。',
        type: 'active',
        slot: 'specializationActive',
        requiredClass: 'berserker',
        requiredSpecialization: 'warlord',
        unlockLevel: 10,
        cooldownMs: 6200,
        priority: 60,
        conditions: [{ type: 'always' }],
        effects: [{ type: 'damage', multiplier: 1.7 }, { type: 'heal', ratio: 0.05 }],
        tags: ['specialization', 'guard'],
        damageMultiplier: 1.7,
        healRatio: 0.05,
    },
    {
        id: 'bloodguard-rage',
        label: '血怒反斩',
        description: '血怒守卫斩击后回复部分生命。',
        type: 'active',
        slot: 'specializationActive',
        requiredClass: 'berserker',
        requiredSpecialization: 'bloodguard',
        unlockLevel: 10,
        cooldownMs: 6000,
        priority: 60,
        conditions: [{ type: 'playerHpBelow', ratio: 0.6 }],
        effects: [{ type: 'damage', multiplier: 1.8 }, { type: 'heal', ratio: 0.08 }],
        tags: ['specialization', 'heal'],
        damageMultiplier: 1.8,
        healRatio: 0.08,
    },
    {
        id: 'sharpshooter-headshot',
        label: '爆头狙击',
        description: '神射手锁定弱点，显著提高暴击率。',
        type: 'active',
        slot: 'specializationActive',
        requiredClass: 'ranger',
        requiredSpecialization: 'sharpshooter',
        unlockLevel: 10,
        cooldownMs: 5200,
        priority: 60,
        conditions: [{ type: 'targetHpBelow', ratio: 0.55 }],
        effects: [{ type: 'damage', multiplier: 1.9 }],
        tags: ['specialization', 'crit'],
        damageMultiplier: 1.9,
        critRateBonus: 30,
        critDamageBonus: 20,
    },
    {
        id: 'trapper-burst',
        label: '诱捕爆发',
        description: '陷阱大师引爆陷阱造成爆发伤害。',
        type: 'active',
        slot: 'specializationActive',
        requiredClass: 'ranger',
        requiredSpecialization: 'trapper',
        unlockLevel: 10,
        cooldownMs: 5800,
        priority: 60,
        conditions: [{ type: 'enemyCountNearby', count: 2, radius: 180 }],
        effects: [{ type: 'damage', multiplier: 1.75 }],
        tags: ['specialization', 'control'],
        damageMultiplier: 1.75,
        critRateBonus: 12,
    },
    {
        id: 'beastmaster-hunt',
        label: '兽群协猎',
        description: '兽王猎手发动协同突袭并回复少量生命。',
        type: 'active',
        slot: 'specializationActive',
        requiredClass: 'ranger',
        requiredSpecialization: 'beastmaster',
        unlockLevel: 10,
        cooldownMs: 6000,
        priority: 60,
        conditions: [{ type: 'always' }],
        effects: [{ type: 'damage', multiplier: 1.8 }, { type: 'heal', ratio: 0.05 }],
        tags: ['specialization', 'heal'],
        damageMultiplier: 1.8,
        healRatio: 0.05,
    },
    {
        id: 'elementalist-flare',
        label: '元素耀斑',
        description: '元素术士引爆元素能量，强化暴击伤害。',
        type: 'active',
        slot: 'specializationActive',
        requiredClass: 'mage',
        requiredSpecialization: 'elementalist',
        unlockLevel: 10,
        cooldownMs: 5600,
        priority: 60,
        conditions: [{ type: 'always' }],
        effects: [{ type: 'damage', multiplier: 1.95 }],
        tags: ['specialization', 'elemental'],
        damageMultiplier: 1.95,
        critDamageBonus: 28,
    },
    {
        id: 'arcanist-surge',
        label: '奥术激流',
        description: '奥术学者进行高频法术打击并提升暴击率。',
        type: 'active',
        slot: 'specializationActive',
        requiredClass: 'mage',
        requiredSpecialization: 'arcanist',
        unlockLevel: 10,
        cooldownMs: 5400,
        priority: 60,
        conditions: [{ type: 'always' }],
        effects: [{ type: 'damage', multiplier: 1.75 }],
        tags: ['specialization', 'arcane'],
        damageMultiplier: 1.75,
        critRateBonus: 18,
    },
    {
        id: 'summoner-command',
        label: '先知敕令',
        description: '召唤先知以先知印记轰击目标并回复生命。',
        type: 'active',
        slot: 'specializationActive',
        requiredClass: 'mage',
        requiredSpecialization: 'summoner',
        unlockLevel: 10,
        cooldownMs: 6200,
        priority: 60,
        conditions: [{ type: 'always' }],
        effects: [{ type: 'damage', multiplier: 1.85 }, { type: 'heal', ratio: 0.07 }],
        tags: ['specialization', 'summon'],
        damageMultiplier: 1.85,
        healRatio: 0.07,
    },
];

export function getSkillById(skillId: string | null): SkillDefinition | null {
    if (!skillId) return null;
    return CLASS_SKILLS.find((skill) => skill.id === skillId) ?? null;
}

export function getDefaultBasicActiveSkill(baseClass: CharacterBaseClass): SkillDefinition | null {
    return CLASS_SKILLS.find((skill) =>
        skill.requiredClass === baseClass && skill.slot === 'basicActive' && skill.requiredSpecialization === undefined,
    ) ?? null;
}

export function getDefaultSpecializationSkill(char: CharacterData): SkillDefinition | null {
    if (!char.specialization) return null;
    return CLASS_SKILLS.find((skill) =>
        skill.requiredClass === char.baseClass &&
        skill.requiredSpecialization === char.specialization &&
        skill.slot === 'specializationActive',
    ) ?? null;
}

export function createDefaultSkillLoadout(char: Pick<CharacterData, 'baseClass' | 'specialization'>): SkillLoadout {
    return {
        ...EMPTY_SKILL_LOADOUT,
        basicActive: getDefaultBasicActiveSkill(char.baseClass)?.id ?? null,
        specializationActive: char.specialization
            ? CLASS_SKILLS.find((skill) =>
                skill.requiredClass === char.baseClass &&
                skill.requiredSpecialization === char.specialization &&
                skill.slot === 'specializationActive',
            )?.id ?? null
            : null,
    };
}

export function isSkillUnlocked(char: CharacterData, skill: SkillDefinition): boolean {
    if (skill.requiredClass !== char.baseClass) return false;
    if (skill.requiredSpecialization !== undefined && skill.requiredSpecialization !== char.specialization) return false;
    return char.level >= skill.unlockLevel;
}

export function isSkillAllowedInSlot(skill: SkillDefinition, slot: SkillSlotType): boolean {
    if (slot === 'passive1' || slot === 'passive2') {
        return skill.type === 'passive';
    }
    return skill.slot === slot;
}

export function canEquipSkill(char: CharacterData, skill: SkillDefinition, slot: SkillSlotType): boolean {
    return isSkillUnlocked(char, skill) && isSkillAllowedInSlot(skill, slot);
}

export function normalizeSkillLoadout(char: CharacterData): SkillLoadout {
    const incoming = char.skillLoadout ?? createDefaultSkillLoadout(char);
    const normalized: SkillLoadout = {
        basicActive: normalizeSlotSkill(char, incoming.basicActive, 'basicActive'),
        specializationActive: normalizeSlotSkill(char, incoming.specializationActive, 'specializationActive'),
        passive1: normalizeSlotSkill(char, incoming.passive1, 'passive1'),
        passive2: normalizeSlotSkill(char, incoming.passive2, 'passive2'),
        trigger: normalizeSlotSkill(char, incoming.trigger, 'trigger'),
    };

    if (!normalized.basicActive) {
        normalized.basicActive = getDefaultBasicActiveSkill(char.baseClass)?.id ?? null;
    }
    if (char.specialization && !normalized.specializationActive) {
        normalized.specializationActive = getDefaultSpecializationSkill(char)?.id ?? null;
    }
    if (normalized.passive1 && normalized.passive1 === normalized.passive2) {
        normalized.passive2 = null;
    }

    return normalized;
}

export function equipSkill(char: CharacterData, skillId: string, slot: SkillSlotType): boolean {
    const skill = getSkillById(skillId);
    if (!skill || !canEquipSkill(char, skill, slot)) {
        return false;
    }

    const loadout = normalizeSkillLoadout(char);
    if ((slot === 'passive1' || slot === 'passive2') && (loadout.passive1 === skillId || loadout.passive2 === skillId)) {
        return false;
    }

    loadout[slot] = skillId;
    char.skillLoadout = loadout;
    return true;
}

export function getEquippedSkillForSlot(char: CharacterData, slot: SkillSlotType): SkillDefinition | null {
    const loadout = normalizeSkillLoadout(char);
    return getSkillById(loadout[slot]);
}

export function getAutoCastSkills(char: CharacterData): SkillDefinition[] {
    const loadout = normalizeSkillLoadout(char);
    return [loadout.trigger, loadout.specializationActive, loadout.basicActive]
        .map((skillId) => getSkillById(skillId))
        .filter((skill): skill is SkillDefinition => skill !== null && skill.type !== 'passive' && isSkillUnlocked(char, skill))
        .sort((a, b) => b.priority - a.priority);
}

export function getUnlockedSkills(char: CharacterData): SkillDefinition[] {
    return CLASS_SKILLS.filter((skill) => isSkillUnlocked(char, skill));
}

export function getSkillPassiveBonuses(char: CharacterData): {
    hp: number;
    atk: number;
    def: number;
    critRate: number;
    critDamage: number;
    moveSpeed: number;
} {
    const result = { hp: 0, atk: 0, def: 0, critRate: 0, critDamage: 0, moveSpeed: 0 };
    const loadout = normalizeSkillLoadout(char);
    const passiveIds = [loadout.passive1, loadout.passive2];
    for (const passiveId of passiveIds) {
        const skill = getSkillById(passiveId);
        if (!skill || skill.type !== 'passive' || !isSkillUnlocked(char, skill)) continue;
        for (const effect of skill.effects) {
            if (effect.type !== 'passiveStat') continue;
            if (effect.stat === 'maxHp') {
                result.hp += effect.value;
            } else {
                result[effect.stat] += effect.value;
            }
        }
    }
    return result;
}

export function getActiveSkillForCharacter(char: CharacterData): SkillDefinition | null {
    return getAutoCastSkills(char)[0] ?? null;
}

function normalizeSlotSkill(char: CharacterData, skillId: string | null, slot: SkillSlotType): string | null {
    const skill = getSkillById(skillId);
    if (!skill || !canEquipSkill(char, skill, slot)) {
        return null;
    }
    return skill.id;
}
