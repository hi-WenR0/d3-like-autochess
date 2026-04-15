import { Math as PhaserMath, Scene } from 'phaser';
import {
    type CharacterData,
    type Monster,
    type DungeonState,
    type Equipment,
    type ExploreState,
    type EquipSlot,
    type WearableSlot,
    type Rarity,
    getZoneForFloor,
    RARITY_CONFIG,
    EQUIP_SLOTS,
    INVENTORY_CAPACITY,
    sellPrice,
} from '../models';
import {
    type EquippedItems,
} from '../systems/equip-system';
import {
    type AffixEffects,
} from '../systems/combat-system';
import {
    createCharacter,
    getEffectiveStats,
    addExperience,
    heal,
    isAlive,
    allocateStatPoint,
    type ExternalStatBonuses,
} from '../systems/character-system';
import {
    spawnMonster,
} from '../systems/monster-system';
import {
    playerAttackMonster,
    collectAffixEffects,
    type CombatResult,
} from '../systems/combat-system';
import {
    shouldDropEquipment,
    bossDropCount,
    rollRarity,
    generateEquipment,
    randomSlot,
} from '../systems/loot-system';
import {
    createInventory,
    addItem,
    addItemWithAutoDismantle,
    dismantleOne,
    dismantleByRarity,
    normalizeInventoryData,
    removeItem,
    isFull,
    sellByRarity,
    queryInventoryItems,
    type InventorySortBy,
    type InventorySortOrder,
    type InventoryData,
} from '../systems/inventory-system';
import {
    createEquippedItems,
    equipItem,
    unequipItem,
    getEquipped,
    findAvailableRingSlot,
    calculateEquipBonuses,
} from '../systems/equip-system';
import {
    createDungeonState,
    monstersForFloor,
    canProceedToNextFloor,
    proceedToNextFloor,
    setExploreState,
    onMonsterKilled,
    isBossFloor,
} from '../systems/dungeon-system';
import {
    saveGame,
    loadGame,
    calculateOfflineRewards,
    AutoSaveManager,
    type SaveData,
} from '../systems/save-system';
import {
    createConsumable,
    useConsumable,
    updateBuffs,
    autoUsePotion,
    getBuffBonuses,
} from '../systems/consumable-system';
import {
    buyConsumable,
    getShopConsumables,
    canBuyMore,
} from '../systems/shop-system';
import {
    type Consumable,
    type ActiveBuff,
    CONSUMABLE_DEFS,
} from '../models/consumable';

const DUNGEON_WIDTH = 1024;
const DUNGEON_HEIGHT = 600;
const HUD_HEIGHT = 168;
const PLAYER_SIZE = 24;
const LOOT_PICKUP_DELAY = 300;
const REST_THRESHOLD = 0.3;
const REST_RECOVERY_RATE = 0.05;
const VIEWPORT_HEIGHT = DUNGEON_HEIGHT + HUD_HEIGHT;

const DEPTH = {
    WORLD_TILE: 0,
    WORLD_ENTITY: 20,
    WORLD_LOOT: 30,
    WORLD_HIGHLIGHT_LOOT: 35,
    WORLD_FLOATING_TEXT: 80,
    HUD_BG: 100,
    HUD_INFO: 110,
    HUD_NAV_BG: 120,
    HUD_NAV_BTN: 130,
    UI_MODAL: 300,
    UI_TOOLTIP: 400,
} as const;

interface PanelRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface PanelDragContext {
    panel: Phaser.GameObjects.Container;
    handle: Phaser.GameObjects.Rectangle;
    frame: Phaser.GameObjects.Rectangle;
}

type GameplayPhase = 'town' | 'dungeon';

interface DungeonRunSummary {
    startFloor: number;
    monsterKills: number;
    gainedExp: number;
    gainedGold: number;
    pickedEquipments: Equipment[];
    gainedConsumables: Map<string, number>;
}

export class Game extends Scene {
    // 游戏数据
    character!: CharacterData;
    inventory!: InventoryData;
    equipped!: EquippedItems;
    dungeon!: DungeonState;
    affixEffects!: AffixEffects;
    consumables: Consumable[] = [];
    activeBuffs: ActiveBuff[] = [];

    // 游戏对象
    playerSprite!: Phaser.GameObjects.Container;
    monsterSprites: Map<string, Phaser.GameObjects.Container> = new Map();
    lootItems: { x: number; y: number; equipment: Equipment; sprite: Phaser.GameObjects.Container }[] = [];
    currentMonster: Monster | null = null;

    // 计时器
    lastAttackTime = 0;
    stateTimer = 0;
    hpRegenTimer = 0;

    // HUD 元素
    hpBar!: Phaser.GameObjects.Rectangle;
    hpBarBg!: Phaser.GameObjects.Rectangle;
    hpText!: Phaser.GameObjects.Text;
    floorText!: Phaser.GameObjects.Text;
    goldText!: Phaser.GameObjects.Text;
    stateText!: Phaser.GameObjects.Text;
    levelText!: Phaser.GameObjects.Text;
    combatLog!: Phaser.GameObjects.Text;
    statPointsText!: Phaser.GameObjects.Text;
    atkText!: Phaser.GameObjects.Text;
    defText!: Phaser.GameObjects.Text;
    buffText!: Phaser.GameObjects.Text;

    // UI 面板
    uiPanel: Phaser.GameObjects.Container | null = null;
    tooltipContainer: Phaser.GameObjects.Container | null = null;
    isUIOpen = false;
    inventoryRarityFilter: Rarity | 'all' = 'all';
    inventorySlotFilter: WearableSlot | 'all' = 'all';
    inventorySortBy: InventorySortBy = 'rarity';
    inventorySortOrder: InventorySortOrder = 'desc';
    inventoryPage = 0;
    gameplayPhase: GameplayPhase = 'town';
    townOverlay: Phaser.GameObjects.Container | null = null;
    autoEnterNextFloor = false;
    floorClearCountdownTimer: Phaser.Time.TimerEvent | null = null;

    // 地牢装饰
    floorTiles: Phaser.GameObjects.Rectangle[] = [];

    // 自动保存
    autoSaveManager!: AutoSaveManager;

    private panelDragContext: PanelDragContext | null = null;
    private dungeonRunSummary: DungeonRunSummary = this.createDungeonRunSummary();

    constructor() {
        super('Game');
    }

    create(data?: { newGame?: boolean }) {
        const forceNewGame = data?.newGame ?? false;
        // 尝试加载存档
        const saved = forceNewGame ? null : loadGame();
        if (saved) {
            this.character = saved.character;
            this.inventory = saved.inventory;
            normalizeInventoryData(this.inventory);
            this.equipped = saved.equipped;
            this.dungeon = saved.dungeon;
            this.consumables = saved.consumables ?? [];
            this.activeBuffs = [];
            this.affixEffects = collectAffixEffects(this.equipped);

            // 离线收益
            const rewards = calculateOfflineRewards(saved);
            if (rewards.offlineHours >= 0.1) {
                addExperience(this.character, rewards.exp);
                this.character.gold += rewards.gold;
                this.showOfflineRewards(rewards);
            }
        } else {
            this.character = createCharacter('冒险者');
            this.inventory = createInventory();
            this.equipped = createEquippedItems();
            this.dungeon = createDungeonState();
            this.affixEffects = collectAffixEffects(this.equipped);
        }

        this.renderDungeon();
        this.renderPlayer();
        this.renderHUD();
        this.spawnMonstersForFloor();
        this.enterTown(true);

        // 启动自动保存
        this.autoSaveManager = new AutoSaveManager(() => this.getCurrentSaveData());
        this.autoSaveManager.start();
    }

    private getCurrentSaveData(): SaveData {
        return {
            version: 2,
            timestamp: Date.now(),
            character: this.character,
            inventory: this.inventory,
            equipped: this.equipped,
            dungeon: this.dungeon,
            consumables: this.consumables,
            totalPlayTime: 0,
        };
    }

    update(time: number, delta: number) {
        if (this.isUIOpen) return;

        if (this.gameplayPhase === 'town') {
            this.updateHUD();
            return;
        }

        if (!isAlive(this.character)) {
            this.onPlayerDeath();
            return;
        }

        const dt = delta / 1000;

        // 更新增益效果
        this.updateBuffsAndAutoPotion(time);

        // HP 回复词条
        this.updateHpRegen(dt);

        switch (this.dungeon.exploreState) {
            case 'exploring':
                this.updateExploring(dt);
                break;
            case 'fighting':
                this.updateFighting(time);
                break;
            case 'looting':
                this.updateLooting();
                break;
            case 'resting':
                this.updateResting(dt);
                break;
            case 'transitioning':
                this.updateTransitioning(dt);
                break;
        }

        this.updateHUD();
    }

    // ─── HP 回复词条 ───

    private updateHpRegen(dt: number) {
        if (this.affixEffects.hpRegen > 0) {
                this.hpRegenTimer += dt;
                if (this.hpRegenTimer >= 1) {
                    this.hpRegenTimer = 0;
                    heal(this.character, this.affixEffects.hpRegen, this.getCurrentStatBonuses());
                }
            }
        }

    // ─── 增益与自动药水 ───

    private updateBuffsAndAutoPotion(time: number) {
        // 更新增益
        const expired = updateBuffs(this.activeBuffs, time);
        for (const name of expired) {
            this.log(`${name} 效果已消失`);
        }

        // 自动使用药水（HP < 30% 时触发）
        const result = autoUsePotion(this.consumables, this.character, 0.3, this.getCurrentStatBonuses());
        if (result.used) {
            this.log(result.message);
            // 清理空消耗品
            this.consumables = this.consumables.filter(c => c.count > 0);
        }
    }

    // ─── 地牢渲染 ───

    private renderDungeon() {
        const zone = getZoneForFloor(this.dungeon.currentFloor);
        this.cameras.main.setBackgroundColor(zone.backgroundColor);

        this.floorTiles.forEach(t => t.destroy());
        this.floorTiles = [];

        const tileSize = 64;
        for (let x = 0; x < DUNGEON_WIDTH; x += tileSize) {
            for (let y = 0; y < DUNGEON_HEIGHT; y += tileSize) {
                const shade = PhaserMath.Between(20, 35);
                const tile = this.add.rectangle(x + tileSize / 2, y + tileSize / 2, tileSize - 2, tileSize - 2, shade << 16 | shade << 8 | shade);
                this.floorTiles.push(tile);
            }
        }
    }

    // ─── 角色渲染 ───

    private renderPlayer() {
        const body = this.add.rectangle(0, 0, PLAYER_SIZE, PLAYER_SIZE, 0x4fc3f7);
        const label = this.add.text(0, -PLAYER_SIZE, '你', { fontSize: '10px', color: '#ffffff' }).setOrigin(0.5);
        this.playerSprite = this.add.container(DUNGEON_WIDTH / 2, DUNGEON_HEIGHT / 2, [body, label]).setDepth(DEPTH.WORLD_ENTITY);
    }

    // ─── 怪物 ───

    private spawnMonstersForFloor() {
        this.monsterSprites.forEach(s => s.destroy());
        this.monsterSprites.clear();

        const count = monstersForFloor(this.dungeon.currentFloor);
        const bossFloor = isBossFloor(this.dungeon.currentFloor);

        for (let i = 0; i < count; i++) {
            const x = PhaserMath.Between(80, DUNGEON_WIDTH - 80);
            const y = PhaserMath.Between(80, DUNGEON_HEIGHT - 80);

            if (bossFloor && i === count - 1) {
                const boss = spawnMonster(this.dungeon.currentFloor, x, y);
                boss.type = 'boss';
                boss.name = boss.name.replace(/[★]*$/, '★★★');
                boss.stats.maxHp *= 5;
                boss.stats.hp = boss.stats.maxHp;
                boss.stats.atk = Math.floor(boss.stats.atk * 2);
                this.renderMonster(boss);
            } else {
                const monster = spawnMonster(this.dungeon.currentFloor, x, y);
                this.renderMonster(monster);
            }
        }
    }

    private renderMonster(monster: Monster) {
        const colors: Record<string, number> = { normal: 0xef5350, elite: 0xffa726, rare: 0xab47bc, boss: 0xff1744 };
        const sizes: Record<string, number> = { normal: 20, elite: 26, rare: 30, boss: 40 };
        const color = colors[monster.type] ?? 0xef5350;
        const size = sizes[monster.type] ?? 20;
        const barWidth = size + 4;

        const body = this.add.rectangle(0, 0, size, size, color);
        const hpBg = this.add.rectangle(0, -size / 2 - 6, barWidth, 4, 0x333333).setOrigin(0.5);
        const hpBar = this.add.rectangle(-barWidth / 2, -size / 2 - 6, barWidth, 2, 0x00ff00).setOrigin(0, 0.5);
        const label = this.add.text(0, -size / 2 - 14, monster.name, { fontSize: '9px', color: '#ffffff' }).setOrigin(0.5);

        const container = this.add.container(monster.x, monster.y, [body, hpBg, hpBar, label]).setDepth(DEPTH.WORLD_ENTITY);
        this.monsterSprites.set(monster.id, container);

        container.setData('monster', monster);
        container.setData('hpBar', hpBar);
        container.setData('maxHp', monster.stats.maxHp);
        container.setData('hpBarWidth', barWidth);
    }

    private updateMonsterHpBar(monster: Monster) {
        const container = this.monsterSprites.get(monster.id);
        if (!container) return;

        const hpBar = container.getData('hpBar') as Phaser.GameObjects.Rectangle;
        const maxHp = container.getData('maxHp') as number;
        const barWidth = container.getData('hpBarWidth') as number;
        if (hpBar && maxHp > 0) {
            const ratio = Math.max(0, monster.stats.hp / maxHp);
            hpBar.width = ratio * barWidth;
            hpBar.fillColor = ratio > 0.5 ? 0x00ff00 : ratio > 0.25 ? 0xffff00 : 0xff0000;
        }
    }

    // ─── 状态更新 ───

    private updateExploring(dt: number) {
        const stats = this.getCurrentStats();

        if (this.character.baseStats.hp / stats.maxHp < REST_THRESHOLD) {
            setExploreState(this.dungeon, 'resting');
            return;
        }

        const nearest = this.findNearestMonster();
        if (nearest) {
            if (this.lootItems.length > 0) {
                setExploreState(this.dungeon, 'looting');
                this.stateTimer = 0;
                return;
            }

            this.currentMonster = nearest.getData('monster') as Monster;
            setExploreState(this.dungeon, 'fighting');
            return;
        }

        if (canProceedToNextFloor(this.dungeon)) {
            this.enterTown();
            this.showFloorClearPanel();
            return;
        }

        this.movePlayerTowardMonster(dt);
    }

    private updateFighting(time: number) {
        if (!this.currentMonster) {
            setExploreState(this.dungeon, 'exploring');
            return;
        }

        const stats = this.getCurrentStats();
        const attackInterval = 1000 / Math.max(0.1, stats.attackSpeed);
        if (time - this.lastAttackTime < attackInterval) return;
        this.lastAttackTime = time;

        const result = playerAttackMonster(this.character, this.currentMonster, this.affixEffects, stats);

        if (result.damageDealt > 0) {
            const suffix = result.isCombo ? ' 连击!' : '';
            this.showDamageNumber(this.currentMonster.x, this.currentMonster.y - 30, result.damageDealt, result.isCrit, suffix);
        }

        if (result.lifeStealHeal > 0) {
            this.showHealNumber(this.playerSprite.x, this.playerSprite.y - 30, result.lifeStealHeal);
        }

        if (result.isEvaded) {
            this.showEvadeText(this.playerSprite.x, this.playerSprite.y - 20);
        }

        if (result.monsterKilled) {
            this.onMonsterKilled(this.currentMonster, result);
        } else {
            this.updateMonsterHpBar(this.currentMonster);
            if (result.damageReceived > 0) {
                // 伤害已在 combat-system 中扣除
            }
        }
    }

    private updateLooting() {
        this.stateTimer += this.game.loop.delta;

        if (this.lootItems.length === 0 || this.stateTimer >= LOOT_PICKUP_DELAY) {
            while (this.lootItems.length > 0) {
                const loot = this.lootItems.pop()!;
                if (!isFull(this.inventory)) {
                    const addResult = addItemWithAutoDismantle(this.inventory, loot.equipment);
                    if (addResult.action === 'dismantled') {
                        this.log(`自动拆解 ${loot.equipment.name}，获得 ${addResult.essenceGained} 精华`);
                    } else if (addResult.action === 'added') {
                        this.dungeonRunSummary.pickedEquipments.push(loot.equipment);
                        this.showPickupText(loot.x, loot.y, loot.equipment);
                    } else {
                        this.lootItems.push(loot);
                        break;
                    }
                    loot.sprite.destroy();
                } else {
                    this.lootItems.push(loot);
                    break;
                }
            }
            setExploreState(this.dungeon, 'exploring');
        }
    }

    private updateResting(dt: number) {
        const stats = this.getCurrentStats();
        const recoverAmount = Math.floor(stats.maxHp * REST_RECOVERY_RATE * dt);
        heal(this.character, recoverAmount, this.getCurrentStatBonuses());

        if (this.character.baseStats.hp / stats.maxHp > 0.7) {
            setExploreState(this.dungeon, 'exploring');
        }
    }

    private updateTransitioning(dt: number) {
        this.stateTimer += dt;

        if (this.stateTimer >= 1.5) {
            proceedToNextFloor(this.dungeon);
            this.renderDungeon();
            this.spawnMonstersForFloor();
            this.playerSprite.setPosition(DUNGEON_WIDTH / 2, DUNGEON_HEIGHT / 2);
        }
    }

    // ─── 事件处理 ───

    private onMonsterKilled(monster: Monster, result: CombatResult) {
        const leveledUp = addExperience(this.character, result.expGained);
        this.character.gold += result.goldGained;
        onMonsterKilled(this.dungeon);
        this.dungeonRunSummary.monsterKills += 1;
        this.dungeonRunSummary.gainedExp += result.expGained;
        this.dungeonRunSummary.gainedGold += result.goldGained;

        if (leveledUp) {
            this.showLevelUp();
        }

        if (shouldDropEquipment(monster)) {
            const dropCount = monster.type === 'boss' ? bossDropCount() : 1;
            // 掠夺者词条：额外掉落
            const predatorBonus = Math.random() * 100 < this.affixEffects.predatorChance ? 1 : 0;
            const totalDrops = dropCount + predatorBonus;

            for (let i = 0; i < totalDrops; i++) {
                const minRarity = monster.type === 'boss' ? 'legendary' : monster.type === 'rare' ? 'rare' : monster.type === 'elite' ? 'magic' : undefined;
                const rarity = rollRarity(minRarity as any);
                const slot = randomSlot();
                const equipment = generateEquipment(slot, this.dungeon.currentFloor, rarity);
                this.dropLoot(monster.x + PhaserMath.Between(-30, 30), monster.y + PhaserMath.Between(-30, 30), equipment);
            }
        }

        // 药水掉落
        this.rollPotionDrop(monster);

        const sprite = this.monsterSprites.get(monster.id);
        if (sprite) {
            sprite.destroy();
            this.monsterSprites.delete(monster.id);
        }

        this.currentMonster = null;
        setExploreState(this.dungeon, 'looting');
        this.stateTimer = 0;
    }

    private dropLoot(x: number, y: number, equipment: Equipment) {
        const color = parseInt(RARITY_CONFIG[equipment.rarity].color.replace('#', ''), 16);
        const rarityColor = RARITY_CONFIG[equipment.rarity].color;
        const isHighRarity = equipment.rarity === 'legendary' || equipment.rarity === 'mythic';

        const elements: Phaser.GameObjects.GameObject[] = [];

        // 传奇/神话发光光环
        if (isHighRarity) {
            const glowColor = equipment.rarity === 'mythic' ? 0xe6cc80 : 0xff8000;
            const glow = this.add.rectangle(0, 0, 24, 24, glowColor, 0.3).setOrigin(0.5);
            elements.push(glow);

            this.tweens.add({
                targets: glow,
                scaleX: 1.8,
                scaleY: 1.8,
                alpha: 0,
                duration: 800,
                yoyo: true,
                repeat: -1,
            });
        }

        const body = this.add.rectangle(0, 0, isHighRarity ? 16 : 12, isHighRarity ? 16 : 12, color);
        elements.push(body);

        const label = this.add.text(0, -14, equipment.name, {
            fontSize: isHighRarity ? '10px' : '8px',
            color: rarityColor,
            fontStyle: isHighRarity ? 'bold' : 'normal',
        }).setOrigin(0.5);
        elements.push(label);

        const container = this.add.container(x, y - 40, elements);
        container.setDepth(isHighRarity ? DEPTH.WORLD_HIGHLIGHT_LOOT : DEPTH.WORLD_LOOT);

        // 掉落动画：从上方落下
        this.tweens.add({
            targets: container,
            y: y,
            duration: 300,
            ease: 'Bounce.easeOut',
        });

        // 闪烁动画
        this.tweens.add({
            targets: body,
            alpha: 0.4,
            duration: isHighRarity ? 300 : 500,
            yoyo: true,
            repeat: -1,
        });

        this.lootItems.push({ x, y, equipment, sprite: container });

        // 高稀有度掉落提示
        if (isHighRarity) {
            const prefix = equipment.rarity === 'mythic' ? '✦ 神话' : '★ 传奇';
            this.log(`${prefix}掉落! ${equipment.name}`);
        }
    }

    private onPlayerDeath() {
        // 复活甲词条
        if (this.affixEffects.rebirthChance > 0 && Math.random() * 100 < this.affixEffects.rebirthChance) {
            const stats = this.getCurrentStats();
            this.character.baseStats.hp = Math.floor(stats.maxHp * 0.5);
            this.log('复活甲触发！恢复 50% HP');
            setExploreState(this.dungeon, 'exploring');
            return;
        }

        const stats = this.getCurrentStats();
        this.character.baseStats.hp = Math.floor(stats.maxHp * 0.5);
        this.character.gold = Math.floor(this.character.gold * 0.9);
        this.log('角色阵亡，自动复活，损失 10% 金币');
        setExploreState(this.dungeon, 'exploring');
    }

    // ─── 辅助方法 ───

    private findNearestMonster(): Phaser.GameObjects.Container | null {
        let nearest: Phaser.GameObjects.Container | null = null;
        let minDist = Infinity;

        const px = this.playerSprite.x;
        const py = this.playerSprite.y;

        this.monsterSprites.forEach((container) => {
            const dist = PhaserMath.Distance.Between(px, py, container.x, container.y);
            if (dist < minDist) {
                minDist = dist;
                nearest = container;
            }
        });

        return nearest;
    }

    private movePlayerTowardMonster(dt: number) {
        const stats = this.getCurrentStats();
        const speed = stats.moveSpeed * dt;

        // 尝试走向最近的怪物
        const nearest = this.findNearestMonster();
        let angle: number;

        if (nearest) {
            angle = PhaserMath.Angle.Between(this.playerSprite.x, this.playerSprite.y, nearest.x, nearest.y);
        } else {
            angle = this.playerSprite.getData('moveAngle') ?? Math.random() * Math.PI * 2;
            if (Math.random() < 0.02) {
                this.playerSprite.setData('moveAngle', Math.random() * Math.PI * 2);
            }
        }

        const nx = PhaserMath.Clamp(this.playerSprite.x + Math.cos(angle) * speed, 30, DUNGEON_WIDTH - 30);
        const ny = PhaserMath.Clamp(this.playerSprite.y + Math.sin(angle) * speed, 30, DUNGEON_HEIGHT - 30);
        this.playerSprite.setPosition(nx, ny);
    }

    private showDamageNumber(x: number, y: number, damage: number, isCrit: boolean, suffix = '') {
        const style: import('phaser').Types.GameObjects.Text.TextStyle = {
            fontSize: isCrit ? '18px' : '14px',
            color: isCrit ? '#ffff00' : '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
        };
        const text = this.add.text(x, y, `-${damage}${isCrit ? '!' : ''}${suffix}`, style).setOrigin(0.5).setDepth(DEPTH.WORLD_FLOATING_TEXT);

        this.tweens.add({
            targets: text,
            y: y - 40,
            alpha: 0,
            duration: 800,
            onComplete: () => text.destroy(),
        });
    }

    private showHealNumber(x: number, y: number, amount: number) {
        const text = this.add.text(x, y, `+${amount}`, { fontSize: '12px', color: '#2ecc71', stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5).setDepth(DEPTH.WORLD_FLOATING_TEXT);

        this.tweens.add({
            targets: text,
            y: y - 30,
            alpha: 0,
            duration: 600,
            onComplete: () => text.destroy(),
        });
    }

    private showEvadeText(x: number, y: number) {
        const text = this.add.text(x, y, '闪避!', { fontSize: '12px', color: '#3498db', stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5).setDepth(DEPTH.WORLD_FLOATING_TEXT);

        this.tweens.add({
            targets: text,
            y: y - 25,
            alpha: 0,
            duration: 500,
            onComplete: () => text.destroy(),
        });
    }

    private showLevelUp() {
        const text = this.add.text(DUNGEON_WIDTH / 2, DUNGEON_HEIGHT / 2 - 50, `LEVEL UP! Lv.${this.character.level}`, {
            fontSize: '28px', color: '#f1c40f', stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(DEPTH.WORLD_FLOATING_TEXT);

        this.tweens.add({
            targets: text,
            y: DUNGEON_HEIGHT / 2 - 100,
            alpha: 0,
            duration: 1500,
            onComplete: () => text.destroy(),
        });

        this.log(`升级到 Lv.${this.character.level}！获得 1 属性点`);
    }

    private showPickupText(x: number, y: number, equipment: Equipment) {
        const rarityColor = RARITY_CONFIG[equipment.rarity].color;
        const isHigh = equipment.rarity === 'legendary' || equipment.rarity === 'mythic';
        const text = this.add.text(x, y, `+${equipment.name}`, {
            fontSize: isHigh ? '13px' : '10px',
            color: rarityColor,
            fontStyle: isHigh ? 'bold' : 'normal',
            stroke: '#000000',
            strokeThickness: isHigh ? 3 : 1,
        }).setOrigin(0.5).setDepth(DEPTH.WORLD_FLOATING_TEXT);

        this.tweens.add({
            targets: text,
            y: y - 30,
            alpha: 0,
            duration: isHigh ? 1200 : 800,
            onComplete: () => text.destroy(),
        });
    }

    private log(msg: string) {
        this.combatLog.setText(msg);
    }

    private createDungeonRunSummary(): DungeonRunSummary {
        return {
            startFloor: this.dungeon?.currentFloor ?? 1,
            monsterKills: 0,
            gainedExp: 0,
            gainedGold: 0,
            pickedEquipments: [],
            gainedConsumables: new Map<string, number>(),
        };
    }

    private resetDungeonRunSummary() {
        this.dungeonRunSummary = this.createDungeonRunSummary();
        this.dungeonRunSummary.startFloor = this.dungeon.currentFloor;
    }

    private clearFloorClearCountdown() {
        if (!this.floorClearCountdownTimer) return;
        this.time.removeEvent(this.floorClearCountdownTimer);
        this.floorClearCountdownTimer = null;
    }

    private proceedToNextFloorFromPanel() {
        this.clearFloorClearCountdown();
        this.closeUI();

        proceedToNextFloor(this.dungeon);
        this.renderDungeon();
        this.spawnMonstersForFloor();
        this.playerSprite.setPosition(DUNGEON_WIDTH / 2, DUNGEON_HEIGHT / 2);
        setExploreState(this.dungeon, 'exploring');
        this.enterDungeon();
    }

    private showFloorClearPanel() {
        this.closeUI();
        this.isUIOpen = true;
        this.clearFloorClearCountdown();

        const summary = this.dungeonRunSummary;
        const gainedItems = summary.pickedEquipments.slice(0, 6);
        const consumableLines = Array.from(summary.gainedConsumables.entries()).slice(0, 3);

        const elements: Phaser.GameObjects.GameObject[] = [];

        const bg = this.add.rectangle(0, 0, DUNGEON_WIDTH, DUNGEON_HEIGHT + HUD_HEIGHT, 0x000000, 0.75).setOrigin(0).setDepth(200).setInteractive();
        elements.push(bg);

        const panelBg = this.add.rectangle(200, 70, 624, 620, 0x1a1a2e).setOrigin(0).setDepth(201).setStrokeStyle(2, 0x4a4a6a);
        elements.push(panelBg);

        const title = this.add.text(512, 95, `第 ${summary.startFloor} 层通关`, {
            fontSize: '24px',
            color: '#f1c40f',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(202);
        elements.push(title);

        const summaryText = this.add.text(240, 130, `击杀: ${summary.monsterKills}   经验: +${summary.gainedExp}   金币: +${summary.gainedGold}`, {
            fontSize: '14px',
            color: '#d6e6f5',
        }).setDepth(202);
        elements.push(summaryText);

        const equipTitle = this.add.text(240, 170, '本次获得装备:', {
            fontSize: '14px',
            color: '#f39c12',
        }).setDepth(202);
        elements.push(equipTitle);

        let listY = 198;
        if (gainedItems.length === 0) {
            const empty = this.add.text(250, listY, '无', { fontSize: '13px', color: '#95a5a6' }).setDepth(202);
            elements.push(empty);
            listY += 24;
        } else {
            for (const eq of gainedItems) {
                const line = this.add.text(250, listY, `• ${eq.name}`, { fontSize: '13px', color: RARITY_CONFIG[eq.rarity].color }).setDepth(202);
                elements.push(line);
                listY += 22;
            }
        }

        const consTitle = this.add.text(240, listY + 10, '本次获得消耗品:', {
            fontSize: '14px',
            color: '#f39c12',
        }).setDepth(202);
        elements.push(consTitle);

        listY += 38;
        if (consumableLines.length === 0) {
            const empty = this.add.text(250, listY, '无', { fontSize: '13px', color: '#95a5a6' }).setDepth(202);
            elements.push(empty);
            listY += 24;
        } else {
            for (const [consumableName, count] of consumableLines) {
                const line = this.add.text(250, listY, `• ${consumableName} x${count}`, { fontSize: '13px', color: '#2ecc71' }).setDepth(202);
                elements.push(line);
                listY += 22;
            }
        }

        const autoLabel = this.add.text(240, 520, this.autoEnterNextFloor ? '[x] 自动进入下一层（3秒）' : '[ ] 自动进入下一层（3秒）', {
            fontSize: '14px',
            color: '#3498db',
        }).setDepth(202).setInteractive({ useHandCursor: true });
        elements.push(autoLabel);

        const countdownText = this.add.text(240, 550, '', { fontSize: '13px', color: '#f1c40f' }).setDepth(202);
        elements.push(countdownText);

        const stayBtn = this.add.text(250, 600, '[留在主城]', {
            fontSize: '16px',
            color: '#95a5a6',
        }).setDepth(202).setInteractive({ useHandCursor: true });
        stayBtn.on('pointerdown', () => {
            this.clearFloorClearCountdown();
            this.closeUI();
            this.log('已留在主城');
        });
        elements.push(stayBtn);

        const nextBtn = this.add.text(620, 600, '[进入下一层]', {
            fontSize: '16px',
            color: '#2ecc71',
            fontStyle: 'bold',
        }).setDepth(202).setInteractive({ useHandCursor: true });
        nextBtn.on('pointerdown', () => this.proceedToNextFloorFromPanel());
        elements.push(nextBtn);

        const startAutoCountdown = () => {
            this.clearFloorClearCountdown();
            if (!this.autoEnterNextFloor) {
                countdownText.setText('');
                return;
            }

            let remaining = 3;
            countdownText.setText(`将在 ${remaining} 秒后自动进入下一层...`);
            this.floorClearCountdownTimer = this.time.addEvent({
                delay: 1000,
                repeat: 2,
                callback: () => {
                    remaining -= 1;
                    if (remaining > 0) {
                        countdownText.setText(`将在 ${remaining} 秒后自动进入下一层...`);
                    } else {
                        countdownText.setText('正在进入下一层...');
                        this.proceedToNextFloorFromPanel();
                    }
                },
            });
        };

        autoLabel.on('pointerdown', () => {
            this.autoEnterNextFloor = !this.autoEnterNextFloor;
            autoLabel.setText(this.autoEnterNextFloor ? '[x] 自动进入下一层（3秒）' : '[ ] 自动进入下一层（3秒）');
            startAutoCountdown();
        });

        const panelRect: PanelRect = { x: 200, y: 70, width: 624, height: 620 };
        this.createManagedPanel(elements, panelRect, panelBg);
        startAutoCountdown();
    }

    private setWorldVisibility(visible: boolean) {
        if (this.playerSprite) {
            this.playerSprite.setVisible(visible);
        }

        this.floorTiles.forEach(tile => tile.setVisible(visible));
        this.monsterSprites.forEach(sprite => sprite.setVisible(visible));
        this.lootItems.forEach(item => item.sprite.setVisible(visible));
    }

    private hideTownOverlay() {
        if (!this.townOverlay) return;
        this.townOverlay.destroy(true);
        this.townOverlay = null;
    }

    private renderTownOverlay() {
        this.hideTownOverlay();

        const elements: Phaser.GameObjects.GameObject[] = [];

        const mask = this.add.rectangle(0, 0, DUNGEON_WIDTH, DUNGEON_HEIGHT, 0x06111f, 0.9).setOrigin(0);
        elements.push(mask);

        const panel = this.add.rectangle(182, 140, 660, 320, 0x10243a).setOrigin(0).setStrokeStyle(2, 0x2f5c88);
        elements.push(panel);

        const title = this.add.text(512, 195, '主城', {
            fontSize: '34px',
            color: '#f1c40f',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        elements.push(title);

        const desc = this.add.text(512, 250, '在主城整理背包、出售装备，然后进入地牢战斗。', {
            fontSize: '15px',
            color: '#d6e6f5',
        }).setOrigin(0.5);
        elements.push(desc);

        const hint = this.add.text(512, 282, '提示：装备出售/分解仅能在主城商店进行。', {
            fontSize: '13px',
            color: '#f39c12',
        }).setOrigin(0.5);
        elements.push(hint);

        const enterBtnBg = this.add.rectangle(512, 355, 220, 50, 0x1b7f3a).setStrokeStyle(2, 0x77d98e).setInteractive({ useHandCursor: true });
        const enterBtnText = this.add.text(512, 355, '进入地牢', {
            fontSize: '20px',
            color: '#ffffff',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        enterBtnBg.on('pointerover', () => enterBtnBg.setFillStyle(0x24964a));
        enterBtnBg.on('pointerout', () => enterBtnBg.setFillStyle(0x1b7f3a));
        enterBtnBg.on('pointerdown', () => this.enterDungeon());
        elements.push(enterBtnBg, enterBtnText);

        this.townOverlay = this.add.container(0, 0, elements).setDepth(DEPTH.WORLD_FLOATING_TEXT + 5);
    }

    private enterTown(initial = false) {
        if (!initial && this.gameplayPhase === 'town') return;

        if (!initial) {
            this.closeUI();
        }
        this.gameplayPhase = 'town';
        this.currentMonster = null;
        setExploreState(this.dungeon, 'exploring');
        this.setWorldVisibility(false);
        this.renderTownOverlay();

        if (!initial) {
            this.log('已回到主城');
        }
    }

    private enterDungeon() {
        if (this.gameplayPhase === 'dungeon') return;

        this.closeUI();
        this.gameplayPhase = 'dungeon';
        this.resetDungeonRunSummary();
        this.hideTownOverlay();
        this.setWorldVisibility(true);

        if (this.monsterSprites.size === 0) {
            this.spawnMonstersForFloor();
        }

        setExploreState(this.dungeon, 'exploring');
        this.log('进入地牢');
    }

    // ─── HUD ───

    private renderHUD() {
        const hudY = DUNGEON_HEIGHT;

        // 主 HUD 背景
        this.add.rectangle(DUNGEON_WIDTH / 2, hudY + HUD_HEIGHT / 2, DUNGEON_WIDTH, HUD_HEIGHT, 0x0d0d1a).setDepth(DEPTH.HUD_BG);

        // 分隔线
        this.add.rectangle(DUNGEON_WIDTH / 2, hudY + 1, DUNGEON_WIDTH, 2, 0x4a4a6a).setDepth(DEPTH.HUD_BG + 1);

        // HP 条
        this.hpBarBg = this.add.rectangle(20, hudY + 16, 220, 18, 0x1a1a2e).setOrigin(0).setDepth(DEPTH.HUD_INFO).setStrokeStyle(1, 0x333355);
        this.hpBar = this.add.rectangle(22, hudY + 18, 216, 14, 0xc0392b).setOrigin(0).setDepth(DEPTH.HUD_INFO + 1);
        this.hpText = this.add.text(130, hudY + 18, '', { fontSize: '11px', color: '#ffffff', stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5).setDepth(DEPTH.HUD_INFO + 2);

        // 左侧信息
        this.floorText = this.add.text(250, hudY + 10, '', { fontSize: '13px', color: '#f39c12', fontStyle: 'bold' }).setDepth(DEPTH.HUD_INFO + 2);
        this.goldText = this.add.text(250, hudY + 28, '', { fontSize: '12px', color: '#f1c40f' }).setDepth(DEPTH.HUD_INFO + 2);
        this.levelText = this.add.text(420, hudY + 10, '', { fontSize: '12px', color: '#2ecc71' }).setDepth(DEPTH.HUD_INFO + 2);
        this.stateText = this.add.text(420, hudY + 28, '', { fontSize: '11px', color: '#95a5a6' }).setDepth(DEPTH.HUD_INFO + 2);

        // 右侧信息
        this.atkText = this.add.text(600, hudY + 10, '', { fontSize: '11px', color: '#e74c3c' }).setDepth(DEPTH.HUD_INFO + 2);
        this.defText = this.add.text(600, hudY + 28, '', { fontSize: '11px', color: '#3498db' }).setDepth(DEPTH.HUD_INFO + 2);
        this.statPointsText = this.add.text(770, hudY + 10, '', { fontSize: '11px', color: '#9b59b6', fontStyle: 'bold' }).setDepth(DEPTH.HUD_INFO + 2);
        this.buffText = this.add.text(770, hudY + 28, '', { fontSize: '9px', color: '#e6cc80' }).setDepth(DEPTH.HUD_INFO + 2);

        // 战斗日志
        this.combatLog = this.add.text(20, hudY + 45, '', {
            fontSize: '11px', color: '#8e8e9e', wordWrap: { width: DUNGEON_WIDTH - 40 }, lineSpacing: 2,
        }).setDepth(DEPTH.HUD_INFO + 2);

        // ─── 底部导航栏 ───
        const navY = hudY + HUD_HEIGHT - 32;
        this.add.rectangle(DUNGEON_WIDTH / 2, navY + 16, DUNGEON_WIDTH, 32, 0x0a0a18).setDepth(DEPTH.HUD_NAV_BG);
        this.add.rectangle(DUNGEON_WIDTH / 2, navY, DUNGEON_WIDTH, 1, 0x333355).setDepth(DEPTH.HUD_NAV_BG + 1);

        // 导航按钮（均匀分布）
        const navBtns: { label: string; color: string; action: () => void }[] = [
            { label: '回主城', color: '#1abc9c', action: () => this.enterTown() },
            { label: '背包', color: '#3498db', action: () => this.openInventoryPanel() },
            { label: '装备', color: '#2ecc71', action: () => this.openEquipPanel() },
            { label: '属性', color: '#9b59b6', action: () => this.openStatsPanel() },
            { label: '消耗品', color: '#e67e22', action: () => this.openConsumablePanel() },
            { label: '商店', color: '#f1c40f', action: () => this.openShopPanel() },
            { label: '存档', color: '#95a5a6', action: () => this.manualSave() },
            { label: '重置', color: '#e74c3c', action: () => this.confirmReset() },
        ];

        const navWidth = DUNGEON_WIDTH / navBtns.length;
        for (let i = 0; i < navBtns.length; i++) {
            const btn = navBtns[i];
            const x = navWidth * i + navWidth / 2;

            const text = this.add.text(x, navY + 16, btn.label, {
                fontSize: '12px', color: btn.color,
            }).setOrigin(0.5).setDepth(DEPTH.HUD_NAV_BTN).setInteractive({ useHandCursor: true });

            // 悬浮效果
            text.on('pointerover', () => {
                text.setScale(1.15);
                text.setColor('#ffffff');
            });
            text.on('pointerout', () => {
                text.setScale(1);
                text.setColor(btn.color);
            });
            text.on('pointerdown', btn.action);
        }
    }

    private updateHUD() {
        const stats = this.getCurrentStats();
        const hpRatio = stats.maxHp > 0 ? this.character.baseStats.hp / stats.maxHp : 0;

        this.hpBar.width = 200 * hpRatio;
        this.hpBar.fillColor = hpRatio > 0.5 ? 0xe74c3c : hpRatio > 0.25 ? 0xe67e22 : 0xc0392b;
        this.hpText.setText(`${this.character.baseStats.hp} / ${stats.maxHp}`);

        const zone = getZoneForFloor(this.dungeon.currentFloor);
        this.floorText.setText(this.gameplayPhase === 'town' ? '主城 安全区' : `${zone.name} ${this.dungeon.currentFloor}F`);
        this.goldText.setText(`金币: ${this.character.gold}`);
        this.levelText.setText(`Lv.${this.character.level}  EXP: ${this.character.exp}/${this.character.expToNextLevel}`);

        const stateLabels: Record<ExploreState, string> = {
            exploring: '探索中', fighting: '战斗中!', looting: '拾取中', resting: '休息中', transitioning: '下楼中...',
        };
        this.stateText.setText(this.gameplayPhase === 'town' ? '主城待机' : stateLabels[this.dungeon.exploreState]);

        this.atkText.setText(`ATK:${stats.atk}  AS:${stats.attackSpeed.toFixed(1)}`);
        this.defText.setText(`DEF:${stats.def}  CR:${stats.critRate.toFixed(0)}%`);
        this.statPointsText.setText(this.character.statPoints > 0 ? `属性点: ${this.character.statPoints}` : '');

        // 增益显示
        const buffNames = this.activeBuffs.map(b => {
            const remain = Math.max(0, Math.ceil((b.endTime - Date.now()) / 1000));
            return `${b.name}${remain}s`;
        });
        const potionCount = this.consumables.filter(c => CONSUMABLE_DEFS[c.type].category === 'potion').reduce((sum, c) => sum + c.count, 0);
        const potionStr = potionCount > 0 ? `药水:${potionCount}` : '';
        this.buffText.setText([potionStr, ...buffNames].filter(Boolean).join(' '));
    }

    // ─── UI 面板系统 ───

    private createDragHandle(panelRect: PanelRect): Phaser.GameObjects.Rectangle {
        return this.add.rectangle(
            panelRect.x + panelRect.width / 2,
            panelRect.y + 22,
            Math.max(120, panelRect.width - 120),
            26,
            0x6ea6d9,
            0.14,
        ).setStrokeStyle(1, 0x9ac3e8, 0.8).setInteractive({ useHandCursor: true });
    }

    private clampPanelPosition(panel: Phaser.GameObjects.Container, panelRect: PanelRect): void {
        const minX = -panelRect.x;
        const maxX = DUNGEON_WIDTH - (panelRect.x + panelRect.width);
        const minY = -panelRect.y;
        const maxY = VIEWPORT_HEIGHT - (panelRect.y + panelRect.height);

        const clampedX = PhaserMath.Clamp(panel.x, Math.min(minX, maxX), Math.max(minX, maxX));
        const clampedY = PhaserMath.Clamp(panel.y, Math.min(minY, maxY), Math.max(minY, maxY));
        panel.setPosition(clampedX, clampedY);
    }

    private clearPanelDragContext(): void {
        if (!this.panelDragContext) return;
        this.panelDragContext.handle.setFillStyle(0x6ea6d9, 0.14);
        this.panelDragContext.frame.setStrokeStyle(2, 0x4a4a6a);
        this.panelDragContext = null;
    }

    private enablePanelDragging(
        panel: Phaser.GameObjects.Container,
        panelRect: PanelRect,
        panelFrame: Phaser.GameObjects.Rectangle,
        dragHandle: Phaser.GameObjects.Rectangle,
    ): void {
        this.input.setDraggable(dragHandle, true);

        dragHandle.on('pointerover', () => {
            if (this.panelDragContext?.handle !== dragHandle) {
                dragHandle.setFillStyle(0x6ea6d9, 0.24);
            }
        });

        dragHandle.on('pointerout', () => {
            if (this.panelDragContext?.handle !== dragHandle) {
                dragHandle.setFillStyle(0x6ea6d9, 0.14);
            }
        });

        dragHandle.on('dragstart', () => {
            this.clearPanelDragContext();
            this.panelDragContext = { panel, handle: dragHandle, frame: panelFrame };
            dragHandle.setFillStyle(0x6ea6d9, 0.35);
            panelFrame.setStrokeStyle(2, 0x74b9ff);
        });

        dragHandle.on('drag', (pointer: Phaser.Input.Pointer) => {
            if (this.panelDragContext?.panel !== panel) return;

            const deltaX = pointer.worldX - pointer.prevPosition.x;
            const deltaY = pointer.worldY - pointer.prevPosition.y;
            panel.x += deltaX;
            panel.y += deltaY;
            this.clampPanelPosition(panel, panelRect);
        });

        dragHandle.on('dragend', () => {
            this.clearPanelDragContext();
        });
    }

    private createManagedPanel(
        elements: Phaser.GameObjects.GameObject[],
        panelRect: PanelRect,
        panelFrame: Phaser.GameObjects.Rectangle,
    ): Phaser.GameObjects.Container {
        const dragHandle = this.createDragHandle(panelRect);
        elements.push(dragHandle);

        const panel = this.add.container(0, 0, elements).setDepth(DEPTH.UI_MODAL);
        this.uiPanel = panel;

        this.enablePanelDragging(panel, panelRect, panelFrame, dragHandle);
        this.clampPanelPosition(panel, panelRect);
        this.animatePanelOpen(panel);
        return panel;
    }

    private closeUI() {
        this.clearPanelDragContext();
        this.clearFloorClearCountdown();

        if (this.uiPanel) {
            const panel = this.uiPanel;
            this.uiPanel = null; // 立即清空引用，允许新面板设置
            // 淡出动画
            this.tweens.add({
                targets: panel,
                alpha: 0,
                duration: 150,
                onComplete: () => {
                    panel.destroy(true);
                    // 如果没有新面板打开，则更新状态
                    if (this.uiPanel === null) {
                        this.isUIOpen = false;
                    }
                },
            });
        } else {
            this.isUIOpen = false;
        }
        if (this.tooltipContainer) {
            this.tooltipContainer.destroy(true);
            this.tooltipContainer = null;
        }
    }

    /** 为面板添加打开动画 */
    private animatePanelOpen(panel: Phaser.GameObjects.Container) {
        panel.setAlpha(0);
        this.tweens.add({
            targets: panel,
            alpha: 1,
            duration: 200,
            ease: 'Power2',
        });
    }

    // ─── 背包面板 ───

    private openInventoryPanel() {
        this.closeUI();
        this.isUIOpen = true;

        const elements: Phaser.GameObjects.GameObject[] = [];

        // 背景遮罩
        const bg = this.add.rectangle(0, 0, DUNGEON_WIDTH, DUNGEON_HEIGHT + HUD_HEIGHT, 0x000000, 0.7).setOrigin(0).setDepth(200).setInteractive();
        elements.push(bg);

        // 面板背景
        const panelBg = this.add.rectangle(100, 40, 824, 680, 0x1a1a2e).setOrigin(0).setDepth(201).setStrokeStyle(2, 0x4a4a6a);
        elements.push(panelBg);

        // 标题
        const title = this.add.text(512, 60, `背包 (${this.inventory.items.length}/${INVENTORY_CAPACITY})`, { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5).setDepth(202);
        elements.push(title);
        const essenceText = this.add.text(230, 62, `拆解精华: ${this.inventory.dismantleEssence}`, { fontSize: '12px', color: '#f39c12' }).setDepth(202);
        elements.push(essenceText);

        // 关闭按钮
        const closeBtn = this.add.text(890, 50, '[X]', { fontSize: '18px', color: '#e74c3c' }).setDepth(202).setInteractive();
        closeBtn.on('pointerdown', () => this.closeUI());
        elements.push(closeBtn);

        const rarityOptions: { label: string; value: Rarity | 'all' }[] = [
            { label: '全部', value: 'all' },
            { label: '白', value: 'common' },
            { label: '蓝', value: 'magic' },
            { label: '黄', value: 'rare' },
            { label: '传说', value: 'legendary' },
            { label: '神话', value: 'mythic' },
        ];
        const rarityTitle = this.add.text(420, 82, '稀有度:', { fontSize: '11px', color: '#95a5a6' }).setDepth(202);
        elements.push(rarityTitle);
        for (let i = 0; i < rarityOptions.length; i++) {
            const option = rarityOptions[i];
            const active = this.inventoryRarityFilter === option.value;
            const btn = this.add.text(470 + i * 62, 82, `[${option.label}]`, {
                fontSize: '11px',
                color: active ? '#f1c40f' : '#bdc3c7',
            }).setDepth(202).setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => {
                this.inventoryRarityFilter = option.value;
                this.inventoryPage = 0;
                this.openInventoryPanel();
            });
            elements.push(btn);
        }

        const slotOptions: { label: string; value: WearableSlot | 'all' }[] = [
            { label: '全部', value: 'all' },
            { label: '武器', value: 'weapon' },
            { label: '防具', value: 'armor' },
            { label: '饰品', value: 'ring' },
            { label: '头盔', value: 'helmet' },
            { label: '手套', value: 'gloves' },
            { label: '项链', value: 'necklace' },
            { label: '靴子', value: 'boots' },
        ];
        const slotTitle = this.add.text(420, 102, '类型:', { fontSize: '11px', color: '#95a5a6' }).setDepth(202);
        elements.push(slotTitle);
        for (let i = 0; i < slotOptions.length; i++) {
            const option = slotOptions[i];
            const active = this.inventorySlotFilter === option.value;
            const btn = this.add.text(460 + i * 56, 102, `[${option.label}]`, {
                fontSize: '10px',
                color: active ? '#2ecc71' : '#bdc3c7',
            }).setDepth(202).setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => {
                this.inventorySlotFilter = option.value;
                this.inventoryPage = 0;
                this.openInventoryPanel();
            });
            elements.push(btn);
        }

        const sortTitle = this.add.text(420, 122, '排序:', { fontSize: '11px', color: '#95a5a6' }).setDepth(202);
        elements.push(sortTitle);
        const sortOptions: { label: string; value: InventorySortBy }[] = [
            { label: '稀有度', value: 'rarity' },
            { label: '等级', value: 'level' },
            { label: '格位', value: 'slot' },
        ];
        for (let i = 0; i < sortOptions.length; i++) {
            const option = sortOptions[i];
            const active = this.inventorySortBy === option.value;
            const btn = this.add.text(460 + i * 70, 122, `[${option.label}]`, {
                fontSize: '10px',
                color: active ? '#3498db' : '#bdc3c7',
            }).setDepth(202).setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => {
                this.inventorySortBy = option.value;
                this.inventoryPage = 0;
                this.openInventoryPanel();
            });
            elements.push(btn);
        }

        const sortOrderBtn = this.add.text(680, 122, this.inventorySortOrder === 'desc' ? '[倒序]' : '[升序]', {
            fontSize: '10px',
            color: '#9b59b6',
        }).setDepth(202).setInteractive({ useHandCursor: true });
        sortOrderBtn.on('pointerdown', () => {
            this.inventorySortOrder = this.inventorySortOrder === 'desc' ? 'asc' : 'desc';
            this.inventoryPage = 0;
            this.openInventoryPanel();
        });
        elements.push(sortOrderBtn);

        const displayedItems = queryInventoryItems(this.inventory, {
            rarity: this.inventoryRarityFilter,
            slot: this.inventorySlotFilter,
            sortBy: this.inventorySortBy,
            sortOrder: this.inventorySortOrder,
        });

        const pageSize = 40;
        const totalPages = Math.max(1, Math.ceil(displayedItems.length / pageSize));
        if (this.inventoryPage >= totalPages) {
            this.inventoryPage = totalPages - 1;
        }
        if (this.inventoryPage < 0) {
            this.inventoryPage = 0;
        }

        const pageInfo = this.add.text(770, 122, `${this.inventoryPage + 1}/${totalPages}`, {
            fontSize: '10px',
            color: '#95a5a6',
        }).setDepth(202);
        elements.push(pageInfo);

        const prevPage = this.add.text(730, 122, '[<]', {
            fontSize: '10px',
            color: this.inventoryPage > 0 ? '#3498db' : '#555555',
        }).setDepth(202).setInteractive({ useHandCursor: this.inventoryPage > 0 });
        if (this.inventoryPage > 0) {
            prevPage.on('pointerdown', () => {
                this.inventoryPage -= 1;
                this.openInventoryPanel();
            });
        }
        elements.push(prevPage);

        const nextPage = this.add.text(810, 122, '[>]', {
            fontSize: '10px',
            color: this.inventoryPage < totalPages - 1 ? '#3498db' : '#555555',
        }).setDepth(202).setInteractive({ useHandCursor: this.inventoryPage < totalPages - 1 });
        if (this.inventoryPage < totalPages - 1) {
            nextPage.on('pointerdown', () => {
                this.inventoryPage += 1;
                this.openInventoryPanel();
            });
        }
        elements.push(nextPage);

        const start = this.inventoryPage * pageSize;
        const pageItems = displayedItems.slice(start, start + pageSize);

        // 物品格子 5x8（按筛选与排序结果展示）
        const cellSize = 52;
        const startX = 420;
        const startY = 150;

        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 8; col++) {
                const idx = row * 8 + col;
                const cx = startX + col * (cellSize + 4);
                const cy = startY + row * (cellSize + 4);

                const cell = this.add.rectangle(cx, cy, cellSize, cellSize, 0x2a2a3e).setOrigin(0).setDepth(202).setStrokeStyle(1, 0x4a4a6a);
                elements.push(cell);

                const item = pageItems[idx];
                if (item) {
                    const rarityColor = RARITY_CONFIG[item.item.rarity].color;
                    const itemBg = this.add.rectangle(cx + 2, cy + 2, cellSize - 4, cellSize - 4, parseInt(rarityColor.replace('#', ''), 16) & 0x555555).setOrigin(0).setDepth(203);
                    elements.push(itemBg);

                    const slotLabel = this.add.text(cx + cellSize / 2, cy + 8, this.slotShortName(item.item.slot), { fontSize: '10px', color: rarityColor }).setOrigin(0.5).setDepth(204);
                    elements.push(slotLabel);

                    const nameLabel = this.add.text(cx + cellSize / 2, cy + 26, item.item.name.substring(0, 4), { fontSize: '8px', color: '#ffffff' }).setOrigin(0.5).setDepth(204);
                    elements.push(nameLabel);

                    // 点击装备
                    const hitArea = this.add.rectangle(cx + cellSize / 2, cy + cellSize / 2, cellSize, cellSize, 0x000000, 0).setDepth(205).setInteractive();
                    hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                        const mouseEvent = pointer.event as MouseEvent | undefined;
                        const shiftPressed = mouseEvent?.shiftKey ?? false;
                        if (shiftPressed) {
                            if (!this.canDismantleInCurrentPhase()) return;
                            const essence = dismantleOne(this.inventory, item.item.id);
                            if (essence > 0) {
                                this.log(`拆解 ${item.item.name}，获得 ${essence} 精华`);
                            }
                            this.openInventoryPanel();
                            return;
                        }
                        this.onInventoryItemClick(item.item);
                    });
                    hitArea.on('pointerover', () => this.showTooltip(item.item, cx + cellSize + 10, cy, this.getCompareTarget(item.item)));
                    hitArea.on('pointerout', () => this.hideTooltip());
                    elements.push(hitArea);
                }
            }
        }

        if (displayedItems.length === 0) {
            const emptyText = this.add.text(640, 290, '当前筛选下无装备', {
                fontSize: '14px',
                color: '#95a5a6',
            }).setOrigin(0.5).setDepth(202);
            elements.push(emptyText);
        }

        // 详情区域（左侧）
        const detailTitle = this.add.text(130, 95, '点击装备 / Shift+点击拆解', { fontSize: '12px', color: '#95a5a6' }).setDepth(202);
        elements.push(detailTitle);

        // 已装备快捷显示
        const equippedTitle = this.add.text(130, 130, '已装备:', { fontSize: '14px', color: '#f39c12' }).setDepth(202);
        elements.push(equippedTitle);

        let ey = 155;
        for (const slot of EQUIP_SLOTS) {
            const eq = getEquipped(this.equipped, slot);
            const label = eq ? eq.name : '(空)';
            const color = eq ? RARITY_CONFIG[eq.rarity].color : '#555555';
            const slotLabel = this.add.text(130, ey, `${slot}: `, { fontSize: '11px', color: '#95a5a6' }).setDepth(202);
            const nameLabel = this.add.text(200, ey, label, { fontSize: '11px', color }).setDepth(202).setInteractive();
            if (eq) {
                nameLabel.on('pointerdown', () => this.onEquippedItemClick(slot));
                nameLabel.on('pointerover', () => this.showTooltip(eq, 280, ey - 20));
                nameLabel.on('pointerout', () => this.hideTooltip());
            }
            elements.push(slotLabel, nameLabel);
            ey += 18;
        }

        const dismantleTitle = this.add.text(130, ey + 10, '手动拆解:', { fontSize: '14px', color: '#e67e22' }).setDepth(202);
        elements.push(dismantleTitle);

        const canDismantle = this.gameplayPhase === 'town';
        const manualBtns: { label: string; rarity: Rarity; color: string }[] = [
            { label: '拆白装', rarity: 'common', color: '#9d9d9d' },
            { label: '拆白+蓝', rarity: 'magic', color: '#3498db' },
            { label: '拆<=黄', rarity: 'rare', color: '#f1c40f' },
        ];

        let dy = ey + 34;
        for (const button of manualBtns) {
            const btn = this.add.text(130, dy, `[${button.label}]`, {
                fontSize: '12px',
                color: canDismantle ? button.color : '#555555',
            }).setDepth(202).setInteractive({ useHandCursor: canDismantle });
            if (canDismantle) {
                btn.on('pointerdown', () => {
                    const result = dismantleByRarity(this.inventory, button.rarity);
                    if (result.count > 0) {
                        this.log(`拆解 ${result.count} 件装备，获得 ${result.essence} 精华`);
                    } else {
                        this.log('没有可拆解的装备');
                    }
                    this.openInventoryPanel();
                });
            }
            elements.push(btn);
            dy += 22;
        }

        const autoTitle = this.add.text(130, dy + 8, '自动拆解:', { fontSize: '14px', color: '#e67e22' }).setDepth(202);
        elements.push(autoTitle);
        dy += 32;

        const autoToggleBtn = this.add.text(130, dy, this.inventory.autoDismantleEnabled ? '[已开启]' : '[已关闭]', {
            fontSize: '12px',
            color: this.inventory.autoDismantleEnabled ? '#2ecc71' : '#95a5a6',
        }).setDepth(202).setInteractive({ useHandCursor: true });
        autoToggleBtn.on('pointerdown', () => {
            this.inventory.autoDismantleEnabled = !this.inventory.autoDismantleEnabled;
            this.openInventoryPanel();
        });
        elements.push(autoToggleBtn);

        const autoRarityBtn = this.add.text(220, dy, `[阈值:${this.inventory.autoDismantleMaxRarity}]`, {
            fontSize: '12px',
            color: '#3498db',
        }).setDepth(202).setInteractive({ useHandCursor: true });
        autoRarityBtn.on('pointerdown', () => {
            this.inventory.autoDismantleMaxRarity = this.nextAutoDismantleRarity(this.inventory.autoDismantleMaxRarity);
            this.openInventoryPanel();
        });
        elements.push(autoRarityBtn);

        const phaseHint = this.add.text(130, dy + 22, canDismantle ? '当前可在主城进行手动拆解' : '地牢中禁止手动拆解', {
            fontSize: '11px',
            color: canDismantle ? '#7f8c8d' : '#e74c3c',
        }).setDepth(202);
        elements.push(phaseHint);

        const panelRect: PanelRect = { x: 100, y: 40, width: 824, height: 680 };
        this.createManagedPanel(elements, panelRect, panelBg);

    }

    private slotShortName(slot: string): string {
        const map: Record<string, string> = { helmet: '盔', armor: '甲', gloves: '手', belt: '腰', legs: '腿', boots: '靴', weapon: '武', necklace: '链', ring: '戒' };
        return map[slot] ?? '?';
    }

    private canDismantleInCurrentPhase(): boolean {
        if (this.gameplayPhase !== 'town') {
            this.log('请先回到主城再进行装备拆解');
            return false;
        }
        return true;
    }

    private nextAutoDismantleRarity(current: Rarity): Rarity {
        const order: Rarity[] = ['common', 'magic', 'rare', 'legendary', 'mythic'];
        const currentIndex = order.indexOf(current);
        const nextIndex = (currentIndex + 1) % order.length;
        return order[nextIndex];
    }

    private getCurrentStatBonuses(): ExternalStatBonuses {
        const equipBonuses = calculateEquipBonuses(this.equipped);
        const buffBonuses = getBuffBonuses(this.activeBuffs);
        return {
            hp: equipBonuses.hp,
            atk: equipBonuses.atk + buffBonuses.atk,
            def: equipBonuses.def + buffBonuses.def,
            attackSpeedPct: equipBonuses.attackSpeed + buffBonuses.attackSpeed,
            critRate: equipBonuses.critRate + buffBonuses.critRate,
            critDamage: equipBonuses.critDamage,
            moveSpeed: equipBonuses.moveSpeed,
        };
    }

    private getCurrentStats() {
        return getEffectiveStats(this.character, this.getCurrentStatBonuses());
    }

    private getCompareTarget(equipment: Equipment): Equipment | null {
        if (equipment.slot === 'ring') {
            const ring1 = getEquipped(this.equipped, 'ring1');
            const ring2 = getEquipped(this.equipped, 'ring2');
            if (!ring1) return ring2;
            if (!ring2) return ring1;
            return ring1.level <= ring2.level ? ring1 : ring2;
        }
        return getEquipped(this.equipped, equipment.slot as EquipSlot);
    }

    private equipmentTotalStats(equipment: Equipment): Record<'atk' | 'def' | 'hp' | 'attackSpeed' | 'critRate' | 'critDamage' | 'moveSpeed', number> {
        const result = {
            atk: equipment.baseStats.atk ?? 0,
            def: equipment.baseStats.def ?? 0,
            hp: equipment.baseStats.hp ?? 0,
            attackSpeed: equipment.baseStats.attackSpeed ?? 0,
            critRate: equipment.baseStats.critRate ?? 0,
            critDamage: equipment.baseStats.critDamage ?? 0,
            moveSpeed: equipment.baseStats.moveSpeed ?? 0,
        };

        for (const affix of equipment.affixes) {
            switch (affix.id) {
                case 'strength':
                case 'berserk':
                    result.atk += affix.value;
                    break;
                case 'toughness':
                    result.def += affix.value;
                    break;
                case 'vitality':
                    result.hp += affix.value;
                    break;
                case 'attackSpeed':
                    result.attackSpeed += affix.value;
                    break;
                case 'crit':
                    result.critRate += affix.value;
                    break;
                case 'critDamage':
                    result.critDamage += affix.value;
                    break;
            }
        }

        return result;
    }

    private onInventoryItemClick(equipment: Equipment) {
        // 穿戴装备
        if (equipment.slot === 'ring') {
            const ringSlot = findAvailableRingSlot(this.equipped);
            if (!ringSlot) {
                const prev = equipItem(this.equipped, 'ring1', equipment);
                if (prev) addItem(this.inventory, prev);
            } else {
                equipItem(this.equipped, ringSlot, equipment);
            }
        } else {
            const slot = equipment.slot as EquipSlot;
            const prev = equipItem(this.equipped, slot, equipment);
            if (prev) addItem(this.inventory, prev);
        }

        // 从背包移除
        removeItem(this.inventory, this.inventory.items.find(i => i.item.id === equipment.id)?.slotIndex ?? -1);

        this.affixEffects = collectAffixEffects(this.equipped);
        this.log(`装备了 ${equipment.name}`);
        this.openInventoryPanel(); // 刷新面板
    }

    private onEquippedItemClick(slot: EquipSlot) {
        const eq = getEquipped(this.equipped, slot);
        if (!eq) return;

        if (isFull(this.inventory)) {
            this.log('背包已满，无法卸下装备');
            return;
        }

        unequipItem(this.equipped, slot);
        addItem(this.inventory, eq);
        this.affixEffects = collectAffixEffects(this.equipped);
        this.log(`卸下了 ${eq.name}`);
        this.openInventoryPanel();
    }

    // ─── 装备面板 ───

    private openEquipPanel() {
        this.closeUI();
        this.isUIOpen = true;

        const elements: Phaser.GameObjects.GameObject[] = [];

        const bg = this.add.rectangle(0, 0, DUNGEON_WIDTH, DUNGEON_HEIGHT + HUD_HEIGHT, 0x000000, 0.7).setOrigin(0).setDepth(200).setInteractive();
        elements.push(bg);

        const panelBg = this.add.rectangle(250, 80, 524, 580, 0x1a1a2e).setOrigin(0).setDepth(201).setStrokeStyle(2, 0x4a4a6a);
        elements.push(panelBg);

        const title = this.add.text(512, 100, '装备栏', { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5).setDepth(202);
        elements.push(title);

        const closeBtn = this.add.text(740, 90, '[X]', { fontSize: '18px', color: '#e74c3c' }).setDepth(202).setInteractive();
        closeBtn.on('pointerdown', () => this.closeUI());
        elements.push(closeBtn);

        // 人物轮廓 + 槽位布局
        const layout: { slot: EquipSlot; label: string; x: number; y: number }[] = [
            { slot: 'helmet', label: '头盔', x: 380, y: 150 },
            { slot: 'necklace', label: '项链', x: 530, y: 150 },
            { slot: 'armor', label: '护甲', x: 380, y: 220 },
            { slot: 'weapon', label: '武器', x: 530, y: 220 },
            { slot: 'gloves', label: '手套', x: 380, y: 290 },
            { slot: 'ring1', label: '戒指1', x: 530, y: 290 },
            { slot: 'ring2', label: '戒指2', x: 620, y: 290 },
            { slot: 'belt', label: '腰带', x: 380, y: 360 },
            { slot: 'legs', label: '护腿', x: 380, y: 430 },
            { slot: 'boots', label: '靴子', x: 380, y: 500 },
        ];

        for (const item of layout) {
            const eq = getEquipped(this.equipped, item.slot);
            const box = this.add.rectangle(item.x, item.y, 120, 50, eq ? 0x2a3a2a : 0x2a2a3e).setDepth(202).setStrokeStyle(1, eq ? 0x4a8a4a : 0x4a4a6a).setInteractive();
            elements.push(box);

            const label = this.add.text(item.x, item.y - 10, item.label, { fontSize: '10px', color: '#95a5a6' }).setOrigin(0.5).setDepth(203);
            elements.push(label);

            if (eq) {
                const nameLabel = this.add.text(item.x, item.y + 10, eq.name, { fontSize: '10px', color: RARITY_CONFIG[eq.rarity].color }).setOrigin(0.5).setDepth(203);
                elements.push(nameLabel);

                box.on('pointerdown', () => this.onEquippedItemClick(item.slot));
                box.on('pointerover', () => this.showTooltip(eq, item.x + 70, item.y - 30));
                box.on('pointerout', () => this.hideTooltip());
            }
        }

        // 属性总览
        const bonuses = calculateEquipBonuses(this.equipped);
        const statsY = 560;
        const statsText = this.add.text(280, statsY, `装备加成: ATK+${bonuses.atk} DEF+${bonuses.def} HP+${bonuses.hp} CR+${bonuses.critRate}% CD+${bonuses.critDamage}%`, {
            fontSize: '11px', color: '#2ecc71',
        }).setDepth(202);
        elements.push(statsText);

        const panelRect: PanelRect = { x: 250, y: 80, width: 524, height: 580 };
        this.createManagedPanel(elements, panelRect, panelBg);

    }

    // ─── 属性面板 ───

    private openStatsPanel() {
        this.closeUI();
        this.isUIOpen = true;

        const elements: Phaser.GameObjects.GameObject[] = [];

        const bg = this.add.rectangle(0, 0, DUNGEON_WIDTH, DUNGEON_HEIGHT + HUD_HEIGHT, 0x000000, 0.7).setOrigin(0).setDepth(200).setInteractive();
        elements.push(bg);

        const panelBg = this.add.rectangle(300, 80, 424, 580, 0x1a1a2e).setOrigin(0).setDepth(201).setStrokeStyle(2, 0x4a4a6a);
        elements.push(panelBg);

        const title = this.add.text(512, 100, `角色属性  Lv.${this.character.level}`, { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5).setDepth(202);
        elements.push(title);

        const closeBtn = this.add.text(690, 90, '[X]', { fontSize: '18px', color: '#e74c3c' }).setDepth(202).setInteractive();
        closeBtn.on('pointerdown', () => this.closeUI());
        elements.push(closeBtn);

        const stats = this.getCurrentStats();
        const bonuses = calculateEquipBonuses(this.equipped);

        const statLines = [
            { label: 'HP', value: `${this.character.baseStats.hp}/${stats.maxHp}`, bonus: bonuses.hp, unit: '' },
            { label: 'ATK', value: `${stats.atk}`, bonus: bonuses.atk, unit: '' },
            { label: 'DEF', value: `${stats.def}`, bonus: bonuses.def, unit: '' },
            { label: '攻速', value: `${stats.attackSpeed.toFixed(2)}`, bonus: bonuses.attackSpeed, unit: '%' },
            { label: '暴击率', value: `${stats.critRate.toFixed(1)}%`, bonus: bonuses.critRate, unit: '%' },
            { label: '暴击伤害', value: `${stats.critDamage.toFixed(0)}%`, bonus: bonuses.critDamage, unit: '%' },
            { label: '移速', value: `${stats.moveSpeed}`, bonus: bonuses.moveSpeed, unit: '' },
        ];

        let sy = 140;
        for (const s of statLines) {
            const label = this.add.text(330, sy, s.label, { fontSize: '14px', color: '#bdc3c7' }).setDepth(202);
            const value = this.add.text(440, sy, s.value, { fontSize: '14px', color: '#ffffff' }).setDepth(202);
            const bonusText = s.bonus > 0 ? `(+${s.bonus}${s.unit})` : '';
            const bonus = this.add.text(570, sy, bonusText, { fontSize: '12px', color: '#2ecc71' }).setDepth(202);
            elements.push(label, value, bonus);
            sy += 28;
        }

        // 词条效果
        sy += 20;
        const effectTitle = this.add.text(330, sy, '词条效果:', { fontSize: '14px', color: '#f39c12' }).setDepth(202);
        elements.push(effectTitle);
        sy += 25;

        const effectLines = [
            { label: '穿透', value: this.affixEffects.penetration, unit: '%' },
            { label: '吸血', value: this.affixEffects.lifeSteal, unit: '%' },
            { label: 'HP回复', value: this.affixEffects.hpRegen, unit: '/s' },
            { label: '伤害减免', value: this.affixEffects.damageReduction, unit: '%' },
            { label: '闪避', value: this.affixEffects.evasion, unit: '%' },
            { label: '连击率', value: this.affixEffects.comboChance, unit: '%' },
            { label: '旋风斩率', value: this.affixEffects.whirlwindChance, unit: '%' },
            { label: '复活甲率', value: this.affixEffects.rebirthChance, unit: '%' },
            { label: '掠夺者率', value: this.affixEffects.predatorChance, unit: '%' },
        ];

        for (const e of effectLines) {
            if (e.value <= 0) continue;
            const text = this.add.text(340, sy, `${e.label}: ${e.value}${e.unit}`, { fontSize: '12px', color: '#e6cc80' }).setDepth(202);
            elements.push(text);
            sy += 20;
        }

        // 属性点分配
        if (this.character.statPoints > 0) {
            sy += 20;
            const ptsTitle = this.add.text(330, sy, `可分配属性点: ${this.character.statPoints}`, { fontSize: '14px', color: '#9b59b6' }).setDepth(202);
            elements.push(ptsTitle);
            sy += 30;

            const allocStats: { key: keyof import('../models').AllocatedStats; label: string }[] = [
                { key: 'hp', label: 'HP+10' },
                { key: 'atk', label: 'ATK+3' },
                { key: 'def', label: 'DEF+2' },
                { key: 'critRate', label: 'CR+0.5%' },
                { key: 'critDamage', label: 'CD+3%' },
            ];

            for (const s of allocStats) {
                const btn = this.add.text(340, sy, `[+${s.label}]`, { fontSize: '13px', color: '#3498db' }).setDepth(202).setInteractive();
                btn.on('pointerdown', () => {
                    allocateStatPoint(this.character, s.key);
                    this.affixEffects = collectAffixEffects(this.equipped);
                    this.openStatsPanel(); // 刷新
                });
                elements.push(btn);
                sy += 24;
            }
        }

        const panelRect: PanelRect = { x: 300, y: 80, width: 424, height: 580 };
        this.createManagedPanel(elements, panelRect, panelBg);

    }

    // ─── Tooltip ───

    private showTooltip(equipment: Equipment, x: number, y: number, compareWith: Equipment | null = null) {
        this.hideTooltip();

        const elements: Phaser.GameObjects.GameObject[] = [];
        const width = 220;
        let lineCount = 4 + equipment.affixes.length;
        if (compareWith) {
            lineCount += 8;
        }
        const height = 40 + lineCount * 16;

        const bg = this.add.rectangle(x, y, width, height, 0x111122, 0.95).setOrigin(0).setDepth(DEPTH.UI_TOOLTIP).setStrokeStyle(1, parseInt(RARITY_CONFIG[equipment.rarity].color.replace('#', ''), 16));
        elements.push(bg);

        const nameText = this.add.text(x + 10, y + 8, equipment.name, { fontSize: '14px', color: RARITY_CONFIG[equipment.rarity].color, fontStyle: 'bold' }).setDepth(DEPTH.UI_TOOLTIP + 1);
        elements.push(nameText);

        const slotText = this.add.text(x + 10, y + 28, `${this.slotLabel(equipment.slot)} Lv.${equipment.level}`, { fontSize: '11px', color: '#95a5a6' }).setDepth(DEPTH.UI_TOOLTIP + 1);
        elements.push(slotText);

        let ty = y + 48;

        // 基础属性
        const statEntries: [string, number | undefined][] = [
            ['ATK', equipment.baseStats.atk],
            ['DEF', equipment.baseStats.def],
            ['HP', equipment.baseStats.hp],
            ['AS', equipment.baseStats.attackSpeed],
            ['CR', equipment.baseStats.critRate],
            ['CD', equipment.baseStats.critDamage],
            ['MS', equipment.baseStats.moveSpeed],
        ];

        for (const [label, val] of statEntries) {
            if (val !== undefined && val > 0) {
                const text = this.add.text(x + 10, ty, `${label}: +${val}`, { fontSize: '11px', color: '#ffffff' }).setDepth(DEPTH.UI_TOOLTIP + 1);
                elements.push(text);
                ty += 16;
            }
        }

        // 词条
        if (equipment.affixes.length > 0) {
            ty += 4;
            const sep = this.add.text(x + 10, ty, '───────', { fontSize: '10px', color: '#555555' }).setDepth(DEPTH.UI_TOOLTIP + 1);
            elements.push(sep);
            ty += 14;

            for (const affix of equipment.affixes) {
                const color = affix.category === 'special' ? '#e6cc80' : affix.category === 'offensive' ? '#ff7777' : '#77ff77';
                const text = this.add.text(x + 10, ty, `• ${affix.name}: +${affix.value}`, { fontSize: '11px', color }).setDepth(DEPTH.UI_TOOLTIP + 1);
                elements.push(text);
                ty += 16;
            }
        }

        if (compareWith) {
            ty += 4;
            const sep = this.add.text(x + 10, ty, '──── 对比当前装备 ────', { fontSize: '10px', color: '#555555' }).setDepth(DEPTH.UI_TOOLTIP + 1);
            elements.push(sep);
            ty += 16;

            const targetStats = this.equipmentTotalStats(compareWith);
            const candidateStats = this.equipmentTotalStats(equipment);
            const compareLines: { label: string; delta: number; unit?: string }[] = [
                { label: 'ATK', delta: candidateStats.atk - targetStats.atk },
                { label: 'DEF', delta: candidateStats.def - targetStats.def },
                { label: 'HP', delta: candidateStats.hp - targetStats.hp },
                { label: 'AS', delta: candidateStats.attackSpeed - targetStats.attackSpeed, unit: '%' },
                { label: 'CR', delta: candidateStats.critRate - targetStats.critRate, unit: '%' },
                { label: 'CD', delta: candidateStats.critDamage - targetStats.critDamage, unit: '%' },
                { label: 'MS', delta: candidateStats.moveSpeed - targetStats.moveSpeed },
            ];

            for (const line of compareLines) {
                if (line.delta === 0) continue;
                const color = line.delta > 0 ? '#2ecc71' : '#e74c3c';
                const sign = line.delta > 0 ? '+' : '';
                const text = this.add.text(x + 10, ty, `${line.label}: ${sign}${line.delta}${line.unit ?? ''}`, {
                    fontSize: '11px',
                    color,
                }).setDepth(DEPTH.UI_TOOLTIP + 1);
                elements.push(text);
                ty += 14;
            }
        }

        this.tooltipContainer = this.add.container(0, 0, elements).setDepth(DEPTH.UI_TOOLTIP);
    }

    private hideTooltip() {
        if (this.tooltipContainer) {
            this.tooltipContainer.destroy(true);
            this.tooltipContainer = null;
        }
    }

    private slotLabel(slot: string): string {
        const map: Record<string, string> = { helmet: '头盔', armor: '护甲', gloves: '手套', belt: '腰带', legs: '护腿', boots: '靴子', weapon: '武器', necklace: '项链', ring: '戒指' };
        return map[slot] ?? slot;
    }

    // ─── 存档系统 ───

    private manualSave() {
        const data = this.getCurrentSaveData();
        if (saveGame(data)) {
            this.log('存档成功！');
        } else {
            this.log('存档失败');
        }
    }

    private confirmReset() {
        this.closeUI();
        this.isUIOpen = true;

        const elements: Phaser.GameObjects.GameObject[] = [];

        const bg = this.add.rectangle(0, 0, DUNGEON_WIDTH, DUNGEON_HEIGHT + HUD_HEIGHT, 0x000000, 0.8).setOrigin(0).setDepth(200).setInteractive();
        elements.push(bg);

        const panelBg = this.add.rectangle(350, 250, 324, 200, 0x1a1a2e).setOrigin(0).setDepth(201).setStrokeStyle(2, 0xe74c3c);
        elements.push(panelBg);

        const title = this.add.text(512, 280, '确认重置存档？', { fontSize: '20px', color: '#e74c3c' }).setOrigin(0.5).setDepth(202);
        elements.push(title);

        const desc = this.add.text(512, 320, '所有进度将被永久删除！', { fontSize: '14px', color: '#bdc3c7' }).setOrigin(0.5).setDepth(202);
        elements.push(desc);

        const confirmBtn = this.add.text(420, 380, '[确认重置]', { fontSize: '16px', color: '#e74c3c' }).setDepth(202).setInteractive();
        confirmBtn.on('pointerdown', () => {
            this.closeUI();
            this.resetGame();
        });
        elements.push(confirmBtn);

        const cancelBtn = this.add.text(570, 380, '[取消]', { fontSize: '16px', color: '#3498db' }).setDepth(202).setInteractive();
        cancelBtn.on('pointerdown', () => this.closeUI());
        elements.push(cancelBtn);

        const panelRect: PanelRect = { x: 350, y: 250, width: 324, height: 200 };
        this.createManagedPanel(elements, panelRect, panelBg);

    }

    private resetGame() {
        if (this.autoSaveManager) this.autoSaveManager.stop();

        this.character = createCharacter('冒险者');
        this.inventory = createInventory();
        this.equipped = createEquippedItems();
        this.dungeon = createDungeonState();
        this.affixEffects = collectAffixEffects(this.equipped);
        this.consumables = [];
        this.activeBuffs = [];
        this.resetDungeonRunSummary();

        this.renderDungeon();
        this.monsterSprites.forEach(s => s.destroy());
        this.monsterSprites.clear();
        this.lootItems.forEach(l => l.sprite.destroy());
        this.lootItems = [];
        this.currentMonster = null;
        this.spawnMonstersForFloor();
        this.playerSprite.setPosition(DUNGEON_WIDTH / 2, DUNGEON_HEIGHT / 2);

        if (this.gameplayPhase === 'town') {
            this.setWorldVisibility(false);
            this.renderTownOverlay();
        } else {
            this.hideTownOverlay();
            this.setWorldVisibility(true);
        }

        this.autoSaveManager = new AutoSaveManager(() => this.getCurrentSaveData());
        this.autoSaveManager.start();

        this.log('存档已重置');
    }

    private showOfflineRewards(rewards: import('../systems/save-system').OfflineRewards) {
        this.closeUI();
        this.isUIOpen = true;

        const elements: Phaser.GameObjects.GameObject[] = [];

        const bg = this.add.rectangle(0, 0, DUNGEON_WIDTH, DUNGEON_HEIGHT + HUD_HEIGHT, 0x000000, 0.8).setOrigin(0).setDepth(200).setInteractive();
        elements.push(bg);

        const panelBg = this.add.rectangle(300, 150, 424, 300, 0x1a1a2e).setOrigin(0).setDepth(201).setStrokeStyle(2, 0xf1c40f);
        elements.push(panelBg);

        const title = this.add.text(512, 180, '离线收益', { fontSize: '24px', color: '#f1c40f', fontStyle: 'bold' }).setOrigin(0.5).setDepth(202);
        elements.push(title);

        const hours = this.add.text(512, 230, `离线时长: ${rewards.offlineHours.toFixed(1)} 小时`, { fontSize: '16px', color: '#bdc3c7' }).setOrigin(0.5).setDepth(202);
        elements.push(hours);

        const expText = this.add.text(512, 270, `经验 +${rewards.exp}`, { fontSize: '16px', color: '#2ecc71' }).setOrigin(0.5).setDepth(202);
        elements.push(expText);

        const goldText = this.add.text(512, 310, `金币 +${rewards.gold}`, { fontSize: '16px', color: '#f1c40f' }).setOrigin(0.5).setDepth(202);
        elements.push(goldText);

        const closeBtn = this.add.text(512, 380, '[领取]', { fontSize: '18px', color: '#3498db' }).setOrigin(0.5).setDepth(202).setInteractive();
        closeBtn.on('pointerdown', () => this.closeUI());
        elements.push(closeBtn);

        const panelRect: PanelRect = { x: 300, y: 150, width: 424, height: 300 };
        this.createManagedPanel(elements, panelRect, panelBg);

    }

    // ─── 消耗品系统 ───

    private rollPotionDrop(monster: Monster) {
        const dropChance = monster.type === 'boss' ? 100 : monster.type === 'rare' ? 40 : monster.type === 'elite' ? 25 : 15;
        if (Math.random() * 100 >= dropChance) return;

        // 根据怪物类型和层数决定药水品质
        const floor = this.dungeon.currentFloor;
        const potionTypes: { type: import('../models/consumable').ConsumableType; weight: number }[] = [];

        if (floor <= 5) {
            potionTypes.push({ type: 'healPotionS', weight: 80 });
            potionTypes.push({ type: 'healPotionM', weight: 20 });
        } else if (floor <= 10) {
            potionTypes.push({ type: 'healPotionS', weight: 30 });
            potionTypes.push({ type: 'healPotionM', weight: 50 });
            potionTypes.push({ type: 'healPotionL', weight: 20 });
        } else if (floor <= 15) {
            potionTypes.push({ type: 'healPotionM', weight: 30 });
            potionTypes.push({ type: 'healPotionL', weight: 50 });
            potionTypes.push({ type: 'healPotionFull', weight: 20 });
        } else {
            potionTypes.push({ type: 'healPotionL', weight: 40 });
            potionTypes.push({ type: 'healPotionFull', weight: 60 });
        }

        // 偶尔掉落卷轴
        if (Math.random() < 0.15) {
            potionTypes.push({ type: 'scrollAtk', weight: 50 });
            potionTypes.push({ type: 'scrollDef', weight: 50 });
        }

        // 按权重随机
        const totalWeight = potionTypes.reduce((s, p) => s + p.weight, 0);
        let roll = Math.random() * totalWeight;
        let selectedType = potionTypes[0].type;
        for (const p of potionTypes) {
            roll -= p.weight;
            if (roll <= 0) { selectedType = p.type; break; }
        }

        // 添加到消耗品列表（堆叠）
        const existing = this.consumables.find(c => c.type === selectedType);
        const def = CONSUMABLE_DEFS[selectedType];
        if (existing && existing.count < def.maxStack) {
            existing.count++;
        } else if (!existing) {
            this.consumables.push(createConsumable(selectedType));
        }
        this.dungeonRunSummary.gainedConsumables.set(def.name, (this.dungeonRunSummary.gainedConsumables.get(def.name) ?? 0) + 1);

        this.log(`获得 ${def.name}`);
    }

    private openConsumablePanel() {
        this.closeUI();
        this.isUIOpen = true;

        const elements: Phaser.GameObjects.GameObject[] = [];

        const bg = this.add.rectangle(0, 0, DUNGEON_WIDTH, DUNGEON_HEIGHT + HUD_HEIGHT, 0x000000, 0.7).setOrigin(0).setDepth(200).setInteractive();
        elements.push(bg);

        const panelBg = this.add.rectangle(250, 80, 524, 580, 0x1a1a2e).setOrigin(0).setDepth(201).setStrokeStyle(2, 0x4a4a6a);
        elements.push(panelBg);

        const title = this.add.text(512, 100, '消耗品', { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5).setDepth(202);
        elements.push(title);

        const closeBtn = this.add.text(740, 90, '[X]', { fontSize: '18px', color: '#e74c3c' }).setDepth(202).setInteractive();
        closeBtn.on('pointerdown', () => this.closeUI());
        elements.push(closeBtn);

        // 消耗品列表
        let cy = 140;
        if (this.consumables.length === 0) {
            const empty = this.add.text(512, cy, '暂无消耗品', { fontSize: '14px', color: '#95a5a6' }).setOrigin(0.5).setDepth(202);
            elements.push(empty);
        }

        for (const cons of this.consumables) {
            if (cons.count <= 0) continue;
            const def = CONSUMABLE_DEFS[cons.type];

            const rowBg = this.add.rectangle(280, cy, 464, 40, 0x2a2a3e).setOrigin(0).setDepth(202).setStrokeStyle(1, 0x4a4a6a);
            elements.push(rowBg);

            const categoryColors: Record<string, number> = { potion: 0x2ecc71, scroll: 0x3498db, elixir: 0x9b59b6 };
            const dot = this.add.rectangle(295, cy + 10, 8, 8, categoryColors[def.category] ?? 0xffffff).setDepth(203);
            elements.push(dot);

            const nameText = this.add.text(310, cy + 5, `${def.name} x${cons.count}`, { fontSize: '13px', color: '#ffffff' }).setDepth(203);
            elements.push(nameText);

            const descText = this.add.text(310, cy + 22, def.description, { fontSize: '10px', color: '#95a5a6' }).setDepth(203);
            elements.push(descText);

            const useBtn = this.add.text(700, cy + 10, '[使用]', { fontSize: '12px', color: '#3498db' }).setDepth(203).setInteractive();
            useBtn.on('pointerdown', () => {
                const result = useConsumable(cons, this.character, this.activeBuffs, Date.now(), this.getCurrentStatBonuses());
                if (result.success) {
                    this.log(result.message);
                    this.consumables = this.consumables.filter(c => c.count > 0);
                } else {
                    this.log(result.message);
                }
                this.openConsumablePanel(); // 刷新
            });
            elements.push(useBtn);

            cy += 48;
        }

        // 活跃增益
        cy += 20;
        if (this.activeBuffs.length > 0) {
            const buffTitle = this.add.text(280, cy, '活跃增益:', { fontSize: '14px', color: '#f39c12' }).setDepth(202);
            elements.push(buffTitle);
            cy += 25;

            for (const buff of this.activeBuffs) {
                const remain = Math.max(0, Math.ceil((buff.endTime - Date.now()) / 1000));
                const text = this.add.text(290, cy, `${buff.name} - ${buff.stat}+${buff.value}% (${remain}s)`, { fontSize: '12px', color: '#e6cc80' }).setDepth(202);
                elements.push(text);
                cy += 22;
            }
        }

        const panelRect: PanelRect = { x: 250, y: 80, width: 524, height: 580 };
        this.createManagedPanel(elements, panelRect, panelBg);

    }

    // ─── 商店面板 ───

    private openShopPanel() {
        if (this.gameplayPhase !== 'town') {
            this.log('请先回到主城，再进行装备出售/分解');
            return;
        }

        this.closeUI();
        this.isUIOpen = true;

        const elements: Phaser.GameObjects.GameObject[] = [];

        const bg = this.add.rectangle(0, 0, DUNGEON_WIDTH, DUNGEON_HEIGHT + HUD_HEIGHT, 0x000000, 0.7).setOrigin(0).setDepth(200).setInteractive();
        elements.push(bg);

        const panelBg = this.add.rectangle(200, 40, 624, 680, 0x1a1a2e).setOrigin(0).setDepth(201).setStrokeStyle(2, 0xf1c40f);
        elements.push(panelBg);

        const title = this.add.text(512, 60, '商店', { fontSize: '20px', color: '#f1c40f' }).setOrigin(0.5).setDepth(202);
        elements.push(title);

        const goldInfo = this.add.text(512, 85, `金币: ${this.character.gold}`, { fontSize: '14px', color: '#f1c40f' }).setOrigin(0.5).setDepth(202);
        elements.push(goldInfo);

        const closeBtn = this.add.text(790, 50, '[X]', { fontSize: '18px', color: '#e74c3c' }).setDepth(202).setInteractive();
        closeBtn.on('pointerdown', () => this.closeUI());
        elements.push(closeBtn);

        // 消耗品购买
        const shopTitle = this.add.text(230, 115, '消耗品:', { fontSize: '15px', color: '#f39c12' }).setDepth(202);
        elements.push(shopTitle);

        let cy = 145;
        const shopItems = getShopConsumables();

        for (const type of shopItems) {
            const def = CONSUMABLE_DEFS[type];
            const canBuy = this.character.gold >= def.buyPrice && canBuyMore(this.consumables, type);
            const existing = this.consumables.find(c => c.type === type);

            const rowBg = this.add.rectangle(230, cy, 564, 45, 0x2a2a3e).setOrigin(0).setDepth(202).setStrokeStyle(1, 0x4a4a6a);
            elements.push(rowBg);

            const categoryColors: Record<string, number> = { potion: 0x2ecc71, scroll: 0x3498db, elixir: 0x9b59b6 };
            const dot = this.add.rectangle(245, cy + 12, 8, 8, categoryColors[def.category] ?? 0xffffff).setDepth(203);
            elements.push(dot);

            const nameText = this.add.text(260, cy + 5, def.name, { fontSize: '13px', color: '#ffffff' }).setDepth(203);
            elements.push(nameText);

            const descText = this.add.text(260, cy + 24, def.description, { fontSize: '10px', color: '#95a5a6' }).setDepth(203);
            elements.push(descText);

            const countStr = existing ? `(${existing.count}/${def.maxStack})` : '(0)';
            const countText = this.add.text(570, cy + 5, countStr, { fontSize: '11px', color: '#95a5a6' }).setDepth(203);
            elements.push(countText);

            const priceText = this.add.text(630, cy + 5, `${def.buyPrice}G`, { fontSize: '11px', color: '#f1c40f' }).setDepth(203);
            elements.push(priceText);

            const buyBtn = this.add.text(690, cy + 10, '[购买]', { fontSize: '12px', color: canBuy ? '#3498db' : '#555555' }).setDepth(203).setInteractive();
            if (canBuy) {
                buyBtn.on('pointerdown', () => {
                    const result = buyConsumable(this.character, this.consumables, type);
                    this.log(result.message);
                    this.openShopPanel(); // 刷新
                });
            }
            elements.push(buyBtn);

            cy += 52;
        }

        // 装备出售区
        cy += 20;
        const sellTitle = this.add.text(230, cy, '快捷出售:', { fontSize: '15px', color: '#e74c3c' }).setDepth(202);
        elements.push(sellTitle);
        cy += 30;

        const sellBtns: { label: string; rarity: Rarity; color: string }[] = [
            { label: '出售普通', rarity: 'common', color: '#9d9d9d' },
            { label: '出售普通+魔法', rarity: 'magic', color: '#0070dd' },
            { label: '出售≤稀有', rarity: 'rare', color: '#ff8000' },
        ];

        for (const sb of sellBtns) {
            const btn = this.add.text(240, cy, `[${sb.label}]`, { fontSize: '13px', color: sb.color }).setDepth(202).setInteractive();
            btn.on('pointerdown', () => {
                const gold = sellByRarity(this.inventory, sb.rarity, sellPrice);
                this.character.gold += gold;
                if (gold > 0) {
                    this.log(`出售装备获得 ${gold} 金币`);
                } else {
                    this.log('没有可出售的装备');
                }
                this.openShopPanel();
            });
            elements.push(btn);
            cy += 28;
        }

        const panelRect: PanelRect = { x: 200, y: 40, width: 624, height: 680 };
        this.createManagedPanel(elements, panelRect, panelBg);

    }
}
