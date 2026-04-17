# 功能开发文档：自动技能搭配系统

## 1. 基本信息

- 日期：2026-04-17
- 负责人：Codex
- 分类：02-combat
- 关联功能：FEATURES / 职业专精技能系统、核心战斗系统优化
- 状态：Testing

## 2. 目标与范围

- 目标：将现有“每个职业 / 专精一个自动技能”的实现扩展为可配置的自动技能搭配系统，让玩家通过技能槽、职业、专精、等级和装备构筑形成战斗差异。
- 本次范围（In Scope）：
  - 明确技能全自动释放，不引入手动施放
  - 设计技能槽规则
  - 设计自动释放优先级与条件判断
  - 设计技能解锁与存档结构
  - 定义首批 15 个技能清单
- 非本次范围（Out of Scope）：
  - 技能升级
  - 手动技能热键
  - 蓝量 / 能量资源
  - 技能树编辑器
  - 复杂召唤物 AI
  - 技能粒子特效精修

## 3. 需求与验收标准

- 功能需求：
  - 玩家不手动释放技能，战斗中由系统自动判断并释放。
  - 玩家可以在主城或安全界面配置已解锁技能。
  - 技能槽限制玩家可装备的技能数量，形成构筑取舍。
  - 技能可按职业、专精和等级解锁。
  - 多个技能同时可用时按优先级释放。
- 验收标准（可检查）：
  - [x] 角色有可持久化的技能搭配配置
  - [x] 技能 UI 可查看已解锁 / 未解锁技能
  - [x] 玩家可装备 / 替换技能槽内技能
  - [x] 自动战斗按触发技能、专精主动、基础主动、普通攻击的顺序判断
  - [x] 被动技能只在装备后生效
  - [x] 旧存档可自动生成默认技能搭配

## 4. 核心规则

### 4.1 释放方式

- 技能全部自动释放。
- 玩家只配置技能搭配，不参与战斗中按键施放。
- 技能释放只发生在地牢战斗阶段。
- 技能释放应复用现有攻击动画、伤害数字和日志反馈。

### 4.2 技能类型

- `active`：主动技能，按冷却与条件自动释放，需要目标。
- `passive`：被动技能，装备后持续生效，不进入释放队列。
- `trigger`：触发技能，满足条件时自动触发，拥有独立冷却。

首版不实现 `modifier`，但数据结构可预留后续扩展。

### 4.3 技能槽

首版建议 5 个槽：

- `basicActive`：基础主动技能，1 个
- `specializationActive`：专精主动技能，1 个
- `passive1`：被动技能，1 个
- `passive2`：被动技能，1 个
- `trigger`：触发技能，1 个

装备限制：

- 基础主动只允许装备当前基础职业技能。
- 专精主动只允许装备当前专精技能。
- 被动技能可以来自基础职业或当前专精。
- 触发技能可以来自基础职业或当前专精。
- 未满足等级、职业、专精条件的技能不可装备。

### 4.4 自动释放优先级

每次战斗循环先检查技能，再普通攻击：

1. `trigger`
2. `specializationActive`
3. `basicActive`
4. 普通攻击

触发技能必须有明确条件和冷却，避免长期抢占主动技能。

### 4.5 自动释放条件

首版条件类型：

- `always`：只要冷却完成且有目标即可释放
- `targetHpBelow`：目标生命比例低于指定值
- `playerHpBelow`：玩家生命比例低于指定值
- `enemyCountNearby`：玩家附近敌人数量达到指定值
- `targetInRange`：目标在指定距离内
- `missingBuff`：玩家没有指定增益

### 4.6 解锁规则

首版只按等级、基础职业、专精解锁：

- Lv.1：基础主动
- Lv.5：基础被动
- Lv.10：专精主动
- Lv.13：触发技能
- Lv.15：专精被动

后续可扩展任务解锁、成就解锁和装备解锁。

## 5. 数据结构草案

```ts
export type SkillType = 'active' | 'passive' | 'trigger';

export type SkillSlotType =
    | 'basicActive'
    | 'specializationActive'
    | 'passive1'
    | 'passive2'
    | 'trigger';

export interface SkillLoadout {
    basicActive: string | null;
    specializationActive: string | null;
    passive1: string | null;
    passive2: string | null;
    trigger: string | null;
}

export interface ClassSkillDefinition {
    id: string;
    label: string;
    description: string;
    type: SkillType;
    slot: SkillSlotType | 'passive';
    requiredClass: CharacterBaseClass;
    requiredSpecialization?: CharacterSpecialization;
    unlockLevel: number;
    cooldownMs?: number;
    priority: number;
    conditions: SkillCastCondition[];
    effects: SkillEffect[];
    tags: SkillTag[];
}
```

```ts
export type SkillCastCondition =
    | { type: 'always' }
    | { type: 'targetHpBelow'; ratio: number }
    | { type: 'playerHpBelow'; ratio: number }
    | { type: 'enemyCountNearby'; count: number; radius: number }
    | { type: 'targetInRange'; range: number }
    | { type: 'missingBuff'; buffId: string };
```

```ts
export type SkillEffect =
    | { type: 'damage'; multiplier: number }
    | { type: 'heal'; ratio: number }
    | { type: 'buff'; stat: 'atk' | 'def' | 'attackSpeed' | 'critRate'; value: number; durationMs: number }
    | { type: 'execute'; threshold: number; bonusMultiplier: number }
    | { type: 'passiveStat'; stat: 'atk' | 'def' | 'maxHp' | 'critRate' | 'critDamage' | 'moveSpeed'; value: number };
```

## 6. 首批技能清单

首版目标总计 15 个技能：每个基础职业 1 主动 + 1 被动，每个专精 1 主动。

### 6.1 狂战士

- 基础主动：裂地斩
  - 类型：`active`
  - 解锁：Lv.1
  - 条件：`always`
  - 效果：对当前目标造成 180% 伤害

- 基础被动：战斗狂热
  - 类型：`passive`
  - 解锁：Lv.5
  - 效果：攻击 +6，暴击伤害 +10%

- 屠戮者主动：处刑突袭
  - 类型：`active`
  - 解锁：Lv.10 + 屠戮者
  - 条件：目标 HP 低于 40%
  - 效果：造成 210% 伤害，斩杀阈值内追加倍率

- 战吼统帅主动：战旗冲锋
  - 类型：`active`
  - 解锁：Lv.10 + 战吼统帅
  - 条件：`always`
  - 效果：造成 170% 伤害，并获得短时防御增益

- 血怒守卫主动：血怒反斩
  - 类型：`active`
  - 解锁：Lv.10 + 血怒守卫
  - 条件：玩家 HP 低于 60%
  - 效果：造成 180% 伤害，并恢复最大生命 8%

### 6.2 游侠

- 基础主动：穿风箭
  - 类型：`active`
  - 解锁：Lv.1
  - 条件：`always`
  - 效果：造成 160% 伤害，暴击率 +18%

- 基础被动：鹰眼节奏
  - 类型：`passive`
  - 解锁：Lv.5
  - 效果：暴击率 +4%，移动速度 +8

- 神射手主动：爆头狙击
  - 类型：`active`
  - 解锁：Lv.10 + 神射手
  - 条件：目标 HP 低于 55%
  - 效果：造成 190% 伤害，暴击率 +30%

- 陷阱大师主动：诱捕爆发
  - 类型：`active`
  - 解锁：Lv.10 + 陷阱大师
  - 条件：附近敌人数量 >= 2
  - 效果：造成 175% 伤害，并预留减速/控制扩展

- 兽王猎手主动：兽群协猎
  - 类型：`active`
  - 解锁：Lv.10 + 兽王猎手
  - 条件：`always`
  - 效果：造成 180% 伤害，并恢复最大生命 5%

### 6.3 法师

- 基础主动：奥术冲击
  - 类型：`active`
  - 解锁：Lv.1
  - 条件：`always`
  - 效果：造成 170% 伤害，暴击伤害 +18%

- 基础被动：秘法专注
  - 类型：`passive`
  - 解锁：Lv.5
  - 效果：攻击 +5，暴击伤害 +15%

- 元素术士主动：元素耀斑
  - 类型：`active`
  - 解锁：Lv.10 + 元素术士
  - 条件：`always`
  - 效果：造成 195% 伤害，暴击伤害 +28%

- 奥术学者主动：奥术激流
  - 类型：`active`
  - 解锁：Lv.10 + 奥术学者
  - 条件：`always`
  - 效果：造成 175% 伤害，暴击率 +18%

- 召唤先知主动：先知敕令
  - 类型：`active`
  - 解锁：Lv.10 + 召唤先知
  - 条件：`always`
  - 效果：造成 185% 伤害，并恢复最大生命 7%

## 7. UI 方案

- 入口：主城面板新增“技能配置”按钮，或角色面板内增加技能页。
- 左侧：当前技能槽。
- 右侧：技能池列表。
- 下方：技能说明、释放条件、冷却、效果、解锁要求。
- 未解锁技能灰显。
- 点击已解锁技能后装备到对应槽位。
- 被动技能可选择放入 `passive1` 或 `passive2`。

首版 UI 可复用现有 Phaser 面板系统，不新增独立场景。

## 8. 存档兼容

角色数据新增：

```ts
skillLoadout: SkillLoadout;
```

旧存档迁移：

- 如果没有 `skillLoadout`，按当前基础职业自动装备 Lv.1 基础主动。
- 如果角色已有专精，自动装备对应专精主动。
- 被动槽和触发槽默认为 `null`。
- 若读档后某技能不再满足职业 / 专精条件，自动卸下。

## 9. 实现计划

- 阶段 1：数据模型与迁移
  - 扩展技能定义
  - 增加 `SkillLoadout`
  - 增加读档归一化

- 阶段 2：战斗接入
  - 替换当前单技能自动释放逻辑
  - 实现槽位优先级
  - 实现条件判断
  - 接入被动加成

- 阶段 3：UI 接入
  - 技能配置面板
  - 技能解锁状态展示
  - 技能装备 / 替换操作

- 阶段 4：平衡与回归
  - 职业、专精技能数值检查
  - 存档兼容检查
  - 自动战斗循环回归

## 10. 风险点

- 自动释放优先级设计不当会导致部分技能长期无法释放。
- 被动技能和装备词条叠加后可能出现数值膨胀。
- 触发技能若条件过宽，会抢占主动技能节奏。
- UI 若一次展示 15+ 技能，信息密度需要控制。

## 11. 测试计划

- 手工测试步骤：
  - 新角色进入技能配置，确认默认基础主动已装备。
  - 升到 Lv.5 后确认基础被动解锁并可装备。
  - 完成转职后确认专精主动解锁并可装备。
  - 进入地牢，确认自动释放顺序符合优先级。
  - 存档、读档后确认技能搭配保持。
- 边界情况：
  - 未满足等级时强行装备技能
  - 转职前尝试装备专精技能
  - 读档后职业 / 专精不匹配的技能仍在槽位中
  - 两个被动槽装备同一技能
- 性能影响检查：
  - 条件判断只在战斗攻击节奏中执行，不做每帧全技能扫描。

## 12. 变更记录

- 2026-04-17: 创建设计文档，明确全自动释放、5 槽搭配、释放优先级、首批 15 个技能与分阶段实现计划
- 2026-04-17: 已实现首版技能搭配数据、旧存档默认迁移、自动释放候选队列、条件判断、被动属性加成和技能配置面板，状态更新为 Testing
- 2026-04-17: 技能系统完善阶段已扩展触发技能、专精被动、技能 buff、HUD 冷却显示和技能标签展示，详见 `.agents/docs/02-combat/2026-04-17-skill-system-completion-phase.md`
