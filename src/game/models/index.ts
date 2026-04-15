export type { CombatStyle, MovementStrategy, CombatStyleProfile } from './combat';
export { COMBAT_STYLE_PROFILES, getCombatStyleProfile } from './combat';

export type {
    CharacterStats,
    CharacterData,
    AllocatedStats,
    CharacterBaseClass,
    CharacterSpecialization,
    CharacterAdvancementState,
    CharacterBaseClassDef,
    CharacterSpecializationDef,
    CharacterSpecializationBonuses,
    AdvancementRequirement,
    AdvancementContext,
} from './character';
export {
    STAT_PER_POINT,
    expForLevel,
    BASE_CLASS_CONFIG,
    ADVANCEMENT_REQUIREMENT_LEVEL,
    getBaseClassDef,
    getSpecializationDef,
} from './character';

export type { EquipSlot, WearableSlot, WeaponType, Rarity, RarityDef, EquipBaseStats, EquipBaseStatsRange, Equipment } from './equipment';
export { EQUIP_SLOTS, SLOT_TO_WEARABLE, RARITY_CONFIG, WEAPON_CLASS_RESTRICTIONS, getAllowedClassesForEquipment, sellPrice } from './equipment';

export type { AffixId, AffixCategory, AffixDef, Affix } from './affix';
export { OFFENSIVE_AFFIXES, DEFENSIVE_AFFIXES, SPECIAL_AFFIXES, ALL_AFFIXES } from './affix';

export type { MonsterType, MonsterTypeDef, MonsterStats, Monster, MonsterCodexEntry, MonsterCodexData } from './monster';
export { MONSTER_TYPE_CONFIG, MONSTER_BASE_STATS, monsterStatsForFloor, MONSTER_SPAWN_WEIGHTS } from './monster';

export type { ItemType, InventoryItem, InventoryData } from './inventory';
export { INVENTORY_ROWS, INVENTORY_COLS, INVENTORY_CAPACITY } from './inventory';

export type { DungeonZone, ExploreState, DungeonState } from './dungeon';
export { DUNGEON_ZONES, getZoneForFloor } from './dungeon';

export type { ConsumableType, ConsumableCategory, ConsumableDef, Consumable, ActiveBuff } from './consumable';
export { CONSUMABLE_DEFS, POTION_HEAL_RATIO } from './consumable';
