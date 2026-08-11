# 危机合约 Buff 机制分析

> 本文档分析 `Data/Json/BuffData/buff_cc_*.json` 中所有危机合约相关 Buff 的详细机制与实现方式。
> 共计 **93 个 Buff 文件**，按功能分为 **14 个系统类别**。

>免责声明：本文档中的内容目前**并未实装**，不代表危机合约上线后游戏内实际表现。下文说明中的数据参数均为buff默认参数（即下文中的blackboard key），实际参数需要等待合约更新当天上午10点更新数据。
>本文档由AI生成，并由渚汐奏梦基于已公开信息校对，若存在错误欢迎反馈，使用或转载相关内容请标注出处。

---

## 目录

1. [伤害削减系统](#1-伤害削减系统)
2. [属性修改系统](#2-属性修改系统)
3. [附着积蓄抗性系统 (Inflict Stack Resist)](#3-附着积蓄抗性系统)
4. [周期性附着免疫系统 (Periodic Inflict Resist)](#4-周期性附着免疫系统)
5. [治疗反射至敌人系统 (Heal Reflect)](#5-治疗反射至敌人系统)
6. [受控回血系统 (Heal Under Control)](#6-受控回血系统)
7. [角色冰冻系统 (FrozenOnChar)](#7-角色冰冻系统)
8. [寒冷附着系统 (Cryst Inflict)](#8-寒冷附着系统)
9. [消耗附着 / 特殊 CC0 系统](#9-消耗附着--特殊-cc0-系统)
10. [移速提升 / 伤害限制系统](#10-移速提升--伤害限制系统)
11. [附着转抗打断系统 (Abnormal to SuperArmor)](#11-附着转抗打断系统)
12. [禁用 / 限制系统](#12-禁用--限制系统)
13. [死亡地面区域系统](#13-死亡地面区域系统)
14. [附加附着系统](#14-附加附着系统)

---

## Buff 数据结构通用说明

每个 Buff JSON 文件包含以下核心字段：

| 字段 | 说明 |
|------|------|
| `id` | Buff 唯一标识符 |
| `lifeType` | 生命周期类型：`Infinity`（无限，需手动移除）/ `Duration`（固定持续时间） |
| `duration` | 持续时间，支持 `useBlackboardKey` 动态读取 |
| `stackingSettings` | 叠加设置：`Unlimited`（无限叠加）/ `Unique`（唯一）/ `Replace`（替换） |
| `damageModifier` | 伤害修改器，定义伤害缩放条件和处理器 |
| `attributeModifier` | 属性修改器，修改角色基础属性 |
| `healModifier` | 治疗修改器 |
| `buffEventAction` | Buff 生命周期事件（OnBuffEnable / OnBuffFinish / OnBuffTrigger 等） |
| `abilityEventAction` | 能力事件（OnAddedBuff / OnBeforeCastSkill / OnTakeDamage 等） |
| `blackboard` | 黑板数据，存储运行时参数（`key` + `valueDouble`） |
| `dispelConfig` | 驱散配置 |
| `tags` | 标签系统，用于状态标识和免疫判断 |

### 关键 Action 类型

| Action 类型 | 说明 |
|------------|------|
| `DamageScaleProcessor` | 伤害缩放处理器，在指定计算阶段乘算伤害 |
| `CreateBuffAction` | 创建新 Buff |
| `FinishBuffAdvanced` | 移除指定 Buff |
| `SetBuffDurationAction` | 设置 Buff 持续时间 |
| `SpawnAbilityEntity` | 生成技能实体（如地面区域） |
| `CheckSkillType` | 检查技能类型（NormalSkill / UltimateSkill / ComboSkill） |
| `CheckDamageDecorateMask` | 检查伤害装饰掩码，用于筛选技能类型 |
| `CheckBuffIdInContextAdvanced` | 检查目标是否拥有指定 Buff（按 ID 或 Tag） |
| `CheckSuperArmor` | 检查目标抗打断值 |
| `CheckSpellInflictionType` | 检查法术附着类型（Fire / Pulse / Cryst / Natural） |
| `SimpleCalcBBAction` | 黑板数值计算 |
| `ModifyDynamicBlackboard` | 修改动态黑板值 |
| `SaveTargetDistanceAction` | 保存目标间距离到黑板 |
| `CompareFloat` | 浮点数比较 |


#### formulaItem（修改公式类型）

| 枚举名 | 值 | 中文 | 计算公式 | 说明 |
|--------|-----|------|----------|------|
| `Addition` | 0 | 加法 | `base + value` | 基础加法 |
| `Multiplier` | 1 | 乘法 | `base * value` | 乘算修正 |
| `FinalAddition` | 3 | 最终加法 | `final + value` | 在最终值上加算 |
| `FinalMultiplier` | 4 | 最终乘法 | `final * value` | 在最终值上乘算 |
| `BaseAddition` | 5 | 基础加法 | `base + value` | 在基础值上加算 |
| `BaseMultiplier` | 6 | 基础乘法 | `base * value` | 在基础值上乘算 |
| `BaseFinalAddition` | 7 | 基础最终加法 | `base_final + value` | 在基础最终值上加算 |
| `BaseFinalMultiplier` | 8 | 基础最终乘法 | `base_final * value` | 在基础最终值上乘算 |


## 1. 伤害削减系统

### 1.1 普通攻击伤害削减

**`buff_cc_chr_normal_attack_dmg_down`**

| 属性 | 值 |
|------|-----|
| 机制 | `damageModifier` (Attacker side, ProdCalcZone) |
| 条件 | `CheckDamageDecorateMask` checkType=`HasAll`, mask=`128` (`NormalAttack`) |
| 参数 | `dmg_scale = -0.6` |
| 效果 | 角色普通攻击伤害 **-60%** |

实现方式：在伤害计算的 `ProdCalcZone` 阶段，对攻击者侧施加 `DamageScaleProcessor`，缩减系数为 `-0.6`。仅对掩码包含 `NormalAttack`（128）的伤害生效。

---

### 1.2 战技伤害削减

**`buff_cc_chr_normal_skill_dmg_down`**

| 属性 | 值 |
|------|-----|
| 机制 | `damageModifier` (Attacker side, ProdCalcZone) |
| 条件 | `CheckDamageDecorateMask` checkType=`HasAll`, mask=`256` (`NormalSkill`) |
| 参数 | `dmg_scale = -0.9` |
| 效果 | 角色战技伤害 **-90%** |

---

### 1.3 连携技能伤害削减

**`buff_cc_chr_combo_skill_dmg_down`**

| 属性 | 值 |
|------|-----|
| 机制 | `damageModifier` (Attacker side, ProdCalcZone) |
| 条件 | `CheckDamageDecorateMask` checkType=`HasAll`, mask=`8192` (`ComboSkill`) |
| 参数 | `dmg_scale = -0.9` |
| 效果 | 连携技能伤害 **-90%** |

实现方式：通过 `CheckDamageDecorateMask` 检测伤害掩码是否包含 `ComboSkill` 位（8192），仅对连携技能伤害生效。

---

### 1.4 终极技能伤害逐步削减

**`buff_cc_chr_ult_dmg_down_gradual`** → **`buff_cc_chr_ult_dmg_down_gradual_stack`** → **`buff_cc_chr_ult_dmg_down_gradual_instance`**

三层嵌套系统：

1. **主 Buff** (`buff_cc_chr_ult_dmg_down_gradual`)
   - 触发事件：`OnBeforeCastSkill`（施放终极技能前）
   - 条件：`CheckSkillType` = `UltimateSkill`
   - 效果：每次施放终极技能时，创建 1 层 `buff_cc_chr_ult_dmg_down_gradual_stack`

2. **层叠 Buff** (`buff_cc_chr_ult_dmg_down_gradual_stack`)
   - 纯标记 Buff，用于叠加计数

3. **实例 Buff** (`buff_cc_chr_ult_dmg_down_gradual_instance`)
   - 机制：`damageModifier`
   - 条件：`CheckDamageDecorateMask` checkType=`HasAll`, mask=`512` (`UltimateSkill`)
   - 参数：`dmg_scale_per_layer = -0.5`
   - 效果：每层 **-50%** 终极技能伤害，层叠后伤害递减

---

### 1.5 队伍重复职业伤害削减

**`buff_cc_chr_repeat_profession_dmg_down`** → **`buff_cc_chr_repeat_profession_dmg_down_instance`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnBuffEnable` |
| 参数 | `dmg_scale = -0.25`, `duration = 3.0` |
| 效果 | 每个重复职业 **-25%** 伤害 |

实现方式：
1. Buff 启用时遍历队伍成员
2. 统计各职业（Guard/Defender/Supporter/Caster/Assault/Vanguard）数量
3. 对每个同职业队友创建一个 `buff_cc_chr_repeat_profession_dmg_down_instance`
4. 实例 Buff 通过 `damageModifier` 施加 -25% 伤害

---

### 1.6 施加附着后伤害削减

**`buff_cc_chr_dmg_down_after_inflict`** → 各元素伤害削减 Buff

| 属性 | 值 |
|------|-----|
| 触发 | `OnOutputBuff`（输出 Buff 时） |
| 条件 | Buff 带有 `NoGuard` 标签 |
| 参数 | `dmg_scale = -0.1`, `duration = 10.0` |
| 效果 | 施加附着后对应元素伤害 **-10%**，持续 10 秒 |

根据附着元素类型创建对应 Buff：
- `buff_cc_chr_phy_dmg_down`（物理）
- `buff_cc_chr_fire_dmg_down`（灼热）
- `buff_cc_chr_pulse_dmg_down`（电磁）
- `buff_cc_chr_cryst_dmg_down`（寒冷）
- `buff_cc_chr_natural_dmg_down`（自然）

---

### 1.7 消耗附着后伤害削减

**`buff_cc_chr_dmg_down_after_consume`** → **`buff_cc_chr_dmg_down_after_consume_instance`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnConsumeBuff` / `OnAbsorbBuff` |
| 条件 | Buff 带有 `NoGuard` + `SpellInflict` 标签 |
| 参数 | `dmg_scale = -0.9`, `duration = 10.0` |
| 效果 | 消耗/吸收附着后伤害 **-90%**，持续 10 秒 |

---

### 1.8 队友普通攻击伤害削减

**`buff_cc_chr_teammate_normal_attack_dmg_down`**

| 属性 | 值 |
|------|-----|
| 机制 | `damageModifier` |
| 条件 | `CheckDamageDecorateMask` checkType=`HasAll`, mask=`128` (`NormalAttack`) |
| 参数 | `dmg_scale = -0.75` |
| 效果 | 队友普通攻击伤害 **-75%** |

---

### 1.9 队友受伤减免

**`buff_cc_chr_teammate_take_dmg_down`**

| 属性 | 值 |
|------|-----|
| 机制 | `damageModifier` (Defender side) |
| 参数 | `dmg_down = -0.5` |
| 效果 | 队友受到伤害 **-50%** |

---

### 1.10 主控角色受伤增加

**`buff_cc_chr_main_dmg_taken_up`**

| 属性 | 值 |
|------|-----|
| 机制 | `damageModifier` (Defender side) |
| 参数 | `dmg_scale = 0.1` |
| 效果 | 主控角色受到伤害 **+10%** |

---

### 1.11 距离伤害削减

**`buff_cc_chr_dmg_down_by_distance`**

| 属性 | 值 |
|------|-----|
| 机制 | `damageModifier` + 动态黑板计算 |
| 参数 | `distance_min = 4.0`, `distance_max = 10.0`, `dmgdown_max = -0.9` |
| 效果 | 基于与目标距离的伤害削减，最大 **-90%** |

实现方式：
1. `OnBuffEnable` 时计算 `distance_min_negative = -distance_min` 和 `distance_delta = distance_max + distance_min_negative`
2. 每次伤害计算时：
   - 检查攻击者是否为主控角色（`CheckTargetsEqual`）
   - 保存攻击者与目标距离到黑板
   - 计算 `distance = (distance + distance_min_negative) / distance_delta`
   - 钳制到 [0, 1] 范围
   - 最终 `dmgdown_scale = dmgdown_max * distance`
3. 伤害缩放 = 1 + dmgdown_scale（即距离越远削减越少）

---

### 1.12 受伤削减最大生命值

**`buff_cc_chr_dmg_reduce_maxhp`** → **`buff_cc_chr_dmg_reduce_maxhp_instance`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnTakeDamage` |
| 参数 | `hp_down = 0.15`, `hp_down_ratio = 0.5`, `hp_down_ratio_melee = 0.3` |
| 效果 | 受伤时永久降低最大生命值 **15%** |

实现方式：
1. 受到伤害时触发
2. 远程攻击降低比率 = 0.5，近战 = 0.3
3. 创建 `buff_cc_chr_dmg_reduce_maxhp_instance`，通过 `attributeModifier` 修改属性：
   - `modifyAttributeType`: `Specific`
   - `attributeType`: `MaxHp`（最大生命值, ID=1）
   - `formulaItem`: `BaseFinalAddition`（基础最终加法）
   - 效果：永久降低最大生命值

---

## 2. 属性修改系统

### 2.1 终结技能量获取速度降低

**`buff_cc_chr_usp_speed_down`**

| 属性 | 值 |
|------|-----|
| 机制 | `attributeModifier` |
| `modifyAttributeType` | `Specific` |
| `attributeType` | `UltimateSpGainScalar`（终结技充能效率, ID=44） |
| `formulaItem` | `FinalMultiplier`（最终乘法） |
| 参数 | `usp_scale = 0.5` |
| 效果 | 终结技能量获取速度 **-50%**（最终值 x0.5） |

---

### 2.2 终结技能量上限增加

**`buff_cc_chr_ult_sp_cost_increase`** → **`buff_cc_chr_ult_sp_cost_increase_instance`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnAfterSkillApplyCost`（施放终极技能后） |
| 条件 | `CheckSkillType` = `UltimateSkill` |
| 参数 | `usp_up = 0.2` |
| 效果 | 终结技能量上限 **+20%** |

实现方式：主 Buff 监听终极技能施放，创建实例 Buff，实例通过 `attributeModifier` 修改属性：
- `modifyAttributeType`: `Specific`
- `attributeType`: `MaxUltimateSp`（终结技能量上限, ID=22）
- `formulaItem`: `BaseMultiplier`（基础乘法）
- 效果：终结技能量上限 x1.2（+20%），即消耗增加 20%

---

### 2.3 连携技能冷却增加

**`buff_cc_chr_combo_cd_up`**

| 属性 | 值 |
|------|-----|
| 机制 | `attributeModifier` |
| `modifyAttributeType` | `Specific` |
| `attributeType` | `ComboSkillCooldownFinalAddition`（连携技冷却时间增加, ID=47） |
| `formulaItem` | `FinalAddition`（最终加法） |
| 参数 | `cd = 5.0` |
| 效果 | 连携技能冷却时间 **+5 秒** |

---

### 2.4 主能力降低

**`buff_cc_chr_main_attribute_down`**

| 属性 | 值 |
|------|-----|
| 机制 | `attributeModifier` |
| `modifyAttributeType` | `Main`（主能力） |
| `formulaItem` | `FinalMultiplier`（最终乘法） |
| 参数 | `attr = 0.9` |
| 效果 | 主能力值乘算 **x0.9**（-10%） |

---

### 2.5 闪避禁用

**`buff_cc_chr_mute_evade`**

| 属性 | 值 |
|------|-----|
| 机制 | Tag 系统 |
| 标签 | `Status/DisableDash` |
| 效果 | 禁用闪避能力 |

---

### 2.6 战技全局冷却

**`buff_cc_chr_normal_skill_global_cd`** → **`buff_cc_chr_normal_skill_global_cd_instance`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnBeforeCastSkill`（施放战技前） |
| 条件 | `CheckSkillType` = `NormalSkill` |
| 参数 | `cd = 8.0` |
| 效果 | 施放战技后全队进入 **8 秒** 冷却 |

实现方式：
1. 主 Buff 监听战技施放
2. 通过 `InstantSearch` + `CharacterTeamFinder` 选中全队角色
3. 对每个队友创建实例 Buff，实例带 `Status/DisableNormalSkill` 标签
4. 持续 8 秒后自动移除

---

### 2.7 冲刺体力恢复速度降低

**`buff_cc_chr_dash_recover_speed_down`**

| 属性 | 值 |
|------|-----|
| 机制 | `globalModifier` |
| `type` | `DashRecover`（冲刺恢复） |
| `formulaItem` | `Multiplier`（乘法） |
| 参数 | `ratio = -0.5` |
| 效果 | 冲刺体力恢复速度 **x(-0.5)**（-50%） |

---

### 2.8 敌方失衡值上限增加

**`buff_cc_enemy_poise_up`**

| 属性 | 值 |
|------|-----|
| 机制 | `attributeModifier` |
| `modifyAttributeType` | `Specific` |
| `attributeType` | `MaxPoise`（失衡值上限, ID=20） |
| `formulaItem` | `BaseMultiplier`（基础乘法） |
| 参数 | `poise_up = 0.15` |
| 效果 | 敌方失衡值上限 **x1.15**（+15%） |

---

### 2.9 敌方生命值增加

**`buff_cc_enemy_common_hp_up`**

| 属性 | 值 |
|------|-----|
| 机制 | `attributeModifier` |
| `modifyAttributeType` | `Specific` |
| `attributeType` | `MaxHp`（最大生命值, ID=1） |
| `formulaItem` | `FinalMultiplier`（最终乘法） |
| 参数 | `hp_up = 1.5` |
| 效果 | 敌方最大生命值 **x2.5**（+150%） |

---

### 2.10 敌方伤害增加

**`buff_cc_enemy_common_dmg_up`**

| 属性 | 值 |
|------|-----|
| 机制 | `attributeModifier`（6 条属性修改） |
| `modifyAttributeType` | `Specific` |
| `formulaItem` | `BaseAddition`（基础加法） |
| 参数 | `dmg_up = 0.1` |
| 效果 | 敌方伤害 **+10%** |

修改的 6 条属性：

| `attributeType` | 中文名 | ID |
|-----------------|--------|-----|
| `PhysicalDamageIncrease` | 物理伤害加成 | 50 |
| `FireDamageIncrease` | 灼热伤害加成 | 51 |
| `PulseDamageIncrease` | 电磁伤害加成 | 52 |
| `CrystDamageIncrease` | 寒冷伤害加成 | 53 |
| `NaturalDamageIncrease` | 自然伤害加成 | 54 |
| `EtherDamageIncrease` | 超域伤害加成 | 55 |

---

## 3. 附着积蓄抗性系统

### 3.1 系统架构

```
buff_cc_enemy_inflict_stack_resist (主入口)
├── buff_cc_enemy_inflict_stack_resist_add_listener (积蓄监听)
│   ├── buff_cc_enemy_inflict_stack_resist_fire
│   ├── buff_cc_enemy_inflict_stack_resist_pulse
│   ├── buff_cc_enemy_inflict_stack_resist_cryst
│   ├── buff_cc_enemy_inflict_stack_resist_natural
│   └── buff_cc_enemy_inflict_stack_resist_phy
└── buff_cc_enemy_inflict_stack_resist_consume_listener (消耗监听)
    └── buff_cc_enemy_inflict_stack_resist_consume_delay
        └── 移除对应元素抗性层
```

### 3.2 主入口 Buff

**`buff_cc_enemy_inflict_stack_resist`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnBuffEnable` |
| 参数 | `dmg_scale = -0.1` |
| 效果 | 启用附着积蓄抗性系统 |

实现方式：Buff 启用时同时创建 `add_listener` 和 `consume_listener` 两个子 Buff。

### 3.3 积蓄监听

**`buff_cc_enemy_inflict_stack_resist_add_listener`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnAddedBuff`（被添加 Buff 时） |
| 参数 | `dmg_scale = -0.1`, `d_dmg_scale = 0.0` |
| 效果 | 当敌人被施加附着时，创建对应元素的抗性层 |

当检测到敌人被施加带有 `NoGuard` 标签的 Buff 时，根据附着元素类型创建对应的抗性 Buff。

### 3.4 消耗监听

**`buff_cc_enemy_inflict_stack_resist_consume_listener`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnFinishedBuff`（Buff 结束时） |
| 效果 | 当附着结束时，创建延迟消耗 Buff |

### 3.5 延迟消耗

**`buff_cc_enemy_inflict_stack_resist_consume_delay`**

| 属性 | 值 |
|------|-----|
| 持续时间 | 0.1 秒 |
| 触发 | `OnBuffFinish` |
| 效果 | 通过 `SwitchAction` 根据 `index` 移除对应元素的抗性层 |

索引映射：0=Fire, 1=Pulse, 2=Cryst, 3=Natural, 4=Phy

### 3.6 各元素抗性 Buff

| Buff ID | 参数 | 效果 |
|---------|------|------|
| `buff_cc_enemy_inflict_stack_resist_fire` | `dmg_scale = -0.1` | 灼热伤害 **-10%** / 层 |
| `buff_cc_enemy_inflict_stack_resist_pulse` | `dmg_scale = -0.1` | 电磁元素伤害 **-10%** / 层 |
| `buff_cc_enemy_inflict_stack_resist_cryst` | `dmg_scale = -0.1` | 寒冷伤害 **-10%** / 层 |
| `buff_cc_enemy_inflict_stack_resist_natural` | `dmg_scale = -0.1` | 自然伤害 **-10%** / 层 |
| `buff_cc_enemy_inflict_stack_resist_phy` | `dmg_scale = -0.1` | 物理伤害 **-10%** / 层 |

---

## 4. 周期性附着免疫系统

### 4.1 系统架构

```
buff_cc_enemy_periodic_inflict_resist (主入口)
├── buff_cc_enemy_periodic_inflict_resist_fire
├── buff_cc_enemy_periodic_inflict_resist_pulse
├── buff_cc_enemy_periodic_inflict_resist_cryst
├── buff_cc_enemy_periodic_inflict_resist_natural
├── buff_cc_enemy_periodic_inflict_resist_phy
└── buff_cc_enemy_periodic_inflict_resist_instance (全元素免疫)
```

### 4.2 主入口 Buff

**`buff_cc_enemy_periodic_inflict_resist`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnEnemyAfterTakeSpellInfliction`（受到法术附着后） |
| 参数 | `duration = 5.0` |
| 效果 | 受到法术附着后获得对应元素 **5 秒** 免疫 |

实现方式：
1. 监听 `OnEnemyAfterTakeSpellInfliction` 事件
2. 通过 `IfElseAction` 链式判断附着类型（Fire → Pulse → Cryst → Natural）
3. 创建对应元素的免疫 Buff
4. 额外监听 `OnAddedBuff`，如果目标带有 `NoGuard` 标签，创建物理免疫 Buff

### 4.3 各元素免疫 Buff

| Buff ID | 免疫标签 | 持续时间 |
|---------|---------|---------|
| `buff_cc_enemy_periodic_inflict_resist_fire` | `ImmuneSpellInflict/ImmuneFireInflict` | 5s |
| `buff_cc_enemy_periodic_inflict_resist_pulse` | `ImmuneSpellInflict/ImmunePulseInflict` | 5s |
| `buff_cc_enemy_periodic_inflict_resist_cryst` | `ImmuneSpellInflict/ImmuneCrystInflict` | 5s |
| `buff_cc_enemy_periodic_inflict_resist_natural` | `ImmuneSpellInflict/ImmuneNaturalInflict` | 5s |
| `buff_cc_enemy_periodic_inflict_resist_phy` | `ImmuneNoGuard` | 5s |
| `buff_cc_enemy_periodic_inflict_resist_instance` | `ImmuneSpellInflict` + `ImmuneNoGuard` | 5s |

---

## 5. 治疗反射至敌人系统

### 5.1 系统架构

```
buff_cc_chr_heal_reflect_to_eny (主入口)
├── buff_cc_chr_heal_reflect_to_eny_heal (治疗触发)
│   └── buff_cc_chr_heal_reflect_to_eny_stack_heal
│       └── buff_cc_chr_heal_reflect_to_eny_stack_heal_do
│           └── buff_cc_chr_heal_reflect_to_eny_effect (伤害执行)
└── buff_cc_chr_heal_reflect_to_eny_shield (护盾触发)
    └── buff_cc_chr_heal_reflect_to_eny_stack_shield
        └── buff_cc_chr_heal_reflect_to_eny_stack_heal_do
            └── buff_cc_chr_heal_reflect_to_eny_effect (伤害执行)
```

### 5.2 主入口 Buff

**`buff_cc_chr_heal_reflect_to_eny`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnBuffEnable` |
| 参数 | `chr_heal_ratio = 0.1`, `eny_heal_ratio = 0.05`, `chr_shield_ratio = 0.2` |
| 效果 | 将治疗/护盾转化为对敌伤害 |

实现方式：创建 `heal` 和 `shield` 两个子 Buff，分别监听治疗和护盾事件。

### 5.3 治疗触发（存疑）

**`buff_cc_chr_heal_reflect_to_eny_heal`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnReceiveHeal`（受到治疗时） |
| 参数 | `chr_heal_ratio = 0.1`, `eny_heal_ratio = 0.05` |
| 效果 | 将 **10%** 治疗量转化为对敌伤害，每层造成敌人 **5%** 最大生命值伤害 |

### 5.4 护盾触发（存疑）

**`buff_cc_chr_heal_reflect_to_eny_shield`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnAfterAddedShield`（获得护盾后） |
| 参数 | `chr_heal_ratio = 0.2`, `eny_heal_ratio = 0.05` |
| 效果 | 将 **20%** 护盾值转化为对敌伤害，每层造成敌人 **5%** 最大生命值伤害 |

---

## 6. 受控回血系统

### 6.1 系统架构

```
buff_cc_enemy_heal_under_control (主控制器)
├── buff_cc_enemy_heal_under_control_stack (叠加标记)
├── buff_cc_enemy_heal_under_control_instance (实例)
│   └── buff_cc_enemy_heal_under_control_timer (周期治疗)
└── buff_cc_enemy_heal_on_finish (结束回血)
```

### 6.2 主控制器

**`buff_cc_enemy_heal_under_control`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnAddedBuff` / `OnFinishedBuff` / `OnBeforeAddedBuff` |
| 效果 | 敌人被控制时获得持续回血 |

实现方式（四组事件链）：

**`OnAddedBuff` 事件组：**
1. **冰冻检测**：检查目标是否有 `Frozen` 标签，且抗打断 ≤ 20 → 创建 1 层 stack
2. **物理附着检测**：检查 `AirborneStatus` / `KnockdownStatus`，且抗打断 < 30 → 创建 1 层 stack
3. **源石寒冷检测**：检查 `buff_common_originum_frozen`，且抗打断 ≤ 20 → 创建 1 层 stack
4. **汤汤终结技检测**：检查 `buff_chr_0027_tangtang_ultskill_debuff` → 创建 1 层 stack

**`OnFinishedBuff` 事件组：**
- 对应上述 4 种情况，当控制结束时移除 1 层 stack

**`OnBeforeAddedBuff` 事件组：**
- 当 stack 数为 0 时，创建 `buff_cc_enemy_heal_under_control_instance`

**`OnFinishedBuff` (stack) 事件组：**
- 当 stack 归零时，移除 instance

### 6.3 实例 Buff

**`buff_cc_enemy_heal_under_control_instance`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnBuffEnable` / `DuringBuffEnable` |
| 参数 | `hp_ratio = 0.01` |
| 效果 | 被控时每秒回复 **1%** 最大生命值 |

创建 `buff_cc_enemy_heal_under_control_timer` 进行周期治疗。

### 6.4 周期治疗

**`buff_cc_enemy_heal_under_control_timer`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnBuffEnable` / `OnBuffTrigger` |
| 参数 | `hp_ratio = 0.01` |
| 效果 | 每秒回复 **1%** 最大生命值，持续至控制结束 |

### 6.5 结束回血（存疑）

**`buff_cc_enemy_heal_on_finish`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnBuffFinish` / `DuringBuffEnable` |
| 参数 | `hp_recover = 0.2`, `duration = 15.0` |
| 效果 | Buff 结束时回复 **20%** 最大生命值 |

---

### 6.6 脱战回血系统

**`buff_cc_enemy_heal_not_take_damage`** → **`buff_cc_enemy_heal_not_take_damage_instance`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnTakeDamage`（受伤时重置计时器） |
| 参数 | `hp_ratio = 0.01` |
| 效果 | 一段时间未受伤后，每秒回复 **1%** 最大生命值 |

实现方式：
1. 受伤时创建 `countdown` 倒计时 Buff
2. 倒计时结束后创建 `instance` Buff
3. `instance` 通过 `OnBuffTrigger` 周期回血
4. 再次受伤时重复流程

---

## 7. 角色冰冻系统

### 7.1 系统架构

```
buff_cc_chr_frozenonchar_extend (延长冰冻)
buff_cc_chr_frozenonchar_extend_instance (冰冻实例)
├── buff_cc_chr_phy_skill_clear_frozenonchar (物理技能解除)
├── buff_cc_chr_fire_skill_clear_frozenonchar (灼热技能解除)
├── buff_cc_chr_pulse_skill_clear_frozenonchar (电磁技能解除)
└── buff_cc_chr_natural_skill_clear_frozenonchar (自然技能解除)
```

### 7.2 冰冻延长

**`buff_cc_chr_frozenonchar_extend`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnAddedBuff` |
| 条件 | 目标有 `FrozenOnChar` 标签 + 是主控角色 |
| 参数 | `duration = 15.0` |
| 效果 | 将冰冻持续时间设为 **15 秒** |

实现方式：通过 `SetBuffDurationAction` 将带有 `FrozenOnChar` 标签的 Buff 持续时间强制设为 15 秒。

### 7.3 冰冻实例

**`buff_cc_chr_frozenonchar_extend_instance`**

| 属性 | 值 |
|------|-----|
| 标签 | `FrozenOnChar`, `DisableFaceToAttacker` |
| 参数 | `duration = 15.0` |
| 效果 | 冻结角色动画（anim scale=0），应用冰冻 VFX |

### 7.4 技能解除冰冻

| Buff ID | 触发条件 | 效果 |
|---------|---------|------|
| `buff_cc_chr_phy_skill_clear_frozenonchar` | 施放物理技能 | 移除冰冻状态 |
| `buff_cc_chr_fire_skill_clear_frozenonchar` | 施放灼热技能 | 移除冰冻状态 |
| `buff_cc_chr_pulse_skill_clear_frozenonchar` | 施放电磁技能 | 移除冰冻状态 |
| `buff_cc_chr_natural_skill_clear_frozenonchar` | 施放自然技能 | 移除冰冻状态 |

实现方式：通过 `OnBeforeCastSkill` + `CheckSkillType` 检测技能类型，然后 `FinishBuffAdvanced` 移除冰冻 Buff。

---

## 8. 寒冷附着系统

### 8.1 寒冷附着减速

**`buff_cc_chr_cryst_inflict_to_slowdown`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnAddedBuff` / `OnFinishedBuff` |
| 条件 | 目标有 `CrystInflictOnChar` 标签 |
| 参数 | `slowdown_scale_per_stack = -0.25` |
| 效果 | 每层寒冷附着 **-25%** 移动速度 |

实现方式：
1. 检测到寒冷附着 Buff 被添加时，通过 `attributeModifier` 修改移动速度（2 条）：
   - `modifyAttributeType`: `Specific`, `attributeType`: `MoveSpeedScalar`（移动速度系数, ID=13）, `formulaItem`: `Multiplier`（乘法）
   - `modifyAttributeType`: `Specific`, `attributeType`: `InAirMoveSpeedScalar`（空中移速系数, ID=91）, `formulaItem`: `Multiplier`（乘法）
2. 每层减速 -25%
3. 寒冷附着结束时重置移速

### 8.2 战技施加附着

**`buff_cc_chr_normal_skill_cryst_inflict`** → **`buff_cc_chr_normal_skill_cryst_inflict_stack`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnAfterSkillApplyCost` |
| 条件 | `CheckSkillType` = `NormalSkill` |
| 参数 | `times = 1.0`, `cd = 3.0` |
| 效果 | 战技命中后施加 1 层寒冷附着，冷却 3 秒 |

### 8.3 连携技能施加附着

**`buff_cc_chr_combo_skill_cryst_inflict`** → **`buff_cc_chr_combo_skill_cryst_inflict_stack`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnAfterSkillApplyCost` |
| 条件 | `CheckSkillType` = `ComboSkill` |
| 参数 | `times = 1.0`, `cd = 3.0` |
| 效果 | 连携技能命中后施加 1 层寒冷附着，冷却 3 秒 |

### 8.4 附着转冻结

**`buff_cc_enemy_cryst_inflict_to_frozen`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnOutputBuff` |
| 条件 | 输出寒冷附着且层数 ≥ 3 |
| 参数 | `cd = 0.1`, `layer = 3.0` |
| 效果 | 寒冷附着累积至 **3 层** 时转化为冰冻状态 |

### 8.5 寒冷附着延长

**`buff_cc_chr_cryst_inflict_extend`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnAddedBuff` |
| 效果 | 新增寒冷附着时延长已有寒冷附着的持续时间 |

---

## 9. 消耗附着 / 特殊 CC0 系统

### 9.1 消耗附着施加特殊 CC0

**`buff_cc_chr_consume_inflict_special_cc0`** → **`buff_cc_chr_consume_inflict_special_cc0_stack`** → **`buff_cc_chr_consume_inflict_special_cc0_instance`**

| 属性 | 值 |
|------|-----|
| 机制 | `damageModifier` + `abilityEventAction` |
| 条件 | `CheckDamageDecorateMask` checkType=`HasAll`, mask=`256` (`NormalSkill`) |
| 参数 | `dmg_scale = -0.6`, `consume_dmg_scale_per_stack = 0.05` |
| 效果 | 战技基础伤害 **-60%**，每消耗 1 层附着 **+5%** 伤害 |

实现方式：
1. 对伤害掩码包含 `NormalSkill`（256）的伤害施加 -60% 基础伤害（`checkType=HasAll`, `mask=256`）
2. 监听 `OnConsumeBuff` / `OnAbsorbBuff`
3. 每消耗/吸收 1 层带有 `NoGuard` + `SpellInflict` 标签的 Buff
4. 创建 1 层 stack，每层提供 +5% 伤害加成
5. stack 结束时通过 instance 计算最终伤害

### 9.2 普通特殊 CC0

**`buff_cc_chr_normal_special_cc0`**

| 属性 | 值 |
|------|-----|
| 机制 | `damageModifier` + `abilityEventAction` |
| 条件 | `CheckDamageDecorateMask` checkType=`HasAll`, mask=`256` (`NormalSkill`) |
| 参数 | `skill_ratio = 2.0`, `dmg_scale = -0.6` |
| 效果 | 战技伤害 **-60%**，获得 ATB（技力） 时触发特殊效果 |

### 9.3 连携特殊 CC0

**`buff_cc_chr_combo_special_cc0`**

| 属性 | 值 |
|------|-----|
| 机制 | `damageModifier` + `attributeModifier` |
| 条件 | `CheckDamageDecorateMask` checkType=`HasAll`, mask=`256` (`NormalSkill`) |
| `modifyAttributeType` | `Specific` |
| `attributeType` | `ComboSkillCooldownScalar`（连携技冷却时间系数, ID=47） |
| `formulaItem` | `FinalMultiplier`（最终乘法） |
| 参数 | `cd_scale = 0.4`, `dmg_scale = -0.6` |
| 效果 | 战技伤害 **-60%**，连携技能冷却 **x0.4**（-60%） |

### 9.4 物理附着增强特殊 CC0

**`buff_cc_chr_physical_and_inflict_enhance_special_cc0`**

| 属性 | 值 |
|------|-----|
| 机制 | `damageModifier`（双条件） |
| 条件1 | `CheckDamageDecorateMask` checkType=`ExceptAny`, mask=`9088` (`ComboSkill\|UltimateSkill\|NormalSkill\|NormalAttack`) |
| 条件2 | `CheckDamageDecorateMask` checkType=`HasAll`, mask=`256` (`NormalSkill`) |
| 参数 | `dmg_up = 2.0`, `dmg_scale = -0.6` |
| 效果 | 非主动技能伤害 **+200%**，战技伤害 **-60%**（双条目分别生效） |

实现方式：包含两个独立的 `damageModifier` 条目：
1. **条件1**（`ExceptAny`, mask=9088）：对**不包含**任何主动技能类型（普通攻击/战技/终极技能/连携技能）的伤害施加 `dmg_up=2.0`（+200%），覆盖 Dot、爆发、残留区域等特殊伤害
2. **条件2**（`HasAll`, mask=256）：对**包含** `NormalSkill` 的伤害施加 `dmg_scale=-0.6`（-60%）

---

## 10. 移速提升 / 伤害限制系统

### 10.1 系统架构

```
buff_cc_enemy_common_movespeedup (主入口)
├── 属性修改：MoveSpeedScalar x2, InAirMoveSpeedScalar x2
└── buff_cc_enemy_common_movespeedup_dmg_limit_base (伤害限制)
    └── buff_cc_enemy_common_movespeedup_dmg_limit_instance (实例)
```

### 10.2 主入口

**`buff_cc_enemy_common_movespeedup`**

| 属性 | 值 |
|------|-----|
| 机制 | `attributeModifier` + `buffEventAction` |
| 参数 | `speedup_scale = 2.0`, `dmg_scale = 0.25` |
| 叠加 | `Unique`（唯一） |
| 效果 | 敌方移速 **x2**，伤害 **+25%** |

实现方式：
1. 通过 `attributeModifier` 修改移动速度（2 条）：
   - `modifyAttributeType`: `Specific`, `attributeType`: `MoveSpeedScalar`（移动速度系数, ID=13）, `formulaItem`: `Multiplier`（乘法）
   - `modifyAttributeType`: `Specific`, `attributeType`: `InAirMoveSpeedScalar`（空中移速系数, ID=91）, `formulaItem`: `Multiplier`（乘法）
2. `OnBuffEnable` 时创建 `dmg_limit_base` 子 Buff

### 10.3 伤害限制基础

**`buff_cc_enemy_common_movespeedup_dmg_limit_base`**

| 属性 | 值 |
|------|-----|
| 机制 | `damageModifier` + `abilityEventAction` |
| 参数 | `dmg_scale = 0.25`, `hp_ratio = 0.0` |
| 效果 | +25% 伤害，单次受伤限制为最大生命值的一定比例 |

实现方式：
1. 在 `ProdCalcZone` 施加 +25% 伤害缩放
2. 监听 `OnBeforeTakeDamage`，计算单次伤害占最大生命值的比例
3. 如果超过阈值，通过 `ModifyDynamicBlackboard` 调整伤害

### 10.4 伤害限制实例

**`buff_cc_enemy_common_movespeedup_dmg_limit_instance`**

| 属性 | 值 |
|------|-----|
| 参数 | `hp_ratio = 0.25` |
| 效果 | 单次受伤不超过最大生命值 **25%**，附带自愈能力 |

---

## 11. 附着转抗打断系统

### 11.1 系统架构

```
buff_cc_eny_abnormal_to_superarmor (主控制器)
├── buff_cc_eny_abnormal_to_superarmor_instance (抗打断实例)
└── buff_cc_eny_abnormal_to_superarmor_do_finish (清理)
```

### 11.2 主控制器

**`buff_cc_eny_abnormal_to_superarmor`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnBeforeAddedBuff` / `OnFinishedBuff` |
| 效果 | 将附着状态转化为抗打断状态 |

实现方式：

**`OnBeforeAddedBuff` 事件组：**
1. 检查即将添加的 Buff 是否带有 `SpellStatus` 或 `PhysicalStatus` 标签
2. 检查当前附着 Buff 数量是否为 0（即这是第一个附着）
3. 如果是，先移除已有的 `do_finish` Buff
4. 创建 `instance` Buff（抗打断状态）

**`OnFinishedBuff` 事件组：**
1. 当 `SpellStatus` 或 `PhysicalStatus` Buff 结束时
2. 检查剩余附着 Buff 数量是否为 0
3. 如果是，创建 `do_finish` Buff 清理抗打断状态

### 11.3 抗打断实例

**`buff_cc_eny_abnormal_to_superarmor_instance`**

| 属性 | 值 |
|------|-----|
| 触发 | `DuringBuffEnable` |
| 效果 | 持续提供抗打断状态 |

### 11.4 清理 Buff

**`buff_cc_eny_abnormal_to_superarmor_do_finish`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnBuffFinish` |
| 效果 | 抗打断转换结束时的清理逻辑 |

---

## 12. 禁用 / 限制系统

### 12.1 主控角色切换

**`buff_cc_level_mute_switch_player_info`** / **`buff_cc_level_mute_switch_player_info_pre`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnBuffStart` / `DuringBuffEnable` |
| 效果 | 关卡禁止切换主控角色 |

---

## 13. 地面伤害区域系统

### 13.1 系统架构

```
buff_cc_enemy_death_ground_area (死亡触发)
└── abilityentity_cc_death_ground_area (地面区域实体)
    └── buff_cc_enemy_death_ground_area_dmg (周期伤害)
```

### 13.2 死亡触发

**`buff_cc_enemy_death_ground_area`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnOwnerHpZero`（生命值归零时） |
| 参数 | `atk_scale = 0.02` |
| 效果 | 敌人死亡时在原地生成伤害区域 |

实现方式：
1. 敌方生命值归零时触发 `SpawnAbilityEntity`
2. 生成 `abilityentity_cc_death_ground_area` 技能实体
3. 实体在死亡位置创建，施放 `cc_enemy_death_ground_area_skill`
4. 继承源技能的施放信息

### 13.3 地面伤害

**`buff_cc_enemy_death_ground_area_dmg`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnBuffTrigger`（周期触发） |
| 参数 | `atk_scale = 0.02` |
| 效果 | 周期性造成 **2%** 攻击力的地面伤害 |

---

## 14. 附加附着系统

**`buff_cc_chr_inflict_after_spell_status`**

| 属性 | 值 |
|------|-----|
| 触发 | `OnBeforeOutputBuff`（输出 Buff 前） |
| 参数 | `inflict_stack = 1.0` |
| 效果 | 施加法术附着时额外附加 **1 层** 附着积蓄 |
