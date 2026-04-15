import type { CharacterBaseClass, CharacterData, CharacterSpecialization } from './character';

export interface SkillDefinition {
    id: string;
    label: string;
    description: string;
    cooldownMs: number;
    requiredClass: CharacterBaseClass;
    requiredSpecialization?: CharacterSpecialization;
    damageMultiplier: number;
    critRateBonus?: number;
    critDamageBonus?: number;
    healRatio?: number;
}

export const CLASS_SKILLS: Readonly<SkillDefinition[]> = [
    { id: 'berserker-cleave', label: '裂地斩', description: '狂战士重击前方敌人，造成更高伤害。', cooldownMs: 6500, requiredClass: 'berserker', damageMultiplier: 1.8, critDamageBonus: 15 },
    { id: 'ranger-volley', label: '穿风箭', description: '游侠精准射击，提升暴击率与伤害。', cooldownMs: 6000, requiredClass: 'ranger', damageMultiplier: 1.6, critRateBonus: 18, critDamageBonus: 10 },
    { id: 'mage-burst', label: '奥术冲击', description: '法师释放高强度法术冲击。', cooldownMs: 6200, requiredClass: 'mage', damageMultiplier: 1.7, critDamageBonus: 18 },
    { id: 'slayer-execute', label: '处刑突袭', description: '屠戮者对濒危目标发动更致命一击。', cooldownMs: 5600, requiredClass: 'berserker', requiredSpecialization: 'slayer', damageMultiplier: 2.1, critDamageBonus: 25 },
    { id: 'warlord-banner', label: '战旗冲锋', description: '战吼统帅以更稳健的重击压制敌人。', cooldownMs: 6200, requiredClass: 'berserker', requiredSpecialization: 'warlord', damageMultiplier: 1.7, healRatio: 0.05 },
    { id: 'bloodguard-rage', label: '血怒反斩', description: '血怒守卫斩击后回复部分生命。', cooldownMs: 6000, requiredClass: 'berserker', requiredSpecialization: 'bloodguard', damageMultiplier: 1.8, healRatio: 0.08 },
    { id: 'sharpshooter-headshot', label: '爆头狙击', description: '神射手锁定弱点，显著提高暴击率。', cooldownMs: 5200, requiredClass: 'ranger', requiredSpecialization: 'sharpshooter', damageMultiplier: 1.9, critRateBonus: 30, critDamageBonus: 20 },
    { id: 'trapper-burst', label: '诱捕爆发', description: '陷阱大师引爆陷阱造成爆发伤害。', cooldownMs: 5800, requiredClass: 'ranger', requiredSpecialization: 'trapper', damageMultiplier: 1.75, critRateBonus: 12 },
    { id: 'beastmaster-hunt', label: '兽群协猎', description: '兽王猎手发动协同突袭并回复少量生命。', cooldownMs: 6000, requiredClass: 'ranger', requiredSpecialization: 'beastmaster', damageMultiplier: 1.8, healRatio: 0.05 },
    { id: 'elementalist-flare', label: '元素耀斑', description: '元素术士引爆元素能量，强化暴击伤害。', cooldownMs: 5600, requiredClass: 'mage', requiredSpecialization: 'elementalist', damageMultiplier: 1.95, critDamageBonus: 28 },
    { id: 'arcanist-surge', label: '奥术激流', description: '奥术学者进行高频法术打击并提升暴击率。', cooldownMs: 5400, requiredClass: 'mage', requiredSpecialization: 'arcanist', damageMultiplier: 1.75, critRateBonus: 18 },
    { id: 'summoner-command', label: '先知敕令', description: '召唤先知以先知印记轰击目标并回复生命。', cooldownMs: 6200, requiredClass: 'mage', requiredSpecialization: 'summoner', damageMultiplier: 1.85, healRatio: 0.07 },
];

export function getActiveSkillForCharacter(char: CharacterData): SkillDefinition | null {
    if (char.specialization) {
        return CLASS_SKILLS.find((skill) =>
            skill.requiredClass === char.baseClass && skill.requiredSpecialization === char.specialization,
        ) ?? null;
    }

    return CLASS_SKILLS.find((skill) =>
        skill.requiredClass === char.baseClass && skill.requiredSpecialization === undefined,
    ) ?? null;
}
