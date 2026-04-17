import { Scene } from 'phaser';
import type { CharacterBaseClass } from '../models';
import {
    PLAYER_ANIM_STATES,
    PLAYER_FACINGS,
    PLAYER_PROJECTILE_TEXTURE_KEYS,
    PLAYER_PROJECTILE_TEXTURE_PATHS,
    PLAYER_SPRITE_FRAME_SIZE,
    getPlayerSpritesheetKey,
    getPlayerSpritesheetPath,
} from '../player-visuals';
import {
    ENEMY_ANIM_STATES,
    ENEMY_FACINGS,
    ENEMY_SPRITE_FRAME_SIZE,
    getEnemySpritesheetKey,
    getEnemySpritesheetPath,
} from '../enemy-visuals';
import type { MonsterType } from '../models';

const PLAYER_CLASSES: CharacterBaseClass[] = ['berserker', 'ranger', 'mage'];
const ENEMY_TYPES: MonsterType[] = ['normal', 'elite', 'rare', 'boss'];

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        //  We loaded this image in our Boot Scene, so we can display it here
        this.add.image(512, 384, 'background');

        //  A simple progress bar. This is the outline of the bar.
        this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        const bar = this.add.rectangle(512-230, 384, 4, 28, 0xffffff);

        //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on('progress', (progress: number) => {

            //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
            bar.width = 4 + (460 * progress);

        });
    }

    preload ()
    {
        //  Load the assets for the game - Replace with your own assets
        this.load.setPath('assets');

        this.load.image('logo', 'logo.png');

        PLAYER_CLASSES.forEach((baseClass) => {
            PLAYER_FACINGS.forEach((facing) => {
                PLAYER_ANIM_STATES.forEach((state) => {
                    this.load.spritesheet(
                        getPlayerSpritesheetKey(baseClass, facing, state),
                        getPlayerSpritesheetPath(baseClass, facing, state),
                        {
                            frameWidth: PLAYER_SPRITE_FRAME_SIZE,
                            frameHeight: PLAYER_SPRITE_FRAME_SIZE,
                        },
                    );
                });
            });
        });

        (Object.keys(PLAYER_PROJECTILE_TEXTURE_KEYS) as CharacterBaseClass[]).forEach((baseClass) => {
            const textureKey = PLAYER_PROJECTILE_TEXTURE_KEYS[baseClass];
            const texturePath = PLAYER_PROJECTILE_TEXTURE_PATHS[baseClass];
            if (!textureKey || !texturePath) {
                return;
            }

            this.load.image(textureKey, texturePath);
        });

        ENEMY_TYPES.forEach((type) => {
            ENEMY_FACINGS.forEach((facing) => {
                ENEMY_ANIM_STATES.forEach((state) => {
                    this.load.spritesheet(
                        getEnemySpritesheetKey(type, facing, state),
                        getEnemySpritesheetPath(type, facing, state),
                        {
                            frameWidth: ENEMY_SPRITE_FRAME_SIZE,
                            frameHeight: ENEMY_SPRITE_FRAME_SIZE,
                        },
                    );
                });
            });
        });
    }

    create ()
    {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.

        //  Move to the MainMenu. You could also swap this for a Scene Transition, such as a camera fade.
        this.scene.start('MainMenu');
    }
}
