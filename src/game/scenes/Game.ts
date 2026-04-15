import { Math as PhaserMath, Scene } from 'phaser';
import {
    type CharacterData,
    type CharacterBaseClass,
    type Monster,
    type DungeonState,
    type Equipment,
    type ExploreState,
    type EquipSlot,
    type WearableSlot,
    type Rarity,
    type CombatStyle,
    type MovementStrategy,
    getZoneForFloor,
    RARITY_CONFIG,
    BASE_CLASS_CONFIG,
    ADVANCEMENT_REQUIREMENT_LEVEL,
    getSpecializationDef,
    getCombatStyleProfile,
    getAllowedClassesForEquipment,
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
    canAdvanceSpecialization,
    chooseSpecialization,
    getSpecializationBonuses,
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
    canEquipItem,
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
import { addBoundedText } from '../ui/text-layout';

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
    playerMovementStrategy: MovementStrategy = 'approach';
    gameplayPhase: GameplayPhase = 'town';
    townOverlay: Phaser.GameObjects.Container | null = null;
    autoEnterNextFloor = false;
    floorClearCountdownTimer: Phaser.Time.TimerEvent | null = null;
    lastAutoSavedCompletedFloor = 0;

    // 地牢装饰
    floorTiles: Phaser.GameObjects.Rectangle[] = [];

    // 自动保存
    autoSaveManager!: AutoSaveManager;

    private panelDragContext: PanelDragContext | null = null;
    private dungeonRunSummary: DungeonRunSummary = this.createDungeonRunSummary();

    constructor() {
        super('Game');
    }

    create(data?: { newGame?: boolean; baseClass?: CharacterBaseClass }) {
        const forceNewGame = data?.newGame ?? false;
        // 尝试加载存档
        const saved = forceNewGame ? null : loadGame();
        if (saved) {
            this.character = saved.character;
            this.inventory = saved.inventory;
            normalizeInventoryData(this.inventory);
            this.equipped = saved.equipped;
            this.normalizeEquippedClassRestrictions();
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
            this.character = createCharacter('冒险者', data?.baseClass ?? 'berserker');
            this.inventory = createInventory();
            this.equipped = createEquippedItems();
            this.dungeon = createDungeonState();
            this.affixEffects = collectAffixEffects(this.equipped);
        }

        this.playerMovementStrategy = getCombatStyleProfile(this.character.combatStyle).defaultMovementStrategy;
        this.lastAutoSavedCompletedFloor = canProceedToNextFloor(this.dungeon) ? this.dungeon.currentFloor : 0;

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
            version: 3,
            timestamp: Date.now(),
            character: this.character,
            inventory: this.inventory,
            equipped: this.equipped,
            dungeon: this.dungeon,
            consumables: this.consumables,
            totalPlayTime: 0,
        };
    }

    private normalizeEquippedClassRestrictions() {
        Object.entries(this.equipped).forEach(([slot, equipment]) => {
            if (!equipment || canEquipItem(this.character.baseClass, equipment)) {
                return;
            }

            if (addItem(this.inventory, equipment)) {
                delete this.equipped[slot as EquipSlot];
            }
        });
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
                this.updateFighting(time, dt);
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
        const classColor = parseInt(BASE_CLASS_CONFIG[this.character.baseClass].color.replace('#', ''), 16);
        const body = this.add.rectangle(0, 0, PLAYER_SIZE, PLAYER_SIZE, classColor);
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
        this.syncMonsterVisualState(monster);
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
        this.updateMonsterAwareness();

        if (this.character.baseStats.hp / stats.maxHp < REST_THRESHOLD) {
            setExploreState(this.dungeon, 'resting');
            return;
        }

        const nearest = this.findNearestMonster(true);
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
            this.autoSaveCompletedFloor();
            this.enterTown();
            this.showFloorClearPanel();
            return;
        }

        this.movePlayerTowardMonster(dt);
    }

    private updateFighting(time: number, dt: number) {
        this.updateMonsterAwareness();
        this.currentMonster = this.pickCombatTarget();
        if (!this.currentMonster) {
            setExploreState(this.dungeon, 'exploring');
            return;
        }

        const stats = this.getCurrentStats();
        this.updateAlertedCombatMovement(dt, stats.moveSpeed);
        const playerCombatProfile = getCombatStyleProfile(this.character.combatStyle);
        const monsterCombatProfile = getCombatStyleProfile(this.currentMonster.combatStyle);

        const distanceToTarget = PhaserMath.Distance.Between(
            this.playerSprite.x,
            this.playerSprite.y,
            this.currentMonster.x,
            this.currentMonster.y,
        );
        if (distanceToTarget > playerCombatProfile.attackRange) {
            return;
        }

        const attackInterval = 1000 / Math.max(0.1, stats.attackSpeed);
        if (time - this.lastAttackTime < attackInterval) return;
        this.lastAttackTime = time;

        const result = playerAttackMonster(
            this.character,
            this.currentMonster,
            this.affixEffects,
            stats,
            distanceToTarget <= monsterCombatProfile.attackRange,
        );

        if (result.damageDealt > 0) {
            const suffixParts: string[] = [];
            if (result.isCombo) suffixParts.push('连击!');
            if (result.specializationProc) suffixParts.push(result.specializationProc);
            const suffix = suffixParts.length > 0 ? ` ${suffixParts.join(' ')}` : '';
            this.showDamageNumber(this.currentMonster.x, this.currentMonster.y - 30, result.damageDealt, result.isCrit, suffix);
        }

        if (result.lifeStealHeal > 0) {
            this.showHealNumber(this.playerSprite.x, this.playerSprite.y - 30, result.lifeStealHeal);
        }

        if (result.specializationHeal > 0) {
            this.showHealNumber(this.playerSprite.x + 18, this.playerSprite.y - 46, result.specializationHeal);
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

    private findNearestMonster(alertedOnly = false): Phaser.GameObjects.Container | null {
        let nearest: Phaser.GameObjects.Container | null = null;
        let minDist = Infinity;

        const px = this.playerSprite.x;
        const py = this.playerSprite.y;

        this.monsterSprites.forEach((container) => {
            const monster = container.getData('monster') as Monster;
            if (alertedOnly && monster.alertState !== 'alerted') {
                return;
            }
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
        const nearest = this.findNearestMonster();
        const playerCombatProfile = getCombatStyleProfile(this.character.combatStyle);

        if (nearest) {
            const next = this.computeStrategyPosition(
                this.playerSprite.x,
                this.playerSprite.y,
                nearest.x,
                nearest.y,
                speed,
                this.playerMovementStrategy,
                playerCombatProfile.approachDistance,
                playerCombatProfile.retreatDistance,
            );
            this.playerSprite.setPosition(next.x, next.y);
            return;
        }

        let angle = this.playerSprite.getData('moveAngle') ?? Math.random() * Math.PI * 2;
        if (Math.random() < 0.02) {
            angle = Math.random() * Math.PI * 2;
            this.playerSprite.setData('moveAngle', angle);
        }

        const nx = PhaserMath.Clamp(this.playerSprite.x + Math.cos(angle) * speed, 30, DUNGEON_WIDTH - 30);
        const ny = PhaserMath.Clamp(this.playerSprite.y + Math.sin(angle) * speed, 30, DUNGEON_HEIGHT - 30);
        this.playerSprite.setPosition(nx, ny);
    }

    private updateAlertedCombatMovement(dt: number, playerMoveSpeed: number) {
        const targetMonster = this.currentMonster;
        if (!targetMonster) {
            return;
        }

        const playerCombatProfile = getCombatStyleProfile(this.character.combatStyle);
        const playerStep = playerMoveSpeed * dt;
        const playerNext = this.computeStrategyPosition(
            this.playerSprite.x,
            this.playerSprite.y,
            targetMonster.x,
            targetMonster.y,
            playerStep,
            this.playerMovementStrategy,
            playerCombatProfile.approachDistance,
            playerCombatProfile.retreatDistance,
        );
        this.playerSprite.setPosition(playerNext.x, playerNext.y);

        this.getAlertedMonsters().forEach((monster) => {
            const monsterCombatProfile = getCombatStyleProfile(monster.combatStyle);
            const monsterStep = monster.stats.moveSpeed * dt;
            const monsterNext = this.computeStrategyPosition(
                monster.x,
                monster.y,
                this.playerSprite.x,
                this.playerSprite.y,
                monsterStep,
                monster.movementStrategy,
                monsterCombatProfile.approachDistance,
                monsterCombatProfile.retreatDistance,
            );
            monster.x = monsterNext.x;
            monster.y = monsterNext.y;

            const sprite = this.monsterSprites.get(monster.id);
            if (sprite) {
                sprite.setPosition(monsterNext.x, monsterNext.y);
            }
        });
    }

    private getCombatStyleLabel(style: CombatStyle): string {
        return getCombatStyleProfile(style).label;
    }

    private getAlertedMonsters(): Monster[] {
        const monsters: Monster[] = [];
        this.monsterSprites.forEach((container) => {
            const monster = container.getData('monster') as Monster;
            if (monster.alertState === 'alerted') {
                monsters.push(monster);
            }
        });
        return monsters;
    }

    private updateMonsterAwareness() {
        const monsters: Monster[] = [];
        this.monsterSprites.forEach((container) => {
            monsters.push(container.getData('monster') as Monster);
        });

        const directlyAlerted = new Set<string>();
        monsters.forEach((monster) => {
            const distanceToPlayer = PhaserMath.Distance.Between(
                this.playerSprite.x,
                this.playerSprite.y,
                monster.x,
                monster.y,
            );
            if (distanceToPlayer <= monster.aggroRadius) {
                directlyAlerted.add(monster.id);
            }
        });

        const groupAlerted = new Set<string>(directlyAlerted);
        monsters.forEach((monster) => {
            if (!monster.groupBehaviorEnabled || !directlyAlerted.has(monster.id)) {
                return;
            }

            monsters.forEach((ally) => {
                if (!ally.groupBehaviorEnabled) {
                    return;
                }

                const allyDistance = PhaserMath.Distance.Between(monster.x, monster.y, ally.x, ally.y);
                if (allyDistance <= monster.groupAssistRadius) {
                    groupAlerted.add(ally.id);
                }
            });
        });

        monsters.forEach((monster) => {
            monster.alertState = groupAlerted.has(monster.id) ? 'alerted' : 'idle';
            this.syncMonsterVisualState(monster);
        });
    }

    private pickCombatTarget(): Monster | null {
        const nearest = this.findNearestMonster(true);
        return nearest ? (nearest.getData('monster') as Monster) : null;
    }

    private syncMonsterVisualState(monster: Monster) {
        const sprite = this.monsterSprites.get(monster.id);
        if (!sprite) {
            return;
        }

        sprite.setAlpha(monster.alertState === 'alerted' ? 1 : 0.82);
    }

    private computeStrategyPosition(
        sourceX: number,
        sourceY: number,
        targetX: number,
        targetY: number,
        step: number,
        strategy: MovementStrategy,
        approachDistance: number,
        retreatDistance: number,
    ): { x: number; y: number } {
        const distance = PhaserMath.Distance.Between(sourceX, sourceY, targetX, targetY);
        if (distance <= 0.001 || step <= 0) {
            return { x: sourceX, y: sourceY };
        }

        const angleToTarget = PhaserMath.Angle.Between(sourceX, sourceY, targetX, targetY);
        let moveAngle: number | null = null;

        if (strategy === 'approach') {
            if (distance > approachDistance) {
                moveAngle = angleToTarget;
            }
        } else if (distance < retreatDistance) {
            moveAngle = angleToTarget + Math.PI;
        }

        if (moveAngle === null) {
            return { x: sourceX, y: sourceY };
        }

        const nextX = PhaserMath.Clamp(sourceX + Math.cos(moveAngle) * step, 30, DUNGEON_WIDTH - 30);
        const nextY = PhaserMath.Clamp(sourceY + Math.sin(moveAngle) * step, 30, DUNGEON_HEIGHT - 30);
        return { x: nextX, y: nextY };
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
        const canAdvance = canAdvanceSpecialization(this.character);
        const specializationDef = getSpecializationDef(this.character.baseClass, this.character.specialization);
        const classDef = BASE_CLASS_CONFIG[this.character.baseClass];

        const mask = this.add.rectangle(0, 0, DUNGEON_WIDTH, DUNGEON_HEIGHT, 0x06111f, 0.9).setOrigin(0);
        elements.push(mask);

        const panel = this.add.rectangle(182, 120, 660, 360, 0x10243a).setOrigin(0).setStrokeStyle(2, 0x2f5c88);
        elements.push(panel);

        const title = this.add.text(512, 195, '主城', {
            fontSize: '34px',
            color: '#f1c40f',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        elements.push(title);

        const desc = addBoundedText(this, {
            x: 512,
            y: 238,
            content: '在主城整理背包、出售装备，然后进入地牢战斗。',
            width: 520,
            height: 24,
            minFontSize: 13,
            maxLines: 1,
            originX: 0.5,
            style: {
                fontSize: '15px',
                color: '#d6e6f5',
                align: 'center',
            },
        });
        elements.push(desc);

        const hint = addBoundedText(this, {
            x: 512,
            y: 268,
            content: '提示：装备出售/分解仅能在主城商店进行。',
            width: 520,
            height: 22,
            minFontSize: 11,
            maxLines: 1,
            originX: 0.5,
            style: {
                fontSize: '13px',
                color: '#f39c12',
                align: 'center',
            },
        });
        elements.push(hint);

        const classStatus = addBoundedText(this, {
            x: 512,
            y: 300,
            content: specializationDef
                ? `职业: ${classDef.label} · ${this.getCombatStyleLabel(this.character.combatStyle)}  |  专精: ${specializationDef.label} · ${specializationDef.passiveName}`
                : canAdvance
                    ? `职业: ${classDef.label} · ${this.getCombatStyleLabel(this.character.combatStyle)}  |  已满足二次转职条件，前往职业导师`
                    : `职业: ${classDef.label} · ${this.getCombatStyleLabel(this.character.combatStyle)}  |  二次转职将在 Lv.${ADVANCEMENT_REQUIREMENT_LEVEL} 解锁`,
            width: 540,
            height: 34,
            minFontSize: 11,
            maxLines: 2,
            originX: 0.5,
            style: {
                fontSize: '13px',
                color: specializationDef ? classDef.color : canAdvance ? '#2ecc71' : '#95a5a6',
                align: 'center',
            },
        });
        elements.push(classStatus);

        const mentorColor = specializationDef ? 0x425466 : canAdvance ? 0x6b3fa0 : 0x3c4350;
        const mentorBorder = specializationDef ? 0x95a5a6 : canAdvance ? 0xc39bff : 0x66707d;
        const mentorBtnBg = this.add.rectangle(355, 395, 220, 46, mentorColor).setStrokeStyle(2, mentorBorder).setInteractive({ useHandCursor: true });
        const mentorBtnText = addBoundedText(this, {
            x: 355,
            y: 386,
            content: specializationDef ? '已完成转职' : canAdvance ? '职业导师' : `Lv.${ADVANCEMENT_REQUIREMENT_LEVEL} 解锁`,
            width: 180,
            height: 18,
            minFontSize: 14,
            maxLines: 1,
            originX: 0.5,
            style: {
                fontSize: '18px',
                color: specializationDef ? '#d5d8dc' : canAdvance ? '#ffffff' : '#bdc3c7',
                fontStyle: 'bold',
                align: 'center',
            },
        });
        const mentorSubtext = addBoundedText(this, {
            x: 355,
            y: 402,
            content: specializationDef
                ? '查看专精详情'
                : canAdvance
                    ? '选择一条专精分支'
                    : `当前等级 ${this.character.level}/${ADVANCEMENT_REQUIREMENT_LEVEL}`,
            width: 180,
            height: 16,
            minFontSize: 10,
            maxLines: 1,
            originX: 0.5,
            style: {
                fontSize: '11px',
                color: specializationDef ? '#bdc3c7' : canAdvance ? '#e6cc80' : '#95a5a6',
                align: 'center',
            },
        });
        mentorBtnBg.on('pointerover', () => {
            if (specializationDef) return;
            mentorBtnBg.setFillStyle(canAdvance ? 0x7a4bb5 : 0x4a5362);
        });
        mentorBtnBg.on('pointerout', () => mentorBtnBg.setFillStyle(mentorColor));
        mentorBtnBg.on('pointerdown', () => {
            if (specializationDef) {
                this.openMentorDetailPanel();
                return;
            }
            if (!canAdvance) {
                this.openMentorDetailPanel();
                return;
            }
            this.openSpecializationPanel();
        });
        elements.push(mentorBtnBg, mentorBtnText, mentorSubtext);

        const enterBtnBg = this.add.rectangle(669, 395, 220, 50, 0x1b7f3a).setStrokeStyle(2, 0x77d98e).setInteractive({ useHandCursor: true });
        const enterBtnText = this.add.text(669, 395, '进入地牢', {
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
            { label: '拆<=传说', rarity: 'legendary', color: '#ff8000' },
            { label: '拆<=神话', rarity: 'mythic', color: '#e6cc80' },
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
        const specializationBonuses = getSpecializationBonuses(this.character);
        return {
            hp: equipBonuses.hp + (specializationBonuses.hp ?? 0),
            atk: equipBonuses.atk + buffBonuses.atk + (specializationBonuses.atk ?? 0),
            def: equipBonuses.def + buffBonuses.def + (specializationBonuses.def ?? 0),
            attackSpeedPct: equipBonuses.attackSpeed + buffBonuses.attackSpeed + (specializationBonuses.attackSpeedPct ?? 0),
            critRate: equipBonuses.critRate + buffBonuses.critRate + (specializationBonuses.critRate ?? 0),
            critDamage: equipBonuses.critDamage + (specializationBonuses.critDamage ?? 0),
            moveSpeed: equipBonuses.moveSpeed + (specializationBonuses.moveSpeed ?? 0),
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
        if (!canEquipItem(this.character.baseClass, equipment)) {
            this.log(`当前职业无法装备 ${equipment.name}`);
            return;
        }

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
        const classDef = BASE_CLASS_CONFIG[this.character.baseClass];

        const specializationDef = getSpecializationDef(this.character.baseClass, this.character.specialization);
        const classLine = addBoundedText(this, {
            x: 512,
            y: 124,
            content: `职业: ${classDef.label} · ${this.getCombatStyleLabel(this.character.combatStyle)}  |  专精: ${specializationDef?.label ?? '未转职'}`,
            width: 320,
            height: 20,
            minFontSize: 11,
            maxLines: 1,
            originX: 0.5,
            style: { fontSize: '13px', color: classDef.color, align: 'center' },
        }).setDepth(202);
        elements.push(classLine);
        if (!specializationDef) {
            const unlockLine = addBoundedText(this, {
                x: 512,
                y: 143,
                content: this.character.level >= ADVANCEMENT_REQUIREMENT_LEVEL
                    ? '已满足二次转职条件，可在主城职业导师处选择专精'
                    : `二次转职解锁条件：达到 Lv.${ADVANCEMENT_REQUIREMENT_LEVEL}（当前 Lv.${this.character.level}）`,
                width: 360,
                height: 34,
                minFontSize: 10,
                maxLines: 2,
                originX: 0.5,
                style: {
                    fontSize: '11px',
                    color: this.character.level >= ADVANCEMENT_REQUIREMENT_LEVEL ? '#2ecc71' : '#95a5a6',
                    align: 'center',
                },
            }).setDepth(202);
            elements.push(unlockLine);
        }
        if (specializationDef) {
            const passiveLine = addBoundedText(this, {
                x: 512,
                y: 143,
                content: `被动: ${specializationDef.passiveName} · ${specializationDef.passiveDescription}`,
                width: 360,
                height: 34,
                minFontSize: 10,
                maxLines: 2,
                originX: 0.5,
                style: { fontSize: '11px', color: '#e6cc80', align: 'center' },
            }).setDepth(202);
            elements.push(passiveLine);
        }

        const statLines = [
            { label: 'HP', value: `${this.character.baseStats.hp}/${stats.maxHp}`, bonus: bonuses.hp, unit: '' },
            { label: 'ATK', value: `${stats.atk}`, bonus: bonuses.atk, unit: '' },
            { label: 'DEF', value: `${stats.def}`, bonus: bonuses.def, unit: '' },
            { label: '攻速', value: `${stats.attackSpeed.toFixed(2)}`, bonus: bonuses.attackSpeed, unit: '%' },
            { label: '暴击率', value: `${stats.critRate.toFixed(1)}%`, bonus: bonuses.critRate, unit: '%' },
            { label: '暴击伤害', value: `${stats.critDamage.toFixed(0)}%`, bonus: bonuses.critDamage, unit: '%' },
            { label: '移速', value: `${stats.moveSpeed}`, bonus: bonuses.moveSpeed, unit: '' },
        ];

        let sy = specializationDef ? 186 : 168;
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
        const allowedClasses = getAllowedClassesForEquipment(equipment);
        if (allowedClasses && allowedClasses.length > 0) {
            lineCount += 1;
        }
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
        if (allowedClasses && allowedClasses.length > 0) {
            const classNames = allowedClasses.map(classId => BASE_CLASS_CONFIG[classId].label).join(' / ');
            const classText = this.add.text(x + 10, ty, `职业限制: ${classNames}`, { fontSize: '11px', color: '#f39c12' }).setDepth(DEPTH.UI_TOOLTIP + 1);
            elements.push(classText);
            ty += 16;
        }

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

    private autoSaveCompletedFloor() {
        if (!canProceedToNextFloor(this.dungeon)) {
            return;
        }

        const completedFloor = this.dungeon.currentFloor;
        if (this.lastAutoSavedCompletedFloor >= completedFloor) {
            return;
        }

        const data = this.getCurrentSaveData();
        if (saveGame(data)) {
            this.lastAutoSavedCompletedFloor = completedFloor;
            this.log(`第 ${completedFloor} 层已自动保存`);
        } else {
            this.log(`第 ${completedFloor} 层自动保存失败`);
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

    private openSpecializationPanel() {
        if (this.gameplayPhase !== 'town') {
            this.log('请先回到主城，再进行二次转职');
            return;
        }
        if (!canAdvanceSpecialization(this.character)) {
            this.log(`当前未满足转职条件，需达到 Lv.${ADVANCEMENT_REQUIREMENT_LEVEL}`);
            return;
        }

        this.closeUI();
        this.isUIOpen = true;

        const elements: Phaser.GameObjects.GameObject[] = [];
        const classDef = BASE_CLASS_CONFIG[this.character.baseClass];

        const bg = this.add.rectangle(0, 0, DUNGEON_WIDTH, DUNGEON_HEIGHT + HUD_HEIGHT, 0x000000, 0.78).setOrigin(0).setDepth(200).setInteractive();
        elements.push(bg);

        const panelBg = this.add.rectangle(180, 70, 664, 610, 0x1a1a2e).setOrigin(0).setDepth(201).setStrokeStyle(2, parseInt(classDef.color.replace('#', ''), 16));
        elements.push(panelBg);

        const title = addBoundedText(this, {
            x: 512,
            y: 88,
            content: `${classDef.label} · 二次转职`,
            width: 420,
            height: 28,
            minFontSize: 20,
            maxLines: 1,
            originX: 0.5,
            style: {
                fontSize: '24px',
                color: classDef.color,
                fontStyle: 'bold',
                align: 'center',
            },
        }).setDepth(202);
        const subtitle = addBoundedText(this, {
            x: 512,
            y: 122,
            content: '选择后不可更改，本次将激活对应专精被动。',
            width: 500,
            height: 20,
            minFontSize: 11,
            maxLines: 1,
            originX: 0.5,
            style: {
                fontSize: '13px',
                color: '#bdc3c7',
                align: 'center',
            },
        }).setDepth(202);
        const closeBtn = this.add.text(814, 84, '[X]', { fontSize: '18px', color: '#e74c3c' }).setDepth(202).setInteractive();
        closeBtn.on('pointerdown', () => this.closeUI());
        elements.push(title, subtitle, closeBtn);

        classDef.specializations.forEach((spec, index) => {
            const x = 210 + index * 215;
            const y = 170;
            const card = this.add.rectangle(x, y, 190, 420, 0x17283a, 0.96).setOrigin(0).setDepth(202).setStrokeStyle(2, parseInt(classDef.color.replace('#', ''), 16));
            const name = addBoundedText(this, {
                x: x + 95,
                y: y + 20,
                content: spec.label,
                width: 154,
                height: 24,
                minFontSize: 16,
                maxLines: 1,
                originX: 0.5,
                style: {
                    fontSize: '20px',
                    color: classDef.color,
                    fontStyle: 'bold',
                    align: 'center',
                },
            }).setDepth(203);
            const desc = addBoundedText(this, {
                x: x + 14,
                y: y + 56,
                content: spec.description,
                width: 162,
                height: 48,
                minFontSize: 11,
                lineSpacing: 6,
                maxLines: 3,
                style: {
                    fontSize: '13px',
                    color: '#d6e6f5',
                },
            }).setDepth(203);
            const passiveName = addBoundedText(this, {
                x: x + 14,
                y: y + 118,
                content: spec.passiveName,
                width: 162,
                height: 22,
                minFontSize: 12,
                maxLines: 1,
                style: {
                    fontSize: '14px',
                    color: '#f1c40f',
                    fontStyle: 'bold',
                },
            }).setDepth(203);
            const passiveDesc = addBoundedText(this, {
                x: x + 14,
                y: y + 148,
                content: spec.passiveDescription,
                width: 162,
                height: 68,
                minFontSize: 10,
                lineSpacing: 5,
                maxLines: 4,
                style: {
                    fontSize: '12px',
                    color: '#bdc3c7',
                },
            }).setDepth(203);
            const bonusLines = [
                spec.bonuses.hp ? `生命 +${spec.bonuses.hp}` : null,
                spec.bonuses.atk ? `攻击 +${spec.bonuses.atk}` : null,
                spec.bonuses.def ? `防御 +${spec.bonuses.def}` : null,
                spec.bonuses.attackSpeedPct ? `攻速 +${spec.bonuses.attackSpeedPct}%` : null,
                spec.bonuses.critRate ? `暴击率 +${spec.bonuses.critRate}%` : null,
                spec.bonuses.critDamage ? `暴击伤害 +${spec.bonuses.critDamage}%` : null,
                spec.bonuses.moveSpeed ? `移速 +${spec.bonuses.moveSpeed}` : null,
            ].filter((line): line is string => line !== null);
            const bonusTitle = addBoundedText(this, {
                x: x + 14,
                y: y + 228,
                content: '转职收益',
                width: 162,
                height: 20,
                minFontSize: 11,
                maxLines: 1,
                style: {
                    fontSize: '13px',
                    color: '#2ecc71',
                    fontStyle: 'bold',
                },
            }).setDepth(203);
            const bonusText = addBoundedText(this, {
                x: x + 14,
                y: y + 254,
                content: bonusLines.join('\n'),
                width: 162,
                height: 92,
                minFontSize: 10,
                lineSpacing: 6,
                maxLines: 5,
                style: {
                    fontSize: '12px',
                    color: '#2ecc71',
                },
            }).setDepth(203);
            const chooseBtn = this.add.rectangle(x + 95, y + 376, 146, 40, 0x20435f).setDepth(203).setStrokeStyle(2, parseInt(classDef.color.replace('#', ''), 16)).setInteractive({ useHandCursor: true });
            const chooseText = this.add.text(x + 95, y + 376, '确认转职', {
                fontSize: '16px',
                color: '#ffffff',
                fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(204);
            chooseBtn.on('pointerover', () => chooseBtn.setFillStyle(0x2a587c));
            chooseBtn.on('pointerout', () => chooseBtn.setFillStyle(0x20435f));
            chooseBtn.on('pointerdown', () => this.confirmSpecialization(spec.id));
            elements.push(card, name, desc, passiveName, passiveDesc, bonusTitle, bonusText, chooseBtn, chooseText);
        });

        const panelRect: PanelRect = { x: 180, y: 70, width: 664, height: 610 };
        this.createManagedPanel(elements, panelRect, panelBg);
    }

    private openMentorDetailPanel() {
        if (this.gameplayPhase !== 'town') {
            this.log('请先回到主城，再查看职业导师信息');
            return;
        }

        this.closeUI();
        this.isUIOpen = true;

        const elements: Phaser.GameObjects.GameObject[] = [];
        const classDef = BASE_CLASS_CONFIG[this.character.baseClass];
        const specializationDef = getSpecializationDef(this.character.baseClass, this.character.specialization);
        const canAdvance = canAdvanceSpecialization(this.character);

        const bg = this.add.rectangle(0, 0, DUNGEON_WIDTH, DUNGEON_HEIGHT + HUD_HEIGHT, 0x000000, 0.78).setOrigin(0).setDepth(200).setInteractive();
        elements.push(bg);

        const panelBg = this.add.rectangle(250, 110, 524, 500, 0x1a1a2e).setOrigin(0).setDepth(201).setStrokeStyle(2, parseInt(classDef.color.replace('#', ''), 16));
        elements.push(panelBg);

        const title = addBoundedText(this, {
            x: 512,
            y: 136,
            content: `${classDef.label} · 职业导师`,
            width: 360,
            height: 26,
            minFontSize: 20,
            maxLines: 1,
            originX: 0.5,
            style: {
                fontSize: '24px',
                color: classDef.color,
                fontStyle: 'bold',
                align: 'center',
            },
        }).setDepth(202);
        const closeBtn = this.add.text(740, 124, '[X]', { fontSize: '18px', color: '#e74c3c' }).setDepth(202).setInteractive();
        closeBtn.on('pointerdown', () => this.closeUI());
        elements.push(title, closeBtn);

        const summary = addBoundedText(this, {
            x: 290,
            y: 180,
            content: specializationDef
                ? `当前专精：${specializationDef.label}`
                : canAdvance
                    ? '当前状态：可进行二次转职'
                    : '当前状态：尚未解锁二次转职',
            width: 444,
            height: 22,
            minFontSize: 12,
            maxLines: 1,
            style: {
                fontSize: '15px',
                color: specializationDef ? classDef.color : canAdvance ? '#2ecc71' : '#95a5a6',
                fontStyle: 'bold',
            },
        }).setDepth(202);
        elements.push(summary);

        if (specializationDef) {
            const passiveName = addBoundedText(this, {
                x: 290,
                y: 220,
                content: `核心被动：${specializationDef.passiveName}`,
                width: 444,
                height: 22,
                minFontSize: 12,
                maxLines: 1,
                style: {
                    fontSize: '14px',
                    color: '#f1c40f',
                    fontStyle: 'bold',
                },
            }).setDepth(202);
            const passiveDesc = addBoundedText(this, {
                x: 290,
                y: 252,
                content: specializationDef.passiveDescription,
                width: 444,
                height: 42,
                minFontSize: 11,
                maxLines: 2,
                lineSpacing: 6,
                style: {
                    fontSize: '13px',
                    color: '#d6e6f5',
                },
            }).setDepth(202);
            elements.push(passiveName, passiveDesc);

            const bonusLines = [
                specializationDef.bonuses.hp ? `生命 +${specializationDef.bonuses.hp}` : null,
                specializationDef.bonuses.atk ? `攻击 +${specializationDef.bonuses.atk}` : null,
                specializationDef.bonuses.def ? `防御 +${specializationDef.bonuses.def}` : null,
                specializationDef.bonuses.attackSpeedPct ? `攻速 +${specializationDef.bonuses.attackSpeedPct}%` : null,
                specializationDef.bonuses.critRate ? `暴击率 +${specializationDef.bonuses.critRate}%` : null,
                specializationDef.bonuses.critDamage ? `暴击伤害 +${specializationDef.bonuses.critDamage}%` : null,
                specializationDef.bonuses.moveSpeed ? `移速 +${specializationDef.bonuses.moveSpeed}` : null,
            ].filter((line): line is string => line !== null);

            const bonusTitle = this.add.text(290, 320, '当前生效收益', {
                fontSize: '14px',
                color: '#2ecc71',
                fontStyle: 'bold',
            }).setDepth(202);
            const bonusText = addBoundedText(this, {
                x: 290,
                y: 350,
                content: bonusLines.join('\n'),
                width: 444,
                height: 120,
                minFontSize: 11,
                maxLines: 6,
                lineSpacing: 8,
                style: {
                    fontSize: '13px',
                    color: '#2ecc71',
                },
            }).setDepth(202);
            elements.push(bonusTitle, bonusText);
        } else {
            const requirementTitle = this.add.text(290, 220, '解锁条件', {
                fontSize: '14px',
                color: '#f1c40f',
                fontStyle: 'bold',
            }).setDepth(202);
            const requirementText = addBoundedText(this, {
                x: 290,
                y: 252,
                content: `达到 Lv.${ADVANCEMENT_REQUIREMENT_LEVEL} 后，可在职业导师处执行二次转职并选择一条专精路线。`,
                width: 444,
                height: 44,
                minFontSize: 11,
                maxLines: 2,
                lineSpacing: 6,
                style: {
                    fontSize: '13px',
                    color: '#d6e6f5',
                },
            }).setDepth(202);
            const progressText = addBoundedText(this, {
                x: 290,
                y: 320,
                content: `当前等级：Lv.${this.character.level} / ${ADVANCEMENT_REQUIREMENT_LEVEL}`,
                width: 444,
                height: 22,
                minFontSize: 12,
                maxLines: 1,
                style: {
                    fontSize: '14px',
                    color: canAdvance ? '#2ecc71' : '#95a5a6',
                    fontStyle: 'bold',
                },
            }).setDepth(202);
            const adviceText = addBoundedText(this, {
                x: 290,
                y: 360,
                content: canAdvance ? '条件已满足，关闭该窗口后点击“职业导师”即可选择专精。' : '继续挑战地牢并提升等级，达到条件后将自动开放转职。',
                width: 444,
                height: 40,
                minFontSize: 11,
                maxLines: 2,
                lineSpacing: 6,
                style: {
                    fontSize: '13px',
                    color: canAdvance ? '#2ecc71' : '#bdc3c7',
                },
            }).setDepth(202);
            elements.push(requirementTitle, requirementText, progressText, adviceText);
        }

        const actionLabel = specializationDef ? '关闭' : canAdvance ? '前往转职' : '返回';
        const actionBtn = this.add.rectangle(512, 560, 180, 42, canAdvance && !specializationDef ? 0x6b3fa0 : 0x3c4350)
            .setDepth(202)
            .setStrokeStyle(2, canAdvance && !specializationDef ? 0xc39bff : 0x66707d)
            .setInteractive({ useHandCursor: true });
        const actionText = this.add.text(512, 560, actionLabel, {
            fontSize: '16px',
            color: '#ffffff',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(203);
        actionBtn.on('pointerdown', () => {
            if (canAdvance && !specializationDef) {
                this.openSpecializationPanel();
                return;
            }
            this.closeUI();
        });
        elements.push(actionBtn, actionText);

        const panelRect: PanelRect = { x: 250, y: 110, width: 524, height: 500 };
        this.createManagedPanel(elements, panelRect, panelBg);
    }

    private confirmSpecialization(specialization: import('../models').CharacterSpecialization) {
        if (!chooseSpecialization(this.character, specialization)) {
            this.log('转职失败：当前状态不满足条件');
            return;
        }
        const specializationDef = getSpecializationDef(this.character.baseClass, specialization);
        this.closeUI();
        this.renderTownOverlay();
        this.log(`完成二次转职：${specializationDef?.label ?? specialization}`);
    }

    private resetGame() {
        if (this.autoSaveManager) this.autoSaveManager.stop();

        this.character = createCharacter('冒险者', this.character.baseClass);
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
