import {
    type CharacterData,
    type CharacterStats,
    type AllocatedStats,
    type CharacterBaseClass,
    type CharacterSpecialization,
    type CharacterSpecializationBonuses,
    type AdvancementContext,
    type AdvancementRequirement,
    STAT_PER_POINT,
    BASE_CLASS_CONFIG,
    ADVANCEMENT_REQUIREMENT_LEVEL,
    createDefaultSkillLoadout,
    normalizeSkillLoadout,
    getSpecializationDef,
    expForLevel,
} from '../models';

export interface ExternalStatBonuses {
    hp?: number;
    atk?: number;
    def?: number;
    attackSpeedPct?: number;
    critRate?: number;
    critDamage?: number;
    moveSpeed?: number;
}

/** 创建初始角色 */
export function createCharacter(name: string, baseClass: CharacterBaseClass = 'berserker'): CharacterData {
    const classDef = BASE_CLASS_CONFIG[baseClass];
    return {
        id: generateId(),
        name,
        baseClass,
        combatStyle: classDef.combatStyle,
        specialization: null,
        advancementState: 'base',
        level: 1,
        exp: 0,
        expToNextLevel: expForLevel(1),
        statPoints: 0,
        allocatedStats: { hp: 0, atk: 0, def: 0, attackSpeed: 0, critRate: 0, critDamage: 0, moveSpeed: 0 },
        skillLoadout: createDefaultSkillLoadout({ baseClass, specialization: null }),
        baseStats: { ...classDef.startingStats },
        gold: 0,
        currentFloor: 1,
    };
}

export function normalizeCharacterData(char: CharacterData): CharacterData {
    const normalizedClass = char.baseClass in BASE_CLASS_CONFIG ? char.baseClass : 'berserker';
    const specializationDef = getSpecializationDef(normalizedClass, char.specialization ?? null);
    const advancementState =
        specializationDef !== null
            ? 'specialized'
            : char.level >= ADVANCEMENT_REQUIREMENT_LEVEL
                ? 'eligible'
                : 'base';
    const normalized: CharacterData = {
        ...char,
        baseClass: normalizedClass,
        combatStyle: BASE_CLASS_CONFIG[normalizedClass].combatStyle,
        specialization: specializationDef?.id ?? null,
        advancementState,
    };
    normalized.skillLoadout = normalizeSkillLoadout(normalized);
    return normalized;
}

/** 计算实际属性（基础 + 属性点加成 + 运行时加成） */
export function getEffectiveStats(char: CharacterData, bonuses?: ExternalStatBonuses): CharacterStats {
    const a = char.allocatedStats;
    const p = STAT_PER_POINT;
    const b = char.baseStats;
    const runtime = bonuses ?? {};
    const baseAttackSpeed = b.attackSpeed + a.attackSpeed * p.attackSpeed;
    return {
        hp: b.hp + Math.floor(a.hp * p.hp) + (runtime.hp ?? 0),
        maxHp: b.maxHp + Math.floor(a.hp * p.hp) + (runtime.hp ?? 0),
        atk: b.atk + Math.floor(a.atk * p.atk) + (runtime.atk ?? 0),
        def: b.def + Math.floor(a.def * p.def) + (runtime.def ?? 0),
        attackSpeed: Math.max(0.1, baseAttackSpeed * (1 + (runtime.attackSpeedPct ?? 0) / 100)),
        critRate: b.critRate + a.critRate * p.critRate + (runtime.critRate ?? 0),
        critDamage: b.critDamage + a.critDamage * p.critDamage + (runtime.critDamage ?? 0),
        moveSpeed: b.moveSpeed + Math.floor(a.moveSpeed * p.moveSpeed) + (runtime.moveSpeed ?? 0),
    };
}

/** 增加经验值，返回是否升级 */
export function addExperience(char: CharacterData, exp: number): boolean {
    char.exp += exp;
    let leveledUp = false;
    const growth = BASE_CLASS_CONFIG[char.baseClass].growth;

    while (char.exp >= char.expToNextLevel) {
        char.exp -= char.expToNextLevel;
        char.level++;
        char.statPoints++;
        char.expToNextLevel = expForLevel(char.level);

        // 升级提升基础属性
        char.baseStats.maxHp += growth.maxHp;
        char.baseStats.hp = char.baseStats.maxHp;
        char.baseStats.atk += growth.atk;
        char.baseStats.def += growth.def;

        if (char.specialization === null && char.level >= ADVANCEMENT_REQUIREMENT_LEVEL) {
            char.advancementState = 'eligible';
        }

        leveledUp = true;
    }

    return leveledUp;
}

/** 分配属性点 */
export function allocateStatPoint(char: CharacterData, stat: keyof AllocatedStats): boolean {
    if (char.statPoints <= 0) return false;
    char.allocatedStats[stat]++;
    char.statPoints--;

    // 如果分配的是 hp，同步更新当前 hp
    if (stat === 'hp') {
        const bonus = STAT_PER_POINT.hp;
        char.baseStats.hp += bonus;
        char.baseStats.maxHp += bonus;
    }

    return true;
}

/** 角色受到伤害 */
export function takeDamage(char: CharacterData, damage: number, bonuses?: ExternalStatBonuses): boolean {
    const stats = getEffectiveStats(char, bonuses);
    const actualDamage = Math.max(1, damage - stats.def);
    char.baseStats.hp = Math.max(0, char.baseStats.hp - actualDamage);
    return char.baseStats.hp <= 0;
}

/** 角色回血 */
export function heal(char: CharacterData, amount: number, bonuses?: ExternalStatBonuses): void {
    const stats = getEffectiveStats(char, bonuses);
    char.baseStats.hp = Math.min(stats.maxHp, char.baseStats.hp + amount);
}

/** 角色是否存活 */
export function isAlive(char: CharacterData): boolean {
    return char.baseStats.hp > 0;
}

export function canAdvanceSpecialization(char: CharacterData): boolean {
    return char.specialization === null && char.level >= ADVANCEMENT_REQUIREMENT_LEVEL;
}

export interface RequirementProgress {
    label: string;
    current: number;
    target: number;
    met: boolean;
}

export function getSpecializationRequirementProgress(
    char: CharacterData,
    specialization: CharacterSpecialization,
    context: AdvancementContext,
): RequirementProgress[] {
    const specializationDef = getSpecializationDef(char.baseClass, specialization);
    if (!specializationDef) return [];

    return specializationDef.requirements.map((requirement) => buildRequirementProgress(char, requirement, context));
}

export function canUnlockSpecialization(
    char: CharacterData,
    specialization: CharacterSpecialization,
    context: AdvancementContext,
): boolean {
    if (char.specialization !== null) {
        return false;
    }

    const progress = getSpecializationRequirementProgress(char, specialization, context);
    return progress.length > 0 && progress.every((item) => item.met);
}

export function canAdvanceAnySpecialization(char: CharacterData, context: AdvancementContext): boolean {
    if (char.specialization !== null) {
        return false;
    }

    return BASE_CLASS_CONFIG[char.baseClass].specializations.some((spec) => canUnlockSpecialization(char, spec.id, context));
}

export function chooseSpecialization(
    char: CharacterData,
    specialization: CharacterSpecialization,
    context: AdvancementContext,
): boolean {
    const specializationDef = getSpecializationDef(char.baseClass, specialization);
    if (!specializationDef || !canUnlockSpecialization(char, specialization, context)) {
        return false;
    }
    char.specialization = specialization;
    char.advancementState = 'specialized';
    char.skillLoadout = normalizeSkillLoadout(char);
    return true;
}

export function getSpecializationBonuses(char: CharacterData): CharacterSpecializationBonuses {
    return getSpecializationDef(char.baseClass, char.specialization)?.bonuses ?? {};
}

let _idCounter = 0;
function generateId(): string {
    return `char_${Date.now()}_${++_idCounter}`;
}

function buildRequirementProgress(
    char: CharacterData,
    requirement: AdvancementRequirement,
    context: AdvancementContext,
): RequirementProgress {
    switch (requirement.type) {
        case 'level':
            return { label: requirement.label, current: char.level, target: requirement.value, met: char.level >= requirement.value };
        case 'floor':
            return { label: requirement.label, current: context.currentFloor, target: requirement.value, met: context.currentFloor >= requirement.value };
        case 'kill': {
            const currentKills = requirement.targetId ? context.monsterCodex[requirement.targetId]?.killCount ?? 0 : 0;
            return { label: requirement.label, current: currentKills, target: requirement.value, met: currentKills >= requirement.value };
        }
    }
}
