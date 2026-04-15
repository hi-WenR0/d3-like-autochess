import { Scene, GameObjects } from 'phaser';
import { BASE_CLASS_CONFIG, type CharacterBaseClass } from '../models';
import { addBoundedText } from '../ui/text-layout';
import {
    deleteSave,
    listSaveSlots,
    setCurrentSaveSlot,
    type SaveSlotSummary,
} from '../systems/save-system';

type MenuView = 'root' | 'newGame' | 'newGameClassSelect' | 'loadGame' | 'intro';

export class MainMenu extends Scene {
    background!: GameObjects.Image;
    logo!: GameObjects.Image;
    title!: GameObjects.Text;
    viewContainer: GameObjects.Container | null = null;
    menuView: MenuView = 'root';
    slotPageByView: Record<'newGame' | 'loadGame', number> = {
        newGame: 0,
        loadGame: 0,
    };
    pendingNewGameSlot: number | null = null;

    constructor() {
        super('MainMenu');
    }

    create() {
        this.background = this.add.image(512, 384, 'background');
        this.logo = this.add.image(512, 200, 'logo').setScale(0.85);
        this.title = this.add.text(512, 330, '暗黑挂机冒险', {
            fontFamily: 'Arial Black',
            fontSize: 34,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center',
        }).setOrigin(0.5);

        this.switchView('root');
    }

    private clearViewContainer() {
        if (!this.viewContainer) return;
        this.viewContainer.destroy(true);
        this.viewContainer = null;
    }

    private switchView(view: MenuView) {
        this.menuView = view;
        this.clearViewContainer();

        switch (view) {
            case 'root':
                this.renderRootView();
                break;
            case 'newGame':
                this.renderNewGameView();
                break;
            case 'loadGame':
                this.renderLoadGameView();
                break;
            case 'newGameClassSelect':
                this.renderNewGameClassSelectView();
                break;
            case 'intro':
                this.renderIntroView();
                break;
        }
    }

    private createActionButton(
        x: number,
        y: number,
        label: string,
        onClick: () => void,
        options?: { width?: number; height?: number; color?: number; border?: number },
    ): GameObjects.Container {
        const width = options?.width ?? 260;
        const height = options?.height ?? 52;
        const color = options?.color ?? 0x1f3b5b;
        const border = options?.border ?? 0x5dade2;

        const bg = this.add.rectangle(0, 0, width, height, color).setStrokeStyle(2, border);
        const text = this.add.text(0, 0, label, {
            fontSize: '20px',
            color: '#ffffff',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        const hit = this.add.rectangle(0, 0, width, height, 0x000000, 0).setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => {
            bg.setFillStyle(0x295a8a);
            text.setScale(1.03);
        });
        hit.on('pointerout', () => {
            bg.setFillStyle(color);
            text.setScale(1);
        });
        hit.on('pointerdown', onClick);

        return this.add.container(x, y, [bg, text, hit]);
    }

    private createBackButton(onClick: () => void): GameObjects.Container {
        return this.createActionButton(100, 70, '返回', onClick, { width: 110, height: 40, color: 0x3b3b3b, border: 0xaaaaaa });
    }

    private createTinyButton(
        x: number,
        y: number,
        label: string,
        onClick: () => void,
        enabled: boolean,
    ): GameObjects.Text {
        const text = this.add.text(x, y, label, {
            fontSize: '14px',
            color: enabled ? '#3498db' : '#555555',
        }).setOrigin(0.5);
        if (enabled) {
            text.setInteractive({ useHandCursor: true });
            text.on('pointerdown', onClick);
        }
        return text;
    }

    private renderRootView() {
        const elements: GameObjects.GameObject[] = [];
        const panel = this.add.rectangle(512, 530, 700, 250, 0x101e2e, 0.88).setStrokeStyle(2, 0x4a6a8a);
        elements.push(panel);

        elements.push(this.createActionButton(512, 470, '新游戏', () => this.switchView('newGame')));
        elements.push(this.createActionButton(512, 535, '加载游戏', () => this.switchView('loadGame')));
        elements.push(this.createActionButton(512, 600, '游戏介绍', () => this.switchView('intro')));

        this.viewContainer = this.add.container(0, 0, elements);
    }

    private renderSlotGrid(
        slots: SaveSlotSummary[],
        options: {
            viewKey: 'newGame' | 'loadGame';
            title: string;
            onPrimary: (slotId: number, hasSave: boolean) => void;
            primaryLabel: string;
            allowDelete: boolean;
        },
    ) {
        const elements: GameObjects.GameObject[] = [];

        const panel = this.add.rectangle(512, 430, 900, 620, 0x111f2f, 0.92).setStrokeStyle(2, 0x4a6a8a);
        elements.push(panel);

        const title = this.add.text(512, 90, options.title, {
            fontSize: '28px',
            color: '#ffffff',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        elements.push(title);

        elements.push(this.createBackButton(() => this.switchView('root')));

        const perPage = 10;
        const totalPages = Math.max(1, Math.ceil(slots.length / perPage));
        let page = this.slotPageByView[options.viewKey] ?? 0;
        if (page >= totalPages) page = totalPages - 1;
        if (page < 0) page = 0;
        this.slotPageByView[options.viewKey] = page;

        const pageSlots = slots.slice(page * perPage, page * perPage + perPage);

        const startX = 140;
        const startY = 150;
        const rowHeight = 50;
        const rowWidth = 744;

        for (let i = 0; i < pageSlots.length; i++) {
            const slot = pageSlots[i];
            const row = i;
            const x = startX;
            const y = startY + row * rowHeight;

            const rowBg = this.add.rectangle(x + rowWidth / 2, y, rowWidth, 42, slot.hasSave ? 0x1f2f45 : 0x1a1a1a)
                .setOrigin(0.5)
                .setStrokeStyle(1, 0x4a4a4a);
            elements.push(rowBg);

            const summary = slot.hasSave
                ? `槽位 ${String(slot.slotId).padStart(2, '0')}  |  ${slot.name ?? '未知角色'}  |  Lv.${slot.level}  |  ${slot.floor}F  |  ${this.formatTimestamp(slot.timestamp)}`
                : `槽位 ${String(slot.slotId).padStart(2, '0')}  |  空存档`;
            const summaryText = addBoundedText(this, {
                x: x + 16,
                y,
                content: summary,
                width: rowWidth - (options.allowDelete ? 220 : 160),
                height: 22,
                minFontSize: 11,
                maxLines: 1,
                originX: 0,
                originY: 0.5,
                style: {
                    fontSize: '13px',
                    color: slot.hasSave ? '#d6e6f5' : '#7f8c8d',
                },
            });
            elements.push(summaryText);

            const canPrimary = options.primaryLabel === '新建' ? true : slot.hasSave;
            const primaryColor = canPrimary ? (slot.hasSave ? '#2ecc71' : '#3498db') : '#555555';
            const primary = this.add.text(x + rowWidth - (options.allowDelete ? 170 : 110), y, `[${options.primaryLabel}]`, {
                fontSize: '13px',
                color: primaryColor,
            }).setOrigin(0, 0.5).setInteractive({ useHandCursor: canPrimary });
            if (canPrimary) {
                primary.on('pointerdown', () => options.onPrimary(slot.slotId, slot.hasSave));
            }
            elements.push(primary);

            if (options.allowDelete) {
                const delColor = slot.hasSave ? '#e74c3c' : '#555555';
                const delBtn = this.add.text(x + rowWidth - 90, y, '[删除]', {
                    fontSize: '13px',
                    color: delColor,
                }).setOrigin(0, 0.5).setInteractive({ useHandCursor: slot.hasSave });
                if (slot.hasSave) {
                    delBtn.on('pointerdown', () => {
                        deleteSave(slot.slotId);
                        this.switchView(options.viewKey);
                    });
                }
                elements.push(delBtn);
            }
        }

        const prevBtn = this.createTinyButton(430, 710, '[上一页]', () => {
            this.slotPageByView[options.viewKey] = Math.max(0, page - 1);
            this.switchView(options.viewKey);
        }, page > 0);
        const pageText = this.add.text(512, 710, `${page + 1} / ${totalPages}`, {
            fontSize: '14px',
            color: '#bdc3c7',
        }).setOrigin(0.5);
        const nextBtn = this.createTinyButton(594, 710, '[下一页]', () => {
            this.slotPageByView[options.viewKey] = Math.min(totalPages - 1, page + 1);
            this.switchView(options.viewKey);
        }, page < totalPages - 1);
        elements.push(prevBtn, pageText, nextBtn);

        this.viewContainer = this.add.container(0, 0, elements);
    }

    private renderNewGameView() {
        const slots = listSaveSlots();
        this.renderSlotGrid(slots, {
            viewKey: 'newGame',
            title: '选择新游戏存档槽（最多20个）',
            primaryLabel: '新建',
            allowDelete: false,
            onPrimary: (slotId) => {
                this.pendingNewGameSlot = slotId;
                this.switchView('newGameClassSelect');
            },
        });
    }

    private renderNewGameClassSelectView() {
        const elements: GameObjects.GameObject[] = [];
        const panel = this.add.rectangle(512, 430, 860, 620, 0x111f2f, 0.92).setStrokeStyle(2, 0x4a6a8a);
        elements.push(panel);

        const title = this.add.text(512, 100, '选择基础职业', {
            fontSize: '30px',
            color: '#ffffff',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        elements.push(title);

        const subtitle = this.add.text(512, 138, `存档槽 ${String(this.pendingNewGameSlot ?? 1).padStart(2, '0')}`, {
            fontSize: '16px',
            color: '#95a5a6',
        }).setOrigin(0.5);
        elements.push(subtitle);

        elements.push(this.createBackButton(() => this.switchView('newGame')));

        const classIds: CharacterBaseClass[] = ['berserker', 'ranger', 'mage'];
        const positions = [220, 512, 804];

        classIds.forEach((classId, index) => {
            const classDef = BASE_CLASS_CONFIG[classId];
            const x = positions[index];
            const y = 390;

            const card = this.add.rectangle(x, y, 230, 360, 0x17283a, 0.95).setStrokeStyle(2, parseInt(classDef.color.replace('#', ''), 16));
            const name = this.add.text(x, y - 140, classDef.label, {
                fontSize: '24px',
                color: classDef.color,
                fontStyle: 'bold',
            }).setOrigin(0.5);
            const desc = addBoundedText(this, {
                x: x - 92,
                y: y - 96,
                content: classDef.description,
                width: 184,
                height: 76,
                minFontSize: 11,
                lineSpacing: 6,
                maxLines: 4,
                style: {
                    fontSize: '14px',
                    color: '#d6e6f5',
                },
            });
            const stats = addBoundedText(this, {
                x: x - 92,
                y: y - 16,
                content: [
                    `HP ${classDef.startingStats.maxHp}`,
                    `ATK ${classDef.startingStats.atk}`,
                    `DEF ${classDef.startingStats.def}`,
                    `攻速 ${classDef.startingStats.attackSpeed.toFixed(2)}`,
                    `暴击 ${classDef.startingStats.critRate}%`,
                    `移速 ${classDef.startingStats.moveSpeed}`,
                ],
                width: 184,
                height: 96,
                minFontSize: 11,
                lineSpacing: 8,
                maxLines: 6,
                style: {
                    fontSize: '13px',
                    color: '#bdc3c7',
                },
            });
            const branchTitle = this.add.text(x, y + 100, '后续专精', {
                fontSize: '14px',
                color: '#f1c40f',
            }).setOrigin(0.5);
            const branchList = addBoundedText(this, {
                x,
                y: y + 136,
                content: classDef.specializations.map(spec => spec.label).join(' / '),
                width: 180,
                height: 46,
                minFontSize: 10,
                maxLines: 2,
                originX: 0.5,
                style: {
                    fontSize: '12px',
                    color: '#e6cc80',
                    align: 'center',
                },
            });
            const chooseBtn = this.createActionButton(x, y + 205, '选择该职业', () => this.startNewGameWithClass(classId), {
                width: 170,
                height: 42,
                color: 0x20435f,
                border: parseInt(classDef.color.replace('#', ''), 16),
            });

            elements.push(card, name, desc, stats, branchTitle, branchList, chooseBtn);
        });

        this.viewContainer = this.add.container(0, 0, elements);
    }

    private startNewGameWithClass(baseClass: CharacterBaseClass) {
        setCurrentSaveSlot(this.pendingNewGameSlot ?? 1);
        this.scene.start('Game', { newGame: true, baseClass });
    }

    private renderLoadGameView() {
        const slots = listSaveSlots();
        this.renderSlotGrid(slots, {
            viewKey: 'loadGame',
            title: '加载游戏（20个存档槽）',
            primaryLabel: '加载',
            allowDelete: true,
            onPrimary: (slotId, hasSave) => {
                if (!hasSave) return;
                setCurrentSaveSlot(slotId);
                this.scene.start('Game');
            },
        });
    }

    private renderIntroView() {
        const elements: GameObjects.GameObject[] = [];

        const panel = this.add.rectangle(512, 430, 860, 620, 0x111f2f, 0.92).setStrokeStyle(2, 0x4a6a8a);
        elements.push(panel);

        const title = this.add.text(512, 100, '游戏介绍', {
            fontSize: '30px',
            color: '#f1c40f',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        elements.push(title);

        elements.push(this.createBackButton(() => this.switchView('root')));

        const lines = [
            '1. 在主城整理背包、购买补给，然后进入地牢战斗。',
            '2. 地牢战斗为自动进行，击败怪物可获得装备与资源。',
            '3. 清空一层后会回到主城，查看本次收益并决定是否进入下一层。',
            '4. 背包支持筛选、对比、手动拆解与自动拆解配置。',
            '5. 目标是构筑更强装备组合，挑战更高楼层。',
        ];

        let y = 180;
        for (const line of lines) {
            const text = this.add.text(130, y, line, { fontSize: '18px', color: '#d6e6f5' });
            elements.push(text);
            y += 68;
        }

        this.viewContainer = this.add.container(0, 0, elements);
    }

    private formatTimestamp(timestamp: number | null): string {
        if (!timestamp) return '--';
        const date = new Date(timestamp);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }
}
