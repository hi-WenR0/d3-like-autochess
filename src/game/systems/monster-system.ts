import {
    type Monster,
    type MonsterType,
    MONSTER_TYPE_CONFIG,
    MONSTER_SPAWN_WEIGHTS,
    monsterStatsForFloor,
} from '../models';

interface MonsterCatalogTemplate {
    id: string;
    name: string;
    description: string;
}

const MONSTER_CATALOG: Record<MonsterType, MonsterCatalogTemplate[]> = {
    normal: [
        { id: 'skeleton-soldier', name: '骷髅兵', description: '被黑暗腐化的矿坑亡骨，行动直接，擅长近身缠斗。' },
        { id: 'zombie', name: '僵尸', description: '动作迟缓但耐打的腐尸，会持续逼近目标。' },
        { id: 'shadow-bat', name: '暗影蝙蝠', description: '在阴影中盘旋的小型怪物，常成群出没。' },
        { id: 'cave-spider', name: '洞穴蜘蛛', description: '潜伏在地牢角落的捕猎者，擅长伏击靠近的入侵者。' },
        { id: 'corrupted-worm', name: '腐化蠕虫', description: '被污染的地底生物，会缓慢但持续地贴近猎物。' },
    ],
    elite: [
        { id: 'skeleton-captain', name: '骷髅队长', description: '拥有更强压迫力的亡灵战士，会带动附近怪物一起逼近。' },
        { id: 'shadow-hunter', name: '暗影猎手', description: '经验老道的追猎者，感应范围更大，突进更凶狠。' },
        { id: 'corrosive-beast', name: '腐蚀巨兽', description: '厚甲怪物，喜欢带着同伴正面压上。' },
        { id: 'bloody-attendant', name: '血腥侍从', description: '精英侍从，善于在混战中持续追击玩家。' },
    ],
    rare: [
        { id: 'necromancer', name: '死灵法师', description: '偏远程的稀有敌人，会在感知到目标后主动拉开距离。' },
        { id: 'shadow-lord', name: '暗影领主', description: '操控阴影的高威胁敌人，擅长边退边压制。' },
        { id: 'lava-giant', name: '熔岩巨人', description: '体型庞大的稀有怪物，虽然沉重，但会维持危险射程。' },
        { id: 'frost-witch', name: '冰霜女巫', description: '会保持距离寻找施法空间的远程威胁。' },
    ],
    boss: [
        { id: 'mine-warden', name: '矿坑守卫', description: '驻守矿层的首领，拥有极强的正面压制力。' },
        { id: 'forest-king', name: '森林之王', description: '统御怪群的区域首领，能迅速带动周围敌人集结。' },
        { id: 'lava-heart', name: '熔岩之心', description: '燃烧着深层火核的巨兽，感应范围极广。' },
        { id: 'abyss-lord', name: '深渊领主', description: '来自深渊的首领，能在近战压迫中牵引整片战场。' },
        { id: 'eternal-judge', name: '永恒判官', description: '高层地牢的最终审判者，会持续逼近并施加压迫。' },
    ],
};

/** 根据层数随机生成怪物 */
export function spawnMonster(floor: number, x: number, y: number, forcedType?: MonsterType): Monster {
    const type = forcedType ?? rollMonsterType();
    const template = randomMonsterTemplate(type);
    const stats = monsterStatsForFloor(floor, type);
    const monsterTypeConfig = MONSTER_TYPE_CONFIG[type];

    return {
        id: generateMonsterId(),
        catalogId: template.id,
        name: `${template.name}${type === 'normal' ? '' : type === 'elite' ? '★' : type === 'rare' ? '★★' : '★★★'}`,
        description: template.description,
        type,
        floor,
        stats,
        combatStyle: monsterTypeConfig.combatStyle,
        movementStrategy: monsterTypeConfig.movementStrategy,
        aggroRadius: monsterTypeConfig.aggroRadius,
        groupAssistRadius: monsterTypeConfig.groupAssistRadius,
        groupBehaviorEnabled: monsterTypeConfig.groupBehaviorEnabled,
        alertState: 'idle',
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

function randomMonsterTemplate(type: MonsterType): MonsterCatalogTemplate {
    const templates = MONSTER_CATALOG[type];
    return templates[Math.floor(Math.random() * templates.length)];
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
