import type { CharacterData } from '../models/character';
import type { InventoryData } from '../models/inventory';
import type { DungeonState } from '../models/dungeon';
import type { Consumable } from '../models/consumable';
import type { MonsterCodexData } from '../models/monster';
import type { EquippedItems } from './equip-system';
import { normalizeCharacterData } from './character-system';
import { normalizeDungeonState } from './dungeon-system';
import { getAllowedClassesForEquipment, getBaseClassDef, getSpecializationDef } from '../models';

const LEGACY_SAVE_KEY = 'darklike_save';
const SAVE_KEY_PREFIX = 'darklike_save_slot_';
export const MAX_SAVE_SLOTS = 20;
const AUTO_SAVE_INTERVAL = 30_000; // 30秒自动保存
let currentSaveSlot = 1;

export interface SaveData {
    version: number;
    timestamp: number;         // 保存时间戳
    character: CharacterData;
    inventory: InventoryData;
    equipped: EquippedItems;
    dungeon: DungeonState;
    monsterCodex: MonsterCodexData;
    consumables: Consumable[];
    totalPlayTime: number;     // 总游戏时长（秒）
}

const CURRENT_VERSION = 3;

export interface SaveSlotSummary {
    slotId: number;
    hasSave: boolean;
    timestamp: number | null;
    level: number | null;
    floor: number | null;
    name: string | null;
    classLabel: string | null;
}

function normalizeSlot(slotId: number): number {
    if (!Number.isFinite(slotId)) return 1;
    const intSlot = Math.floor(slotId);
    return Math.min(MAX_SAVE_SLOTS, Math.max(1, intSlot));
}

function slotKey(slotId: number): string {
    return `${SAVE_KEY_PREFIX}${String(normalizeSlot(slotId)).padStart(2, '0')}`;
}

export function setCurrentSaveSlot(slotId: number): number {
    currentSaveSlot = normalizeSlot(slotId);
    return currentSaveSlot;
}

export function getCurrentSaveSlot(): number {
    return currentSaveSlot;
}

/** 保存游戏到 LocalStorage */
export function saveGame(data: SaveData, slotId = currentSaveSlot): boolean {
    try {
        data.version = CURRENT_VERSION;
        data.timestamp = Date.now();
        const json = JSON.stringify(data);
        localStorage.setItem(slotKey(slotId), json);
        return true;
    } catch {
        console.warn('存档保存失败');
        return false;
    }
}

/** 读取存档，无存档返回 null */
export function loadGame(slotId = currentSaveSlot): SaveData | null {
    try {
        let json = localStorage.getItem(slotKey(slotId));
        if (!json && normalizeSlot(slotId) === 1) {
            json = localStorage.getItem(LEGACY_SAVE_KEY);
        }
        if (!json) return null;
        const data = JSON.parse(json) as SaveData & { version?: number };
        if ((data.version ?? 1) > CURRENT_VERSION) {
            console.warn(`存档版本不匹配: ${data.version} vs ${CURRENT_VERSION}`);
            return null;
        }
        data.version = CURRENT_VERSION;
        data.character = normalizeCharacterData(data.character);
        data.dungeon = normalizeDungeonState(data.dungeon);
        Object.values(data.equipped).forEach((equipment) => {
            if (!equipment) return;
            equipment.allowedClasses = getAllowedClassesForEquipment(equipment);
        });
        data.inventory.items.forEach((item) => {
            item.item.allowedClasses = getAllowedClassesForEquipment(item.item);
        });
        data.monsterCodex = data.monsterCodex ?? {};
        data.consumables = data.consumables ?? [];
        data.totalPlayTime = data.totalPlayTime ?? 0;
        return data;
    } catch {
        console.warn('存档读取失败');
        return null;
    }
}

/** 删除存档 */
export function deleteSave(slotId = currentSaveSlot): void {
    localStorage.removeItem(slotKey(slotId));
    if (normalizeSlot(slotId) === 1) {
        localStorage.removeItem(LEGACY_SAVE_KEY);
    }
}

/** 是否存在存档 */
export function hasSave(slotId = currentSaveSlot): boolean {
    if (localStorage.getItem(slotKey(slotId)) !== null) return true;
    return normalizeSlot(slotId) === 1 && localStorage.getItem(LEGACY_SAVE_KEY) !== null;
}

export function listSaveSlots(): SaveSlotSummary[] {
    const slots: SaveSlotSummary[] = [];
    for (let slotId = 1; slotId <= MAX_SAVE_SLOTS; slotId++) {
        const data = loadGame(slotId);
        const classLabel = data
            ? getSpecializationDef(data.character.baseClass, data.character.specialization)?.label
                ?? getBaseClassDef(data.character.baseClass).label
            : null;
        slots.push({
            slotId,
            hasSave: data !== null,
            timestamp: data?.timestamp ?? null,
            level: data?.character.level ?? null,
            floor: data?.dungeon.currentFloor ?? null,
            name: data?.character.name ?? null,
            classLabel,
        });
    }
    return slots;
}

/** 计算离线时长（毫秒） */
export function getOfflineDuration(saveData: SaveData): number {
    return Date.now() - saveData.timestamp;
}

/** 离线收益上限（24 小时） */
const OFFLINE_MAX_HOURS = 24;

/** 计算离线收益 */
export function calculateOfflineRewards(saveData: SaveData): OfflineRewards {
    const offlineMs = Math.min(getOfflineDuration(saveData), OFFLINE_MAX_HOURS * 3600_000);
    const offlineHours = offlineMs / 3600_000;
    const efficiency = 0.5; // 50% 效率

    // 基于角色等级和层数的估算收益
    const char = saveData.character;
    const floor = saveData.dungeon.currentFloor;
    const levelFactor = char.level * (1 + floor * 0.1);

    const exp = Math.floor(levelFactor * 10 * offlineHours * efficiency);
    const gold = Math.floor(levelFactor * 5 * offlineHours * efficiency);

    return {
        offlineHours: Math.round(offlineHours * 100) / 100,
        exp,
        gold,
    };
}

export interface OfflineRewards {
    offlineHours: number;
    exp: number;
    gold: number;
}

/** 自动保存管理器 */
export class AutoSaveManager {
    private timer: number | null = null;
    private getSaveData: () => SaveData;
    private totalPlayTime = 0;
    private lastTick = 0;

    constructor(getSaveData: () => SaveData) {
        this.getSaveData = getSaveData;
    }

    start() {
        this.lastTick = Date.now();
        this.timer = window.setInterval(() => {
            const now = Date.now();
            this.totalPlayTime += (now - this.lastTick) / 1000;
            this.lastTick = now;

            const data = this.getSaveData();
            data.totalPlayTime = this.totalPlayTime;
            saveGame(data);
        }, AUTO_SAVE_INTERVAL);
    }

    stop() {
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }
        // 退出时保存一次
        const now = Date.now();
        this.totalPlayTime += (now - this.lastTick) / 1000;
        const data = this.getSaveData();
        data.totalPlayTime = this.totalPlayTime;
        saveGame(data);
    }

    setPlayTime(seconds: number) {
        this.totalPlayTime = seconds;
    }
}
