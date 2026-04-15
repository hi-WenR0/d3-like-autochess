import {
    type CharacterData,
    type CharacterStats,
    type AllocatedStats,
    STAT_PER_POINT,
    expForLevel,
} from '../models';

/** 创建初始角色 */
export function createCharacter(name: string): CharacterData {
    return {
        id: generateId(),
        name,
        level: 1,
        exp: 0,
        expToNextLevel: expForLevel(1),
        statPoints: 0,
        allocatedStats: { hp: 0, atk: 0, def: 0, attackSpeed: 0, critRate: 0, critDamage: 0, moveSpeed: 0 },
        baseStats: {
            hp: 200,
            maxHp: 200,
            atk: 15,
            def: 5,
            attackSpeed: 1.0,
            critRate: 5,
            critDamage: 150,
            moveSpeed: 100,
        },
        gold: 0,
        currentFloor: 1,
    };
}

/** 计算实际属性（基础 + 属性点加成） */
export function getEffectiveStats(char: CharacterData): CharacterStats {
    const a = char.allocatedStats;
    const p = STAT_PER_POINT;
    const b = char.baseStats;
    return {
        hp: b.hp + Math.floor(a.hp * p.hp),
        maxHp: b.maxHp + Math.floor(a.hp * p.hp),
        atk: b.atk + Math.floor(a.atk * p.atk),
        def: b.def + Math.floor(a.def * p.def),
        attackSpeed: b.attackSpeed + a.attackSpeed * p.attackSpeed,
        critRate: b.critRate + a.critRate * p.critRate,
        critDamage: b.critDamage + a.critDamage * p.critDamage,
        moveSpeed: b.moveSpeed + Math.floor(a.moveSpeed * p.moveSpeed),
    };
}

/** 增加经验值，返回是否升级 */
export function addExperience(char: CharacterData, exp: number): boolean {
    char.exp += exp;
    let leveledUp = false;

    while (char.exp >= char.expToNextLevel) {
        char.exp -= char.expToNextLevel;
        char.level++;
        char.statPoints++;
        char.expToNextLevel = expForLevel(char.level);

        // 升级提升基础属性
        char.baseStats.maxHp += 15;
        char.baseStats.hp = char.baseStats.maxHp;
        char.baseStats.atk += 2;
        char.baseStats.def += 1;

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
export function takeDamage(char: CharacterData, damage: number): boolean {
    const stats = getEffectiveStats(char);
    const actualDamage = Math.max(1, damage - stats.def);
    char.baseStats.hp = Math.max(0, char.baseStats.hp - actualDamage);
    return char.baseStats.hp <= 0;
}

/** 角色回血 */
export function heal(char: CharacterData, amount: number): void {
    const stats = getEffectiveStats(char);
    char.baseStats.hp = Math.min(stats.maxHp, char.baseStats.hp + amount);
}

/** 角色是否存活 */
export function isAlive(char: CharacterData): boolean {
    return char.baseStats.hp > 0;
}

let _idCounter = 0;
function generateId(): string {
    return `char_${Date.now()}_${++_idCounter}`;
}
