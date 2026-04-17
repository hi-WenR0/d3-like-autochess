# 功能开发文档：技能升级/熟练度系统

## 1. 基本信息

- 日期：2026-04-17
- 负责人：Codex
- 分类：04-progression
- 关联功能：核心战斗系统优化、职业专精技能系统
- 状态：Implemented

## 2. 目标与范围

- 目标：
  - 为自动释放技能添加熟练度成长机制，让玩家在挂机战斗中持续获得技能成长。
  - 技能等级提升后增强伤害、冷却、治疗、buff数值或触发阈值，提供长期成长目标。
- 本次范围（In Scope）：
  - 扩展角色数据模型，支持技能进度存档。
  - 扩展技能定义，支持成长配置。
  - 实现技能释放经验结算逻辑。
  - 实现技能等级对战斗数值的影响。
  - 更新技能面板显示等级和经验。
  - 确保向后兼容（旧存档缺少进度字段时自动补默认值）。
- 非本次范围（Out of Scope）：
  - 技能符文/变体系统（后续阶段）。
  - 技能标签协同（后续阶段）。
  - 职业专属技能机制（后续阶段）。
  - 触发器扩展与技能连携（后续阶段）。
  - 技能UI完善（后续阶段）。

## 3. 需求与验收标准

- 功能需求：
  - 每个技能独立记录等级、经验值和升级所需经验。
  - 主动/触发技能释放后获得技能经验，被动技能按战斗时间或击杀结算少量经验。
  - 技能等级上限10级，降低数值失控风险。
  - 技能伤害、冷却、治疗、buff数值等受等级加成影响。
  - 技能面板和HUD能显示当前等级、经验进度和下一级所需经验。
- 验收标准（可检查）：
  - [ ] 技能释放后对应技能经验增加。
  - [ ] 技能经验达到升级阈值后等级提升。
  - [ ] 技能升级后面板显示等级和下一级进度。
  - [ ] 技能实际伤害/冷却/治疗读取等级加成。
  - [ ] 旧存档加载时自动初始化技能进度字段。
  - [ ] 技能卸下后经验保留，重新装备时恢复。
  - [ ] 技能满级（10级）后经验不再增长。

## 4. 方案设计

### 4.1 玩法/交互设计

- 技能升级为被动成长，无需玩家手动分配点数。
- 主动技能和触发技能：每次成功释放获得基础经验值（例如10点）。
- 被动技能：每场战斗结束时，根据战斗时长或击杀数结算少量经验。
- 技能等级影响：
  - 伤害类技能：每级增加伤害乘数（例如+2%每级）。
  - 冷却类技能：每级减少冷却时间（例如-3%每级，最多减少30%）。
  - 治疗类技能：每级增加治疗比率（例如+5%每级）。
  - buff类技能：每级增加buff数值或持续时间。
  - 执行类技能：每级降低执行阈值或增加额外倍率。
- 经验曲线：升级所需经验逐级递增，采用平方或指数曲线。

### 4.2 技术设计

#### 数据模型扩展

1. **SkillProgress 接口**（新）：
   ```ts
   export interface SkillProgress {
       level: number;        // 当前等级 (1-10)
       xp: number;          // 当前经验
       xpToNext: number;    // 升级所需经验
   }
   ```

2. **CharacterData 扩展**：
   在 `CharacterData` 接口中添加：
   ```ts
   skillProgress: Record<string, SkillProgress>; // key: skillId
   ```

3. **SkillDefinition 扩展**：
   在 `SkillDefinition` 接口中添加：
   ```ts
   growth?: SkillGrowth;
   ```

4. **SkillGrowth 接口**（新）：
   ```ts
   export interface SkillGrowth {
       damageMultiplierPerLevel?: number;      // 每级伤害乘数加成（乘法）
       cooldownReductionPerLevel?: number;     // 每级冷却缩减百分比（加法）
       healRatioPerLevel?: number;             // 每级治疗比率加成（加法）
       critRateBonusPerLevel?: number;         // 每级暴击率加成（加法）
       critDamageBonusPerLevel?: number;       // 每级暴击伤害加成（加法）
       // 其他可成长属性...
   }
   ```

#### 经验结算逻辑

- **经验获取函数**：`addSkillExperience(skillId: string, xp: number, character: CharacterData)`
  - 增加经验值，检查升级，循环升级直到经验不足或达到满级。
  - 升级时更新等级和 `xpToNext`。

- **战斗系统集成**：
  - 在 `calculateDamage` 或技能释放成功时调用经验获取。
  - 主动/触发技能：释放后调用 `addSkillExperience`。
  - 被动技能：战斗结束时根据战斗时长调用。

- **经验公式**：
  - 基础经验：主动/触发技能10点，被动技能每场战斗5点。
  - 升级所需经验：`baseXP * level^1.5`，其中 `baseXP = 100`。

#### 等级加成应用

- **伤害计算**：`getEffectiveSkillDamageMultiplier` 函数需要考虑技能等级加成。
- **冷却计算**：`getEffectiveSkillCooldownMs` 函数需要考虑等级冷却缩减。
- **治疗计算**：`getEffectiveSkillHealRatio` 函数需要考虑等级治疗加成。
- **其他加成**：通过技能等级查找 `growth` 配置并应用。

#### 向后兼容

- 加载旧存档时，检查 `character.skillProgress` 是否存在，若不存在则初始化为空对象。
- 首次获取技能进度时，若 `skillProgress[skillId]` 不存在，则创建默认进度（level=1, xp=0, xpToNext=第一级所需经验）。

### 4.3 数据结构与配置

#### 新接口定义位置

- `src/game/models/skill.ts`：添加 `SkillProgress`、`SkillGrowth` 接口，扩展 `SkillDefinition`。
- `src/game/models/character.ts`：扩展 `CharacterData` 接口。

#### 默认成长配置

可在 `CLASS_SKILLS` 数组中为每个技能添加 `growth` 字段。例如：

```ts
{
    id: 'berserker-cleave',
    // ... 其他字段
    growth: {
        damageMultiplierPerLevel: 0.02,   // 每级 +2% 伤害
        cooldownReductionPerLevel: 0.03,  // 每级 -3% 冷却
    }
}
```

#### 常量定义

- `MAX_SKILL_LEVEL = 10`
- `BASE_SKILL_XP = 100`
- `ACTIVE_SKILL_XP_PER_CAST = 10`
- `PASSIVE_SKILL_XP_PER_BATTLE = 5`

### 4.4 兼容性与迁移影响

- **存档兼容性**：旧存档缺少 `skillProgress` 字段，需在加载时自动初始化。
- **技能解锁**：未解锁的技能不会获得经验，但进度对象仍可创建（等级为1）。
- **职业/专精切换**：切换职业或专精后，不合法的技能进度保留，但不会生效。
- **性能影响**：经验结算仅在技能释放或战斗结束时触发，频率低，性能影响可忽略。

## 5. 实现计划

### 任务拆分

1. **数据模型扩展**（任务#12）：
   - 添加 `SkillProgress` 和 `SkillGrowth` 接口。
   - 扩展 `CharacterData` 添加 `skillProgress` 字段。
   - 扩展 `SkillDefinition` 添加 `growth` 字段。
   - 更新 `CLASS_SKILLS` 数组，为每个技能添加 `growth` 配置。

2. **经验结算逻辑**（任务#13）：
   - 实现 `addSkillExperience` 函数。
   - 实现 `getSkillProgress` 辅助函数（获取或创建默认进度）。
   - 在战斗系统中集成经验获取：
     - 修改 `calculateDamage` 或技能释放函数，在成功释放主动/触发技能后调用 `addSkillExperience`。
     - 添加战斗结束时的被动技能经验结算。

3. **等级加成应用**（任务#13续）：
   - 修改 `getEffectiveSkillDamageMultiplier` 函数，考虑等级加成。
   - 修改 `getEffectiveSkillCooldownMs` 函数，考虑等级冷却缩减。
   - 修改 `getEffectiveSkillHealRatio` 函数，考虑等级治疗加成。
   - 确保其他战斗数值计算也读取技能等级。

4. **UI显示更新**（任务#14）：
   - 修改技能面板（`Game.ts` 中的技能槽UI），显示技能等级和进度条。
   - 添加技能详情弹窗（可选），显示等级、经验、下一级所需经验和加成数值。
   - 确保HUD中技能图标能显示等级（例如角标）。

5. **测试与验证**（任务#15）：
   - 创建测试场景，验证技能释放后经验增加。
   - 验证升级后技能数值变化。
   - 验证旧存档加载正常。
   - 验证满级后经验不再增长。

### 预计改动文件

- `src/game/models/skill.ts`：数据模型扩展。
- `src/game/models/character.ts`：`CharacterData` 扩展。
- `src/game/systems/combat-system.ts`：经验获取集成和等级加成应用。
- `src/game/systems/skill-system.ts`：可能添加经验相关辅助函数。
- `src/game/scenes/Game.ts`：UI更新。
- 可能涉及的其他文件：`src/game/systems/character-system.ts`（存档加载）。

### 风险点与回滚方案

- **风险点1**：等级加成数值不平衡，可能导致游戏难度骤降。
  - 缓解：采用保守的成长数值（每级+2%伤害，-3%冷却），上限10级限制总增幅。
  - 回滚：若数值问题严重，可临时注释等级加成代码，保留进度数据但不加成。

- **风险点2**：旧存档加载失败。
  - 缓解：在 `character-system.ts` 的 `loadCharacter` 或初始化函数中添加默认值补全。
  - 回滚：若加载问题无法快速解决，可暂时禁用技能进度功能，将 `skillProgress` 设为可选字段。

- **风险点3**：UI显示溢出或布局错乱。
  - 缓解：在技能槽中使用小字体或角标显示等级，进度条仅在详情弹窗显示。
  - 回滚：若UI问题影响体验，可先隐藏等级显示，保留数据逻辑。

## 6. 测试计划

### 手工测试步骤

1. **基础功能测试**：
   - 创建新角色，装备技能。
   - 进入战斗，观察技能释放后经验是否增加（可在控制台日志输出）。
   - 持续战斗直到技能升级，验证等级提升。
   - 检查升级后技能伤害/冷却数值变化。

2. **边界情况测试**：
   - 技能满级（10级）后释放，经验不应再增长。
   - 卸下技能后重新装备，验证经验保留。
   - 加载旧存档（无 `skillProgress` 字段），验证自动初始化。
   - 切换职业/专精，验证非法技能进度不生效但保留。

3. **UI测试**：
   - 技能槽显示等级角标。
   - 鼠标悬停显示等级和进度。
   - 技能详情弹窗（如有）显示完整信息。

### 性能影响检查

- 监控战斗循环帧率，确保经验结算不会造成卡顿。
- 确保 `skillProgress` 对象不会每帧都被遍历。

### 回归测试

- 确保现有战斗系统功能不受影响（伤害计算、冷却、治疗等）。
- 确保技能装备、卸载、切换功能正常。
- 确保存档/读档功能正常。

## 7. 变更记录

- 2026-04-17: 创建技能升级/熟练度系统开发文档，基于技能系统路线图推荐优先级。