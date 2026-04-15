# Phaser 4 Dungeon Crawler RPG

A complete **Dungeon Crawler + Idle RPG** game built with Phaser 4, Vite, and TypeScript. Features auto-exploration, deep equipment affix systems, five dungeon areas, and offline progression.

**Note:** This project is based on the official Phaser Vite TypeScript template, upgraded to use Phaser 4.0.0.

### Versions

This template has been updated for:

- [Phaser 4.0.0](https://github.com/phaserjs/phaser)
- [Vite 6.3.1](https://github.com/vitejs/vite)
- [TypeScript 5.7.2](https://github.com/microsoft/TypeScript)

![screenshot](screenshot.png)

## Requirements

[Node.js](https://nodejs.org) is required to install dependencies and run scripts via `npm`.

## Available Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install project dependencies |
| `npm run dev` | Launch a development web server (with anonymous usage logging) |
| `npm run build` | Create a production build in the `dist` folder (with anonymous usage logging) |
| `npm run dev-nolog` | Launch a development web server without sending anonymous data |
| `npm run build-nolog` | Create a production build in the `dist` folder without sending anonymous data |

The development server runs on `http://localhost:8080` by default.

## Getting Started

After cloning the repo, run `npm install` from your project directory. Then, you can start the local development server by running `npm run dev`.

Once the server is running you can edit any of the files in the `src` folder. Vite will automatically recompile your code and then reload the browser.

## Project Structure

```
src/
├── main.ts              # Application entry point (DOM loading)
├── vite-env.d.ts       # Vite type definitions
└── game/
    ├── main.ts         # Game entry point: configures and starts the Phaser game
    ├── scenes/         # Phaser game scenes
    │   ├── Boot.ts
    │   ├── Preloader.ts
    │   ├── MainMenu.ts
    │   ├── Game.ts
    │   └── GameOver.ts
    ├── models/         # Data models (character, dungeon, etc.)
    └── systems/        # Game systems (combat, inventory, etc.)
```

### Key Files

| Path | Description |
|------|-------------|
| `index.html` | A basic HTML page to contain the game |
| `public/assets/` | Game sprites, audio, etc. Served directly at runtime |
| `public/style.css` | Global layout styles |
| `src/main.ts` | Application bootstrap (DOM loading) |
| `src/game/main.ts` | Game entry point: configures and starts the Phaser game |
| `src/game/scenes/` | Folder with all Phaser game scenes |
| `src/game/models/` | Data models for game entities |
| `src/game/systems/` | Game systems and logic |

## Game Features

This project includes a complete **Dungeon Crawler + Idle RPG** game with deep gameplay mechanics and systems.

### Game Type
- **Dungeon Crawler** + **Idle/Auto-battler** 2D RPG
- Players focus on equipment optimization, attribute allocation, and system management while characters automatically explore, fight, and collect loot
- Supports offline progression, auto-save, and infinite dungeon areas

### Core Gameplay
1. **Auto Exploration & Combat**
   - Characters automatically move through dungeons, finding and attacking nearest monsters
   - Combat occurs every 500ms with automatic damage calculation, critical hits, life steal, dodge, etc.
   - Five character states: Exploring, Fighting, Looting, Resting, Descending

2. **Character Progression**
   - Gain experience and gold by defeating monsters, level up to earn attribute points
   - Attribute points can be allocated to HP, ATK, DEF, Attack Speed, Critical Rate, Critical Damage, Movement Speed
   - Equipment provides base stats and special affixes when equipped

3. **Equipment Collection & Affix System**
   - Equipment spans 9 slots (Helmet, Armor, Weapon, Necklace, Rings, etc.)
   - Five rarity tiers: Common (Gray), Magic (Blue), Rare (Orange), Legendary (Orange), Mythic (Gold)
   - Three affix categories: Attack (Penetration, Life Steal), Defense (HP Regen, Damage Reduction), Special (Combo, Whirlwind, Guardian, Plunderer, etc.)
   - Higher rarity equipment has more affixes and stronger effects

4. **Dungeon Progression**
   - Five dungeon areas: Barren Mines, Dark Forest, Lava Abyss, Abyssal Realm, Endless Abyss
   - Each floor requires defeating a fixed number of monsters to advance, every 5th floor is a Boss floor
   - Bosses drop more and higher rarity equipment

### Key Game Systems

| System | Description |
|--------|-------------|
| **Character System** (`src/game/models/character.ts`) | Character data, attribute allocation, level-up formulas, effective stat calculation |
| **Equipment System** (`src/game/models/equipment.ts`) | Equipment slots, rarity configuration, base stat ranges, sell prices |
| **Affix System** (`src/game/models/affix.ts`) | Affix definitions, categories, weights, randomization rules |
| **Monster System** (`src/game/models/monster.ts`) | Monster types (Normal, Elite, Rare, Boss), attribute scaling, spawn weights |
| **Dungeon System** (`src/game/models/dungeon.ts`) | Area definitions, exploration states, floor progression |
| **Inventory System** (`src/game/models/inventory.ts`) | 40-slot backpack, item stacking, sell by rarity |
| **Consumable System** (`src/game/models/consumable.ts`) | Potions, scrolls, elixirs definitions, stack limits, purchase prices |
| **Combat System** (`src/game/systems/combat-system.ts`) | Damage calculation, penetration, life steal, dodge, combo, whirlwind effects |
| **Equipment System** (`src/game/systems/equip-system.ts`) | Equipment slot management, stat bonus calculation |
| **Loot System** (`src/game/systems/loot-system.ts`) | Equipment generation, rarity randomization, affix randomization, name generation |
| **Shop System** (`src/game/systems/shop-system.ts`) | Consumable purchases, one-click equipment selling |
| **Save System** (`src/game/systems/save-system.ts`) | LocalStorage auto-save, offline progression calculation (up to 24 hours) |
| **Consumable System** (`src/game/systems/consumable-system.ts`) | Potion healing, buff scrolls, auto-potion logic |

### Key Game Mechanics

- **Affix Effects**
  - **Penetration**: Ignore a portion of monster defense
  - **Life Steal**: Heal based on damage dealt
  - **HP Regeneration**: Restore fixed HP per second
  - **Damage Reduction**: Reduce incoming damage
  - **Dodge**: Completely avoid one damage instance
  - **Combo**: Chance to attack again
  - **Whirlwind**: Chance to damage all surrounding monsters
  - **Guardian**: Chance to revive with 50% HP upon death
  - **Plunderer**: Chance to drop an additional equipment item
  - **Berserker**: Greatly increased attack when HP is below 30%
  - **Immortal**: Enter cooldown upon death, revive after cooldown ends

- **Offline Progression**
  Calculates experience and gold rewards based on offline duration, character level, and current dungeon floor (50% efficiency)

- **Auto-Save**
  Automatically saves progress every 30 seconds, also saves when page is closed

- **UI Panels**
  Main game interface includes HUD (HP bar, floor number, gold, status, attribute display), bottom navigation bar opens:
  - **Backpack**: View/equip items
  - **Equipment**: View equipped items
  - **Attributes**: View character stats, allocate attribute points, view affix effects
  - **Consumables**: Use potions/scrolls/elixirs, view active buffs
  - **Shop**: Purchase consumables, one-click sell equipment by rarity
  - **Save**: Manual save
  - **Reset**: Confirm to reset all progress

## Handling Assets

Vite supports loading assets via JavaScript module `import` statements.

This template provides support for both embedding assets and also loading them from a static folder. To embed an asset, you can import it at the top of the JavaScript file you are using it in:

```js
import logoImg from './assets/logo.png'
```

To load static files such as audio files, videos, etc place them into the `public/assets` folder. Then you can use this path in the Loader calls within Phaser:

```js
preload ()
{
    //  This is an example of an imported bundled image.
    //  Remember to import it at the top of this file
    this.load.image('logo', logoImg);

    //  This is an example of loading a static image
    //  from the public/assets folder:
    this.load.image('background', 'assets/bg.png');
}
```

When you issue the `npm run build` command, all static assets are automatically copied to the `dist/assets` folder.

## Deploying to Production

After you run the `npm run build` command, your code will be built into a single bundle and saved to the `dist` folder, along with any other assets your project imported, or stored in the public assets folder.

In order to deploy your game, you will need to upload *all* of the contents of the `dist` folder to a public facing web server.

## Customizing the Template

### Vite

If you want to customize your build, such as adding plugin (i.e. for loading CSS or fonts), you can modify the `vite/config.*.mjs` file for cross-project changes, or you can modify and/or create new configuration files and target them in specific npm tasks inside of `package.json`. Please see the [Vite documentation](https://vitejs.dev/) for more information.

### TypeScript

This project uses strict TypeScript configuration with the following settings in `tsconfig.json`:

- `target`: ES2020
- `strict`: true
- `noUnusedLocals`: true
- `noUnusedParameters`: true
- `noFallthroughCasesInSwitch`: true

Always run type checking after code changes:

```bash
npx tsc --noEmit
```

## About log.js

If you inspect our node scripts you will see there is a file called `log.js`. This file makes a single silent API call to a domain called `gryzor.co`. This domain is owned by Phaser Studio Inc. The domain name is a homage to one of our favorite retro games.

We send the following 3 pieces of data to this API: The name of the template being used (vue, react, etc). If the build was 'dev' or 'prod' and finally the version of Phaser being used.

At no point is any personal data collected or sent. We don't know about your project files, device, browser or anything else. Feel free to inspect the `log.js` file to confirm this.

Why do we do this? Because being open source means we have no visible metrics about which of our templates are being used. We work hard to maintain a large and diverse set of templates for Phaser developers and this is our small anonymous way to determine if that work is actually paying off, or not. In short, it helps us ensure we're building the tools for you.

However, if you don't want to send any data, you can use these commands instead:

Dev:

```bash
npm run dev-nolog
```

Build:

```bash
npm run build-nolog
```

Or, to disable the log entirely, simply delete the file `log.js` and remove the call to it in the `scripts` section of `package.json`:

Before:

```json
"scripts": {
    "dev": "node log.js dev & dev-template-script",
    "build": "node log.js build & build-template-script"
},
```

After:

```json
"scripts": {
    "dev": "dev-template-script",
    "build": "build-template-script"
},
```

Either of these will stop `log.js` from running. If you do decide to do this, please could you at least join our Discord and tell us which template you're using! Or send us a quick email. Either will be super-helpful, thank you.

## Phaser 4 Resources

- [Phaser 4 Documentation](https://docs.phaser.io/)
- [Phaser 4 Examples](https://labs.phaser.io/)
- [Phaser 4 Migration Guide](https://phaser.io/skills/v4-migration)

## Join the Phaser Community!

We love to see what developers like you create with Phaser! It really motivates us to keep improving. So please join our community and show-off your work 😄

**Visit:** The [Phaser website](https://phaser.io) and follow on [Phaser Twitter](https://twitter.com/phaser_)<br />
**Play:** Some of the amazing games [#madewithphaser](https://twitter.com/search?q=%23madewithphaser&src=typed_query&f=live)<br />
**Learn:** [API Docs](https://newdocs.phaser.io), [Support Forum](https://phaser.discourse.group/) and [StackOverflow](https://stackoverflow.com/questions/tagged/phaser-framework)<br />
**Discord:** Join us on [Discord](https://discord.gg/phaser)<br />
**Code:** 2000+ [Examples](https://labs.phaser.io)<br />
**Read:** The [Phaser World](https://phaser.io/community/newsletter) Newsletter<br />

Created by [Phaser Studio](mailto:support@phaser.io). Powered by coffee, anime, pixels and love.

The Phaser logo and characters are &copy; 2011 - 2025 Phaser Studio Inc.

All rights reserved.