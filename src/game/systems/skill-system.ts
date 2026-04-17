import type { ActiveBuff, CharacterData, CharacterStats, Monster, SkillDefinition } from '../models';

export interface SkillCastContext {
    character: CharacterData;
    monster: Monster;
    stats: CharacterStats;
    activeBuffs: ActiveBuff[];
    distanceToTarget: number;
    nearbyEnemyCount: (radius: number) => number;
}

export function canCastSkill(skill: SkillDefinition, context: SkillCastContext): boolean {
    return skill.conditions.every((condition) => {
        switch (condition.type) {
            case 'always':
                return true;
            case 'targetHpBelow':
                return context.monster.stats.maxHp > 0 && context.monster.stats.hp / context.monster.stats.maxHp <= condition.ratio;
            case 'playerHpBelow':
                return context.stats.maxHp > 0 && context.character.baseStats.hp / context.stats.maxHp <= condition.ratio;
            case 'enemyCountNearby':
                return context.nearbyEnemyCount(condition.radius) >= condition.count;
            case 'targetInRange':
                return context.distanceToTarget <= condition.range;
            case 'missingBuff':
                return !context.activeBuffs.some((buff) => buff.sourceId === condition.buffId || buff.name === condition.buffId);
        }
    });
}

export function skillConditionSummary(skill: SkillDefinition): string {
    const condition = skill.conditions[0];
    switch (condition.type) {
        case 'always': return '冷却就绪';
        case 'targetHpBelow': return `目标HP<=${Math.round(condition.ratio * 100)}%`;
        case 'playerHpBelow': return `自身HP<=${Math.round(condition.ratio * 100)}%`;
        case 'enemyCountNearby': return `附近敌人>=${condition.count}`;
        case 'targetInRange': return `距离<=${condition.range}`;
        case 'missingBuff': return `缺少${condition.buffId}`;
    }
}

export function skillTagsSummary(skill: SkillDefinition): string {
    return skill.tags.slice(0, 3).join(' / ');
}
