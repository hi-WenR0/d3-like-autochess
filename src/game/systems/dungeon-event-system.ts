import type { DungeonEventDefinition } from '../models';

export const DUNGEON_EVENT_CHECK_INTERVAL = 2.5;
export const DUNGEON_EVENT_TRIGGER_CHANCE = 0.18;

export const DUNGEON_EVENTS: ReadonlyArray<DungeonEventDefinition> = [
    {
        id: 'healing-spring',
        title: '地下清泉',
        description: '石缝里涌出微光清泉，水面映着短暂的安全感。',
        minFloor: 1,
        weight: 24,
        choices: [
            {
                id: 'drink',
                label: '饮用清泉',
                resultText: '清泉恢复了你的生命。',
                effects: [{ type: 'healRatio', value: 0.35, label: '恢复 35% 最大生命' }],
            },
        ],
    },
    {
        id: 'coin-cache',
        title: '遗失钱袋',
        description: '散落的金币压在破旧布袋下，附近暂时没有怪物踪迹。',
        minFloor: 1,
        weight: 22,
        choices: [
            {
                id: 'collect',
                label: '收起金币',
                resultText: '你找到了一小袋金币。',
                effects: [{ type: 'gold', value: 18, label: '获得楼层金币' }],
            },
        ],
    },
    {
        id: 'spike-trap',
        title: '暗藏尖刺',
        description: '脚下石板突然下沉，寒光从缝隙中弹出。',
        minFloor: 2,
        weight: 18,
        choices: [
            {
                id: 'brace',
                label: '护住要害',
                resultText: '你避开了致命处，但仍受到擦伤。',
                effects: [{ type: 'damageRatio', value: 0.12, label: '损失 12% 最大生命' }],
            },
        ],
    },
    {
        id: 'old-altar',
        title: '古旧祭坛',
        description: '祭坛上残留着未熄的符文，力量与代价都很清晰。',
        minFloor: 3,
        weight: 16,
        choices: [
            {
                id: 'power',
                label: '汲取力量',
                resultText: '符文灼痛掌心，攻击力量短暂增强。',
                effects: [
                    { type: 'damageRatio', value: 0.08, label: '损失 8% 最大生命' },
                    { type: 'buff', value: 45_000, buffStat: 'atk', buffValue: 20, label: '攻击 +20% 持续 45 秒' },
                ],
            },
            {
                id: 'guard',
                label: '祈求庇护',
                resultText: '祭坛低声回应，防御力量短暂增强。',
                effects: [
                    { type: 'damageRatio', value: 0.05, label: '损失 5% 最大生命' },
                    { type: 'buff', value: 45_000, buffStat: 'def', buffValue: 20, label: '防御 +20% 持续 45 秒' },
                ],
            },
        ],
    },
    {
        id: 'wandering-supplier',
        title: '游荡补给者',
        description: '一个披着斗篷的人影留下补给，转身消失在矿道深处。',
        minFloor: 4,
        weight: 14,
        choices: [
            {
                id: 'potion',
                label: '拿取药水',
                resultText: '你获得了一瓶回复药水。',
                effects: [{ type: 'consumable', value: 1, consumableType: 'healPotionM', label: '获得中回复药水 x1' }],
            },
            {
                id: 'scroll',
                label: '拿取卷轴',
                resultText: '你获得了一张攻击卷轴。',
                effects: [{ type: 'consumable', value: 1, consumableType: 'scrollAtk', label: '获得攻击卷轴 x1' }],
            },
        ],
    },
];

export function rollDungeonEvent(currentFloor: number): DungeonEventDefinition | null {
    if (Math.random() >= DUNGEON_EVENT_TRIGGER_CHANCE) {
        return null;
    }

    const available = DUNGEON_EVENTS.filter((event) => currentFloor >= event.minFloor);
    if (available.length === 0) {
        return null;
    }

    const totalWeight = available.reduce((sum, event) => sum + event.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const event of available) {
        roll -= event.weight;
        if (roll <= 0) {
            return event;
        }
    }

    return available[available.length - 1];
}
