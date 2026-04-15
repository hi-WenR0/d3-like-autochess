import type { CharacterData } from '../models/character';
import type { InventoryData } from '../models/inventory';
import type { DungeonState } from '../models/dungeon';
import type { Consumable } from '../models/consumable';
import type { EquippedItems } from './equip-system';

const SAVE_KEY = 'darklike_save';
const AUTO_SAVE_INTERVAL = 30_000; // 30秒自动保存

export interface SaveData {
    version: number;
    timestamp: number;         // 保存时间戳
    character: CharacterData;
    inventory: InventoryData;
    equipped: EquippedItems;
    dungeon: DungeonState;
    consumables: Consumable[];
    totalPlayTime: number;     // 总游戏时长（秒）
}

const CURRENT_VERSION = 2;

/** 保存游戏到 LocalStorage */
export function saveGame(data: SaveData): boolean {
    try {
        data.version = CURRENT_VERSION;
        data.timestamp = Date.now();
        const json = JSON.stringify(data);
        localStorage.setItem(SAVE_KEY, json);
        return true;
    } catch {
        console.warn('存档保存失败');
        return false;
    }
}

/** 读取存档，无存档返回 null */
export function loadGame(): SaveData | null {
    try {
        const json = localStorage.getItem(SAVE_KEY);
        if (!json) return null;
        const data = JSON.parse(json) as SaveData;
        if (data.version !== CURRENT_VERSION) {
            console.warn(`存档版本不匹配: ${data.version} vs ${CURRENT_VERSION}`);
            return null;
        }
        return data;
    } catch {
        console.warn('存档读取失败');
        return null;
    }
}

/** 删除存档 */
export function deleteSave(): void {
    localStorage.removeItem(SAVE_KEY);
}

/** 是否存在存档 */
export function hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
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
