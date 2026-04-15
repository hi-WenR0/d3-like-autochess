# AGENTS.md - Phaser 4 Demo Project

This file provides guidelines for AI coding agents operating in this repository.

## Project Overview

- **Framework**: Phaser 4.0.0 (WebGL-based 2D game framework)
- **Build Tool**: Vite 6.x
- **Language**: TypeScript (strict mode enabled)
- **Package Manager**: pnpm/npm

## Build Commands

```bash
# Development server (http://localhost:8080)
npm run dev

# Production build
npm run build

# Development without logging wrapper
npm run dev-nolog

# Production build without logging wrapper
npm run build-nolog
```

## TypeScript Configuration

The project uses strict TypeScript with the following settings in `tsconfig.json`:

- `target`: ES2020
- `module`: ESNext
- `strict`: true
- `noUnusedLocals`: true
- `noUnusedParameters`: true
- `noFallthroughCasesInSwitch`: true

**Always run type checking after code changes:**
```bash
npx tsc --noEmit
```

## Code Style Guidelines

### TypeScript

- Use explicit types for function parameters and return types
- Use `interface` for object shapes, `type` for unions/intersections
- Prefer `const` over `let`; never use `var`

### Imports

- Use named imports from 'phaser':
  ```ts
  import { Scene, Sprite, Text } from 'phaser';
  import { AUTO, Game } from 'phaser';
  ```
- Group imports: external (phaser) -> relative paths
- Use path aliases if configured (none currently)

### Naming Conventions

- **Classes**: PascalCase (`class MainMenu extends Scene`)
- **Variables/Functions**: camelCase (`const playerSpeed`, `function updatePlayer()`)
- **Constants**: UPPER_SNAKE_CASE (`const MAX_LIVES = 3`)
- **Files**: kebab-case (`main-menu.ts`, `game-scene.ts`)

### Phaser 4 Specific

- **Scene classes**: Extend `Phaser.Scene`, use scene key as constructor:
  ```ts
  export class MainMenu extends Scene {
      constructor() {
          super('MainMenu');
      }
  }
  ```
- **Game Config**: Define as typed `Phaser.Types.Core.GameConfig` object
- **Lifecycle methods**: `preload()`, `create()`, `update()` - no explicit typing needed

### Error Handling

- Use try/catch for async operations and asset loading
- Handle nullable values with optional chaining (`?.`) or nullish coalescing (`??`)
- For game errors, consider using Phaser's built-in error events:
  ```ts
  this.game.events.on('error', (error) => { /* ... */ });
  ```

### Comments

- Avoid obvious comments; code should be self-documenting
- Use JSDoc for public APIs if needed for documentation generation
- TODO/FIXME comments should include the issue context

## Project Structure

```
src/
├── main.ts              # Entry point
├── vite-env.d.ts       # Vite type definitions
└── game/
    ├── main.ts         # Game initialization
    └── scenes/       # Scene files
        ├── Boot.ts
        ├── Preloader.ts
        ├── MainMenu.ts
        ├── Game.ts
        └── GameOver.ts
```

## Common Patterns

### Creating a Scene
```ts
import { Scene } from 'phaser';

export class MyScene extends Scene {
    constructor() {
        super('MyScene');
    }

    preload() {
        this.load.image('key', 'path/to/image.png');
    }

    create() {
        this.add.image(512, 384, 'key');
    }

    update() {
        // Game loop logic
    }
}
```

### Game Config
```ts
import { AUTO, Game } from 'phaser';

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    scene: [Boot, Preloader, MainMenu, Game]
};

new Game(config);
```

## Performance Considerations (Phaser 4)

- Use `SpriteGPULayer` for rendering 10,000+ sprites
- Leverage Phaser 4's unified Filter system (replaces FX/Masks)
- Use tilemap GPU layer for large tilemaps
- Prefer WebGL renderer (Phaser 4 is WebGL-only)

## Dependencies

- **phaser**: ^4.0.0 (required for this project)
- **vite**: ^6.3.1
- **typescript**: ~5.7.2
- **terser**: ^5.39.0

## No Test Framework

This project has no tests configured. Do not add test files unless explicitly requested.

## Feature Tracking

The project uses `FEATURES.md` to track feature requirements, development progress, and priorities. AI agents should:

1. **Consult FEATURES.md** before implementing new features
2. **Update FEATURES.md** when adding new feature requirements
3. **Track progress** by updating feature status in FEATURES.md
4. **Reference features** in commit messages when implementing tracked features

### Feature Status Definitions

- **Pending**: Feature proposed but not yet evaluated
- **Planned**: Evaluated and scheduled for future implementation
- **In Development**: Currently being implemented
- **Testing**: Development complete, undergoing testing
- **Completed**: Implemented and tested
- **Deprecated**: No longer planned for implementation
- **Blocked**: Temporarily blocked due to dependencies or technical limitations

### When to Update FEATURES.md

- When user requests a new feature
- When starting work on a planned feature
- When completing a feature implementation
- When encountering blockers or changing priorities
- When deprecating or postponing a feature

## References

- [Phaser 4 Documentation](https://docs.phaser.io/)
- [Phaser 4 Examples](https://labs.phaser.io/)
- [Phaser 4 Migration Guide](https://phaser.io/skills/v4-migration)
- [FEATURES.md](./FEATURES.md) - Feature tracking document