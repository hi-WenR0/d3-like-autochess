import {
    type Monster,
    type MonsterType,
    MONSTER_TYPE_CONFIG,
    MONSTER_SPAWN_WEIGHTS,
    monsterStatsForFloor,
} from '../models';

const MONSTER_NAMES: Record<MonsterType, string[]> = {
    normal: ['骷髅兵', '僵尸', '暗影蝙蝠', '洞穴蜘蛛', '腐化蠕虫'],
    elite: ['骷髅队长', '暗影猎手', '腐蚀巨兽', '血腥侍从'],
    rare: ['死灵法师', '暗影领主', '熔岩巨人', '冰霜女巫'],
    boss: ['矿坑守卫', '森林之王', '熔岩之心', '深渊领主', '永恒判官'],
};

/** 根据层数随机生成怪物 */
export function spawnMonster(floor: number, x: number, y: number): Monster {
    const type = rollMonsterType();
    const names = MONSTER_NAMES[type];
    const name = names[Math.floor(Math.random() * names.length)];
    const stats = monsterStatsForFloor(floor, type);
    const monsterTypeConfig = MONSTER_TYPE_CONFIG[type];

    return {
        id: generateMonsterId(),
        name: `${name}${type === 'normal' ? '' : type === 'elite' ? '★' : type === 'rare' ? '★★' : '★★★'}`,
        type,
        floor,
        stats,
        movementStrategy: monsterTypeConfig.movementStrategy,
        x,
        y,
    };
}

/** 按权重随机怪物类型 */
function rollMonsterType(): MonsterType {
    const totalWeight = Object.values(MONSTER_SPAWN_WEIGHTS).reduce((s, w) => s + w, 0);
    let roll = Math.random() * totalWeight;

    for (const [type, weight] of Object.entries(MONSTER_SPAWN_WEIGHTS)) {
        roll -= weight;
        if (roll <= 0) return type as MonsterType;
    }
    return 'normal';
}

/** 怪物受到伤害，返回是否死亡 */
export function monsterTakeDamage(monster: Monster, damage: number): boolean {
    monster.stats.hp = Math.max(0, monster.stats.hp - damage);
    return monster.stats.hp <= 0;
}

/** 怪物攻击力（实际伤害由战斗系统计算防御） */
export function getMonsterAttack(monster: Monster): number {
    return monster.stats.atk;
}

let _monsterIdCounter = 0;
function generateMonsterId(): string {
    return `mob_${Date.now()}_${++_monsterIdCounter}`;
}
