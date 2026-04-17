import { Geom, Math as PhaserMath, Scene } from 'phaser';
import {
    type CharacterData,
    type CharacterBaseClass,
    type DungeonEventChoice,
    type DungeonEventDefinition,
    type DungeonEventEffect,
    type Monster,
    type MonsterCodexData,
    type DungeonState,
    type Equipment,
    type ExploreState,
    type EquipSlot,
    type WearableSlot,
    type Rarity,
    type SkillDefinition,
    type SkillSlotType,
    type CombatStyle,
    type MovementStrategy,
    getZoneForFloor,
    RARITY_CONFIG,
    BASE_CLASS_CONFIG,
    ADVANCEMENT_REQUIREMENT_LEVEL,
    getSpecializationDef,
    getCombatStyleProfile,
    getAllowedClassesForEquipment,
    getActiveSkillForCharacter,
    getAutoCastSkills,
    getEquippedSkillForSlot,
    getSkillPassiveBonuses,
    canEquipSkill,
    equipSkill,
    isSkillUnlocked,
    getSkillProgress,
    getSkillCritRateBonusWithLevel,
    getSkillCritDamageBonusWithLevel,
    CLASS_SKILLS,
    EQUIP_SLOTS,
    INVENTORY_CAPACITY,
    sellPrice,
    MERCHANT_ITEMS,
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
    canAdvanceAnySpecialization,
    canUnlockSpecialization,
    chooseSpecialization,
    getSpecializationRequirementProgress,
    getSpecializationBonuses,
    heal,
    isAlive,
    allocateStatPoint,
    takeDamage,
    type ExternalStatBonuses,
} from '../systems/character-system';
import {
    spawnMonster,
} from '../systems/monster-system';
import {
    playerAttackMonster,
    playerUseSkillOnMonster,
    collectAffixEffects,
    getEffectiveSkillCooldownMs,
    getEffectiveSkillDamageMultiplier,
    getEffectiveSkillHealRatio,
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
    autoDismantleLowestLevelItems,
    dismantleOne,
    dismantleByRarity,
    dismantleUnequippable,
    normalizeInventoryData,
    removeItem,
    isFull,
    sellByRarity,
    toggleItemLock,
    queryInventoryItems,
    type InventorySortBy,
    type InventorySortOrder,
    type InventoryData,
} from '../systems/inventory-system';
import {
    type PlayerFacing,
    PLAYER_ANIMATION_FRAME_COUNT,
    PLAYER_ANIMATION_FRAME_RATE,
    PLAYER_ANIM_STATES,
    PLAYER_FACINGS,
    type PlayerAnimState,
    PLAYER_PROJECTILE_TEXTURE_KEYS,
    PLAYER_SPRITE_SCALE,
    getPlayerAnimationKey,
    getPlayerSpritesheetKey,
} from '../player-visuals';
import {
    ENEMY_ANIMATION_FRAME_COUNT,
    ENEMY_ANIMATION_FRAME_RATE,
    ENEMY_ANIM_STATES,
    ENEMY_FACINGS,
    ENEMY_SPRITE_SCALE,
    type EnemyAnimState,
    type EnemyFacing,
    getEnemyAnimationKey,
    getEnemySpritesheetKey,
} from '../enemy-visuals';
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
    DUNGEON_EVENT_CHECK_INTERVAL,
    rollDungeonEvent,
} from '../systems/dungeon-event-system';
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
    canCastSkill,
    skillConditionSummary,
    skillTagsSummary,
} from '../systems/skill-system';
import {
    updateMonsterSkillCooldowns,
    selectSkillToCast,
    executeMonsterSkill,
    checkBossPhaseTransition,
    initMonsterSkillState,
    applyPhaseEffects,
} from '../systems/monster-skill-system';
import {
    getMonsterSkills,
    getBossPhases,
} from '../configs';
// 死亡粒子效果暂时禁用
// import {
//     getDeathParticleConfig,
// } from '../configs/particle-configs';
import {
    type Consumable,
    type ConsumableType,
    type ActiveBuff,
    CONSUMABLE_DEFS,
} from '../models/consumable';
import { addBoundedText } from '../ui/text-layout';

const DUNGEON_WIDTH = 1024;
const DUNGEON_HEIGHT = 600;
const HUD_HEIGHT = 168;
const PLAYER_SIZE = 24;
const ENEMY_PERSISTENT_PURSUIT_FACTOR = 0.35;
const PLAYER_CONTACT_DAMAGE = 2;
const PLAYER_CONTACT_DAMAGE_INTERVAL_MS = 200;
const PLAYER_CONTACT_HITBOX_SIZE = 20;
const ENEMY_CONTACT_PADDING = 4;
const LOOT_PICKUP_DELAY = 300;
const REST_THRESHOLD = 0.3;
const REST_RECOVERY_RATE = 0.05;
const VIEWPORT_HEIGHT = DUNGEON_HEIGHT + HUD_HEIGHT;
const PLAYER_WORLD_BOUND_LEFT = 30;
const PLAYER_WORLD_BOUND_TOP = 30;
const PLAYER_WORLD_BOUND_RIGHT = 30;
const PLAYER_WORLD_BOUND_BOTTOM = 20;
const DUNGEON1_WALLS_FLOOR_TILESET_NAME = 'walls_floor';
const DUNGEON1_PRIMARY_FLOOR_TILE_ID = 139;
const DUNGEON1_FLOOR_PATCH_TILE_PAIRS = [
    [229, 230],
    [246, 247],
] as const;
const DUNGEON1_WALL_BORDER_TILE_IDS = {
    topLeft: 23,
    top: 24,
    topRight: 25,
    right: 42,
    bottomRight: 76,
    bottom: 75,
    bottomLeft: 74,
    left: 57,
} as const;
const DUNGEON1_FLOOR_PATCH_RATIO = 0.05;
const DUNGEON1_TILESET_TEXTURE_KEYS = {
    cracked_tiles: 'dungeon1-cracked-walls',
    cracked_tiles_floor: 'dungeon1-cracked-floor',
    walls_floor: 'dungeon1-walls-floor',
    Water_coasts_animation: 'dungeon1-water-coasts',
    Water_detilazation: 'dungeon1-water-details',
    Water_coasts_animation_decorative_cracks: 'dungeon1-cracked-coasts',
    fire_animation: 'dungeon1-fire-1',
    fire_animation2: 'dungeon1-fire-2',
    doors_lever_chest_animation: 'dungeon1-doors',
    Objects: 'dungeon1-objects',
    trap_animation: 'dungeon1-traps',
} as const;

type ManualMoveDirection = 'up' | 'down' | 'left' | 'right';
type ProjectileClass = 'ranger' | 'mage';

const DEPTH = {
    WORLD_TILE: 0,
    WORLD_SKILL_WARNING: 15,
    WORLD_ENTITY: 20,
    WORLD_PLAYER: 21,
    WORLD_PROJECTILE: 25,
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

interface PlayerProjectile {
    sprite: Phaser.GameObjects.Image;
    target: Monster;
    ownerClass: ProjectileClass;
}

interface MonsterVisualState {
    facing: EnemyFacing;
    facingLeft: boolean;
    state: EnemyAnimState;
}

type DungeonFloorLayer = Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer;
type DungeonObjectLayer = Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer;

interface DungeonObstacleDefinition {
    key: string;
    width: number;
    height: number;
    tiles: Array<{ x: number; y: number; tileId: number }>;
    collider: { x: number; y: number; width: number; height: number };
}

const PLAYER_PROJECTILE_SPEED: Record<ProjectileClass, number> = {
    ranger: 320,
    mage: 260,
};

const PLAYER_PROJECTILE_SCALE: Record<ProjectileClass, number> = {
    ranger: 2.5,
    mage: 6,
};

const PLAYER_PROJECTILE_HIT_RADIUS = 18;

export class Game extends Scene {
    // 游戏数据
    character!: CharacterData;
    inventory!: InventoryData;
    equipped!: EquippedItems;
    dungeon!: DungeonState;
    monsterCodex: MonsterCodexData = {};
    affixEffects!: AffixEffects;
    consumables: Consumable[] = [];
    activeBuffs: ActiveBuff[] = [];
    skillCooldowns: Record<string, number> = {};

    // 游戏对象
    playerSprite!: Phaser.GameObjects.Container;
    playerBodySprite!: Phaser.GameObjects.Sprite;
    playerPhysicsHost!: Phaser.GameObjects.Rectangle;
    playerProjectiles: PlayerProjectile[] = [];
    monsterSprites: Map<string, Phaser.GameObjects.Container> = new Map();
    monsterPhysicsBodies: Map<string, Phaser.GameObjects.Rectangle> = new Map();
    lootItems: { x: number; y: number; equipment: Equipment; sprite: Phaser.GameObjects.Container }[] = [];
    currentMonster: Monster | null = null;
    private playerFacing: PlayerFacing = 'down';
    private playerFacingLeft = false;
    private playerAttackLockUntil = 0;
    private playerAttackFacing: PlayerFacing = 'down';
    private playerAttackFacingLeft = false;
    private manualMoveBindingsReady = false;
    private manualMovePressed: Record<ManualMoveDirection, boolean> = {
        up: false,
        down: false,
        left: false,
        right: false,
    };

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
    inventoryUsageText!: Phaser.GameObjects.Text;
    stateText!: Phaser.GameObjects.Text;
    levelText!: Phaser.GameObjects.Text;
    combatLog!: Phaser.GameObjects.Text;
    statPointsText!: Phaser.GameObjects.Text;
    atkText!: Phaser.GameObjects.Text;
    defText!: Phaser.GameObjects.Text;
    buffText!: Phaser.GameObjects.Text;
    skillStatusText!: Phaser.GameObjects.Text;

    // UI 面板
    uiPanel: Phaser.GameObjects.Container | null = null;
    tooltipContainer: Phaser.GameObjects.Container | null = null;
    isUIOpen = false;
    inventoryRarityFilter: Rarity | 'all' = 'all';
    inventorySlotFilter: WearableSlot | 'all' = 'all';
    inventorySortBy: InventorySortBy = 'rarity';
    inventorySortOrder: InventorySortOrder = 'desc';
    inventoryPage = 0;
    consumableScrollIndex = 0;
    playerMovementStrategy: MovementStrategy = 'approach';
    gameplayPhase: GameplayPhase = 'town';
    townOverlay: Phaser.GameObjects.Container | null = null;
    autoEnterNextFloor = false;
    floorClearCountdownTimer: Phaser.Time.TimerEvent | null = null;
    lastAutoSavedCompletedFloor = 0;
    dungeonEventCheckTimer = 0;

    // 地牢装饰
    floorTiles: Phaser.GameObjects.Rectangle[] = [];
    dungeonFloorTilemap: Phaser.Tilemaps.Tilemap | null = null;
    dungeonFloorLayers: DungeonFloorLayer[] = [];
    dungeonObjectTilemap: Phaser.Tilemaps.Tilemap | null = null;
    dungeonObjectLayers: DungeonObjectLayer[] = [];
    dungeonObstacleBodies: Phaser.GameObjects.Rectangle[] = [];

    // 自动保存
    autoSaveManager!: AutoSaveManager;
    enemyCollisionCollider: Phaser.Physics.Arcade.Collider | null = null;
    enemyObstacleCollider: Phaser.Physics.Arcade.Collider | null = null;
    nextContactDamageAt: Map<string, number> = new Map();

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
            this.monsterCodex = saved.monsterCodex ?? {};
            this.consumables = saved.consumables ?? [];
            this.activeBuffs = [];
            this.skillCooldowns = {};
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
            this.monsterCodex = {};
            this.skillCooldowns = {};
            this.affixEffects = collectAffixEffects(this.equipped);
        }

        this.playerMovementStrategy = getCombatStyleProfile(this.character.combatStyle).defaultMovementStrategy;
        this.lastAutoSavedCompletedFloor = canProceedToNextFloor(this.dungeon) ? this.dungeon.currentFloor : 0;

        this.renderDungeon();
        this.renderPlayer();
        this.setupManualMovementControls();
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
            monsterCodex: this.monsterCodex,
            consumables: this.consumables,
            totalPlayTime: 0,
        };
    }

    private getAdvancementContext() {
        return {
            currentFloor: this.dungeon.currentFloor,
            monsterCodex: this.monsterCodex,
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

        this.updatePlayerProjectiles(dt);
        this.handlePlayerEnemyContacts(time);
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

        this.clearDungeonFloorTilemap();
        this.floorTiles.forEach(t => t.destroy());
        this.floorTiles = [];
        this.createDungeonFloorTilemap();
    }

    // ─── 角色渲染 ───

    private renderPlayer() {
        this.ensurePlayerAnimations();

        const body = this.add.sprite(0, 0, getPlayerSpritesheetKey(this.character.baseClass, 'down', 'idle'))
            .setScale(PLAYER_SPRITE_SCALE);
        const label = this.add.text(0, -PLAYER_SIZE - 18, '你', { fontSize: '10px', color: '#ffffff' }).setOrigin(0.5);

        this.playerBodySprite = body;
        this.playerFacing = 'down';
        this.playerFacingLeft = false;
        this.playerSprite = this.add.container(DUNGEON_WIDTH / 2, DUNGEON_HEIGHT / 2, [body, label]).setDepth(DEPTH.WORLD_PLAYER);
        this.playerPhysicsHost = this.add.rectangle(DUNGEON_WIDTH / 2, DUNGEON_HEIGHT / 2, PLAYER_CONTACT_HITBOX_SIZE, PLAYER_CONTACT_HITBOX_SIZE, 0xffffff, 0)
            .setVisible(false)
            .setDepth(DEPTH.WORLD_TILE);
        this.physics.add.existing(this.playerPhysicsHost);
        const physicsBody = this.getArcadeBody(this.playerPhysicsHost);
        physicsBody.setAllowGravity(false);
        physicsBody.setImmovable(true);
        physicsBody.moves = false;
        this.applyPlayerAnimationState('idle');
    }

    // ─── 怪物 ───

    private spawnMonstersForFloor() {
        this.clearPlayerProjectiles();
        this.clearMonsterPhysicsBodies();
        this.monsterSprites.forEach(s => s.destroy());
        this.monsterSprites.clear();

        const count = monstersForFloor(this.dungeon.currentFloor);
        const bossFloor = isBossFloor(this.dungeon.currentFloor);

        for (let i = 0; i < count; i++) {
            const x = PhaserMath.Between(80, DUNGEON_WIDTH - 80);
            const y = PhaserMath.Between(80, DUNGEON_HEIGHT - 80);

            if (bossFloor && i === count - 1) {
                const boss = spawnMonster(this.dungeon.currentFloor, x, y, 'boss');
                this.renderMonster(boss);
            } else {
                const monster = spawnMonster(this.dungeon.currentFloor, x, y);
                this.renderMonster(monster);
            }
        }

        this.setupMonsterCollision();
    }

    private renderMonster(monster: Monster) {
        this.ensureEnemyAnimations(monster.type);

        const sizes: Record<string, number> = { normal: 20, elite: 24, rare: 28, boss: 34 };
        const size = sizes[monster.type] ?? 20;
        const barWidth = size + 4;

        const body = this.add.sprite(0, 0, getEnemySpritesheetKey(monster.type, 'down', 'idle'), 0)
            .setScale(ENEMY_SPRITE_SCALE[monster.type] ?? 1)
            .setOrigin(0.5);
        const hpBg = this.add.rectangle(0, -size / 2 - 10, barWidth, 4, 0x333333).setOrigin(0.5);
        const hpBar = this.add.rectangle(-barWidth / 2, -size / 2 - 10, barWidth, 2, 0x00ff00).setOrigin(0, 0.5);
        const label = this.add.text(0, -size / 2 - 18, monster.name, { fontSize: '9px', color: '#ffffff' }).setOrigin(0.5);

        const container = this.add.container(monster.x, monster.y, [body, hpBg, hpBar, label]).setDepth(DEPTH.WORLD_ENTITY);
        this.monsterSprites.set(monster.id, container);
        this.createMonsterPhysicsBody(monster, size);

        container.setData('monster', monster);
        container.setData('bodySprite', body);
        container.setData('hpBg', hpBg);
        container.setData('hpBar', hpBar);
        container.setData('label', label);
        container.setData('maxHp', monster.stats.maxHp);
        container.setData('hpBarWidth', barWidth);
        container.setData('visualState', {
            facing: 'down',
            facingLeft: false,
            state: 'idle',
        } satisfies MonsterVisualState);

        // 初始化怪物技能状态
        const skills = getMonsterSkills(monster.catalogId, monster.type);
        if (skills.length > 0) {
            initMonsterSkillState(monster, skills);
        }

        // 初始化Boss阶段配置
        if (monster.type === 'boss') {
            monster.phases = getBossPhases(monster.catalogId);
            monster.currentPhase = 0;
        }

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
        this.updateMovement(dt, stats.moveSpeed);
        this.updateEnemyPersistentPursuit();
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

        if (this.tryTriggerDungeonEvent(dt)) {
            return;
        }

        if (this.isCurrentFloorCleared()) {
            this.autoSaveCompletedFloor();
            this.enterTown();
            this.showFloorClearPanel();
            return;
        }

    }

    private updateFighting(time: number, dt: number) {
        const stats = this.getCurrentStats();
        this.updateMovement(dt, stats.moveSpeed);
        this.updateEnemyPersistentPursuit();
        this.updateMonsterAwareness();
        this.currentMonster = this.pickCombatTarget();
        if (!this.currentMonster) {
            setExploreState(this.dungeon, 'exploring');
            return;
        }

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

        if (this.tryUseClassSkill(time, this.currentMonster, stats)) {
            return;
        }

        const attackInterval = 1000 / Math.max(0.1, stats.attackSpeed);
        if (time - this.lastAttackTime < attackInterval) return;
        this.lastAttackTime = time;
        this.triggerPlayerAttackAnimation();

        if (this.shouldUsePlayerProjectile(this.character.baseClass)) {
            this.launchPlayerProjectile(this.character.baseClass, this.currentMonster);
            return;
        }

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
            this.showHitFlash(this.currentMonster);
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

            // 检查Boss阶段转换
            const phase = checkBossPhaseTransition(this.currentMonster);
            if (phase) {
                applyPhaseEffects(this.currentMonster, phase);
                if (phase.message) {
                    this.showPhaseTransitionMessage(phase.message);
                }
                // 如果有技能覆盖，重新初始化技能状态
                if (phase.skillOverrides) {
                    const newSkills = getMonsterSkills(this.currentMonster.catalogId, this.currentMonster.type)
                        .filter(s => phase.skillOverrides!.includes(s.id));
                    if (newSkills.length > 0) {
                        initMonsterSkillState(this.currentMonster, newSkills);
                    }
                }
            }

            // 执行怪物技能
            this.executeMonsterSkills(time, this.currentMonster, stats);
        }
    }

    /** 执行怪物技能 */
    private executeMonsterSkills(time: number, monster: Monster, _playerStats: ReturnType<Game['getCurrentStats']>) {
        const skills = getMonsterSkills(monster.catalogId, monster.type);
        if (skills.length === 0) return;

        // 更新技能冷却
        updateMonsterSkillCooldowns([monster], this.game.loop.delta);

        // 选择要释放的技能
        const context = {
            time,
            playerX: this.playerSprite.x,
            playerY: this.playerSprite.y,
        };

        const skillToCast = selectSkillToCast(monster, skills, context);
        if (!skillToCast) return;

        // 执行技能
        const result = executeMonsterSkill(monster, skillToCast, context);

        // 显示技能预警
        if (result.showWarning && result.warningPosition) {
            this.showSkillWarning(
                result.warningPosition.x,
                result.warningPosition.y,
                result.warningPosition.radius,
                result.warningPosition.color,
                result.warningPosition.duration
            );
        }

        // 处理技能伤害
        if (result.damage && result.damage > 0) {
            // 延迟造成伤害（配合预警时间）
            const delay = skillToCast.visual?.warningDuration ?? 0;
            this.time.delayedCall(delay, () => {
                const playerDied = takeDamage(this.character, result.damage!, this.getCurrentStatBonuses());
                this.showDamageNumber(this.playerSprite.x, this.playerSprite.y - 30, result.damage!, false, ` ${skillToCast.name}`);
                if (playerDied) {
                    this.onPlayerDeath();
                }
            });
        }

        // 处理召唤效果
        if (result.summonedMonsters && result.summonedMonsters.length > 0) {
            this.time.delayedCall(500, () => {
                for (const summon of result.summonedMonsters!) {
                    const summonedMonster = spawnMonster(this.dungeon.currentFloor, summon.x, summon.y, summon.type);
                    this.renderMonster(summonedMonster);
                    this.setupMonsterCollision();
                }
                this.log(`${monster.name} 召唤了援军！`);
            });
        }
    }

    private updateLooting() {
        const dt = this.game.loop.delta / 1000;
        const stats = this.getCurrentStats();
        this.updateMovement(dt, stats.moveSpeed);
        this.updateEnemyPersistentPursuit();
        this.updateMonsterAwareness();
        this.stateTimer += this.game.loop.delta;

        if (this.lootItems.length === 0 || this.stateTimer >= LOOT_PICKUP_DELAY) {
            while (this.lootItems.length > 0) {
                const loot = this.lootItems.pop()!;
                if (isFull(this.inventory)) {
                    const dismantleResult = autoDismantleLowestLevelItems(this.inventory, 100);
                    if (dismantleResult.count > 0) {
                        this.log(`背包已满，自动分解最低等级 ${dismantleResult.count} 件装备，获得 ${dismantleResult.essence} 精华`);
                    }
                }
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
        this.updateEnemyPersistentPursuit();
        this.updateMonsterAwareness();
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
            this.dungeonEventCheckTimer = 0;
            this.renderDungeon();
            this.spawnMonstersForFloor();
            this.playerSprite.setPosition(DUNGEON_WIDTH / 2, DUNGEON_HEIGHT / 2);
            this.playerPhysicsHost.setPosition(DUNGEON_WIDTH / 2, DUNGEON_HEIGHT / 2);
        }
    }

    // ─── 地牢随机事件 ───

    private tryTriggerDungeonEvent(dt: number): boolean {
        if (this.dungeon.randomEventTriggered || this.lootItems.length > 0 || this.monsterSprites.size === 0) {
            return false;
        }

        if (Date.now() - this.dungeon.floorStartTime < 1500) {
            return false;
        }

        this.dungeonEventCheckTimer += dt;
        if (this.dungeonEventCheckTimer < DUNGEON_EVENT_CHECK_INTERVAL) {
            return false;
        }

        this.dungeonEventCheckTimer = 0;
        const event = rollDungeonEvent(this.dungeon.currentFloor);
        if (!event) {
            return false;
        }

        this.dungeon.randomEventTriggered = true;
        this.showDungeonEventPanel(event);
        return true;
    }

    private showDungeonEventPanel(event: DungeonEventDefinition) {
        this.closeUI();
        this.isUIOpen = true;

        const elements: Phaser.GameObjects.GameObject[] = [];

        const bg = this.add.rectangle(0, 0, DUNGEON_WIDTH, DUNGEON_HEIGHT + HUD_HEIGHT, 0x000000, 0.74).setOrigin(0).setDepth(DEPTH.UI_MODAL).setInteractive();
        elements.push(bg);

        const panelBg = this.add.rectangle(270, 150, 484, 350, 0x182433).setOrigin(0).setDepth(DEPTH.UI_MODAL + 1).setStrokeStyle(2, 0xf1c40f);
        elements.push(panelBg);

        const title = addBoundedText(this, {
            x: 512,
            y: 180,
            content: event.title,
            width: 360,
            height: 30,
            minFontSize: 20,
            maxLines: 1,
            originX: 0.5,
            style: {
                fontSize: '24px',
                color: '#f1c40f',
                fontStyle: 'bold',
                align: 'center',
            },
        }).setDepth(DEPTH.UI_MODAL + 2);
        elements.push(title);

        const desc = addBoundedText(this, {
            x: 310,
            y: 228,
            content: event.description,
            width: 404,
            height: 78,
            minFontSize: 13,
            maxLines: 3,
            lineSpacing: 8,
            style: {
                fontSize: '16px',
                color: '#d6e6f5',
            },
        }).setDepth(DEPTH.UI_MODAL + 2);
        elements.push(desc);

        const effectLines = event.choices.map((choice) => `${choice.label}: ${choice.effects.map((effect) => effect.label).join('，')}`);
        const effectText = addBoundedText(this, {
            x: 310,
            y: 326,
            content: effectLines.join('\n'),
            width: 404,
            height: 68,
            minFontSize: 11,
            maxLines: 3,
            lineSpacing: 6,
            style: {
                fontSize: '13px',
                color: '#bdc3c7',
            },
        }).setDepth(DEPTH.UI_MODAL + 2);
        elements.push(effectText);

        const buttonWidth = event.choices.length > 1 ? 172 : 190;
        const gap = 24;
        const totalWidth = event.choices.length * buttonWidth + (event.choices.length - 1) * gap;
        const startX = 512 - totalWidth / 2;

        event.choices.forEach((choice, index) => {
            const x = startX + index * (buttonWidth + gap) + buttonWidth / 2;
            const btn = this.add.rectangle(x, 445, buttonWidth, 42, 0x25435c).setDepth(DEPTH.UI_MODAL + 2).setStrokeStyle(2, 0x5dade2).setInteractive({ useHandCursor: true });
            const btnText = addBoundedText(this, {
                x,
                y: 445,
                content: choice.label,
                width: buttonWidth - 20,
                height: 22,
                minFontSize: 12,
                maxLines: 1,
                originX: 0.5,
                originY: 0.5,
                style: {
                    fontSize: '16px',
                    color: '#ffffff',
                    fontStyle: 'bold',
                    align: 'center',
                },
            }).setDepth(DEPTH.UI_MODAL + 3);
            btn.on('pointerover', () => btn.setFillStyle(0x2e5879));
            btn.on('pointerout', () => btn.setFillStyle(0x25435c));
            btn.on('pointerdown', () => this.resolveDungeonEventChoice(event, choice));
            elements.push(btn, btnText);
        });

        const panelRect: PanelRect = { x: 270, y: 150, width: 484, height: 350 };
        this.createManagedPanel(elements, panelRect, panelBg);
    }

    private resolveDungeonEventChoice(event: DungeonEventDefinition, choice: DungeonEventChoice) {
        const resultLines: string[] = [];
        for (const effect of choice.effects) {
            const line = this.applyDungeonEventEffect(event, effect);
            if (line) {
                resultLines.push(line);
            }
        }

        this.closeUI();
        setExploreState(this.dungeon, 'exploring');
        this.updateHUD();
        const suffix = resultLines.length > 0 ? `（${resultLines.join('，')}）` : '';
        this.log(`${choice.resultText}${suffix}`);
    }

    private applyDungeonEventEffect(event: DungeonEventDefinition, effect: DungeonEventEffect): string | null {
        const stats = this.getCurrentStats();
        switch (effect.type) {
            case 'gold': {
                const gold = Math.max(1, Math.floor(effect.value + this.dungeon.currentFloor * 4));
                this.character.gold += gold;
                this.dungeonRunSummary.gainedGold += gold;
                return `金币 +${gold}`;
            }
            case 'healRatio': {
                const amount = Math.max(1, Math.floor(stats.maxHp * effect.value));
                heal(this.character, amount, this.getCurrentStatBonuses());
                this.showHealNumber(this.playerSprite.x, this.playerSprite.y - 42, amount);
                return `生命 +${amount}`;
            }
            case 'damageRatio': {
                const damage = Math.max(1, Math.floor(stats.maxHp * effect.value));
                this.character.baseStats.hp = Math.max(1, this.character.baseStats.hp - damage);
                this.showDamageNumber(this.playerSprite.x, this.playerSprite.y - 42, damage, false, event.title);
                return `生命 -${damage}`;
            }
            case 'consumable': {
                if (!effect.consumableType) return null;
                const count = Math.max(1, Math.floor(effect.value));
                this.addConsumableReward(effect.consumableType, count);
                return `${CONSUMABLE_DEFS[effect.consumableType].name} x${count}`;
            }
            case 'buff': {
                if (!effect.buffStat) return null;
                this.addDungeonEventBuff(event, effect);
                return effect.label;
            }
        }
    }

    private addDungeonEventBuff(event: DungeonEventDefinition, effect: DungeonEventEffect) {
        if (!effect.buffStat) return;

        const existing = this.activeBuffs.find((buff) => buff.type === 'elixirLuck' && buff.name === event.title && buff.stat === effect.buffStat);
        const endTime = Date.now() + effect.value;
        if (existing) {
            existing.endTime = endTime;
            existing.value = effect.buffValue ?? existing.value;
            return;
        }

        this.activeBuffs.push({
            type: 'elixirLuck',
            name: event.title,
            stat: effect.buffStat,
            value: effect.buffValue ?? 20,
            endTime,
        });
    }

    // ─── 事件处理 ───

    private onMonsterKilled(monster: Monster, result: CombatResult) {
        const leveledUp = addExperience(this.character, result.expGained);
        this.character.gold += result.goldGained;
        this.recordMonsterCodexKill(monster);
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

        // 死亡粒子效果（暂时禁用）
        // this.showDeathEffect(monster);

        // 死亡折叠动画
        const sprite = this.monsterSprites.get(monster.id);
        if (sprite) {
            const bodySprite = sprite.getData('bodySprite') as Phaser.GameObjects.Sprite;
            const hpBar = sprite.getData('hpBar') as Phaser.GameObjects.Rectangle;
            const hpBg = sprite.getData('hpBg') as Phaser.GameObjects.Rectangle;
            const label = sprite.getData('label') as Phaser.GameObjects.Text;

            // 隐藏血条和标签
            if (hpBar) hpBar.setVisible(false);
            if (hpBg) hpBg.setVisible(false);
            if (label) label.setVisible(false);

            // 立即销毁物理体
            const physicsHost = this.monsterPhysicsBodies.get(monster.id);
            if (physicsHost) {
                physicsHost.destroy();
                this.monsterPhysicsBodies.delete(monster.id);
            }
            this.nextContactDamageAt.delete(monster.id);

            // 播放折叠动画
            if (bodySprite) {
                // 设置原点到底部，实现从下往上折叠
                bodySprite.setOrigin(0.5, 1);

                this.tweens.add({
                    targets: bodySprite,
                    scaleY: 0.1,
                    duration: 500,
                    ease: 'Power2',
                    onComplete: () => {
                        sprite.destroy();
                        this.monsterSprites.delete(monster.id);
                    },
                });
            } else {
                sprite.destroy();
                this.monsterSprites.delete(monster.id);
            }
        } else {
            // 没有精灵时，直接销毁物理体
            const physicsHost = this.monsterPhysicsBodies.get(monster.id);
            if (physicsHost) {
                physicsHost.destroy();
                this.monsterPhysicsBodies.delete(monster.id);
            }
            this.nextContactDamageAt.delete(monster.id);
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
        this.clearPlayerProjectiles();
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

    private getArcadeBody(gameObject: Phaser.GameObjects.Rectangle): Phaser.Physics.Arcade.Body {
        return gameObject.body as Phaser.Physics.Arcade.Body;
    }

    private clearMonsterPhysicsBodies() {
        if (this.enemyCollisionCollider) {
            this.enemyCollisionCollider.destroy();
            this.enemyCollisionCollider = null;
        }

        this.monsterPhysicsBodies.forEach((body) => body.destroy());
        this.monsterPhysicsBodies.clear();
        this.nextContactDamageAt.clear();
        if (this.enemyObstacleCollider) {
            this.enemyObstacleCollider.destroy();
            this.enemyObstacleCollider = null;
        }
    }

    private createMonsterPhysicsBody(monster: Monster, visualSize: number) {
        const hitboxSize = Math.max(12, visualSize - ENEMY_CONTACT_PADDING);
        const host = this.add.rectangle(monster.x, monster.y, hitboxSize, hitboxSize, 0xffffff, 0)
            .setVisible(false)
            .setDepth(DEPTH.WORLD_TILE);
        this.physics.add.existing(host);

        const body = this.getArcadeBody(host);
        body.setAllowGravity(false);
        body.setCollideWorldBounds(true);
        body.setImmovable(false);
        body.setMaxVelocity(monster.stats.moveSpeed, monster.stats.moveSpeed);

        this.monsterPhysicsBodies.set(monster.id, host);
    }

    private setupMonsterCollision() {
        if (this.enemyCollisionCollider) {
            this.enemyCollisionCollider.destroy();
        }
        if (this.enemyObstacleCollider) {
            this.enemyObstacleCollider.destroy();
        }

        const hosts = Array.from(this.monsterPhysicsBodies.values());
        if (hosts.length > 1) {
            this.enemyCollisionCollider = this.physics.add.collider(hosts, hosts);
        } else {
            this.enemyCollisionCollider = null;
        }

        if (hosts.length > 0 && this.dungeonObstacleBodies.length > 0) {
            this.enemyObstacleCollider = this.physics.add.collider(hosts, this.dungeonObstacleBodies);
        } else {
            this.enemyObstacleCollider = null;
        }
    }

    private syncMonsterDataFromBodies() {
        this.monsterPhysicsBodies.forEach((host, monsterId) => {
            const monsterContainer = this.monsterSprites.get(monsterId);
            if (!monsterContainer) {
                return;
            }

            const monster = monsterContainer.getData('monster') as Monster;
            monster.x = host.x;
            monster.y = host.y;
            monsterContainer.setPosition(host.x, host.y);
        });
    }

    private updateEnemyPersistentPursuit() {
        this.syncMonsterDataFromBodies();
        this.monsterSprites.forEach((container) => {
            const monster = container.getData('monster') as Monster;
            const host = this.monsterPhysicsBodies.get(monster.id);
            if (!host) {
                return;
            }

            const body = this.getArcadeBody(host);
            const angleToTarget = PhaserMath.Angle.Between(host.x, host.y, this.playerSprite.x, this.playerSprite.y);
            const speed = monster.stats.moveSpeed * ENEMY_PERSISTENT_PURSUIT_FACTOR;
            const distance = PhaserMath.Distance.Between(host.x, host.y, this.playerSprite.x, this.playerSprite.y);
            const velocityScale = distance <= 2 ? 0 : Math.min(1, distance / 24);

            body.setVelocity(
                Math.cos(angleToTarget) * speed * velocityScale,
                Math.sin(angleToTarget) * speed * velocityScale,
            );
        });
    }

    private handlePlayerEnemyContacts(time: number) {
        this.monsterPhysicsBodies.forEach((host, monsterId) => {
            const monsterContainer = this.monsterSprites.get(monsterId);
            if (!monsterContainer) {
                this.nextContactDamageAt.delete(monsterId);
                return;
            }

            const isOverlapping = this.physics.overlap(this.playerPhysicsHost, host);
            if (!isOverlapping) {
                this.nextContactDamageAt.delete(monsterId);
                return;
            }

            const nextDamageAt = this.nextContactDamageAt.get(monsterId) ?? 0;
            if (time < nextDamageAt) {
                return;
            }

            const playerDied = takeDamage(this.character, PLAYER_CONTACT_DAMAGE, this.getCurrentStatBonuses());
            this.showDamageNumber(this.playerSprite.x, this.playerSprite.y - 42, PLAYER_CONTACT_DAMAGE, false, ' 接触');
            this.nextContactDamageAt.set(monsterId, time + PLAYER_CONTACT_DAMAGE_INTERVAL_MS);

            if (playerDied) {
                this.onPlayerDeath();
            }
        });
    }

    private shouldUsePlayerProjectile(baseClass: CharacterBaseClass): baseClass is ProjectileClass {
        return baseClass === 'ranger' || baseClass === 'mage';
    }

    private launchPlayerProjectile(baseClass: ProjectileClass, target: Monster) {
        const textureKey = PLAYER_PROJECTILE_TEXTURE_KEYS[baseClass];
        if (!textureKey) {
            return;
        }

        const sprite = this.add.image(this.playerSprite.x, this.playerSprite.y, textureKey)
            .setScale(PLAYER_PROJECTILE_SCALE[baseClass])
            .setDepth(DEPTH.WORLD_PROJECTILE);

        this.playerProjectiles.push({
            sprite,
            target,
            ownerClass: baseClass,
        });
    }

    private updatePlayerProjectiles(dt: number) {
        for (let i = this.playerProjectiles.length - 1; i >= 0; i--) {
            const projectile = this.playerProjectiles[i];
            const targetSprite = this.monsterSprites.get(projectile.target.id);
            if (!targetSprite || projectile.target.stats.hp <= 0) {
                this.destroyPlayerProjectileAt(i);
                continue;
            }

            const angle = PhaserMath.Angle.Between(
                projectile.sprite.x,
                projectile.sprite.y,
                targetSprite.x,
                targetSprite.y,
            );
            const speed = PLAYER_PROJECTILE_SPEED[projectile.ownerClass];
            projectile.sprite.x += Math.cos(angle) * speed * dt;
            projectile.sprite.y += Math.sin(angle) * speed * dt;
            projectile.sprite.setRotation(angle);

            const distanceToTarget = PhaserMath.Distance.Between(
                projectile.sprite.x,
                projectile.sprite.y,
                targetSprite.x,
                targetSprite.y,
            );
            if (distanceToTarget <= PLAYER_PROJECTILE_HIT_RADIUS) {
                this.resolvePlayerProjectileHit(projectile, i);
            }
        }
    }

    private resolvePlayerProjectileHit(projectile: PlayerProjectile, projectileIndex: number) {
        const monster = projectile.target;
        const monsterSprite = this.monsterSprites.get(monster.id);
        if (!monsterSprite || monster.stats.hp <= 0) {
            this.destroyPlayerProjectileAt(projectileIndex);
            return;
        }

        const stats = this.getCurrentStats();
        const monsterCombatProfile = getCombatStyleProfile(monster.combatStyle);
        const distanceToTarget = PhaserMath.Distance.Between(
            this.playerSprite.x,
            this.playerSprite.y,
            monster.x,
            monster.y,
        );
        const result = playerAttackMonster(
            this.character,
            monster,
            this.affixEffects,
            stats,
            distanceToTarget <= monsterCombatProfile.attackRange,
        );

        if (result.damageDealt > 0) {
            const suffixParts: string[] = [];
            if (result.isCombo) suffixParts.push('连击!');
            if (result.specializationProc) suffixParts.push(result.specializationProc);
            const suffix = suffixParts.length > 0 ? ` ${suffixParts.join(' ')}` : '';
            this.showDamageNumber(monster.x, monster.y - 30, result.damageDealt, result.isCrit, suffix);
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
            this.onMonsterKilled(monster, result);
        } else {
            this.updateMonsterHpBar(monster);
        }

        this.destroyPlayerProjectileAt(projectileIndex);
    }

    private destroyPlayerProjectileAt(index: number) {
        const projectile = this.playerProjectiles[index];
        projectile.sprite.destroy();
        this.playerProjectiles.splice(index, 1);
    }

    private clearPlayerProjectiles() {
        this.playerProjectiles.forEach((projectile) => projectile.sprite.destroy());
        this.playerProjectiles = [];
    }

    private setupManualMovementControls() {
        if (this.manualMoveBindingsReady) {
            return;
        }

        const keyboard = this.input.keyboard;
        if (!keyboard) {
            return;
        }

        this.manualMoveBindingsReady = true;
        keyboard.on('keydown-UP', this.onManualMoveKeyDown, this);
        keyboard.on('keydown-DOWN', this.onManualMoveKeyDown, this);
        keyboard.on('keydown-LEFT', this.onManualMoveKeyDown, this);
        keyboard.on('keydown-RIGHT', this.onManualMoveKeyDown, this);
        keyboard.on('keyup-UP', this.onManualMoveKeyUp, this);
        keyboard.on('keyup-DOWN', this.onManualMoveKeyUp, this);
        keyboard.on('keyup-LEFT', this.onManualMoveKeyUp, this);
        keyboard.on('keyup-RIGHT', this.onManualMoveKeyUp, this);
    }

    private onManualMoveKeyDown(event: KeyboardEvent) {
        const direction = this.getManualMoveDirectionFromEvent(event);
        if (!direction) {
            return;
        }

        this.manualMovePressed[direction] = true;
    }

    private onManualMoveKeyUp(event: KeyboardEvent) {
        const direction = this.getManualMoveDirectionFromEvent(event);
        if (!direction) {
            return;
        }

        this.manualMovePressed[direction] = false;
    }

    private getManualMoveDirectionFromEvent(event: KeyboardEvent): ManualMoveDirection | null {
        switch (event.code) {
            case 'ArrowUp':
                return 'up';
            case 'ArrowDown':
                return 'down';
            case 'ArrowLeft':
                return 'left';
            case 'ArrowRight':
                return 'right';
            default:
                return null;
        }
    }

    private updateMovement(dt: number, moveSpeed: number) {
        if (this.character.movementMode === 'manual') {
            this.updateManualMovement(dt, moveSpeed);
        } else {
            this.updateAutoMovement(dt, moveSpeed);
        }
    }

    private updateAutoMovement(dt: number, moveSpeed: number) {
        // 只有在地牢状态下才自动移动
        if (this.gameplayPhase !== 'dungeon') {
            if (!this.isPlayerAttackAnimationLocked()) {
                this.applyPlayerAnimationState('idle');
            }
            return;
        }

        // 找到最近的存活怪物
        let targetX: number;
        let targetY: number;

        let nearestDistance = Infinity;
        let nearestMonsterId: string | null = null;

        this.monsterSprites.forEach((container) => {
            const monster = container.getData('monster') as Monster;
            if (monster.stats.hp <= 0) return;

            const dx = container.x - this.playerSprite.x;
            const dy = container.y - this.playerSprite.y;
            const distance = Math.hypot(dx, dy);

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestMonsterId = monster.id;
            }
        });

        if (nearestMonsterId) {
            // 朝最近的怪物移动
            const container = this.monsterSprites.get(nearestMonsterId);
            if (container) {
                targetX = container.x;
                targetY = container.y;
            } else {
                // 没有目标，保持原地
                if (!this.isPlayerAttackAnimationLocked()) {
                    this.applyPlayerAnimationState('idle');
                }
                return;
            }
        } else {
            // 无怪物时，随机探索
            const randomAngle = Math.random() * Math.PI * 2;
            const randomDistance = 100 + Math.random() * 200;

            targetX = this.playerSprite.x + Math.cos(randomAngle) * randomDistance;
            targetY = this.playerSprite.y + Math.sin(randomAngle) * randomDistance;

            // 限制在地图范围内
            targetX = Math.max(PLAYER_WORLD_BOUND_LEFT, Math.min(DUNGEON_WIDTH - PLAYER_WORLD_BOUND_RIGHT, targetX));
            targetY = Math.max(PLAYER_WORLD_BOUND_TOP, Math.min(DUNGEON_HEIGHT - PLAYER_WORLD_BOUND_BOTTOM, targetY));
        }

        // 计算移动方向
        const dx = targetX - this.playerSprite.x;
        const dy = targetY - this.playerSprite.y;
        const distance = Math.hypot(dx, dy);

        if (distance < 1) {
            if (!this.isPlayerAttackAnimationLocked()) {
                this.applyPlayerAnimationState('idle');
            }
            return;
        }

        const direction = {
            x: dx / distance,
            y: dy / distance,
        };

        const step = Math.max(0, moveSpeed) * dt;
        let nextX = this.playerSprite.x + direction.x * step;
        let nextY = this.playerSprite.y + direction.y * step;

        // 限制在地图范围内
        nextX = PhaserMath.Clamp(nextX, PLAYER_WORLD_BOUND_LEFT, DUNGEON_WIDTH - PLAYER_WORLD_BOUND_RIGHT);
        nextY = PhaserMath.Clamp(nextY, PLAYER_WORLD_BOUND_TOP, DUNGEON_HEIGHT - PLAYER_WORLD_BOUND_BOTTOM);

        if (nextX === this.playerSprite.x && nextY === this.playerSprite.y) {
            if (!this.isPlayerAttackAnimationLocked()) {
                this.applyPlayerAnimationState('idle');
            }
            return;
        }

        if (!this.canPlayerMoveTo(nextX, nextY)) {
            if (!this.isPlayerAttackAnimationLocked()) {
                this.applyPlayerAnimationState('idle');
            }
            return;
        }

        this.playerSprite.setPosition(nextX, nextY);
        this.playerPhysicsHost.setPosition(nextX, nextY);

        if (this.isPlayerAttackAnimationLocked()) {
            return;
        }

        // 更新朝向和动画
        this.updatePlayerFacingFromMovement(direction);
        this.applyPlayerAnimationState('walk');
    }

    private updateManualMovement(dt: number, moveSpeed: number) {
        const movement = this.getManualMovementVector();
        if (!movement) {
            if (this.isPlayerAttackAnimationLocked()) {
                return;
            }
            this.applyPlayerAnimationState('idle');
            return;
        }

        const moved = this.movePlayerManually(dt, moveSpeed, movement);
        if (this.isPlayerAttackAnimationLocked()) {
            return;
        }
        this.updatePlayerFacingFromMovement(movement);
        this.applyPlayerAnimationState(moved ? 'walk' : 'idle');
    }

    private getManualMovementVector(): { x: number; y: number } | null {
        const inputX = (this.manualMovePressed.right ? 1 : 0) - (this.manualMovePressed.left ? 1 : 0);
        const inputY = (this.manualMovePressed.down ? 1 : 0) - (this.manualMovePressed.up ? 1 : 0);
        if (inputX === 0 && inputY === 0) {
            return null;
        }

        const magnitude = Math.hypot(inputX, inputY);
        if (magnitude <= 0.001) {
            return null;
        }

        return {
            x: inputX / magnitude,
            y: inputY / magnitude,
        };
    }

    private movePlayerManually(dt: number, moveSpeed: number, movement: { x: number; y: number }): boolean {
        const step = Math.max(0, moveSpeed) * dt;
        let nextX = this.playerSprite.x + movement.x * step;
        let nextY = this.playerSprite.y + movement.y * step;

        nextX = PhaserMath.Clamp(nextX, PLAYER_WORLD_BOUND_LEFT, DUNGEON_WIDTH - PLAYER_WORLD_BOUND_RIGHT);
        nextY = PhaserMath.Clamp(nextY, PLAYER_WORLD_BOUND_TOP, DUNGEON_HEIGHT - PLAYER_WORLD_BOUND_BOTTOM);

        if (nextX === this.playerSprite.x && nextY === this.playerSprite.y) {
            return false;
        }

        if (!this.canPlayerMoveTo(nextX, nextY)) {
            return false;
        }

        this.playerSprite.setPosition(nextX, nextY);
        this.playerPhysicsHost.setPosition(nextX, nextY);
        return true;
    }

    private canPlayerMoveTo(nextX: number, nextY: number): boolean {
        const proposedBounds = new Geom.Rectangle(
            nextX - this.playerPhysicsHost.width / 2,
            nextY - this.playerPhysicsHost.height / 2,
            this.playerPhysicsHost.width,
            this.playerPhysicsHost.height,
        );

        return !this.dungeonObstacleBodies.some((host) => {
            const obstacleBounds = new Geom.Rectangle(
                host.x - host.width / 2,
                host.y - host.height / 2,
                host.width,
                host.height,
            );
            return Geom.Intersects.RectangleToRectangle(proposedBounds, obstacleBounds);
        });
    }

    private ensurePlayerAnimations() {
        PLAYER_FACINGS.forEach((facing) => {
            PLAYER_ANIM_STATES.forEach((state) => {
                const animationKey = getPlayerAnimationKey(this.character.baseClass, facing, state);
                if (this.anims.exists(animationKey)) {
                    return;
                }

                this.anims.create({
                    key: animationKey,
                    frames: this.anims.generateFrameNumbers(
                        getPlayerSpritesheetKey(this.character.baseClass, facing, state),
                        {
                            start: 0,
                            end: PLAYER_ANIMATION_FRAME_COUNT[state] - 1,
                        },
                    ),
                    frameRate: PLAYER_ANIMATION_FRAME_RATE[state],
                    repeat: state === 'attack' ? 0 : -1,
                });
            });
        });
    }

    private ensureEnemyAnimations(type: Monster['type']) {
        ENEMY_FACINGS.forEach((facing) => {
            ENEMY_ANIM_STATES.forEach((state) => {
                const animationKey = getEnemyAnimationKey(type, facing, state);
                if (this.anims.exists(animationKey)) {
                    return;
                }

                this.anims.create({
                    key: animationKey,
                    frames: this.anims.generateFrameNumbers(
                        getEnemySpritesheetKey(type, facing, state),
                        {
                            start: 0,
                            end: ENEMY_ANIMATION_FRAME_COUNT[state] - 1,
                        },
                    ),
                    frameRate: ENEMY_ANIMATION_FRAME_RATE[state],
                    repeat: state === 'attack' || state === 'hurt' || state === 'death' ? 0 : -1,
                });
            });
        });
    }

    private clearDungeonFloorTilemap() {
        this.dungeonFloorLayers.forEach((layer) => layer.destroy());
        this.dungeonFloorLayers = [];
        this.dungeonFloorTilemap = null;
    }

    private clearDungeonObjects() {
        if (this.enemyObstacleCollider) {
            this.enemyObstacleCollider.destroy();
            this.enemyObstacleCollider = null;
        }

        this.dungeonObstacleBodies.forEach((body) => body.destroy());
        this.dungeonObstacleBodies = [];
        this.dungeonObjectLayers.forEach((layer) => layer.destroy());
        this.dungeonObjectLayers = [];
        this.dungeonObjectTilemap = null;
    }

    private createDungeonFloorTilemap() {
        const tileWidth = 16;
        const tileHeight = 16;
        const columns = Math.ceil(DUNGEON_WIDTH / tileWidth);
        const rows = Math.ceil(DUNGEON_HEIGHT / tileHeight);
        this.clearDungeonObjects();
        const data = Array.from({ length: rows }, () =>
            Array.from({ length: columns }, () => DUNGEON1_PRIMARY_FLOOR_TILE_ID),
        );
        const totalTiles = rows * columns;
        const patchCount = Math.max(1, Math.floor((totalTiles * DUNGEON1_FLOOR_PATCH_RATIO) / 2));
        const occupiedPatches = new Set<string>();
        let placedPatches = 0;
        let attempts = 0;
        const maxAttempts = patchCount * 12;

        while (placedPatches < patchCount && attempts < maxAttempts) {
            attempts += 1;

            const patchX = PhaserMath.Between(1, columns - 3);
            const patchY = PhaserMath.Between(1, rows - 2);
            const patchKey = `${patchX},${patchY}`;

            if (occupiedPatches.has(patchKey)) {
                continue;
            }

            occupiedPatches.add(patchKey);
            const pairIndex = PhaserMath.Between(0, DUNGEON1_FLOOR_PATCH_TILE_PAIRS.length - 1);
            const [leftTileId, rightTileId] = DUNGEON1_FLOOR_PATCH_TILE_PAIRS[pairIndex];
            data[patchY][patchX] = leftTileId;
            data[patchY][patchX + 1] = rightTileId;
            placedPatches += 1;
        }

        data[0][0] = DUNGEON1_WALL_BORDER_TILE_IDS.topLeft;
        data[0][columns - 1] = DUNGEON1_WALL_BORDER_TILE_IDS.topRight;
        data[rows - 1][0] = DUNGEON1_WALL_BORDER_TILE_IDS.bottomLeft;
        data[rows - 1][columns - 1] = DUNGEON1_WALL_BORDER_TILE_IDS.bottomRight;

        for (let x = 1; x < columns - 1; x += 1) {
            data[0][x] = DUNGEON1_WALL_BORDER_TILE_IDS.top;
            data[rows - 1][x] = DUNGEON1_WALL_BORDER_TILE_IDS.bottom;
        }

        for (let y = 1; y < rows - 1; y += 1) {
            data[y][0] = DUNGEON1_WALL_BORDER_TILE_IDS.left;
            data[y][columns - 1] = DUNGEON1_WALL_BORDER_TILE_IDS.right;
        }

        const map = this.make.tilemap({
            data,
            tileWidth,
            tileHeight,
        });
        this.dungeonFloorTilemap = map;

        const tileset = map.addTilesetImage(
            DUNGEON1_WALLS_FLOOR_TILESET_NAME,
            DUNGEON1_TILESET_TEXTURE_KEYS.walls_floor,
            tileWidth,
            tileHeight,
            0,
            0,
            1,
        );

        if (!tileset) {
            return;
        }

        const offsetX = Math.floor((DUNGEON_WIDTH - columns * tileWidth) / 2);
        const offsetY = Math.floor((DUNGEON_HEIGHT - rows * tileHeight) / 2);
        const layer = map.createLayer(0, tileset, offsetX, offsetY);
        if (layer) {
            layer.setDepth(DEPTH.WORLD_TILE);
            this.dungeonFloorLayers.push(layer);
        }

        this.createDungeonObstacleTilemap(columns, rows, tileWidth, tileHeight, offsetX, offsetY);
    }

    private createDungeonObstacleTilemap(columns: number, rows: number, tileWidth: number, tileHeight: number, offsetX: number, offsetY: number) {
        const obstacleDefinitions = this.getDungeonObstacleDefinitions();
        const data = Array.from({ length: rows }, () =>
            Array.from({ length: columns }, () => -1),
        );
        const placedAreas: Array<{ x: number; y: number; width: number; height: number }> = [];

        obstacleDefinitions.forEach((definition) => {
            const placement = this.findDungeonObstaclePlacement(definition, columns, rows, tileWidth, tileHeight, offsetX, offsetY, placedAreas);
            if (!placement) {
                return;
            }

            placedAreas.push({
                x: placement.x,
                y: placement.y,
                width: definition.width,
                height: definition.height,
            });

            definition.tiles.forEach((tile) => {
                data[placement.y + tile.y][placement.x + tile.x] = tile.tileId;
            });

            this.createDungeonObstacleBody(definition, placement.x, placement.y, tileWidth, tileHeight, offsetX, offsetY);
        });

        const map = this.make.tilemap({
            data,
            tileWidth,
            tileHeight,
        });
        this.dungeonObjectTilemap = map;

        const tileset = map.addTilesetImage(
            'Objects',
            DUNGEON1_TILESET_TEXTURE_KEYS.Objects,
            tileWidth,
            tileHeight,
            0,
            0,
            1,
        );

        if (!tileset) {
            return;
        }

        const layer = map.createLayer(0, tileset, offsetX, offsetY);
        if (layer) {
            layer.setDepth(DEPTH.WORLD_TILE + 5);
            this.dungeonObjectLayers.push(layer);
        }
    }

    private getDungeonObstacleDefinitions(): DungeonObstacleDefinition[] {
        return [
            {
                key: 'pillar-a',
                width: 1,
                height: 2,
                tiles: [
                    { x: 0, y: 0, tileId: 127 },
                    { x: 0, y: 1, tileId: 151 },
                ],
                collider: { x: 0, y: 0, width: 1, height: 1 },
            },
            {
                key: 'pillar-a-2',
                width: 1,
                height: 2,
                tiles: [
                    { x: 0, y: 0, tileId: 127 },
                    { x: 0, y: 1, tileId: 151 },
                ],
                collider: { x: 0, y: 0, width: 1, height: 1 },
            },
            {
                key: 'pillar-b',
                width: 1,
                height: 2,
                tiles: [
                    { x: 0, y: 0, tileId: 128 },
                    { x: 0, y: 1, tileId: 152 },
                ],
                collider: { x: 0, y: 0, width: 1, height: 1 },
            },
            {
                key: 'pillar-b-2',
                width: 1,
                height: 2,
                tiles: [
                    { x: 0, y: 0, tileId: 128 },
                    { x: 0, y: 1, tileId: 152 },
                ],
                collider: { x: 0, y: 0, width: 1, height: 1 },
            },
            {
                key: 'crate-stack',
                width: 2,
                height: 3,
                tiles: [
                    { x: 0, y: 0, tileId: 42 },
                    { x: 1, y: 0, tileId: 43 },
                    { x: 0, y: 1, tileId: 66 },
                    { x: 1, y: 1, tileId: 67 },
                    { x: 0, y: 2, tileId: 90 },
                    { x: 1, y: 2, tileId: 91 },
                ],
                collider: { x: 0, y: 1, width: 2, height: 1 },
            },
        ];
    }

    private findDungeonObstaclePlacement(
        definition: DungeonObstacleDefinition,
        columns: number,
        rows: number,
        tileWidth: number,
        tileHeight: number,
        offsetX: number,
        offsetY: number,
        placedAreas: Array<{ x: number; y: number; width: number; height: number }>,
    ): { x: number; y: number } | null {
        const minX = 2;
        const maxX = columns - definition.width - 3;
        const minY = 2;
        const maxY = rows - definition.height - 3;
        const playerSpawnX = DUNGEON_WIDTH / 2;
        const playerSpawnY = DUNGEON_HEIGHT / 2;

        for (let attempt = 0; attempt < 60; attempt += 1) {
            const x = PhaserMath.Between(minX, maxX);
            const y = PhaserMath.Between(minY, maxY);
            const overlapsExisting = placedAreas.some((area) =>
                x < area.x + area.width + 1 &&
                x + definition.width + 1 > area.x &&
                y < area.y + area.height + 1 &&
                y + definition.height + 1 > area.y,
            );
            if (overlapsExisting) {
                continue;
            }

            const colliderCenterX = offsetX + (x + definition.collider.x + definition.collider.width / 2) * tileWidth;
            const colliderCenterY = offsetY + (y + definition.collider.y + definition.collider.height / 2) * tileHeight;
            const distanceToSpawn = PhaserMath.Distance.Between(colliderCenterX, colliderCenterY, playerSpawnX, playerSpawnY);
            if (distanceToSpawn < 96) {
                continue;
            }

            return { x, y };
        }

        return null;
    }

    private createDungeonObstacleBody(
        definition: DungeonObstacleDefinition,
        tileX: number,
        tileY: number,
        tileWidth: number,
        tileHeight: number,
        offsetX: number,
        offsetY: number,
    ) {
        const colliderX = offsetX + (tileX + definition.collider.x) * tileWidth;
        const colliderY = offsetY + (tileY + definition.collider.y) * tileHeight;
        const bodyWidth = definition.collider.width * tileWidth;
        const bodyHeight = definition.collider.height * tileHeight;
        const host = this.add.rectangle(
            colliderX + bodyWidth / 2,
            colliderY + bodyHeight / 2,
            bodyWidth,
            bodyHeight,
            0xffffff,
            0,
        )
            .setVisible(false)
            .setDepth(DEPTH.WORLD_TILE);

        this.physics.add.existing(host);
        const body = this.getArcadeBody(host);
        body.setAllowGravity(false);
        body.setImmovable(true);
        body.moves = false;

        this.dungeonObstacleBodies.push(host);
    }

    private updatePlayerFacingFromMovement(movement: { x: number; y: number }) {
        if (Math.abs(movement.y) >= Math.abs(movement.x)) {
            this.playerFacing = movement.y < 0 ? 'up' : 'down';
            this.playerFacingLeft = false;
            return;
        }

        this.playerFacing = 'side';
        this.playerFacingLeft = movement.x < 0;
    }

    private isPlayerAttackAnimationLocked(): boolean {
        return this.time.now < this.playerAttackLockUntil;
    }

    private triggerPlayerAttackAnimation() {
        this.playerAttackFacing = this.playerFacing;
        this.playerAttackFacingLeft = this.playerFacingLeft;
        const duration = (PLAYER_ANIMATION_FRAME_COUNT.attack / PLAYER_ANIMATION_FRAME_RATE.attack) * 1000;
        this.playerAttackLockUntil = this.time.now + duration;
        this.applyPlayerAnimationState('attack', true);
    }

    private applyPlayerAnimationState(state: PlayerAnimState, forceRestart = false) {
        if (!this.playerBodySprite) {
            return;
        }

        const facing = state === 'attack' ? this.playerAttackFacing : this.playerFacing;
        const facingLeft = state === 'attack' ? this.playerAttackFacingLeft : this.playerFacingLeft;

        this.playerBodySprite.setFlipX(facing === 'side' && !facingLeft);
        const animationKey = getPlayerAnimationKey(this.character.baseClass, facing, state);
        if (!forceRestart && this.playerBodySprite.anims.currentAnim?.key === animationKey) {
            return;
        }

        this.playerBodySprite.play(animationKey, true);
    }

    private getCombatStyleLabel(style: CombatStyle): string {
        return getCombatStyleProfile(style).label;
    }

    private recordMonsterCodexKill(monster: Monster) {
        const existing = this.monsterCodex[monster.catalogId];
        this.monsterCodex[monster.catalogId] = {
            id: monster.catalogId,
            name: monster.name.replace(/[★]+$/, ''),
            description: monster.description,
            type: monster.type,
            combatStyle: monster.combatStyle,
            killCount: (existing?.killCount ?? 0) + 1,
            unlocked: true,
        };
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
        const container = this.monsterSprites.get(monster.id);
        if (!container) {
            return;
        }

        container.setAlpha(monster.alertState === 'alerted' ? 1 : 0.82);

        const bodySprite = container.getData('bodySprite') as Phaser.GameObjects.Sprite | undefined;
        const physicsHost = this.monsterPhysicsBodies.get(monster.id);
        if (!bodySprite || !physicsHost) {
            return;
        }

        const body = this.getArcadeBody(physicsHost);
        const nextState: EnemyAnimState = Math.abs(body.velocity.x) > 1 || Math.abs(body.velocity.y) > 1 ? 'walk' : 'idle';
        const nextFacing: EnemyFacing = Math.abs(body.velocity.y) >= Math.abs(body.velocity.x)
            ? (body.velocity.y < 0 ? 'up' : 'down')
            : 'side';
        const nextFacingLeft = nextFacing === 'side' && body.velocity.x < 0;

        const currentState = container.getData('visualState') as MonsterVisualState | undefined;
        if (
            currentState
            && currentState.state === nextState
            && currentState.facing === nextFacing
            && currentState.facingLeft === nextFacingLeft
        ) {
            return;
        }

        bodySprite.setFlipX(nextFacing === 'side' && !nextFacingLeft);
        bodySprite.play(getEnemyAnimationKey(monster.type, nextFacing, nextState), true);
        container.setData('visualState', {
            facing: nextFacing,
            facingLeft: nextFacingLeft,
            state: nextState,
        } satisfies MonsterVisualState);
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

    /** 怪物受击闪光效果 */
    private showHitFlash(monster: Monster) {
        const container = this.monsterSprites.get(monster.id);
        if (!container) return;

        const bodySprite = container.getData('bodySprite') as Phaser.GameObjects.Sprite;
        if (!bodySprite) return;

        bodySprite.setTint(0xffffff);
        this.time.delayedCall(60, () => {
            if (bodySprite && bodySprite.active) {
                bodySprite.clearTint();
            }
        });
    }

    /** 怪物死亡粒子效果（暂时禁用） */
    // private showDeathEffect(monster: Monster) {
    //     const config = getDeathParticleConfig(monster.type);
    //
    //     // 创建一个简单的白色方块作为粒子纹理
    //     const particleKey = 'particle-white';
    //     if (!this.textures.exists(particleKey)) {
    //         const graphics = this.make.graphics({ x: 0, y: 0 });
    //         graphics.fillStyle(0xffffff);
    //         graphics.fillRect(0, 0, 4, 4);
    //         graphics.generateTexture(particleKey, 4, 4);
    //         graphics.destroy();
    //     }
    //
    //     const emitter = this.add.particles(monster.x, monster.y, particleKey, {
    //         lifespan: config.lifespan,
    //         speed: config.speed as { min: number; max: number },
    //         scale: config.scale,
    //         quantity: config.quantity,
    //         alpha: config.alpha,
    //         emitting: true,
    //         emitCallback: (particle: Phaser.GameObjects.Particles.Particle) => {
    //             if (config.tint) {
    //                 const tints = Array.isArray(config.tint) ? config.tint : [config.tint];
    //                 particle.tint = tints[Math.floor(Math.random() * tints.length)];
    //             }
    //         },
    //     });
    //
    //     emitter.setDepth(DEPTH.WORLD_FLOATING_TEXT);
    //
    //     // 延迟销毁粒子发射器
    //     this.time.delayedCall(config.lifespan + 100, () => {
    //         emitter.destroy();
    //     });
    // }

    /** Boss技能预警圆环 */
    private showSkillWarning(x: number, y: number, radius: number, color: number, duration: number) {
        const circle = this.add.circle(x, y, 0, color, 0.2)
            .setDepth(DEPTH.WORLD_SKILL_WARNING);

        this.tweens.add({
            targets: circle,
            radius: radius,
            alpha: 0.35,
            duration: duration,
            onComplete: () => circle.destroy(),
        });
    }

    /** Boss阶段转换消息 */
    private showPhaseTransitionMessage(message: string) {
        const text = this.add.text(DUNGEON_WIDTH / 2, DUNGEON_HEIGHT / 2 - 60, message, {
            fontSize: '20px',
            color: '#ff6600',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5).setDepth(DEPTH.WORLD_FLOATING_TEXT);

        this.tweens.add({
            targets: text,
            y: DUNGEON_HEIGHT / 2 - 100,
            alpha: 0,
            duration: 2000,
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

    private tryUseClassSkill(time: number, monster: Monster, stats: ReturnType<Game['getCurrentStats']>): boolean {
        const skill = getAutoCastSkills(this.character).find((candidate) => this.canAutoCastSkill(candidate, monster, stats));
        if (!skill) {
            return false;
        }

        const nextReadyAt = this.skillCooldowns[skill.id] ?? 0;
        if (time < nextReadyAt) {
            return false;
        }

        const skillLevel = getSkillProgress(this.character, skill.id).level;
        const cooldownMs = getEffectiveSkillCooldownMs(skill, this.affixEffects, skillLevel);
        this.skillCooldowns[skill.id] = time + cooldownMs;
        this.triggerPlayerAttackAnimation();
        const result = playerUseSkillOnMonster(this.character, monster, this.affixEffects, skill, stats);
        const sideEffectLines = this.applySkillSideEffects(skill);
        this.showDamageNumber(monster.x, monster.y - 44, result.damageDealt, result.isCrit, ` ${result.skillName}`);

        if (result.specializationHeal > 0) {
            this.showHealNumber(this.playerSprite.x + 18, this.playerSprite.y - 58, result.specializationHeal);
        }

        if (result.monsterKilled) {
            this.onMonsterKilled(monster, result);
        } else {
            this.updateMonsterHpBar(monster);
            const sideEffects = sideEffectLines.length > 0 ? ` · ${sideEffectLines.join(' / ')}` : '';
            this.log(`释放技能：${result.skillName}（${this.describeSkillTrigger(skill)}）${sideEffects}`);
        }

        return true;
    }

    private canAutoCastSkill(skill: SkillDefinition, monster: Monster, stats: ReturnType<Game['getCurrentStats']>): boolean {
        const distanceToTarget = PhaserMath.Distance.Between(this.playerSprite.x, this.playerSprite.y, monster.x, monster.y);
        return canCastSkill(skill, {
            character: this.character,
            monster,
            stats,
            activeBuffs: this.activeBuffs,
            distanceToTarget,
            nearbyEnemyCount: (radius) => this.countMonstersNearPlayer(radius),
        });
    }

    private applySkillSideEffects(skill: SkillDefinition): string[] {
        const lines: string[] = [];
        const now = Date.now();
        for (const effect of skill.effects) {
            if (effect.type !== 'buff') continue;
            const existing = this.activeBuffs.find((buff) => buff.sourceId === skill.id && buff.stat === effect.stat);
            const endTime = now + effect.durationMs;
            if (existing) {
                existing.endTime = endTime;
                existing.value = effect.value;
            } else {
                this.activeBuffs.push({
                    type: 'elixirLuck',
                    name: skill.label,
                    sourceId: skill.id,
                    stat: effect.stat,
                    value: effect.value,
                    endTime,
                });
            }
            lines.push(`${this.skillBuffStatLabel(effect.stat)}+${effect.value}%`);
        }
        return lines;
    }

    private describeSkillTrigger(skill: SkillDefinition): string {
        return skillConditionSummary(skill);
    }

    private skillBuffStatLabel(stat: string): string {
        const labels: Record<string, string> = {
            atk: '攻击',
            def: '防御',
            attackSpeed: '攻速',
            critRate: '暴击',
            moveSpeed: '移速',
        };
        return labels[stat] ?? stat;
    }

    private getSkillCooldownSummary(): string {
        const skills = getAutoCastSkills(this.character);
        if (skills.length === 0) {
            return '技能: 未装备自动技能';
        }

        const now = this.time.now;
        return `技能: ${skills.map((skill) => {
            const nextReadyAt = this.skillCooldowns[skill.id] ?? 0;
            const remaining = Math.max(0, Math.ceil((nextReadyAt - now) / 1000));
            return remaining > 0 ? `${skill.label} ${remaining}s` : `${skill.label} 就绪`;
        }).join('  |  ')}`;
    }

    private countMonstersNearPlayer(radius: number): number {
        let count = 0;
        this.monsterSprites.forEach((container) => {
            const monster = container.getData('monster') as Monster;
            if (monster.stats.hp <= 0) return;
            const distance = PhaserMath.Distance.Between(this.playerSprite.x, this.playerSprite.y, monster.x, monster.y);
            if (distance <= radius) {
                count += 1;
            }
        });
        return count;
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
        this.dungeonEventCheckTimer = 0;
        this.renderDungeon();
        this.spawnMonstersForFloor();
        this.playerSprite.setPosition(DUNGEON_WIDTH / 2, DUNGEON_HEIGHT / 2);
        this.playerPhysicsHost.setPosition(DUNGEON_WIDTH / 2, DUNGEON_HEIGHT / 2);
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
        this.dungeonFloorLayers.forEach((layer) => layer.setVisible(visible));
        this.dungeonObjectLayers.forEach((layer) => layer.setVisible(visible));
        this.monsterSprites.forEach(sprite => sprite.setVisible(visible));
        this.lootItems.forEach(item => item.sprite.setVisible(visible));
        this.playerProjectiles.forEach((projectile) => projectile.sprite.setVisible(visible));
    }

    private hideTownOverlay() {
        if (!this.townOverlay) return;
        this.townOverlay.destroy(true);
        this.townOverlay = null;
    }

    private renderTownOverlay() {
        this.hideTownOverlay();

        const elements: Phaser.GameObjects.GameObject[] = [];
        const canAdvance = canAdvanceAnySpecialization(this.character, this.getAdvancementContext());
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

        const codexBtnBg = this.add.rectangle(412, 452, 160, 34, 0x25435c).setStrokeStyle(2, 0x5dade2).setInteractive({ useHandCursor: true });
        const codexBtnText = this.add.text(412, 452, '怪物图鉴', {
            fontSize: '15px',
            color: '#d6eaf8',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        codexBtnBg.on('pointerover', () => codexBtnBg.setFillStyle(0x2e5879));
        codexBtnBg.on('pointerout', () => codexBtnBg.setFillStyle(0x25435c));
        codexBtnBg.on('pointerdown', () => this.openMonsterCodexPanel());
        elements.push(codexBtnBg, codexBtnText);

        const settingsBtnBg = this.add.rectangle(612, 452, 160, 34, 0x25435c).setStrokeStyle(2, 0x9b59b6).setInteractive({ useHandCursor: true });
        const settingsBtnText = this.add.text(612, 452, '移动设置', {
            fontSize: '15px',
            color: '#d6eaf8',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        settingsBtnBg.on('pointerover', () => settingsBtnBg.setFillStyle(0x2e5879));
        settingsBtnBg.on('pointerout', () => settingsBtnBg.setFillStyle(0x25435c));
        settingsBtnBg.on('pointerdown', () => this.openMovementSettingsPanel());
        elements.push(settingsBtnBg, settingsBtnText);

        this.townOverlay = this.add.container(0, 0, elements).setDepth(DEPTH.WORLD_FLOATING_TEXT + 5);
    }

    private enterTown(initial = false) {
        if (!initial && this.gameplayPhase === 'town') return;

        if (!initial) {
            this.closeUI();
        }
        this.clearPlayerProjectiles();
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
        this.dungeonEventCheckTimer = 0;
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
        this.goldText = this.add.text(250, hudY + 26, '', { fontSize: '12px', color: '#f1c40f' }).setDepth(DEPTH.HUD_INFO + 2);
        this.inventoryUsageText = this.add.text(250, hudY + 42, '', { fontSize: '11px', color: '#ff69b4' }).setDepth(DEPTH.HUD_INFO + 2);
        this.levelText = this.add.text(420, hudY + 10, '', { fontSize: '12px', color: '#2ecc71' }).setDepth(DEPTH.HUD_INFO + 2);
        this.stateText = this.add.text(420, hudY + 28, '', { fontSize: '11px', color: '#95a5a6' }).setDepth(DEPTH.HUD_INFO + 2);

        // 右侧信息
        this.atkText = this.add.text(600, hudY + 10, '', { fontSize: '11px', color: '#e74c3c' }).setDepth(DEPTH.HUD_INFO + 2);
        this.defText = this.add.text(600, hudY + 28, '', { fontSize: '11px', color: '#3498db' }).setDepth(DEPTH.HUD_INFO + 2);
        this.statPointsText = this.add.text(770, hudY + 10, '', { fontSize: '11px', color: '#9b59b6', fontStyle: 'bold' }).setDepth(DEPTH.HUD_INFO + 2);
        this.buffText = this.add.text(770, hudY + 28, '', { fontSize: '9px', color: '#e6cc80' }).setDepth(DEPTH.HUD_INFO + 2);

        // 战斗日志
        this.combatLog = this.add.text(20, hudY + 60, '', {
            fontSize: '11px', color: '#8e8e9e', wordWrap: { width: DUNGEON_WIDTH - 40 }, lineSpacing: 2,
        }).setDepth(DEPTH.HUD_INFO + 2);
        this.skillStatusText = this.add.text(20, hudY + 101, '', {
            fontSize: '10px', color: '#5dade2', wordWrap: { width: DUNGEON_WIDTH - 40 }, lineSpacing: 2,
        }).setDepth(DEPTH.HUD_INFO + 2);

        // ─── 底部导航栏 ───
        const navY = hudY + HUD_HEIGHT - 32;
        this.add.rectangle(DUNGEON_WIDTH / 2, navY + 16, DUNGEON_WIDTH, 32, 0x0a0a18).setDepth(DEPTH.HUD_NAV_BG);
        this.add.rectangle(DUNGEON_WIDTH / 2, navY, DUNGEON_WIDTH, 1, 0x333355).setDepth(DEPTH.HUD_NAV_BG + 1);

        // 导航按钮（均匀分布）
        const navBtns: { label: string; color: string; action: () => void }[] = [
            { label: '回主城', color: '#1abc9c', action: () => this.enterTown() },
            { label: '背包', color: '#3498db', action: () => this.openInventoryPanel() },
            { label: '角色', color: '#2ecc71', action: () => this.openCharacterPanel() },
            { label: '技能', color: '#5dade2', action: () => this.openSkillLoadoutPanel() },
            { label: '消耗品', color: '#e67e22', action: () => this.openConsumablePanel() },
            { label: '商店', color: '#f1c40f', action: () => this.openShopPanel() },
            { label: '图鉴', color: '#5dade2', action: () => this.openMonsterCodexPanel() },
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
        this.inventoryUsageText.setText(`背包: ${this.inventory.items.length}/${INVENTORY_CAPACITY}`);
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
        this.skillStatusText.setText(this.getSkillCooldownSummary());
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

                    const lockToggle = this.add.text(cx + 5, cy + 4, '锁', {
                        fontSize: '10px',
                        color: item.locked ? '#f1c40f' : '#6f7580',
                        fontStyle: 'bold',
                    }).setDepth(206).setInteractive({ useHandCursor: true });
                    lockToggle.on('pointerdown', () => {
                        const locked = toggleItemLock(this.inventory, item.item.id);
                        if (locked !== null) {
                            this.log(`${locked ? '锁定' : '解锁'} ${item.item.name}`);
                        }
                        this.openInventoryPanel();
                    });
                    elements.push(lockToggle);


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
                            } else {
                                this.log(`${item.item.name} 已锁定，无法拆解`);
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

        const unequippableBtn = this.add.text(130, dy, '[拆不可用]', {
            fontSize: '12px',
            color: canDismantle ? '#e74c3c' : '#555555',
        }).setDepth(202).setInteractive({ useHandCursor: canDismantle });
        if (canDismantle) {
            unequippableBtn.on('pointerdown', () => {
                const result = dismantleUnequippable(this.inventory, this.character.baseClass);
                if (result.count > 0) {
                    this.log(`拆解 ${result.count} 件当前职业无法装备的装备，获得 ${result.essence} 精华`);
                } else {
                    this.log('没有当前职业无法装备的未锁定装备');
                }
                this.openInventoryPanel();
            });
        }
        elements.push(unequippableBtn);
        dy += 22;

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
        const skillBonuses = getSkillPassiveBonuses(this.character);
        return {
            hp: equipBonuses.hp + (specializationBonuses.hp ?? 0) + skillBonuses.hp,
            atk: equipBonuses.atk + buffBonuses.atk + (specializationBonuses.atk ?? 0) + skillBonuses.atk,
            def: equipBonuses.def + buffBonuses.def + (specializationBonuses.def ?? 0) + skillBonuses.def,
            attackSpeedPct: equipBonuses.attackSpeed + buffBonuses.attackSpeed + (specializationBonuses.attackSpeedPct ?? 0) + skillBonuses.attackSpeedPct,
            critRate: equipBonuses.critRate + buffBonuses.critRate + (specializationBonuses.critRate ?? 0) + skillBonuses.critRate,
            critDamage: equipBonuses.critDamage + (specializationBonuses.critDamage ?? 0) + skillBonuses.critDamage,
            moveSpeed: equipBonuses.moveSpeed + buffBonuses.moveSpeed + (specializationBonuses.moveSpeed ?? 0) + skillBonuses.moveSpeed,
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

    // ─── 技能配置面板 ───

    private openSkillLoadoutPanel() {
        this.closeUI();
        this.isUIOpen = true;

        const elements: Phaser.GameObjects.GameObject[] = [];
        const classDef = BASE_CLASS_CONFIG[this.character.baseClass];
        const specializationDef = getSpecializationDef(this.character.baseClass, this.character.specialization);

        const bg = this.add.rectangle(0, 0, DUNGEON_WIDTH, DUNGEON_HEIGHT + HUD_HEIGHT, 0x000000, 0.72).setOrigin(0).setDepth(200).setInteractive();
        elements.push(bg);

        const panelBg = this.add.rectangle(120, 58, 784, 632, 0x1a1a2e).setOrigin(0).setDepth(201).setStrokeStyle(2, 0x4a4a6a);
        elements.push(panelBg);

        const title = addBoundedText(this, {
            x: 512,
            y: 82,
            content: `${classDef.label} 技能配置`,
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
            y: 116,
            content: `全自动释放 · ${specializationDef ? `当前专精：${specializationDef.label}` : '未转职'}`,
            width: 460,
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
        const closeBtn = this.add.text(870, 74, '[X]', { fontSize: '18px', color: '#e74c3c' }).setDepth(202).setInteractive();
        closeBtn.on('pointerdown', () => this.closeUI());
        elements.push(title, subtitle, closeBtn);

        const slots: SkillSlotType[] = ['basicActive', 'specializationActive', 'passive1', 'passive2', 'trigger'];
        const slotTitle = this.add.text(156, 154, '当前搭配', { fontSize: '16px', color: '#f1c40f', fontStyle: 'bold' }).setDepth(202);
        elements.push(slotTitle);

        let y = 188;
        for (const slot of slots) {
            const skill = getEquippedSkillForSlot(this.character, slot);
            const skillLevel = skill ? getSkillProgress(this.character, skill.id).level : 0;
            const slotBg = this.add.rectangle(150, y - 8, 300, 52, 0x17283a).setOrigin(0).setDepth(202).setStrokeStyle(1, 0x34495e);
            const slotLabel = this.add.text(166, y, this.skillSlotLabel(slot), { fontSize: '12px', color: '#95a5a6' }).setDepth(203);
            const skillLabel = addBoundedText(this, {
                x: 260,
                y,
                content: skill ? `${skill.label} (Lv${skillLevel})` : '未装备',
                width: 168,
                height: 18,
                minFontSize: 10,
                maxLines: 1,
                style: {
                    fontSize: '13px',
                    color: skill ? '#ffffff' : '#66707d',
                    fontStyle: skill ? 'bold' : 'normal',
                },
            }).setDepth(203);
            const desc = addBoundedText(this, {
                x: 166,
                y: y + 22,
                content: skill ? `${this.skillTypeLabel(skill)} · ${this.skillConditionSummary(skill)} · ${this.skillEffectSummary(skill)} · ${skillTagsSummary(skill)}` : '从右侧已解锁技能中选择装备',
                width: 260,
                height: 18,
                minFontSize: 9,
                maxLines: 1,
                style: {
                    fontSize: '10px',
                    color: '#bdc3c7',
                },
            }).setDepth(203);
            elements.push(slotBg, slotLabel, skillLabel, desc);
            y += 64;
        }

        const poolTitle = this.add.text(486, 154, '技能池', { fontSize: '16px', color: '#f1c40f', fontStyle: 'bold' }).setDepth(202);
        elements.push(poolTitle);

        const relevantSkills = CLASS_SKILLS
            .filter((skill) => skill.requiredClass === this.character.baseClass)
            .filter((skill) => skill.requiredSpecialization === undefined || skill.requiredSpecialization === this.character.specialization)
            .sort((a, b) => a.unlockLevel - b.unlockLevel || b.priority - a.priority || a.label.localeCompare(b.label));

        let skillY = 188;
        for (const skill of relevantSkills) {
            const unlocked = isSkillUnlocked(this.character, skill);
            const compatibleSlots = slots.filter((slot) => canEquipSkill(this.character, skill, slot));
            const card = this.add.rectangle(482, skillY - 8, 374, 56, unlocked ? 0x14253a : 0x222834).setOrigin(0).setDepth(202).setStrokeStyle(1, unlocked ? 0x3c6382 : 0x4a5362);
            const name = addBoundedText(this, {
                x: 498,
                y: skillY,
                content: `${skill.label} · ${this.skillTypeLabel(skill)}`,
                width: 210,
                height: 18,
                minFontSize: 11,
                maxLines: 1,
                style: {
                    fontSize: '13px',
                    color: unlocked ? '#ffffff' : '#7f8c8d',
                    fontStyle: 'bold',
                },
            }).setDepth(203);
            const detail = addBoundedText(this, {
                x: 498,
                y: skillY + 22,
                content: unlocked ? `${this.skillConditionSummary(skill)} · ${this.skillEffectSummary(skill)} · ${skillTagsSummary(skill)}` : this.skillLockedReason(skill),
                width: 218,
                height: 18,
                minFontSize: 9,
                maxLines: 1,
                style: {
                    fontSize: '10px',
                    color: unlocked ? '#bdc3c7' : '#95a5a6',
                },
            }).setDepth(203);
            elements.push(card, name, detail);

            compatibleSlots.slice(0, 2).forEach((slot, index) => {
                const btnX = 736 + index * 58;
                const btn = this.add.text(btnX, skillY + 12, `[${this.shortSkillSlotLabel(slot)}]`, {
                    fontSize: '11px',
                    color: unlocked ? '#3498db' : '#555555',
                }).setDepth(203).setInteractive({ useHandCursor: unlocked });
                if (unlocked) {
                    btn.on('pointerdown', () => {
                        if (equipSkill(this.character, skill.id, slot)) {
                            this.log(`装备技能：${skill.label}`);
                            this.openSkillLoadoutPanel();
                        }
                    });
                }
                elements.push(btn);
            });

            skillY += 64;
        }

        const panelRect: PanelRect = { x: 120, y: 58, width: 784, height: 632 };
        this.createManagedPanel(elements, panelRect, panelBg);
    }

    private skillSlotLabel(slot: SkillSlotType): string {
        const labels: Record<SkillSlotType, string> = {
            basicActive: '基础主动',
            specializationActive: '专精主动',
            passive1: '被动 1',
            passive2: '被动 2',
            trigger: '触发技能',
        };
        return labels[slot];
    }

    private shortSkillSlotLabel(slot: SkillSlotType): string {
        const labels: Record<SkillSlotType, string> = {
            basicActive: '基础',
            specializationActive: '专精',
            passive1: '被动1',
            passive2: '被动2',
            trigger: '触发',
        };
        return labels[slot];
    }

    private skillTypeLabel(skill: SkillDefinition): string {
        if (skill.type === 'active') return '主动';
        if (skill.type === 'passive') return '被动';
        return '触发';
    }

    private skillConditionSummary(skill: SkillDefinition): string {
        return skillConditionSummary(skill);
    }

    private skillEffectSummary(skill: SkillDefinition): string {
        if (skill.type === 'passive') {
            return skill.effects
                .filter((effect) => effect.type === 'passiveStat')
                .map((effect) => `${this.passiveStatLabel(effect.stat)}+${effect.value}${effect.stat === 'critRate' || effect.stat === 'critDamage' || effect.stat === 'attackSpeedPct' ? '%' : ''}`)
                .join(' / ');
        }

        const skillLevel = getSkillProgress(this.character, skill.id).level;
        const effectiveDamage = skill.damageMultiplier * getEffectiveSkillDamageMultiplier(skill, this.affixEffects, skillLevel);
        const effectiveCooldown = getEffectiveSkillCooldownMs(skill, this.affixEffects, skillLevel);
        const critRateBonusWithLevel = getSkillCritRateBonusWithLevel(skill, skillLevel);
        const critDamageBonusWithLevel = getSkillCritDamageBonusWithLevel(skill, skillLevel);
        const parts = [`Lv${skillLevel}`, `伤害${Math.round(effectiveDamage * 100)}%`, `冷却${(effectiveCooldown / 1000).toFixed(1)}s`];
        if (critRateBonusWithLevel > 0) parts.push(`暴击+${Math.round(critRateBonusWithLevel * 100) / 100}%`);
        if (critDamageBonusWithLevel > 0) parts.push(`暴伤+${critDamageBonusWithLevel}%`);
        const effectiveHealRatio = getEffectiveSkillHealRatio(skill, this.affixEffects, skillLevel);
        if (effectiveHealRatio > 0) parts.push(`回血${Math.round(effectiveHealRatio * 100)}%`);
        for (const effect of skill.effects) {
            if (effect.type === 'buff') {
                parts.push(`${this.skillBuffStatLabel(effect.stat)}+${effect.value}%`);
            }
        }
        return parts.join(' / ');
    }

    private passiveStatLabel(stat: string): string {
        const labels: Record<string, string> = {
            atk: '攻击',
            def: '防御',
            maxHp: '生命',
            attackSpeedPct: '攻速',
            critRate: '暴击',
            critDamage: '暴伤',
            moveSpeed: '移速',
        };
        return labels[stat] ?? stat;
    }

    private skillLockedReason(skill: SkillDefinition): string {
        if (this.character.level < skill.unlockLevel) {
            return `Lv.${skill.unlockLevel} 解锁`;
        }
        if (skill.requiredSpecialization && skill.requiredSpecialization !== this.character.specialization) {
            const spec = getSpecializationDef(skill.requiredClass, skill.requiredSpecialization);
            return `${spec?.label ?? '对应专精'} 解锁`;
        }
        return '当前不可装备';
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

    private openCharacterPanel() {
        this.closeUI();
        this.isUIOpen = true;

        const elements: Phaser.GameObjects.GameObject[] = [];

        const bg = this.add.rectangle(0, 0, DUNGEON_WIDTH, DUNGEON_HEIGHT + HUD_HEIGHT, 0x000000, 0.7).setOrigin(0).setDepth(200).setInteractive();
        elements.push(bg);

        const panelBg = this.add.rectangle(120, 70, 784, 610, 0x1a1a2e).setOrigin(0).setDepth(201).setStrokeStyle(2, 0x4a4a6a);
        elements.push(panelBg);

        const title = this.add.text(512, 96, `\u89d2\u8272  Lv.${this.character.level}`, { fontSize: '22px', color: '#ffffff' }).setOrigin(0.5).setDepth(202);
        const closeBtn = this.add.text(872, 86, '[X]', { fontSize: '18px', color: '#e74c3c' }).setDepth(202).setInteractive();
        closeBtn.on('pointerdown', () => this.closeUI());
        elements.push(title, closeBtn);

        const stats = this.getCurrentStats();
        const bonuses = calculateEquipBonuses(this.equipped);
        const classDef = BASE_CLASS_CONFIG[this.character.baseClass];
        const activeSkill = getActiveSkillForCharacter(this.character);
        const specializationDef = getSpecializationDef(this.character.baseClass, this.character.specialization);

        const divider = this.add.rectangle(512, 118, 1, 520, 0x3a3a56).setDepth(202);
        const statsSectionTitle = this.add.text(172, 136, '\u89d2\u8272\u5c5e\u6027', { fontSize: '18px', color: '#d6eaf8' }).setDepth(202);
        const equipSectionTitle = this.add.text(582, 136, '\u88c5\u5907\u680f', { fontSize: '18px', color: '#d5f5e3' }).setDepth(202);
        elements.push(divider, statsSectionTitle, equipSectionTitle);

        const classLine = addBoundedText(this, {
            x: 312,
            y: 164,
            content: `\u804c\u4e1a: ${classDef.label} \u00b7 ${this.getCombatStyleLabel(this.character.combatStyle)} | \u4e13\u7cbe: ${specializationDef?.label ?? '\u672a\u8f6c\u804c'}`,
            width: 308,
            height: 20,
            minFontSize: 11,
            maxLines: 1,
            originX: 0.5,
            style: { fontSize: '13px', color: classDef.color, align: 'center' },
        }).setDepth(202);
        elements.push(classLine);

        if (!specializationDef) {
            const unlockLine = addBoundedText(this, {
                x: 312,
                y: 186,
                content: this.character.level >= ADVANCEMENT_REQUIREMENT_LEVEL
                    ? '\u5df2\u6ee1\u8db3\u4e8c\u6b21\u8f6c\u804c\u6761\u4ef6\uff0c\u53ef\u5728\u4e3b\u57ce\u804c\u4e1a\u5bfc\u5e08\u5904\u9009\u62e9\u4e13\u7cbe'
                    : `\u4e8c\u6b21\u8f6c\u804c\u89e3\u9501\u6761\u4ef6\uff1a\u8fbe\u5230 Lv.${ADVANCEMENT_REQUIREMENT_LEVEL}\uff08\u5f53\u524d Lv.${this.character.level}\uff09`,
                width: 320,
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
                x: 312,
                y: 186,
                content: `\u88ab\u52a8: ${specializationDef.passiveName} \u00b7 ${specializationDef.passiveDescription}`,
                width: 320,
                height: 34,
                minFontSize: 10,
                maxLines: 2,
                originX: 0.5,
                style: { fontSize: '11px', color: '#e6cc80', align: 'center' },
            }).setDepth(202);
            elements.push(passiveLine);
        }

        if (activeSkill) {
            const skillLine = addBoundedText(this, {
                x: 312,
                y: 213,
                content: `\u804c\u4e1a\u6280\u80fd: ${activeSkill.label} \u00b7 CD ${(activeSkill.cooldownMs / 1000).toFixed(1)}s`,
                width: 320,
                height: 20,
                minFontSize: 10,
                maxLines: 1,
                originX: 0.5,
                style: { fontSize: '11px', color: '#5dade2', align: 'center' },
            }).setDepth(202);
            elements.push(skillLine);
        }

        const statLines = [
            { label: 'HP', value: `${this.character.baseStats.hp}/${stats.maxHp}`, bonus: bonuses.hp, unit: '' },
            { label: 'ATK', value: `${stats.atk}`, bonus: bonuses.atk, unit: '' },
            { label: 'DEF', value: `${stats.def}`, bonus: bonuses.def, unit: '' },
            { label: '\u653b\u901f', value: `${stats.attackSpeed.toFixed(2)}`, bonus: bonuses.attackSpeed, unit: '%' },
            { label: '\u66b4\u51fb\u7387', value: `${stats.critRate.toFixed(1)}%`, bonus: bonuses.critRate, unit: '%' },
            { label: '\u66b4\u51fb\u4f24\u5bb3', value: `${stats.critDamage.toFixed(0)}%`, bonus: bonuses.critDamage, unit: '%' },
            { label: '\u79fb\u901f', value: `${stats.moveSpeed}`, bonus: bonuses.moveSpeed, unit: '' },
        ];

        let sy = activeSkill ? 246 : specializationDef ? 220 : 212;
        for (const s of statLines) {
            const label = this.add.text(158, sy, s.label, { fontSize: '14px', color: '#bdc3c7' }).setDepth(202);
            const value = this.add.text(258, sy, s.value, { fontSize: '14px', color: '#ffffff' }).setDepth(202);
            const bonusText = s.bonus > 0 ? `(+${s.bonus}${s.unit})` : '';
            const bonus = this.add.text(378, sy, bonusText, { fontSize: '12px', color: '#2ecc71' }).setDepth(202);
            elements.push(label, value, bonus);
            sy += 28;
        }

        sy += 20;
        const effectTitle = this.add.text(158, sy, '\u8bcd\u6761\u6548\u679c:', { fontSize: '14px', color: '#f39c12' }).setDepth(202);
        elements.push(effectTitle);
        sy += 25;

        const effectLines = [
            { label: '\u7a7f\u900f', value: this.affixEffects.penetration, unit: '%' },
            { label: '\u5438\u8840', value: this.affixEffects.lifeSteal, unit: '%' },
            { label: 'HP\u56de\u590d', value: this.affixEffects.hpRegen, unit: '/s' },
            { label: '\u4f24\u5bb3\u51cf\u514d', value: this.affixEffects.damageReduction, unit: '%' },
            { label: '\u95ea\u907f', value: this.affixEffects.evasion, unit: '%' },
            { label: '\u8fde\u51fb\u7387', value: this.affixEffects.comboChance, unit: '%' },
            { label: '\u65cb\u98ce\u65a9\u7387', value: this.affixEffects.whirlwindChance, unit: '%' },
            { label: '\u590d\u6d3b\u7387', value: this.affixEffects.rebirthChance, unit: '%' },
            { label: '\u63a0\u593a\u8005\u7387', value: this.affixEffects.predatorChance, unit: '%' },
            { label: '\u6280\u80fd\u4f24\u5bb3', value: this.affixEffects.skillDamageBonus, unit: '%' },
            { label: '\u4e3b\u52a8\u51b7\u5374', value: this.affixEffects.activeCooldownReduction, unit: '%' },
            { label: '\u89e6\u53d1\u51b7\u5374', value: this.affixEffects.triggerCooldownReduction, unit: '%' },
            { label: '\u6280\u80fd\u6cbb\u7597', value: this.affixEffects.healingSkillPower, unit: '%' },
            { label: '\u5143\u7d20\u6280\u80fd', value: this.affixEffects.elementalSkillDamageBonus, unit: '%' },
        ];

        for (const e of effectLines) {
            if (e.value <= 0) continue;
            const text = this.add.text(168, sy, `${e.label}: ${e.value}${e.unit}`, { fontSize: '12px', color: '#e6cc80' }).setDepth(202);
            elements.push(text);
            sy += 20;
        }

        if (this.character.statPoints > 0) {
            sy += 20;
            const ptsTitle = this.add.text(158, sy, `\u53ef\u5206\u914d\u5c5e\u6027\u70b9: ${this.character.statPoints}`, { fontSize: '14px', color: '#9b59b6' }).setDepth(202);
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
                const btn = this.add.text(168, sy, `[+${s.label}]`, { fontSize: '13px', color: '#3498db' }).setDepth(202).setInteractive();
                btn.on('pointerdown', () => {
                    allocateStatPoint(this.character, s.key);
                    this.affixEffects = collectAffixEffects(this.equipped);
                    this.openCharacterPanel();
                });
                elements.push(btn);
                sy += 24;
            }
        }

        const equipmentPanel = this.add.rectangle(706, 388, 332, 468, 0x141423, 0.75).setDepth(202).setStrokeStyle(1, 0x384b5a);
        elements.push(equipmentPanel);

        const layout: { slot: EquipSlot; label: string; x: number; y: number }[] = [
            { slot: 'helmet', label: '\u5934\u76d4', x: 620, y: 186 },
            { slot: 'necklace', label: '\u9879\u94fe', x: 792, y: 186 },
            { slot: 'armor', label: '\u62a4\u7532', x: 620, y: 262 },
            { slot: 'weapon', label: '\u6b66\u5668', x: 792, y: 262 },
            { slot: 'gloves', label: '\u624b\u5957', x: 620, y: 338 },
            { slot: 'ring1', label: '\u6212\u63071', x: 792, y: 338 },
            { slot: 'belt', label: '\u8170\u5e26', x: 620, y: 414 },
            { slot: 'ring2', label: '\u6212\u63072', x: 792, y: 414 },
            { slot: 'legs', label: '\u62a4\u817f', x: 620, y: 490 },
            { slot: 'boots', label: '\u9774\u5b50', x: 792, y: 490 },
        ];

        for (const item of layout) {
            const eq = getEquipped(this.equipped, item.slot);
            const box = this.add.rectangle(item.x, item.y, 140, 56, eq ? 0x243828 : 0x232338)
                .setDepth(203)
                .setStrokeStyle(1, eq ? 0x4a8a4a : 0x4a4a6a)
                .setInteractive();
            const label = this.add.text(item.x, item.y - 13, item.label, { fontSize: '10px', color: '#95a5a6' }).setOrigin(0.5).setDepth(204);
            const value = this.add.text(item.x, item.y + 8, eq ? eq.name : '\u672a\u88c5\u5907', {
                fontSize: '10px',
                color: eq ? RARITY_CONFIG[eq.rarity].color : '#6b7280',
                align: 'center',
                wordWrap: { width: 126 },
            }).setOrigin(0.5).setDepth(204);
            elements.push(box, label, value);

            if (eq) {
                box.on('pointerdown', () => this.onEquippedItemClick(item.slot));
                box.on('pointerover', () => this.showTooltip(eq, item.x + 84, item.y - 34));
                box.on('pointerout', () => this.hideTooltip());
            }
        }

        const equipBonusTitle = this.add.text(548, 572, '\u88c5\u5907\u603b\u52a0\u6210', { fontSize: '13px', color: '#2ecc71' }).setDepth(203);
        const equipBonusText = addBoundedText(this, {
            x: 706,
            y: 602,
            content: `ATK +${bonuses.atk}  DEF +${bonuses.def}  HP +${bonuses.hp}  AS +${bonuses.attackSpeed}%  CR +${bonuses.critRate}%  CD +${bonuses.critDamage}%  MS +${bonuses.moveSpeed}`,
            width: 300,
            height: 40,
            minFontSize: 10,
            maxLines: 2,
            originX: 0.5,
            style: { fontSize: '11px', color: '#2ecc71', align: 'center' },
        }).setDepth(203);
        elements.push(equipBonusTitle, equipBonusText);

        const panelRect: PanelRect = { x: 120, y: 70, width: 784, height: 610 };
        this.createManagedPanel(elements, panelRect, panelBg);
    }

    private openMonsterCodexPanel() {
        this.closeUI();
        this.isUIOpen = true;

        const elements: Phaser.GameObjects.GameObject[] = [];
        const entries = Object.values(this.monsterCodex).sort((a, b) => b.killCount - a.killCount || a.name.localeCompare(b.name, 'zh-Hans-CN'));

        const bg = this.add.rectangle(0, 0, DUNGEON_WIDTH, DUNGEON_HEIGHT + HUD_HEIGHT, 0x000000, 0.72).setOrigin(0).setDepth(200).setInteractive();
        elements.push(bg);

        const panelBg = this.add.rectangle(180, 70, 664, 610, 0x111827).setOrigin(0).setDepth(201).setStrokeStyle(2, 0x5dade2);
        elements.push(panelBg);

        const title = this.add.text(512, 96, '怪物图鉴', { fontSize: '22px', color: '#d6eaf8', fontStyle: 'bold' }).setOrigin(0.5).setDepth(202);
        const subtitle = this.add.text(512, 122, `已解锁 ${entries.length} 种怪物`, { fontSize: '12px', color: '#95a5a6' }).setOrigin(0.5).setDepth(202);
        const closeBtn = this.add.text(820, 82, '[X]', { fontSize: '18px', color: '#e74c3c' }).setDepth(202).setInteractive();
        closeBtn.on('pointerdown', () => this.closeUI());
        elements.push(title, subtitle, closeBtn);

        if (entries.length === 0) {
            const emptyText = this.add.text(512, 360, '尚未记录任何怪物\n进入地牢并击败敌人后将自动解锁图鉴。', {
                fontSize: '16px',
                color: '#7f8c8d',
                align: 'center',
                lineSpacing: 10,
            }).setOrigin(0.5).setDepth(202);
            elements.push(emptyText);
            this.createManagedPanel(elements, { x: 180, y: 70, width: 664, height: 610 }, panelBg);
            return;
        }

        const visibleEntries = entries.slice(0, 10);
        visibleEntries.forEach((entry, index) => {
            const y = 160 + index * 44;
            const row = this.add.rectangle(512, y, 620, 38, index % 2 === 0 ? 0x162234 : 0x12202f, 0.95).setDepth(202);
            const name = this.add.text(220, y - 10, entry.name, { fontSize: '14px', color: '#ffffff', fontStyle: 'bold' }).setDepth(203);
            const meta = this.add.text(
                220,
                y + 8,
                `${entry.type.toUpperCase()} · ${this.getCombatStyleLabel(entry.combatStyle)} · 击败 ${entry.killCount} 次`,
                { fontSize: '11px', color: '#5dade2' },
            ).setDepth(203);
            const desc = addBoundedText(this, {
                x: 470,
                y: y - 12,
                content: entry.description,
                width: 330,
                height: 26,
                minFontSize: 10,
                maxLines: 2,
                lineSpacing: 4,
                style: {
                    fontSize: '11px',
                    color: '#bdc3c7',
                },
            }).setDepth(203);
            elements.push(row, name, meta, desc);
        });

        if (entries.length > visibleEntries.length) {
            const overflow = this.add.text(512, 620, `其余 ${entries.length - visibleEntries.length} 种怪物将在后续图鉴翻页中展示`, {
                fontSize: '11px',
                color: '#7f8c8d',
            }).setOrigin(0.5).setDepth(202);
            elements.push(overflow);
        }

        this.createManagedPanel(elements, { x: 180, y: 70, width: 664, height: 610 }, panelBg);
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

    private isCurrentFloorCleared(): boolean {
        return canProceedToNextFloor(this.dungeon) && this.monsterSprites.size === 0;
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
        if (!this.isCurrentFloorCleared()) {
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
            this.log(`当前未满足转职前置等级，需达到 Lv.${ADVANCEMENT_REQUIREMENT_LEVEL}`);
            return;
        }
        if (!canAdvanceAnySpecialization(this.character, this.getAdvancementContext())) {
            this.log('当前尚未满足任一专精的转职任务条件');
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
            const requirements = getSpecializationRequirementProgress(this.character, spec.id, this.getAdvancementContext());
            const unlocked = canUnlockSpecialization(this.character, spec.id, this.getAdvancementContext());
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
                height: 70,
                minFontSize: 10,
                lineSpacing: 6,
                maxLines: 4,
                style: {
                    fontSize: '12px',
                    color: '#2ecc71',
                },
            }).setDepth(203);
            const requirementText = addBoundedText(this, {
                x: x + 14,
                y: y + 332,
                content: requirements.map((item) => `${item.met ? '✓' : '•'} ${item.label} (${Math.min(item.current, item.target)}/${item.target})`).join('\n'),
                width: 162,
                height: 42,
                minFontSize: 9,
                lineSpacing: 4,
                maxLines: 3,
                style: {
                    fontSize: '10px',
                    color: unlocked ? '#d5f5e3' : '#f5cba7',
                },
            }).setDepth(203);
            const chooseBtn = this.add.rectangle(x + 95, y + 386, 146, 40, unlocked ? 0x20435f : 0x3c4350).setDepth(203).setStrokeStyle(2, unlocked ? parseInt(classDef.color.replace('#', ''), 16) : 0x66707d).setInteractive({ useHandCursor: unlocked });
            const chooseText = this.add.text(x + 95, y + 386, unlocked ? '确认转职' : '条件未达成', {
                fontSize: '16px',
                color: unlocked ? '#ffffff' : '#bdc3c7',
                fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(204);
            if (unlocked) {
                chooseBtn.on('pointerover', () => chooseBtn.setFillStyle(0x2a587c));
                chooseBtn.on('pointerout', () => chooseBtn.setFillStyle(0x20435f));
                chooseBtn.on('pointerdown', () => this.confirmSpecialization(spec.id));
            }
            elements.push(card, name, desc, passiveName, passiveDesc, bonusTitle, bonusText, requirementText, chooseBtn, chooseText);
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
        const canAdvance = canAdvanceAnySpecialization(this.character, this.getAdvancementContext());

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
                    : '当前状态：转职任务未完成',
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
                content: `达到 Lv.${ADVANCEMENT_REQUIREMENT_LEVEL} 后，还需满足各专精对应的楼层与击杀条件，才能完成二次转职。`,
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
                content: `当前等级：Lv.${this.character.level} / ${ADVANCEMENT_REQUIREMENT_LEVEL}  ·  当前楼层：${this.dungeon.currentFloor}`,
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
                content: canAdvance ? '已有至少一条专精路线满足条件，关闭该窗口后点击“职业导师”即可选择专精。' : '继续挑战地牢、提升等级并完成目标怪物击杀，满足条件后将自动开放转职。',
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
        if (!chooseSpecialization(this.character, specialization, this.getAdvancementContext())) {
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
        this.monsterCodex = {};
        this.skillCooldowns = {};
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

    private addConsumableReward(type: ConsumableType, count = 1) {
        const def = CONSUMABLE_DEFS[type];
        let remaining = count;

        while (remaining > 0) {
            const existing = this.consumables.find(c => c.type === type && c.count < def.maxStack);
            if (existing) {
                const addCount = Math.min(remaining, def.maxStack - existing.count);
                existing.count += addCount;
                remaining -= addCount;
            } else {
                const addCount = Math.min(remaining, def.maxStack);
                this.consumables.push(createConsumable(type, addCount));
                remaining -= addCount;
            }
        }

        this.dungeonRunSummary.gainedConsumables.set(def.name, (this.dungeonRunSummary.gainedConsumables.get(def.name) ?? 0) + count);
    }

    private rollPotionDrop(monster: Monster) {
        const dropChance = monster.type === 'boss' ? 100 : monster.type === 'rare' ? 40 : monster.type === 'elite' ? 25 : 15;
        if (Math.random() * 100 >= dropChance) return;

        // 根据怪物类型和层数决定药水品质
        const floor = this.dungeon.currentFloor;
        const potionTypes: { type: ConsumableType; weight: number }[] = [];

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

        const def = CONSUMABLE_DEFS[selectedType];
        this.addConsumableReward(selectedType);
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

        const activeConsumables = this.consumables.filter(consumable => consumable.count > 0);
        const title = this.add.text(512, 100, `消耗品 (${activeConsumables.length})`, { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5).setDepth(202);
        elements.push(title);

        const closeBtn = this.add.text(740, 90, '[X]', { fontSize: '18px', color: '#e74c3c' }).setDepth(202).setInteractive();
        closeBtn.on('pointerdown', () => this.closeUI());
        elements.push(closeBtn);

        const activeBuffSummary = this.activeBuffs.length > 0
            ? this.activeBuffs.map((buff) => {
                const remain = Math.max(0, Math.ceil((buff.endTime - Date.now()) / 1000));
                return `${buff.name} ${remain}s`;
            }).join('  ')
            : '无活跃增益';
        const buffText = this.add.text(512, 124, `增益: ${activeBuffSummary}`, {
            fontSize: '12px',
            color: this.activeBuffs.length > 0 ? '#e6cc80' : '#95a5a6',
        }).setOrigin(0.5).setDepth(202);
        elements.push(buffText);

        const listX = 280;
        const listY = 145;
        const listWidth = 464;
        const listHeight = 488;
        const rowHeight = 48;
        const visibleRows = Math.floor(listHeight / rowHeight);
        let maxScrollIndex = Math.max(0, activeConsumables.length - visibleRows);
        this.consumableScrollIndex = PhaserMath.Clamp(this.consumableScrollIndex, 0, maxScrollIndex);

        const listBg = this.add.rectangle(listX, listY, listWidth, listHeight, 0x12121f, 0.65).setOrigin(0).setDepth(202).setStrokeStyle(1, 0x30304c);
        elements.push(listBg);

        const listHitArea = this.add.rectangle(listX, listY, listWidth, listHeight, 0x000000, 0.01).setOrigin(0).setDepth(202).setInteractive();
        elements.push(listHitArea);

        const empty = this.add.text(512, listY + listHeight / 2, '暂无消耗品', { fontSize: '14px', color: '#95a5a6' }).setOrigin(0.5).setDepth(205);
        elements.push(empty);

        const categoryColors: Record<string, number> = { potion: 0x2ecc71, scroll: 0x3498db, elixir: 0x9b59b6 };
        const rowConsumables: Array<Consumable | null> = [];
        const rows = Array.from({ length: visibleRows }, (_, rowIndex) => {
            const cy = listY + rowIndex * rowHeight;
            const rowBg = this.add.rectangle(listX, cy, listWidth, 40, 0x2a2a3e).setOrigin(0).setDepth(203).setStrokeStyle(1, 0x4a4a6a);
            const dot = this.add.rectangle(295, cy + 10, 8, 8, 0xffffff).setDepth(205);
            const nameText = this.add.text(310, cy + 5, '', { fontSize: '13px', color: '#ffffff' }).setDepth(205);
            const descText = this.add.text(310, cy + 22, '', { fontSize: '10px', color: '#95a5a6' }).setDepth(205);
            const useBtn = this.add.text(700, cy + 10, '[使用]', { fontSize: '12px', color: '#3498db' }).setDepth(206).setInteractive();
            useBtn.on('pointerdown', () => {
                const cons = rowConsumables[rowIndex];
                if (!cons) return;

                const result = useConsumable(cons, this.character, this.activeBuffs, Date.now(), this.getCurrentStatBonuses());
                this.log(result.message);
                if (result.success) {
                    this.consumables = this.consumables.filter(c => c.count > 0);
                }
                this.openConsumablePanel();
            });
            elements.push(rowBg, dot, nameText, descText, useBtn);
            return { rowBg, dot, nameText, descText, useBtn };
        });

        const scrollTrackX = 754;
        const scrollTrackTop = listY + 28;
        const scrollTrackHeight = listHeight - 56;
        const scrollTrack = this.add.rectangle(scrollTrackX, scrollTrackTop + scrollTrackHeight / 2, 8, scrollTrackHeight, 0x30304c).setDepth(205).setInteractive();
        const scrollThumb = this.add.rectangle(scrollTrackX, scrollTrackTop, 14, 36, 0x74b9ff, 0.8).setDepth(206).setInteractive({ useHandCursor: true });
        const upBtn = this.add.text(scrollTrackX, listY + 2, '▲', { fontSize: '16px', color: '#555555' }).setOrigin(0.5, 0).setDepth(205).setInteractive();
        const downBtn = this.add.text(scrollTrackX, listY + listHeight - 20, '▼', { fontSize: '16px', color: '#555555' }).setOrigin(0.5, 0).setDepth(205).setInteractive();
        const pageText = this.add.text(700, listY + listHeight + 4, '', { fontSize: '11px', color: '#95a5a6' }).setOrigin(1, 0).setDepth(205);
        elements.push(scrollTrack, scrollThumb, upBtn, downBtn, pageText);

        const renderConsumableRows = (): void => {
            maxScrollIndex = Math.max(0, activeConsumables.length - visibleRows);
            this.consumableScrollIndex = PhaserMath.Clamp(this.consumableScrollIndex, 0, maxScrollIndex);
            empty.setVisible(activeConsumables.length === 0);

            const hasScroll = maxScrollIndex > 0;
            scrollTrack.setVisible(hasScroll);
            scrollThumb.setVisible(hasScroll);
            upBtn.setVisible(hasScroll);
            downBtn.setVisible(hasScroll);
            pageText.setVisible(hasScroll);

            rows.forEach((row, rowIndex) => {
                const cons = activeConsumables[this.consumableScrollIndex + rowIndex] ?? null;
                rowConsumables[rowIndex] = cons;
                const visible = cons !== null;
                row.rowBg.setVisible(visible);
                row.dot.setVisible(visible);
                row.nameText.setVisible(visible);
                row.descText.setVisible(visible);
                row.useBtn.setVisible(visible);
                if (!cons) return;

                const def = CONSUMABLE_DEFS[cons.type];
                row.dot.setFillStyle(categoryColors[def.category] ?? 0xffffff);
                row.nameText.setText(`${def.name} x${cons.count}`);
                row.descText.setText(def.description);
            });

            if (!hasScroll) return;

            const thumbHeight = Math.max(36, (visibleRows / activeConsumables.length) * scrollTrackHeight);
            const thumbTravel = scrollTrackHeight - thumbHeight;
            const visibleCount = rows.filter((_, rowIndex) => rowConsumables[rowIndex] !== null).length;
            scrollThumb.height = thumbHeight;
            scrollThumb.y = scrollTrackTop + thumbHeight / 2 + (this.consumableScrollIndex / maxScrollIndex) * thumbTravel;
            upBtn.setColor(this.consumableScrollIndex > 0 ? '#74b9ff' : '#555555');
            downBtn.setColor(this.consumableScrollIndex < maxScrollIndex ? '#74b9ff' : '#555555');
            pageText.setText(`${this.consumableScrollIndex + 1}-${this.consumableScrollIndex + visibleCount}/${activeConsumables.length}`);
        };

        const updateConsumableScrollIndex = (index: number): void => {
            const nextIndex = PhaserMath.Clamp(Math.round(index), 0, Math.max(0, maxScrollIndex));
            if (nextIndex === this.consumableScrollIndex) return;
            this.consumableScrollIndex = nextIndex;
            renderConsumableRows();
        };

        listHitArea.on('wheel', (_pointer: Phaser.Input.Pointer, _deltaX: number, deltaY: number) => {
            if (maxScrollIndex <= 0) return;
            updateConsumableScrollIndex(this.consumableScrollIndex + (deltaY > 0 ? 1 : -1));
        });

        upBtn.on('pointerdown', () => updateConsumableScrollIndex(this.consumableScrollIndex - 1));
        downBtn.on('pointerdown', () => updateConsumableScrollIndex(this.consumableScrollIndex + 1));
        scrollTrack.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (maxScrollIndex <= 0) return;
            const trackBounds = scrollTrack.getBounds();
            const ratio = PhaserMath.Clamp((pointer.worldY - trackBounds.top) / trackBounds.height, 0, 1);
            updateConsumableScrollIndex(ratio * maxScrollIndex);
        });
        scrollThumb.on('dragstart', () => {
            scrollThumb.setFillStyle(0x9ac3e8, 0.95);
        });
        scrollThumb.on('drag', (pointer: Phaser.Input.Pointer) => {
            if (maxScrollIndex <= 0) return;
            const thumbHeight = scrollThumb.height;
            const minY = scrollTrackTop + thumbHeight / 2;
            const maxY = scrollTrackTop + scrollTrackHeight - thumbHeight / 2;
            const deltaY = pointer.worldY - pointer.prevPosition.y;
            scrollThumb.y = PhaserMath.Clamp(scrollThumb.y + deltaY, minY, maxY);

            const thumbTravel = Math.max(1, scrollTrackHeight - thumbHeight);
            const ratio = PhaserMath.Clamp((scrollThumb.y - scrollTrackTop - thumbHeight / 2) / thumbTravel, 0, 1);
            updateConsumableScrollIndex(ratio * maxScrollIndex);
        });
        scrollThumb.on('dragend', () => {
            scrollThumb.setFillStyle(0x74b9ff, 0.8);
        });
        this.input.setDraggable(scrollThumb, true);
        renderConsumableRows();

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

        // 能力商店区
        cy += 20;
        const abilityTitle = this.add.text(230, cy, '能力商店:', { fontSize: '15px', color: '#9b59b6' }).setDepth(202);
        elements.push(abilityTitle);
        cy += 30;

        for (const item of MERCHANT_ITEMS) {
            const owned = this.character.purchasedAbilities.includes(item.id);
            const canBuy = !owned && this.character.gold >= item.price;

            const rowBg = this.add.rectangle(230, cy, 564, 45, 0x2a2a3e).setOrigin(0).setDepth(202).setStrokeStyle(1, 0x4a4a6a);
            elements.push(rowBg);

            const dot = this.add.rectangle(245, cy + 12, 8, 8, 0x9b59b6).setDepth(203);
            elements.push(dot);

            const nameText = this.add.text(260, cy + 5, item.label, { fontSize: '13px', color: '#ffffff' }).setDepth(203);
            elements.push(nameText);

            const descText = this.add.text(260, cy + 24, item.description, { fontSize: '10px', color: '#95a5a6' }).setDepth(203);
            elements.push(descText);

            const statusText = this.add.text(630, cy + 5, owned ? '已拥有' : `${item.price}G`, { fontSize: '11px', color: owned ? '#2ecc71' : '#f1c40f' }).setDepth(203);
            elements.push(statusText);

            const actionBtn = this.add.text(690, cy + 10, owned ? '[已解锁]' : '[购买]', { fontSize: '12px', color: canBuy ? '#9b59b6' : '#555555' }).setDepth(203).setInteractive();
            if (canBuy) {
                actionBtn.on('pointerdown', () => {
                    this.character.gold -= item.price;
                    this.character.purchasedAbilities.push(item.id);
                    this.log(`成功购买 ${item.label}`);
                    this.openShopPanel(); // 刷新
                });
            }
            elements.push(actionBtn);

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

    private openMovementSettingsPanel() {
        if (this.gameplayPhase !== 'town') {
            this.log('请在主城内设置移动模式');
            return;
        }

        this.closeUI();
        this.isUIOpen = true;

        const elements: Phaser.GameObjects.GameObject[] = [];

        const bg = this.add.rectangle(0, 0, DUNGEON_WIDTH, DUNGEON_HEIGHT + HUD_HEIGHT, 0x000000, 0.7).setOrigin(0).setDepth(200).setInteractive();
        elements.push(bg);

        const panelBg = this.add.rectangle(300, 200, 424, 280, 0x1a1a2e).setOrigin(0).setDepth(201).setStrokeStyle(2, 0x9b59b6);
        elements.push(panelBg);

        const title = this.add.text(512, 230, '移动设置', { fontSize: '20px', color: '#9b59b6' }).setOrigin(0.5).setDepth(202);
        elements.push(title);

        const closeBtn = this.add.text(700, 215, '[X]', { fontSize: '18px', color: '#e74c3c' }).setDepth(202).setInteractive();
        closeBtn.on('pointerdown', () => this.closeUI());
        elements.push(closeBtn);

        const hasAutoMovement = this.character.purchasedAbilities.includes('auto-movement');
        const currentMode = this.character.movementMode;

        // 手动移动选项
        const manualBtnBg = this.add.rectangle(320, 290, 380, 50, currentMode === 'manual' ? 0x2ecc71 : 0x2a2a3e)
            .setOrigin(0).setDepth(202).setStrokeStyle(2, currentMode === 'manual' ? 0x27ae60 : 0x4a4a6a).setInteractive({ useHandCursor: true });
        const manualBtnText = this.add.text(510, 315, '手动移动（方向键控制）', { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5).setDepth(203);
        elements.push(manualBtnBg, manualBtnText);

        manualBtnBg.on('pointerdown', () => {
            this.character.movementMode = 'manual';
            this.log('已切换为手动移动模式');
            this.closeUI();
        });

        // 自动移动选项
        const autoBtnBg = this.add.rectangle(320, 360, 380, 50, currentMode === 'auto' ? 0x2ecc71 : 0x2a2a3e)
            .setOrigin(0).setDepth(202).setStrokeStyle(2, currentMode === 'auto' ? 0x27ae60 : 0x4a4a6a);
        const autoBtnText = this.add.text(510, 385, hasAutoMovement ? '自动移动（自动探索）' : '自动移动（未解锁）', { fontSize: '14px', color: hasAutoMovement ? '#ffffff' : '#7f8c8d' }).setOrigin(0.5).setDepth(203);
        elements.push(autoBtnBg, autoBtnText);

        if (hasAutoMovement) {
            autoBtnBg.setInteractive({ useHandCursor: true });
            autoBtnBg.on('pointerdown', () => {
                this.character.movementMode = 'auto';
                this.log('已切换为自动移动模式');
                this.closeUI();
            });
        }

        // 提示文本
        if (!hasAutoMovement) {
            const hint = this.add.text(512, 430, '提示：在商店购买"自动移动能力"后解锁', { fontSize: '12px', color: '#f39c12' }).setOrigin(0.5).setDepth(202);
            elements.push(hint);
        }

        const panelRect: PanelRect = { x: 300, y: 200, width: 424, height: 280 };
        this.createManagedPanel(elements, panelRect, panelBg);
    }
}
