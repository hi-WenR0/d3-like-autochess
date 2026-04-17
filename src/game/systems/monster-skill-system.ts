import type {
    Monster,
    MonsterSkillDefinition,
    MonsterSkillEffect,
    SkillExecutionContext,
    SkillExecutionResult,
    MonsterPhase,
} from '../models';

/** 更新所有怪物的技能冷却 */
export function updateMonsterSkillCooldowns(monsters: Monster[], dt: number): void {
    for (const monster of monsters) {
        if (!monster.skillState) continue;

        for (const state of monster.skillState) {
            if (state.cooldownRemaining > 0) {
                state.cooldownRemaining = Math.max(0, state.cooldownRemaining - dt);
            }
        }
    }
}

/** 检查怪物是否可以释放技能 */
export function canCastSkill(monster: Monster, skill: MonsterSkillDefinition, context: SkillExecutionContext): boolean {
    // 检查冷却
    const skillState = monster.skillState?.find(s => s.skillId === skill.id);
    if (skillState && skillState.cooldownRemaining > 0) {
        return false;
    }

    // 检查所有条件
    for (const condition of skill.conditions) {
        if (!checkCondition(monster, condition, context)) {
            return false;
        }
    }

    return true;
}

/** 检查技能条件 */
function checkCondition(monster: Monster, condition: MonsterSkillDefinition['conditions'][0], context: SkillExecutionContext): boolean {
    const hpRatio = monster.stats.hp / monster.stats.maxHp;

    switch (condition.type) {
        case 'always':
            return true;

        case 'hpBelow':
            return hpRatio < (condition.value ?? 0);

        case 'hpAbove':
            return hpRatio > (condition.value ?? 0);

        case 'targetInRange': {
            const dx = context.playerX - monster.x;
            const dy = context.playerY - monster.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            return dist <= (condition.value ?? 150);
        }

        case 'cooldownReady':
            return true; // 已在 canCastSkill 中检查

        case 'phase':
            return (monster.currentPhase ?? 0) >= (condition.value ?? 0);

        default:
            return false;
    }
}

/** 选择怪物应该释放的技能（优先级最高且条件满足） */
export function selectSkillToCast(monster: Monster, skills: MonsterSkillDefinition[], context: SkillExecutionContext): MonsterSkillDefinition | null {
    // 过滤可用技能
    const availableSkills = skills.filter(skill => canCastSkill(monster, skill, context));

    if (availableSkills.length === 0) {
        return null;
    }

    // 按优先级排序，返回最高优先级的技能
    availableSkills.sort((a, b) => b.priority - a.priority);
    return availableSkills[0];
}

/** 执行怪物技能 */
export function executeMonsterSkill(
    monster: Monster,
    skill: MonsterSkillDefinition,
    context: SkillExecutionContext
): SkillExecutionResult {
    const result: SkillExecutionResult = {
        success: true,
    };

    // 处理预警效果
    if (skill.visual?.warningDuration && skill.visual.warningDuration > 0) {
        result.showWarning = true;

        // 计算预警位置（对于AOE技能）
        let warningRadius = 50;
        for (const effect of skill.effects) {
            if (effect.radius) {
                warningRadius = effect.radius;
            }
        }

        result.warningPosition = {
            x: context.playerX,
            y: context.playerY,
            radius: warningRadius,
            color: skill.visual.warningColor ?? 0xff4444,
            duration: skill.visual.warningDuration,
        };
    }

    // 处理技能效果
    for (const effect of skill.effects) {
        applyEffect(monster, effect, context, result);
    }

    // 更新技能冷却
    if (!monster.skillState) {
        monster.skillState = [];
    }

    let skillState = monster.skillState.find(s => s.skillId === skill.id);
    if (!skillState) {
        skillState = {
            skillId: skill.id,
            cooldownRemaining: skill.cooldownMs,
            lastCastTime: context.time,
        };
        monster.skillState.push(skillState);
    } else {
        skillState.cooldownRemaining = skill.cooldownMs;
        skillState.lastCastTime = context.time;
    }

    return result;
}

/** 应用技能效果 */
function applyEffect(
    monster: Monster,
    effect: MonsterSkillEffect,
    _context: SkillExecutionContext,
    result: SkillExecutionResult
): void {
    switch (effect.type) {
        case 'damage':
            result.damage = Math.floor(monster.stats.atk * (effect.damageMultiplier ?? 1));
            break;

        case 'heal':
            const healAmount = Math.floor(monster.stats.maxHp * (effect.healRatio ?? 0.1));
            monster.stats.hp = Math.min(monster.stats.maxHp, monster.stats.hp + healAmount);
            result.heal = healAmount;
            break;

        case 'buff':
            // Buff效果需要在Game.ts中处理（修改怪物属性）
            break;

        case 'summon':
            if (effect.summonType && effect.summonCount) {
                result.summonedMonsters = [];
                for (let i = 0; i < effect.summonCount; i++) {
                    // 在怪物周围随机位置召唤
                    const angle = (Math.PI * 2 * i) / effect.summonCount;
                    const spawnDist = 80;
                    const spawnX = monster.x + Math.cos(angle) * spawnDist;
                    const spawnY = monster.y + Math.sin(angle) * spawnDist;
                    result.summonedMonsters.push({
                        type: effect.summonType,
                        x: spawnX,
                        y: spawnY,
                    });
                }
            }
            break;

        case 'projectile':
            result.damage = Math.floor(monster.stats.atk * (effect.damageMultiplier ?? 1));
            // 投射物创建需要在Game.ts中处理
            break;

        case 'aoe':
            result.damage = Math.floor(monster.stats.atk * (effect.damageMultiplier ?? 1));
            break;
    }
}

/** 检查Boss是否需要阶段转换 */
export function checkBossPhaseTransition(monster: Monster): MonsterPhase | null {
    if (!monster.phases || monster.phases.length === 0) {
        return null;
    }

    const hpRatio = monster.stats.hp / monster.stats.maxHp;
    const currentPhase = monster.currentPhase ?? 0;

    // 找到下一个应该触发的阶段
    for (const phase of monster.phases) {
        // 跳过已经过的阶段
        if (phase.phase <= currentPhase) {
            continue;
        }

        // 检查血量是否达到阈值
        if (hpRatio <= phase.hpThreshold) {
            monster.currentPhase = phase.phase;
            return phase;
        }
    }

    return null;
}

/** 初始化怪物技能状态 */
export function initMonsterSkillState(monster: Monster, skills: MonsterSkillDefinition[]): void {
    monster.skillState = skills.map(skill => ({
        skillId: skill.id,
        cooldownRemaining: Math.random() * skill.cooldownMs, // 随机初始冷却，避免同时释放
        lastCastTime: 0,
    }));
}

/** 应用阶段效果 */
export function applyPhaseEffects(monster: Monster, phase: MonsterPhase): void {
    if (phase.aggroRadiusMultiplier) {
        // 临时增加仇恨范围
        monster.aggroRadius = Math.floor(monster.aggroRadius * phase.aggroRadiusMultiplier);
    }

    if (phase.atkMultiplier) {
        monster.stats.atk = Math.floor(monster.stats.atk * phase.atkMultiplier);
    }

    if (phase.movementStrategyOverride) {
        monster.movementStrategy = phase.movementStrategyOverride;
    }
}
