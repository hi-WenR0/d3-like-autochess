#!/usr/bin/env python3
"""
战斗数值模拟器与平衡调参工具

根据 Phaser 4 游戏代码中的战斗逻辑，模拟角色与怪物之间的战斗，
批量输出胜率、平均击杀时间、平均剩余血量等指标，辅助数值平衡调整。

用法：
    python scripts/balance_simulator.py [--floor-min 1] [--floor-max 10] [--simulations 1000] [--seed 42]
"""

import argparse
import csv
import json
import random
import math
import sys
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any, Literal
from enum import Enum

# ============================================================================
# 数据类型定义（从 TypeScript 模型映射）
# ============================================================================

CombatStyle = Literal['melee', 'ranged']
MovementStrategy = Literal['approach', 'retreat']
CharacterBaseClass = Literal['berserker', 'ranger', 'mage']
MonsterType = Literal['normal', 'elite', 'rare', 'boss']
SkillType = Literal['active', 'passive', 'trigger']
SkillSlotType = Literal['basicActive', 'specializationActive', 'passive1', 'passive2', 'trigger']

@dataclass
class CharacterStats:
    """角色属性"""
    hp: int
    max_hp: int
    atk: int
    def_: int  # 因为 def 是 Python 关键字，加下划线
    attack_speed: float  # 每秒攻击次数
    crit_rate: float     # 0-100%
    crit_damage: float   # 暴击伤害倍率 (e.g. 150 = 1.5x)
    move_speed: int      # 像素/秒，模拟中可能不用

@dataclass
class CharacterBaseClassDef:
    id: CharacterBaseClass
    label: str
    description: str
    color: str
    combat_style: CombatStyle
    starting_stats: CharacterStats
    growth: Dict[str, int]  # maxHp, atk, def

@dataclass
class CharacterSpecializationBonuses:
    hp: int = 0
    atk: int = 0
    def_: int = 0
    attack_speed_pct: int = 0
    crit_rate: int = 0
    crit_damage: int = 0
    move_speed: int = 0

@dataclass
class CharacterSpecializationDef:
    id: str
    label: str
    description: str
    bonuses: CharacterSpecializationBonuses

@dataclass
class SkillDefinition:
    id: str
    label: str
    description: str
    type: SkillType
    slot: SkillSlotType
    required_class: CharacterBaseClass
    required_specialization: Optional[str] = None
    unlock_level: int = 1
    cooldown_ms: int = 0
    priority: int = 0
    damage_multiplier: float = 1.0
    crit_rate_bonus: float = 0
    crit_damage_bonus: float = 0
    heal_ratio: float = 0

@dataclass
class MonsterStats:
    max_hp: int
    hp: int
    atk: int
    exp: int
    gold: int
    move_speed: int

@dataclass
class MonsterTypeDef:
    hp_multiplier: float
    atk_multiplier: float
    skill_count: int
    movement_strategy: MovementStrategy
    combat_style: CombatStyle
    move_speed_multiplier: float

@dataclass
class AffixEffects:
    """装备词条效果汇总"""
    # 基础属性加成
    hp: int = 0
    atk: int = 0
    def_: int = 0
    crit_rate: float = 0
    crit_damage: float = 0
    attack_speed_pct: float = 0
    move_speed: int = 0
    
    # 特殊词条效果
    penetration: float = 0          # 无视防御百分比
    life_steal: float = 0           # 吸血百分比
    hp_regen: float = 0             # 每秒回复 HP
    damage_reduction: float = 0     # 伤害减免百分比
    evasion: float = 0              # 闪避率百分比
    combo_chance: float = 0         # 连击概率
    whirlwind_chance: float = 0     # 旋风斩概率（暂未使用）
    rebirth_chance: float = 0       # 复活概率（暂未使用）
    predator_chance: float = 0      # 掠夺者概率（暂未使用）
    berserker_atk_bonus: float = 0  # 狂战士 ATK 加成百分比
    immortal_cooldown: float = 0    # 不朽冷却（秒）
    skill_damage_bonus: float = 0   # 技能伤害百分比
    trigger_cooldown_reduction: float = 0  # 触发技能冷却缩减百分比
    active_cooldown_reduction: float = 0   # 主动技能冷却缩减百分比
    healing_skill_power: float = 0  # 技能治疗效果百分比
    elemental_skill_damage_bonus: float = 0  # 元素标签技能伤害百分比

@dataclass
class SimulationScenario:
    """模拟场景配置"""
    floor_min: int = 1
    floor_max: int = 10
    base_class: CharacterBaseClass = 'berserker'
    specialization: Optional[str] = None
    level: int = 1
    equipment_tier: str = 'common'  # common, magic, rare, legendary, mythic
    skill_config: str = 'default'   # default, optimal, random
    simulations_per_floor: int = 100
    random_seed: Optional[int] = None

@dataclass
class SimulationResult:
    """单场战斗结果"""
    floor: int
    monster_type: MonsterType
    victory: bool
    time_to_kill: float  # 秒
    player_hp_remaining: int
    player_hp_percent: float
    monster_hp_remaining: int
    damage_dealt: int
    damage_taken: int
    crit_count: int
    skill_uses: int
    potions_used: int = 0
    gold_gained: int = 0
    exp_gained: int = 0

@dataclass
class AggregateResult:
    """聚合结果（按楼层/类型）"""
    floor: int
    monster_type: MonsterType
    total_simulations: int
    victories: int
    victory_rate: float
    avg_time_to_kill: float
    avg_player_hp_percent: float
    avg_damage_dealt: int
    avg_damage_taken: int
    avg_crit_count: float
    avg_skill_uses: float
    median_time_to_kill: float
    p90_time_to_kill: float

# ============================================================================
# 游戏数据配置（从 TypeScript 代码移植）
# ============================================================================

# 职业基础配置
BASE_CLASS_CONFIG: Dict[CharacterBaseClass, CharacterBaseClassDef] = {
    'berserker': CharacterBaseClassDef(
        id='berserker',
        label='狂战士',
        description='高生命、高攻击的近战起手',
        color='#e74c3c',
        combat_style='melee',
        starting_stats=CharacterStats(
            hp=240, max_hp=240, atk=18, def_=6,
            attack_speed=0.95, crit_rate=5, crit_damage=155, move_speed=98
        ),
        growth={'maxHp': 20, 'atk': 3, 'def': 1}
    ),
    'ranger': CharacterBaseClassDef(
        id='ranger',
        label='游侠',
        description='高攻速、高暴击率的灵活输出',
        color='#27ae60',
        combat_style='ranged',
        starting_stats=CharacterStats(
            hp=190, max_hp=190, atk=14, def_=4,
            attack_speed=1.2, crit_rate=8, crit_damage=150, move_speed=112
        ),
        growth={'maxHp': 12, 'atk': 2, 'def': 1}
    ),
    'mage': CharacterBaseClassDef(
        id='mage',
        label='法师',
        description='高暴击伤害与均衡属性的施法者',
        color='#3498db',
        combat_style='ranged',
        starting_stats=CharacterStats(
            hp=180, max_hp=180, atk=16, def_=4,
            attack_speed=1.05, crit_rate=6, crit_damage=165, move_speed=102
        ),
        growth={'maxHp': 10, 'atk': 3, 'def': 1}
    ),
}

# 专精配置
SPECIALIZATION_CONFIG: Dict[Tuple[CharacterBaseClass, str], CharacterSpecializationDef] = {}

def _init_specializations():
    """初始化专精配置（从 TypeScript 代码简化）"""
    # 狂战士专精
    SPECIALIZATION_CONFIG[('berserker', 'slayer')] = CharacterSpecializationDef(
        id='slayer', label='屠戮者', description='偏爆发和斩杀',
        bonuses=CharacterSpecializationBonuses(atk=10, crit_damage=25)
    )
    SPECIALIZATION_CONFIG[('berserker', 'warlord')] = CharacterSpecializationDef(
        id='warlord', label='战吼统帅', description='偏团队增幅和压场',
        bonuses=CharacterSpecializationBonuses(hp=40, atk=6, def_=4)
    )
    SPECIALIZATION_CONFIG[('berserker', 'bloodguard')] = CharacterSpecializationDef(
        id='bloodguard', label='血怒守卫', description='偏续航和反打',
        bonuses=CharacterSpecializationBonuses(hp=80, def_=6, attack_speed_pct=8)
    )
    # 游侠专精
    SPECIALIZATION_CONFIG[('ranger', 'sharpshooter')] = CharacterSpecializationDef(
        id='sharpshooter', label='神射手', description='偏远程单点与爆头',
        bonuses=CharacterSpecializationBonuses(atk=8, crit_rate=6, crit_damage=20)
    )
    SPECIALIZATION_CONFIG[('ranger', 'trapper')] = CharacterSpecializationDef(
        id='trapper', label='陷阱大师', description='偏控制和区域压制',
        bonuses=CharacterSpecializationBonuses(attack_speed_pct=14, move_speed=12, def_=3)
    )
    SPECIALIZATION_CONFIG[('ranger', 'beastmaster')] = CharacterSpecializationDef(
        id='beastmaster', label='兽王猎手', description='偏召唤协同与持续输出',
        bonuses=CharacterSpecializationBonuses(hp=50, atk=7, move_speed=10)
    )
    # 法师专精
    SPECIALIZATION_CONFIG[('mage', 'elementalist')] = CharacterSpecializationDef(
        id='elementalist', label='元素术士', description='偏元素爆发与范围伤害',
        bonuses=CharacterSpecializationBonuses(atk=12, crit_damage=18, attack_speed_pct=6)
    )
    SPECIALIZATION_CONFIG[('mage', 'arcanist')] = CharacterSpecializationDef(
        id='arcanist', label='奥术学者', description='偏资源循环与法术强化',
        bonuses=CharacterSpecializationBonuses(atk=8, crit_rate=5, move_speed=8)
    )
    SPECIALIZATION_CONFIG[('mage', 'summoner')] = CharacterSpecializationDef(
        id='summoner', label='召唤先知', description='偏召唤体与战场控制',
        bonuses=CharacterSpecializationBonuses(hp=70, def_=5, crit_damage=15)
    )

_init_specializations()

# 怪物类型配置
MONSTER_TYPE_CONFIG: Dict[MonsterType, MonsterTypeDef] = {
    'normal': MonsterTypeDef(
        hp_multiplier=1.0, atk_multiplier=1.0, skill_count=0,
        movement_strategy='approach', combat_style='melee', move_speed_multiplier=1.0
    ),
    'elite': MonsterTypeDef(
        hp_multiplier=1.5, atk_multiplier=1.2, skill_count=2,
        movement_strategy='approach', combat_style='melee', move_speed_multiplier=1.05
    ),
    'rare': MonsterTypeDef(
        hp_multiplier=2.0, atk_multiplier=1.5, skill_count=3,
        movement_strategy='retreat', combat_style='ranged', move_speed_multiplier=0.95
    ),
    'boss': MonsterTypeDef(
        hp_multiplier=5.0, atk_multiplier=2.0, skill_count=5,
        movement_strategy='approach', combat_style='melee', move_speed_multiplier=0.9
    ),
}

# 怪物基础属性（第1层）
MONSTER_BASE_STATS = {
    'hp': 50,
    'atk': 8,
    'exp': 20,
    'gold': 5,
    'move_speed': 72,
}

# 怪物生成权重
MONSTER_SPAWN_WEIGHTS: Dict[MonsterType, float] = {
    'normal': 80,
    'elite': 15,
    'rare': 4,
    'boss': 1,
}

# 技能配置（简化版，只包含基础主动技能）
SKILLS: List[SkillDefinition] = [
    # 狂战士基础主动
    SkillDefinition(
        id='berserker-cleave',
        label='裂地斩',
        description='狂战士重击前方敌人，造成更高伤害。',
        type='active',
        slot='basicActive',
        required_class='berserker',
        damage_multiplier=1.8,
        crit_damage_bonus=15,
        cooldown_ms=6500,
        priority=30
    ),
    # 游侠基础主动
    SkillDefinition(
        id='ranger-volley',
        label='穿风箭',
        description='游侠精准射击，提升暴击率与伤害。',
        type='active',
        slot='basicActive',
        required_class='ranger',
        damage_multiplier=1.6,
        crit_rate_bonus=18,
        crit_damage_bonus=10,
        cooldown_ms=6000,
        priority=30
    ),
    # 法师基础主动
    SkillDefinition(
        id='mage-burst',
        label='奥术冲击',
        description='法师释放高强度法术冲击。',
        type='active',
        slot='basicActive',
        required_class='mage',
        damage_multiplier=1.7,
        crit_damage_bonus=18,
        cooldown_ms=6200,
        priority=30
    ),
]

# 每点属性点带来的增益
STAT_PER_POINT = {
    'hp': 10,
    'atk': 3,
    'def': 2,
    'attack_speed': 0.02,
    'crit_rate': 0.5,
    'crit_damage': 3,
    'move_speed': 2,
}

# 装备稀有度对应的词条效果估算
EQUIPMENT_TIER_EFFECTS: Dict[str, AffixEffects] = {
    'common': AffixEffects(),  # 无额外词条
    'magic': AffixEffects(
        atk=5, def_=3, hp=20,
        penetration=5, life_steal=2
    ),
    'rare': AffixEffects(
        atk=10, def_=6, hp=40,
        penetration=10, life_steal=4, damage_reduction=5,
        crit_rate=3, crit_damage=10
    ),
    'legendary': AffixEffects(
        atk=20, def_=12, hp=80,
        penetration=15, life_steal=8, damage_reduction=10,
        crit_rate=6, crit_damage=20, evasion=5,
        skill_damage_bonus=15
    ),
    'mythic': AffixEffects(
        atk=35, def_=20, hp=150,
        penetration=20, life_steal=12, damage_reduction=15,
        crit_rate=10, crit_damage=35, evasion=8,
        skill_damage_bonus=25, healing_skill_power=20
    ),
}

# ============================================================================
# 核心模拟逻辑
# ============================================================================

def monster_stats_for_floor(floor: int, monster_type: MonsterType) -> MonsterStats:
    """根据层数和怪物类型计算怪物属性"""
    cfg = MONSTER_TYPE_CONFIG[monster_type]
    base = MONSTER_BASE_STATS
    
    max_hp = math.floor(base['hp'] * (1 + floor * 0.15) * cfg.hp_multiplier)
    atk = math.floor(base['atk'] * (1 + floor * 0.12) * cfg.atk_multiplier)
    exp = math.floor(base['exp'] * (1 + floor * 0.1))
    gold = math.floor(base['gold'] * (1 + floor * 0.1))
    move_speed = math.floor(base['move_speed'] * cfg.move_speed_multiplier)
    
    return MonsterStats(
        max_hp=max_hp,
        hp=max_hp,
        atk=atk,
        exp=exp,
        gold=gold,
        move_speed=move_speed
    )


def create_character_stats(
    base_class: CharacterBaseClass,
    specialization: Optional[str],
    level: int,
    equipment_tier: str
) -> Tuple[CharacterStats, AffixEffects]:
    """创建角色属性和词条效果"""
    class_def = BASE_CLASS_CONFIG[base_class]
    
    # 基础属性 = 起始属性 + 成长 * (等级-1)
    growth = class_def.growth
    base_stats = class_def.starting_stats
    
    max_hp = base_stats.max_hp + growth.get('maxHp', 0) * (level - 1)
    atk = base_stats.atk + growth.get('atk', 0) * (level - 1)
    def_ = base_stats.def_ + growth.get('def', 0) * (level - 1)
    
    # 专精加成
    spec_bonuses = CharacterSpecializationBonuses()
    if specialization:
        key = (base_class, specialization)
        if key in SPECIALIZATION_CONFIG:
            spec_bonuses = SPECIALIZATION_CONFIG[key].bonuses
    
    # 装备词条效果（简化：直接加到属性上）
    equip_effects = EQUIPMENT_TIER_EFFECTS.get(equipment_tier, AffixEffects())
    
    # 计算最终属性
    stats = CharacterStats(
        hp=max_hp + spec_bonuses.hp + equip_effects.hp,
        max_hp=max_hp + spec_bonuses.hp + equip_effects.hp,
        atk=atk + spec_bonuses.atk + equip_effects.atk,
        def_=def_ + spec_bonuses.def_ + equip_effects.def_,
        attack_speed=base_stats.attack_speed * (1 + spec_bonuses.attack_speed_pct / 100),
        crit_rate=base_stats.crit_rate + spec_bonuses.crit_rate + equip_effects.crit_rate,
        crit_damage=base_stats.crit_damage + spec_bonuses.crit_damage + equip_effects.crit_damage,
        move_speed=base_stats.move_speed + spec_bonuses.move_speed
    )
    
    return stats, equip_effects


def calculate_damage(
    attacker_stats: CharacterStats,
    effects: AffixEffects,
    is_skill: bool = False,
    skill_multiplier: float = 1.0,
    skill_crit_rate_bonus: float = 0,
    skill_crit_damage_bonus: float = 0
) -> Tuple[int, bool]:
    """计算单次攻击伤害"""
    # 暴击判定
    crit_chance = attacker_stats.crit_rate + skill_crit_rate_bonus
    is_crit = random.random() * 100 < crit_chance
    
    # 基础攻击力
    damage = attacker_stats.atk
    
    # 暴击伤害
    if is_crit:
        crit_multiplier = (attacker_stats.crit_damage + skill_crit_damage_bonus) / 100
        damage = math.floor(damage * crit_multiplier)
    
    # 技能倍率
    if is_skill:
        skill_bonus = 1 + max(0, effects.skill_damage_bonus) / 100
        damage = math.floor(damage * skill_multiplier * skill_bonus)
    
    # 随机浮动 ±10%
    variance = 0.9 + random.random() * 0.2
    damage = math.floor(damage * variance)
    
    return max(1, damage), is_crit


def apply_damage_to_monster(damage: int, monster_def: int, effects: AffixEffects) -> int:
    """计算对怪物的实际伤害（含穿透）"""
    # 穿透：无视部分防御
    effective_def = math.floor(monster_def * (1 - effects.penetration / 100))
    return max(1, damage - effective_def)


def calculate_incoming_damage(
    raw_damage: int,
    player_def: int,
    effects: AffixEffects
) -> Tuple[int, bool]:
    """计算受到的伤害（含减免、闪避）"""
    # 闪避判定
    if random.random() * 100 < effects.evasion:
        return 0, True
    
    # 减免 + 防御
    after_def = max(1, raw_damage - player_def)
    after_reduction = math.floor(after_def * (1 - effects.damage_reduction / 100))
    
    return max(1, after_reduction), False


def simulate_single_combat(
    player_stats: CharacterStats,
    effects: AffixEffects,
    monster: MonsterStats,
    monster_type: MonsterType,
    floor: int,
    base_class: CharacterBaseClass,
    max_time_seconds: float = 60.0
) -> SimulationResult:
    """
    模拟单场战斗
    
    简化假设：
    - 玩家和怪物轮流攻击
    - 玩家攻击频率由 attack_speed 决定
    - 怪物每1秒攻击一次
    - 玩家可以使用技能（冷却时间）
    - 战斗最多持续 max_time_seconds 秒
    """
    # 战斗状态初始化
    player_hp = player_stats.hp
    monster_hp = monster.hp
    monster_atk = monster.atk
    
    time_elapsed = 0.0
    player_attack_interval = 1.0 / player_stats.attack_speed
    player_next_attack = 0.0
    monster_next_attack = 1.0  # 怪物每秒攻击一次
    
    # 技能状态
    basic_skill = next((s for s in SKILLS if s.required_class == base_class and s.slot == 'basicActive'), None)
    skill_cooldown = 0.0
    skill_cooldown_ms = basic_skill.cooldown_ms if basic_skill else 0
    skill_cooldown_seconds = skill_cooldown_ms / 1000.0 if skill_cooldown_ms > 0 else 0
    
    # 统计
    damage_dealt = 0
    damage_taken = 0
    crit_count = 0
    skill_uses = 0
    potions_used = 0
    
    # 主循环
    while time_elapsed < max_time_seconds:
        # 玩家攻击
        if time_elapsed >= player_next_attack:
            # 判断是否使用技能
            use_skill = False
            if basic_skill and skill_cooldown <= 0:
                use_skill = True
                skill_cooldown = skill_cooldown_seconds
                skill_uses += 1
            
            if use_skill and basic_skill:
                # 技能伤害
                damage, is_crit = calculate_damage(
                    player_stats, effects,
                    is_skill=True,
                    skill_multiplier=basic_skill.damage_multiplier,
                    skill_crit_rate_bonus=basic_skill.crit_rate_bonus,
                    skill_crit_damage_bonus=basic_skill.crit_damage_bonus
                )
            else:
                # 普通攻击
                damage, is_crit = calculate_damage(player_stats, effects)
            
            # 应用穿透和防御
            monster_def = math.floor(monster_atk * 0.3)  # 简化：怪物防御 = 30%攻击力
            actual_damage = apply_damage_to_monster(damage, monster_def, effects)
            
            # 吸血
            if effects.life_steal > 0:
                heal_amount = math.floor(actual_damage * effects.life_steal / 100)
                player_hp = min(player_stats.max_hp, player_hp + heal_amount)
            
            monster_hp -= actual_damage
            damage_dealt += actual_damage
            if is_crit:
                crit_count += 1
            
            player_next_attack += player_attack_interval
            
            # 检查怪物是否死亡
            if monster_hp <= 0:
                break
        
        # 怪物攻击
        if time_elapsed >= monster_next_attack and monster_hp > 0:
            incoming_damage, evaded = calculate_incoming_damage(
                monster_atk, player_stats.def_, effects
            )
            
            if not evaded:
                player_hp -= incoming_damage
                damage_taken += incoming_damage
            
            monster_next_attack += 1.0  # 怪物每秒攻击一次
            
            # 检查玩家是否死亡
            if player_hp <= 0:
                break
        
        # 时间推进（取下一个事件的时间）
        next_event = min(
            player_next_attack if monster_hp > 0 else float('inf'),
            monster_next_attack if player_hp > 0 else float('inf'),
            max_time_seconds
        )
        delta_time = next_event - time_elapsed
        
        # 更新冷却
        if skill_cooldown > 0:
            skill_cooldown = max(0, skill_cooldown - delta_time)
        
        time_elapsed = next_event
    
    # 判断胜负
    victory = monster_hp <= 0 and player_hp > 0
    
    # 构建结果
    return SimulationResult(
        floor=floor,
        monster_type=monster_type,
        victory=victory,
        time_to_kill=time_elapsed if victory else max_time_seconds,
        player_hp_remaining=player_hp,
        player_hp_percent=player_hp / player_stats.max_hp if player_stats.max_hp > 0 else 0,
        monster_hp_remaining=monster_hp,
        damage_dealt=damage_dealt,
        damage_taken=damage_taken,
        crit_count=crit_count,
        skill_uses=skill_uses,
        potions_used=potions_used,
        gold_gained=monster.gold if victory else 0,
        exp_gained=monster.exp if victory else 0
    )


def aggregate_results(results: List[SimulationResult]) -> Dict[Tuple[int, MonsterType], AggregateResult]:
    """聚合多场战斗结果"""
    grouped = {}
    for result in results:
        key = (result.floor, result.monster_type)
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(result)
    
    aggregated = {}
    for (floor, monster_type), group_results in grouped.items():
        victories = sum(1 for r in group_results if r.victory)
        total = len(group_results)
        
        # 只统计胜利的战斗时间
        victory_times = [r.time_to_kill for r in group_results if r.victory]
        
        aggregated[(floor, monster_type)] = AggregateResult(
            floor=floor,
            monster_type=monster_type,
            total_simulations=total,
            victories=victories,
            victory_rate=victories / total if total > 0 else 0,
            avg_time_to_kill=sum(victory_times) / len(victory_times) if victory_times else 0,
            avg_player_hp_percent=sum(r.player_hp_percent for r in group_results) / total,
            avg_damage_dealt=sum(r.damage_dealt for r in group_results) // total,
            avg_damage_taken=sum(r.damage_taken for r in group_results) // total,
            avg_crit_count=sum(r.crit_count for r in group_results) / total,
            avg_skill_uses=sum(r.skill_uses for r in group_results) / total,
            median_time_to_kill=sorted(victory_times)[len(victory_times)//2] if victory_times else 0,
            p90_time_to_kill=sorted(victory_times)[int(len(victory_times)*0.9)] if victory_times else 0
        )
    
    return aggregated


def run_simulation(scenario: SimulationScenario) -> Tuple[List[SimulationResult], Dict[Tuple[int, MonsterType], AggregateResult]]:
    """运行完整模拟"""
    # 设置随机种子
    if scenario.random_seed is not None:
        random.seed(scenario.random_seed)
    
    all_results = []
    
    # 遍历楼层
    for floor in range(scenario.floor_min, scenario.floor_max + 1):
        # 创建玩家属性
        player_stats, effects = create_character_stats(
            scenario.base_class,
            scenario.specialization,
            scenario.level,
            scenario.equipment_tier
        )
        
        # 遍历怪物类型
        for monster_type, weight in MONSTER_SPAWN_WEIGHTS.items():
            # 根据权重决定模拟次数
            sim_count = max(1, int(scenario.simulations_per_floor * weight / 100))
            
            for _ in range(sim_count):
                # 创建怪物
                monster = monster_stats_for_floor(floor, monster_type)
                
                # 模拟战斗
                result = simulate_single_combat(
                    player_stats, effects, monster, monster_type, floor, scenario.base_class
                )
                all_results.append(result)
    
    # 聚合结果
    aggregated = aggregate_results(all_results)
    
    return all_results, aggregated


# ============================================================================
# 输出和报告
# ============================================================================

def save_csv_results(results: List[SimulationResult], filename: str):
    """保存详细结果到 CSV"""
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'floor', 'monster_type', 'victory', 'time_to_kill', 
            'player_hp_remaining', 'player_hp_percent', 'monster_hp_remaining',
            'damage_dealt', 'damage_taken', 'crit_count', 'skill_uses',
            'potions_used', 'gold_gained', 'exp_gained'
        ])
        
        for r in results:
            writer.writerow([
                r.floor, r.monster_type, 1 if r.victory else 0, r.time_to_kill,
                r.player_hp_remaining, r.player_hp_percent, r.monster_hp_remaining,
                r.damage_dealt, r.damage_taken, r.crit_count, r.skill_uses,
                r.potions_used, r.gold_gained, r.exp_gained
            ])


def save_aggregated_csv(aggregated: Dict[Tuple[int, MonsterType], AggregateResult], filename: str):
    """保存聚合结果到 CSV"""
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'floor', 'monster_type', 'total_simulations', 'victories', 'victory_rate',
            'avg_time_to_kill', 'avg_player_hp_percent', 'avg_damage_dealt',
            'avg_damage_taken', 'avg_crit_count', 'avg_skill_uses',
            'median_time_to_kill', 'p90_time_to_kill'
        ])
        
        for key in sorted(aggregated.keys()):
            r = aggregated[key]
            writer.writerow([
                r.floor, r.monster_type, r.total_simulations, r.victories, r.victory_rate,
                r.avg_time_to_kill, r.avg_player_hp_percent, r.avg_damage_dealt,
                r.avg_damage_taken, r.avg_crit_count, r.avg_skill_uses,
                r.median_time_to_kill, r.p90_time_to_kill
            ])


def generate_markdown_report(
    scenario: SimulationScenario,
    aggregated: Dict[Tuple[int, MonsterType], AggregateResult],
    filename: str
):
    """生成 Markdown 格式的报告"""
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(f"# 战斗数值模拟报告\n\n")
        f.write(f"生成时间: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        f.write(f"## 模拟配置\n")
        f.write(f"- 楼层范围: {scenario.floor_min} - {scenario.floor_max}\n")
        f.write(f"- 职业: {scenario.base_class}\n")
        f.write(f"- 专精: {scenario.specialization or '无'}\n")
        f.write(f"- 等级: {scenario.level}\n")
        f.write(f"- 装备档位: {scenario.equipment_tier}\n")
        f.write(f"- 每层模拟次数: {scenario.simulations_per_floor}\n")
        f.write(f"- 随机种子: {scenario.random_seed or '未设置'}\n\n")
        
        f.write(f"## 总体胜率\n")
        
        # 按楼层统计
        floors = sorted(set(k[0] for k in aggregated.keys()))
        for floor in floors:
            f.write(f"\n### 第 {floor} 层\n")
            f.write("| 怪物类型 | 模拟次数 | 胜利次数 | 胜率 | 平均击杀时间(s) | 平均剩余血量% |\n")
            f.write("|----------|----------|----------|------|------------------|----------------|\n")
            
            floor_results = [agg for (f, m), agg in aggregated.items() if f == floor]
            for r in sorted(floor_results, key=lambda x: MONSTER_SPAWN_WEIGHTS.get(x.monster_type, 0), reverse=True):
                f.write(f"| {r.monster_type} | {r.total_simulations} | {r.victories} | {r.victory_rate:.1%} | {r.avg_time_to_kill:.2f} | {r.avg_player_hp_percent:.1%} |\n")
        
        # 识别难度问题
        f.write("\n## 平衡性问题识别\n")
        
        low_difficulty = []
        high_difficulty = []
        
        for key, r in aggregated.items():
            floor, monster_type = key
            if r.victory_rate > 0.95 and r.avg_time_to_kill < 5:
                low_difficulty.append((floor, monster_type, r.victory_rate, r.avg_time_to_kill))
            elif r.victory_rate < 0.5:
                high_difficulty.append((floor, monster_type, r.victory_rate, r.avg_time_to_kill))
        
        if low_difficulty:
            f.write("\n### 难度偏低（需要加强怪物）\n")
            for floor, mtype, rate, ttk in low_difficulty:
                f.write(f"- 第 {floor} 层 {mtype}: 胜率 {rate:.1%}, 平均击杀时间 {ttk:.2f}s\n")
        
        if high_difficulty:
            f.write("\n### 难度偏高（需要削弱怪物或加强玩家）\n")
            for floor, mtype, rate, ttk in high_difficulty:
                f.write(f"- 第 {floor} 层 {mtype}: 胜率 {rate:.1%}, 平均击杀时间 {ttk:.2f}s\n")
        
        if not low_difficulty and not high_difficulty:
            f.write("\n当前数值曲线较为平衡，未发现明显问题。\n")
        
        f.write("\n## 建议调整方向\n")
        f.write("1. 根据识别出的难度问题，调整怪物生命、攻击或成长系数\n")
        f.write("2. 考虑调整装备词条效果或专精加成数值\n")
        f.write("3. 重新运行模拟器验证调整效果\n")


def print_summary(aggregated: Dict[Tuple[int, MonsterType], AggregateResult]):
    """在控制台输出简要总结"""
    print("\n=== 模拟结果摘要 ===\n")
    
    # 总体胜率
    total_simulations = sum(r.total_simulations for r in aggregated.values())
    total_victories = sum(r.victories for r in aggregated.values())
    overall_rate = total_victories / total_simulations if total_simulations > 0 else 0
    
    print(f"总体胜率: {overall_rate:.1%} ({total_victories}/{total_simulations})")
    
    # 按楼层统计
    floors = sorted(set(k[0] for k in aggregated.keys()))
    for floor in floors:
        floor_results = [agg for (f, m), agg in aggregated.items() if f == floor]
        floor_sim = sum(r.total_simulations for r in floor_results)
        floor_victories = sum(r.victories for r in floor_results)
        floor_rate = floor_victories / floor_sim if floor_sim > 0 else 0
        
        print(f"  第 {floor} 层: {floor_rate:.1%} ({floor_victories}/{floor_sim})")
    
    print("\n详细结果已保存到 CSV 和 Markdown 文件。")


# ============================================================================
# 主程序
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description='战斗数值模拟器')
    parser.add_argument('--floor-min', type=int, default=1, help='起始楼层')
    parser.add_argument('--floor-max', type=int, default=10, help='结束楼层')
    parser.add_argument('--class', dest='base_class', default='berserker', 
                       choices=['berserker', 'ranger', 'mage'], help='职业')
    parser.add_argument('--specialization', type=str, help='专精')
    parser.add_argument('--level', type=int, default=1, help='角色等级')
    parser.add_argument('--equipment-tier', default='common',
                       choices=['common', 'magic', 'rare', 'legendary', 'mythic'],
                       help='装备档位')
    parser.add_argument('--simulations', type=int, default=1000, help='总模拟次数')
    parser.add_argument('--seed', type=int, help='随机种子')
    parser.add_argument('--output-dir', default='.', help='输出目录')
    
    args = parser.parse_args()
    
    # 构建场景
    scenario = SimulationScenario(
        floor_min=args.floor_min,
        floor_max=args.floor_max,
        base_class=args.base_class,
        specialization=args.specialization,
        level=args.level,
        equipment_tier=args.equipment_tier,
        simulations_per_floor=max(1, args.simulations // (args.floor_max - args.floor_min + 1)),
        random_seed=args.seed
    )
    
    print(f"开始模拟: {scenario}")
    print(f"配置: {scenario.base_class} Lv.{scenario.level}, 装备 {scenario.equipment_tier}")
    print(f"楼层: {scenario.floor_min}-{scenario.floor_max}, 每层约 {scenario.simulations_per_floor} 场战斗")
    
    start_time = time.time()
    results, aggregated = run_simulation(scenario)
    elapsed = time.time() - start_time
    
    print(f"模拟完成: {len(results)} 场战斗，耗时 {elapsed:.2f} 秒")
    
    # 保存结果
    import os
    os.makedirs(args.output_dir, exist_ok=True)
    
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    csv_file = os.path.join(args.output_dir, f"combat_results_{timestamp}.csv")
    agg_csv_file = os.path.join(args.output_dir, f"aggregated_results_{timestamp}.csv")
    md_file = os.path.join(args.output_dir, f"balance_report_{timestamp}.md")
    
    save_csv_results(results, csv_file)
    save_aggregated_csv(aggregated, agg_csv_file)
    generate_markdown_report(scenario, aggregated, md_file)
    
    print(f"\n结果已保存:")
    print(f"  详细战斗记录: {csv_file}")
    print(f"  聚合统计数据: {agg_csv_file}")
    print(f"  平衡性报告: {md_file}")
    
    print_summary(aggregated)


if __name__ == '__main__':
    main()