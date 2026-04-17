import {
    type CharacterData,
    type CharacterStats,
    type Monster,
    type AffixId,
    type Equipment,
    type SkillDefinition,
} from '../models';
import { getEffectiveStats } from './character-system';
import { monsterTakeDamage, getMonsterAttack } from './monster-system';
import { calculateEquipBonuses, type EquippedItems, type EquipBonuses } from './equip-system';

/** 战斗结果 */
export interface CombatResult {
    damageDealt: number;
    isCrit: boolean;
    monsterKilled: boolean;
    expGained: number;
    goldGained: number;
    damageReceived: number;
    playerDied: boolean;
    lifeStealHeal: number;
    extraAttacks: number;
    isEvaded: boolean;
    isCombo: boolean;
    specializationProc: string | null;
    specializationHeal: number;
}

export interface SkillCombatResult extends CombatResult {
    skillName: string;
}

/** 收集所有装备上的词条效果 */
export function collectAffixEffects(equipped: EquippedItems): AffixEffects {
    const bonuses = calculateEquipBonuses(equipped);
    const effects: AffixEffects = {
        penetration: 0,
        lifeSteal: 0,
        hpRegen: 0,
        damageReduction: 0,
        evasion: 0,
        comboChance: 0,
        whirlwindChance: 0,
        rebirthChance: 0,
        predatorChance: 0,
        berserkerAtkBonus: 0,
        immortalCooldown: 0,
    };

    const allEquipped = (Object.values(equipped) as (Equipment | undefined)[]).filter((e): e is Equipment => !!e);
    for (const equip of allEquipped) {
        for (const affix of equip.affixes) {
            switch (affix.id as AffixId) {
                case 'penetration':      effects.penetration += affix.value; break;
                case 'lifeSteal':        effects.lifeSteal += affix.value; break;
                case 'hpRegen':          effects.hpRegen += affix.value; break;
                case 'damageReduction':  effects.damageReduction += affix.value; break;
                case 'evasion':          effects.evasion += affix.value; break;
                case 'combo':            effects.comboChance += affix.value; break;
                case 'whirlwind':        effects.whirlwindChance += affix.value; break;
                case 'rebirth':          effects.rebirthChance += affix.value; break;
                case 'predator':         effects.predatorChance += affix.value; break;
                case 'berserker':        effects.berserkerAtkBonus += affix.value; break;
                case 'immortal':         effects.immortalCooldown += affix.value; break;
            }
        }
    }

    // 存储基础加成以便外部使用
    effects.bonuses = bonuses;

    return effects;
}

export interface AffixEffects {
    penetration: number;       // 无视防御百分比
    lifeSteal: number;         // 吸血百分比
    hpRegen: number;           // 每秒回复 HP
    damageReduction: number;   // 伤害减免百分比
    evasion: number;           // 闪避率百分比
    comboChance: number;       // 连击概率
    whirlwindChance: number;   // 旋风斩概率
    rebirthChance: number;     // 复活概率
    predatorChance: number;    // 掠夺者概率
    berserkerAtkBonus: number; // 狂战士 ATK 加成百分比
    immortalCooldown: number;  // 不朽冷却（秒）
    bonuses?: EquipBonuses;    // 基础属性加成
}

/** 计算单次攻击伤害（含穿透、狂战士） */
export function calculateDamage(
    char: CharacterData,
    effects: AffixEffects,
    stats?: CharacterStats,
    modifiers?: { critRateBonus?: number; damageMultiplier?: number; critDamageBonus?: number },
): { damage: number; isCrit: boolean } {
    const effectiveStats = stats ?? getEffectiveStats(char);
    const isCrit = Math.random() * 100 < (effectiveStats.critRate + (modifiers?.critRateBonus ?? 0));

    let atk = effectiveStats.atk;

    // 狂战士：血量低于 30% 时 ATK 翻倍
    if (effects.berserkerAtkBonus > 0 && char.baseStats.hp / effectiveStats.maxHp < 0.3) {
        atk = Math.floor(atk * (1 + effects.berserkerAtkBonus / 100));
    }

    let damage = atk;

    if (isCrit) {
        damage = Math.floor(damage * ((effectiveStats.critDamage + (modifiers?.critDamageBonus ?? 0)) / 100));
    }

    // 随机浮动 ±10%
    const variance = 0.9 + Math.random() * 0.2;
    damage = Math.floor(damage * variance * (modifiers?.damageMultiplier ?? 1));

    return { damage: Math.max(1, damage), isCrit };
}

/** 计算对怪物的实际伤害（含穿透） */
export function applyDamageToMonster(damage: number, monsterDef: number, effects: AffixEffects): number {
    // 穿透：无视部分防御
    const effectiveDef = Math.floor(monsterDef * (1 - effects.penetration / 100));
    return Math.max(1, damage - effectiveDef);
}

/** 计算受到的伤害（含减免、闪避） */
export function calculateIncomingDamage(rawDamage: number, charDef: number, effects: AffixEffects): { damage: number; evaded: boolean } {
    // 闪避判定
    if (Math.random() * 100 < effects.evasion) {
        return { damage: 0, evaded: true };
    }

    // 减免 + 防御
    const afterDef = Math.max(1, rawDamage - charDef);
    const afterReduction = Math.floor(afterDef * (1 - effects.damageReduction / 100));

    return { damage: Math.max(1, afterReduction), evaded: false };
}

/** 执行一次角色攻击怪物（含全部词条效果） */
export function playerAttackMonster(
    char: CharacterData,
    monster: Monster,
    effects: AffixEffects,
    stats?: CharacterStats,
    monsterCanRetaliate = true,
): CombatResult {
    const effectiveStats = stats ?? getEffectiveStats(char);
    const targetHpRatio = monster.stats.maxHp > 0 ? monster.stats.hp / monster.stats.maxHp : 1;
    const selfHpRatio = effectiveStats.maxHp > 0 ? char.baseStats.hp / effectiveStats.maxHp : 1;
    let critRateBonus = 0;
    let critDamageBonus = 0;
    let damageMultiplier = 1;
    let extraComboChance = 0;
    let skipRetaliation = false;
    let killHealRatio = 0;
    let hitHealRatio = 0;
    let goldMultiplier = 1;
    let specializationProc: string | null = null;

    switch (char.specialization) {
        case 'slayer':
            if (targetHpRatio <= 0.35) {
                damageMultiplier *= 1.35;
                specializationProc = '斩杀';
            }
            break;
        case 'warlord':
            if (selfHpRatio >= 0.8) {
                damageMultiplier *= 1.15;
                specializationProc = '统御';
            }
            break;
        case 'bloodguard':
            if (selfHpRatio <= 0.5) {
                damageMultiplier *= 1.15;
                killHealRatio = 0.05;
                specializationProc = '血怒';
            }
            break;
        case 'sharpshooter':
            if (targetHpRatio >= 0.9) {
                critRateBonus += 20;
                damageMultiplier *= 1.2;
                specializationProc = '狙击';
            }
            break;
        case 'trapper':
            if (Math.random() < 0.25) {
                skipRetaliation = true;
                specializationProc = '牵制';
            }
            break;
        case 'beastmaster':
            extraComboChance += 20;
            break;
        case 'elementalist':
            critDamageBonus += 25;
            break;
        case 'arcanist':
            hitHealRatio = 0.03;
            break;
        case 'summoner':
            killHealRatio = 0.04;
            goldMultiplier = 1.2;
            break;
    }

    // 主攻击
    const { damage: rawDamage, isCrit } = calculateDamage(char, effects, effectiveStats, {
        critRateBonus,
        critDamageBonus,
        damageMultiplier,
    });
    if (char.specialization === 'elementalist' && isCrit) {
        specializationProc = '元素爆裂';
    }
    const damageDealt = applyDamageToMonster(rawDamage, Math.floor(monster.stats.atk * 0.3), effects);
    const monsterKilled = monsterTakeDamage(monster, damageDealt);

    // 连击判定
    let extraAttacks = 0;
    const comboChance = effects.comboChance + extraComboChance;
    if (!monsterKilled && comboChance > 0 && Math.random() * 100 < comboChance) {
        extraAttacks = 1;
        const extraDamage = applyDamageToMonster(rawDamage, Math.floor(monster.stats.atk * 0.3), effects);
        monsterTakeDamage(monster, extraDamage);
        if (char.specialization === 'beastmaster') {
            specializationProc = '协猎';
        }
    }

    // 吸血
    let lifeStealHeal = 0;
    if (effects.lifeSteal > 0) {
        lifeStealHeal = Math.floor(damageDealt * effects.lifeSteal / 100);
        char.baseStats.hp = Math.min(effectiveStats.maxHp, char.baseStats.hp + lifeStealHeal);
    }

    let specializationHeal = 0;
    if (hitHealRatio > 0) {
        specializationHeal += Math.max(1, Math.floor(effectiveStats.maxHp * hitHealRatio));
        char.baseStats.hp = Math.min(effectiveStats.maxHp, char.baseStats.hp + specializationHeal);
    }

    let expGained = 0;
    let goldGained = 0;

    // 掠夺者：额外掉落概率（不在此处处理，在掉落逻辑中）

    if (monsterKilled) {
        expGained = monster.stats.exp;
        goldGained = Math.floor(monster.stats.gold * goldMultiplier);
        if (killHealRatio > 0) {
            specializationHeal += Math.max(1, Math.floor(effectiveStats.maxHp * killHealRatio));
            char.baseStats.hp = Math.min(effectiveStats.maxHp, char.baseStats.hp + specializationHeal);
        }
    }

    // 怪物反击（如果存活）
    let damageReceived = 0;
    let playerDied = false;
    let isEvaded = false;

    if (!monsterKilled && !skipRetaliation && monsterCanRetaliate) {
        const rawMonsterDmg = getMonsterAttack(monster);
        const { damage: incomingDmg, evaded } = calculateIncomingDamage(rawMonsterDmg, effectiveStats.def, effects);
        damageReceived = incomingDmg;
        isEvaded = evaded;

        if (!evaded && incomingDmg > 0) {
            char.baseStats.hp = Math.max(0, char.baseStats.hp - incomingDmg);
            playerDied = char.baseStats.hp <= 0;
        }
    }

    return {
        damageDealt,
        isCrit,
        monsterKilled,
        expGained,
        goldGained,
        damageReceived,
        playerDied,
        lifeStealHeal,
        extraAttacks,
        isEvaded,
        isCombo: extraAttacks > 0,
        specializationProc,
        specializationHeal,
    };
}

export function playerUseSkillOnMonster(
    char: CharacterData,
    monster: Monster,
    effects: AffixEffects,
    skill: SkillDefinition,
    stats?: CharacterStats,
): SkillCombatResult {
    const effectiveStats = stats ?? getEffectiveStats(char);
    const targetHpRatio = monster.stats.maxHp > 0 ? monster.stats.hp / monster.stats.maxHp : 1;
    let damageMultiplier = skill.damageMultiplier;
    for (const effect of skill.effects) {
        if (effect.type === 'execute' && targetHpRatio <= effect.threshold) {
            damageMultiplier *= effect.bonusMultiplier;
        }
    }
    const { damage: rawDamage, isCrit } = calculateDamage(char, effects, effectiveStats, {
        damageMultiplier,
        critRateBonus: skill.critRateBonus,
        critDamageBonus: skill.critDamageBonus,
    });
    const damageDealt = applyDamageToMonster(rawDamage, Math.floor(monster.stats.atk * 0.25), effects);
    const monsterKilled = monsterTakeDamage(monster, damageDealt);

    let specializationHeal = 0;
    if (skill.healRatio && skill.healRatio > 0) {
        specializationHeal = Math.max(1, Math.floor(effectiveStats.maxHp * skill.healRatio));
        char.baseStats.hp = Math.min(effectiveStats.maxHp, char.baseStats.hp + specializationHeal);
    }

    return {
        skillName: skill.label,
        damageDealt,
        isCrit,
        monsterKilled,
        expGained: monsterKilled ? monster.stats.exp : 0,
        goldGained: monsterKilled ? monster.stats.gold : 0,
        damageReceived: 0,
        playerDied: false,
        lifeStealHeal: 0,
        extraAttacks: 0,
        isEvaded: false,
        isCombo: false,
        specializationProc: skill.label,
        specializationHeal,
    };
}
