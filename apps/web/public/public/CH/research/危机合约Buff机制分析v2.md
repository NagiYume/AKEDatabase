# 危机合约 Buff 机制分析

> 本文基于当前数据表解析危机合约相关 Buff 机制，面向希望理解词条效果与底层机制的玩家。
> 原作者: [@渚汐奏梦](https://space.bilibili.com/694452100)，重写：bilibili[@MoeYinlo](https://space.bilibili.com/394239497)

## 数据范围与读法

- 当前 `BuffData` 下共有 **97** 个 `buff_cc*.json`。
- 当前 `GlobalBuffData` 下共有 **42** 个 `global_buff_cc*.json`。
- 当前 `CcTagTable` 有 **41** 个 tag 条目，合计 **45** 条 term 记录；其中部分 tag 同时引用多个 term。
- 本文优先按玩家会看到的 `CcTagTable` 词条组织：同一个词条的多个等级合并成一个单元；同名但解除元素不同的词条合并成一个变体单元。
- 没有出现在当前 `CcTagTable` 的 `buff_cc*` 不直接删除：它们可能是当前词条内部子 Buff、当前未开放的 Global Buff child、随进度解锁的后续词条，或废案/备用或旧版残留。
- 数值优先级按“当前 CcTag 黑板覆盖值 > GlobalBuffData 默认值 > BuffData 默认值”阅读。如果只看 BuffData 默认黑板，很多词条会偏离当前表配置。

术语上，`EnemyBuff` 是直接给敌人挂普通 Buff；`SelfGlobalBuff` 是先启用一个 Global Buff 入口，再把实际 Buff 分发给我方干员或修改全局系统；`ReduceChallengeTime` 是挑战时间类关卡效果。Global Buff 的通俗解释见附录 1。


## 当前未开放与内部数据

本节收录当前表里没有作为玩家词条出现的数据。下面的“暂拟”名称与描述均由本文根据 BuffData / GlobalBuffData 行为编写，用来帮助读者理解数据意图；它们不是游戏原文，也不代表后续一定会上线。

内部派生 Buff 不单独拟成玩家词条，它们保留在本节末尾作为当前词条的实现结构。

“可能的密钥指标”表示：当前游戏内已经出现的两个 `special_cc0` 词条均为密钥指标，即选择后用于解锁后续部分词条；未出现的同类数据只按命名和结构推测，不属于游戏原文。

### 暂拟词条总览

>目前只能通过这个看tag机制，准确数值请等待6/26上午十点数据更新
>下述tag**不一定全部实装**，但是他们**一定**出现在了目前的游戏数据中
>你可以在下方找到每个词条的详细的描述与机制分析

| 暂拟名称 | 当前状态 | 暂拟描述 | 主要数据入口 |
|---|---|---|---|
| 暂拟：环境：逆流 | 有 Global Buff 入口，当前 CcTag 未引用；可能的密钥指标 | 干员战技伤害降低；干员消耗或吸收破防/法术附着层数后，对目标造成按层数计算的真实伤害。 | `global_buff_cc_chr_consume_inflict_special_cc0` |
| 暂拟：环境：紊流 | 有 Global Buff 入口，当前 CcTag 未引用；可能的密钥指标 | 技力自然恢复速度下降；干员通过技能获得技力时会额外获得 2 倍技力，但战技伤害降低 60%。 | `global_buff_cc_chr_normal_special_cc0` |
| 暂拟：队列：迟滞 | 有 Global Buff 入口，当前 CcTag 未引用 | 干员连携技冷却时间增加 5 秒。 | `global_buff_cc_chr_combo_cd_up` |
| 暂拟：队列：失衡 | 有 Global Buff 入口，当前 CcTag 未引用 | 干员连携技伤害降低 90%。 | `global_buff_cc_chr_combo_skill_dmg_down` |
| 暂拟：环境：凝滞 | 有 Global Buff 入口，当前 CcTag 未引用 | 角色受到寒冷相关附着后，该附着持续时间被延长。 | `global_buff_cc_chr_cryst_inflict_extend` |
| 暂拟：环境：霜阻 | 有 Global Buff 入口，当前 CcTag 未引用 | 角色身上的寒冷附着层数会降低移动速度。 | `global_buff_cc_chr_cryst_inflict_to_slowdown` |
| 暂拟：队列：耗竭 | 有 Global Buff 入口，当前 CcTag 未引用 | 干员消耗或吸收法术附着后，短时间内造成伤害降低。 | `global_buff_cc_chr_dmg_down_after_consume` |
| 暂拟：队列：远隔 | 有 Global Buff 入口，当前 CcTag 未引用 | 干员距离目标越远，造成伤害越低；4 米内基本不降低，10 米达到最大降低。 | `global_buff_cc_chr_dmg_down_by_distance` |
| 暂拟：队列：追附 | 有 Global Buff 入口，当前 CcTag 未引用 | 干员造成法术异常时，自身被施加 1 层对应的法术附着。 | `global_buff_cc_chr_inflict_after_spell_status` |
| 暂拟：队列：抑技 | 有 Global Buff 入口，当前 CcTag 未引用 | 干员战技伤害降低 90%。 | `global_buff_cc_chr_normal_skill_dmg_down` |
| 暂拟：队列：锁技 | 有 Global Buff 入口，当前 CcTag 未引用 | 干员施放战技后，战技进入 8 秒禁用状态。 | `global_buff_cc_chr_normal_skill_global_cd_lv1` |
| 暂拟：队列：重编 | 有 Global Buff 入口，当前 CcTag 未引用 | 队伍中同职业第 2 名及以后每多 1 名，全队造成伤害降低 25%。 | `global_buff_cc_chr_repeat_profession_dmg_down` |
| 暂拟：队列：旁击 | 有 Global Buff 入口，当前 CcTag 未引用 | 队友普通攻击伤害降低 75%。 | `global_buff_cc_chr_teammate_normal_attack_dmg_down` |
| 暂拟：队列：分担 | 有 Global Buff 入口，当前 CcTag 未引用 | 非主控队友受到伤害降低 50%，主控干员不受影响。 | `global_buff_cc_chr_teammate_take_dmg_down` |
| 暂拟：队列：蓄压 | 有 Global Buff 入口，当前 CcTag 未引用 | 干员每次施放终结技后，提高自身后续终结技能量需求。 | `global_buff_cc_chr_ult_sp_cost_increase_lv1`<br>`global_buff_cc_chr_ult_sp_cost_increase_lv2` |
| 暂拟：队列：滞能 | 有 Global Buff 入口，当前 CcTag 未引用 | 干员终结技能量获取速度降低。 | `global_buff_cc_chr_usp_speed_down` |
| 暂拟：环境：钝化 | GlobalBuffData-only，当前 CcTag 未引用 | ATB（技力） 恢复速度降低。 | `global_buff_cc_chr_ATB_recoverspeed_down` |
| 暂拟：改写：精锐 | GlobalBuffData-only，当前 CcTag 未引用 | 通过关卡事件提升敌方或关卡精英等级。 | `global_buff_cc_level_elite_levelup` |
| 暂拟：环境：深冻 | 当前未见入口 | 角色进入冻结表现状态，播放冻结效果并触发冻结附着事件。 | `buff_cc_chr_frozenonchar_extend_instance` |
| 暂拟：环境：回灌 | 当前未见入口 | 查找场上敌人，并对每个敌人执行回血结算。 | `buff_cc_chr_heal_reflect_to_eny_stack` |
| 暂拟：改写：凝冻 | 当前未见入口 | 敌人对主控干员造成寒冷附着时，额外触发 1 层寒冷附着，并设置 0.1 秒冷却标记。 | `buff_cc_enemy_cryst_inflict_to_frozen` |
| 暂拟：改写：休养 | 当前未见入口 | 敌人 5 秒未受到伤害后，每秒回复 1% 最大生命；再次受伤会重置倒计时。 | `buff_cc_enemy_heal_not_take_damage`<br>`buff_cc_enemy_heal_not_take_damage_countdown` |
| 暂拟：改写：濒愈 | 当前未见入口 | 敌人受伤后若生命低于 10% 且仍有触发次数，会获得 15 秒延迟回血 Buff；该 Buff 结束时回复 20% 最大生命。 | `buff_cc_enemy_low_hp_heal`<br>`buff_cc_enemy_heal_on_finish` |
| 暂拟：改写：全域屏障 | 当前未见入口 | 敌人获得破防与法术附着免疫。 | `buff_cc_enemy_periodic_inflict_resist_instance` |
| 暂拟：改写：稳态 | 当前未见入口 | 敌人最大失衡值提高。 | `buff_cc_enemy_poise_up` |
| 暂拟：改写：稳固 | 当前未见入口 | 敌人受到指定异常层数后获得霸体，异常结束后移除。 | `buff_cc_eny_abnormal_to_superarmor`<br>`buff_cc_eny_abnormal_to_superarmor_instance` |

### 暂拟词条详解

### 暂拟：环境：逆流 （可能的密钥指标）

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

干员战技伤害降低；干员消耗或吸收破防/法术附着层数后，对目标造成按层数计算的真实伤害。

**当前数据状态**

- 有 Global Buff 入口，当前 CcTag 未引用。
- 可能的密钥指标：当前已上线的两个 `special_cc0` 词条均为密钥指标，本条同属 `special_cc0` 命名组，但尚未在 CcTagTable 出现。
- 默认值：战技伤害 -60%；消耗/吸收结算为每层目标最大生命值 5% 的真实伤害。
- 数据参数为 `dmg_scale=-0.6`，`consume_dmg_scale_per_stack=0.05`。
- 主 Buff 的常驻伤害修正只检查 `NormalSkill`，因此只降低战技伤害。
- `OnConsumeBuff` 与 `OnAbsorbBuff` 都会检查被消耗/吸收的 Buff 是否带有 `Skill/Character/Common/NoGuard` 或 `Skill/Character/Common/SpellInflict` 标签，并要求消耗层数至少为 1。
- 通过检查后，主 Buff 在目标身上创建 `buff_cc_chr_consume_inflict_special_cc0_stack` 作为计数标记，数量等于本次消耗/吸收层数；同时创建 0.033 秒的 `buff_cc_chr_consume_inflict_special_cc0_instance`。
- instance 结束时统计目标身上的 stack 数量，计算 `consume_dmg_scale = consume_dmg_scale_per_stack * consume_stack`，然后对该目标造成 `MaxHp * consume_dmg_scale` 的真实伤害，并清除 stack 标记。默认就是每层 5% 最大生命值真实伤害；同一短窗口内多次触发会被 stack 汇总。

**数据链路**

- `global_buff_cc_chr_consume_inflict_special_cc0` -> `buff_cc_chr_consume_inflict_special_cc0`。
- 主 Buff 创建 `buff_cc_chr_consume_inflict_special_cc0_stack` 和 `buff_cc_chr_consume_inflict_special_cc0_instance`；stack 负责计数，instance 负责延迟汇总并执行真实伤害。
- 涉及 ID：`global_buff_cc_chr_consume_inflict_special_cc0`、`buff_cc_chr_consume_inflict_special_cc0`、`buff_cc_chr_consume_inflict_special_cc0_stack`、`buff_cc_chr_consume_inflict_special_cc0_instance`。

### 暂拟：环境：紊流 （可能的密钥指标）

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

技力自然恢复速度下降；干员通过技能获得技力时会额外获得 2 倍技力，但战技伤害降低 60%。

**当前数据状态**

- 有 Global Buff 入口，当前 CcTag 未引用。
- 可能的密钥指标：当前已上线的两个 `special_cc0` 词条均为密钥指标，本条同属 `special_cc0` 命名组，但尚未在 CcTagTable 出现。
- GlobalBuffData 默认值：`recover_ratio=1`，`skill_ratio=2`，`dmg_scale=-0.6`。其中 `recover_ratio` 是 `ATB（技力）Recover` 全局倍率的占位默认值；若后续进入 CcTagTable，应以 CcTagTable 的真实黑板值覆盖，玩家效果应理解为技力自然恢复速度下降。
- child Buff 监听 `OnObtainATB（技力）`：只有获得来源为 `Skill`、获得方式为 `Gain` 时才触发。这里的 `Skill` 是技能来源，不限于战技，连携技、终结技等技能来源的技力获取也可触发；触发后先读取本次获得的技力值，再乘以 `skill_ratio=2`，然后通过 `ObtainCostAction` 以 ATB（技力） 类型补发这部分数值。
- 同一个 child Buff 还检查伤害标记 `NormalSkill`，对战技伤害应用 `dmg_scale=-0.6`，即战技伤害降低 60%。

**数据链路**

- `global_buff_cc_chr_normal_special_cc0` -> `buff_cc_chr_normal_special_cc0`，并附带 `ATB（技力）Recover` globalModifier。
- child Buff 监听 `OnObtainATB（技力）`，并对战技伤害应用伤害降低。
- 涉及 ID：`global_buff_cc_chr_normal_special_cc0`、`buff_cc_chr_normal_special_cc0`。

### 暂拟：队列：迟滞

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

干员连携技冷却时间增加 5 秒。

**当前数据状态**

- 有 Global Buff 入口，当前 CcTag 未引用。
- 默认值：`cd=5`。

**数据链路**

- `global_buff_cc_chr_combo_cd_up` -> `buff_cc_chr_combo_cd_up`。
- child Buff 修改 `ComboSkillCooldownFinalAddition`。
- 涉及 ID：`global_buff_cc_chr_combo_cd_up`、`buff_cc_chr_combo_cd_up`。

### 暂拟：队列：失衡

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

干员连携技伤害降低 90%。

**当前数据状态**

- 有 Global Buff 入口，当前 CcTag 未引用。
- 默认值：`dmg_scale=-0.9`。

**数据链路**

- `global_buff_cc_chr_combo_skill_dmg_down` -> `buff_cc_chr_combo_skill_dmg_down`。
- child Buff 通过伤害修正筛选连携技伤害。
- 涉及 ID：`global_buff_cc_chr_combo_skill_dmg_down`、`buff_cc_chr_combo_skill_dmg_down`。

### 暂拟：环境：凝滞

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

角色受到寒冷相关附着后，该附着持续时间被延长。

**当前数据状态**

- 有 Global Buff 入口，当前 CcTag 未引用。
- 当前 Global 默认黑板没有明确数值，需等待正式 CcTag 覆盖。

**数据链路**

- `global_buff_cc_chr_cryst_inflict_extend` -> `buff_cc_chr_cryst_inflict_extend`。
- child Buff 监听 `OnAddedBuff`，对指定 Buff 执行 `SetBuffDurationAction`。
- 涉及 ID：`global_buff_cc_chr_cryst_inflict_extend`、`buff_cc_chr_cryst_inflict_extend`。

### 暂拟：环境：霜阻

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

角色身上的寒冷附着层数会降低移动速度。

**当前数据状态**

- 有 Global Buff 入口，当前 CcTag 未引用。
- 默认值：每层 `slowdown_scale_per_stack=-0.25`。

**数据链路**

- `global_buff_cc_chr_cryst_inflict_to_slowdown` -> `buff_cc_chr_cryst_inflict_to_slowdown`。
- child Buff 根据附着层数写入动态黑板，并修正地面/空中移动速度。
- 涉及 ID：`global_buff_cc_chr_cryst_inflict_to_slowdown`、`buff_cc_chr_cryst_inflict_to_slowdown`。

### 暂拟：队列：耗竭

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

干员消耗或吸收破防、法术附着或者法术异常后，短时间内造成伤害降低。

**当前数据状态**

- 有 Global Buff 入口，当前 CcTag 未引用。
- 默认值：伤害 -90%，持续 10 秒。
- 触发条件是消耗或吸收法术附着；数据用 `Skill/Character/Common/SpellInflict`、`Skill/Character/Common/SpellStatus` 等标签识别对应 Buff，且消耗层数至少为 1。
- 被消耗或吸收的法术附着种类不会决定降伤种类；派生的 `buff_cc_chr_dmg_down_after_consume_instance` 没有法术/物理类型条件，是对持有者后续造成的伤害统一应用 `dmg_scale`。

**数据链路**

- `global_buff_cc_chr_dmg_down_after_consume` -> `buff_cc_chr_dmg_down_after_consume`。
- 主 Buff 创建 `buff_cc_chr_dmg_down_after_consume_instance`，由 instance 执行伤害降低。
- 涉及 ID：`global_buff_cc_chr_dmg_down_after_consume`、`buff_cc_chr_dmg_down_after_consume`、`buff_cc_chr_dmg_down_after_consume_instance`。

### 暂拟：队列：远隔

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

干员距离目标越远，造成伤害越低；4 米内基本不降低，10 米达到最大降低。

**当前数据状态**

- 有 Global Buff 入口，当前 CcTag 未引用。
- 默认值：`distance_min=4`，`distance_max=10`，最大伤害降低 90%。
- 公式为 `dmgdown_scale = clamp((distance - distance_min) / (distance_max - distance_min), 0, 1) * dmgdown_max` （一段距离之后开始，在达到最大距离前线性递减为0）。
- 代入默认值：4 米内为 0，不降低；7 米约为 -45%；10 米及更远为 -90%。该值进入 `DamageScaleProcessor` 的 `ProdCalcZone`，等价于按距离降低干员本次造成的伤害。

**数据链路**

- `global_buff_cc_chr_dmg_down_by_distance` -> `buff_cc_chr_dmg_down_by_distance`。
- child Buff 保存目标距离并计算 `dmgdown_scale`。
- 涉及 ID：`global_buff_cc_chr_dmg_down_by_distance`、`buff_cc_chr_dmg_down_by_distance`。

### 暂拟：队列：追附

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

干员造成法术异常时，自身被施加 1 层对应的法术附着。

**当前数据状态**

- 有 Global Buff 入口，当前 CcTag 未引用。
- 默认值：`inflict_stack=1`。
- 该 Buff 监听 `OnBeforeOutputBuff`。当干员即将造成特定法术异常时，会对当前主控干员施加对应法术附着：造成冻结异常时自身获得寒冷附着（Cryst），造成燃烧异常时自身获得火附着（Fire），造成传导异常时自身获得脉冲附着（Pulse），造成腐蚀异常时自身获得自然附着（Natural）。
- 这里的目标选择为 `MainCharacter`，所以效果不是提高本次对敌人输出的异常或附着层数，而是把对应法术附着加到当前主控干员身上。

**数据链路**

- `global_buff_cc_chr_inflict_after_spell_status` -> `buff_cc_chr_inflict_after_spell_status`。
- child Buff 监听输出 Buff 前事件，并根据即将造成的法术异常，对主控干员施加对应法术附着。
- 涉及 ID：`global_buff_cc_chr_inflict_after_spell_status`、`buff_cc_chr_inflict_after_spell_status`。

### 暂拟：队列：抑技

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

干员战技伤害降低 90%。

**当前数据状态**

- 有 Global Buff 入口，当前 CcTag 未引用。
- 默认值：`dmg_scale=-0.9`。

**数据链路**

- `global_buff_cc_chr_normal_skill_dmg_down` -> `buff_cc_chr_normal_skill_dmg_down`。
- child Buff 通过伤害装饰 mask 筛选战技伤害。
- 涉及 ID：`global_buff_cc_chr_normal_skill_dmg_down`、`buff_cc_chr_normal_skill_dmg_down`。

### 暂拟：队列：锁技

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

干员施放战技后，全队的战技进入 8 秒禁用状态。

**当前数据状态**

- 有 Global Buff 入口，当前 CcTag 未引用。
- 默认值：`cd=8`。

**数据链路**

- `global_buff_cc_chr_normal_skill_global_cd_lv1` -> `buff_cc_chr_normal_skill_global_cd`。
- 主 Buff 在施放战技前创建 `buff_cc_chr_normal_skill_global_cd_instance`，instance 带有 `DisableNormalSkill` 标签。
- 涉及 ID：`global_buff_cc_chr_normal_skill_global_cd_lv1`、`buff_cc_chr_normal_skill_global_cd`、`buff_cc_chr_normal_skill_global_cd_instance`。

### 暂拟：队列：重编

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

队伍中每个职业只允许 1 名干员；同职业第 2 名及以后每多 1 名，全队造成伤害降低 25%。多个重复职业会累加。

**当前数据状态**

- 有 Global Buff 入口，当前 CcTag 未引用。
- 默认值：`dmg_scale=-0.25`，即每 1 个重复职业额外名额造成伤害 -25%。
- 判定职业包括数据中的 `Guard`、`Defender`、`Supporter`、`Caster`、`Assault`、`Vanguard`；如果实际队伍人数与六类统计不一致，数据会用差额重写 `Assault` 计数，推测是职业枚举兜底。
- 惩罚层数为 `sum(max(职业人数 - 1, 0))`。例如 2 名同职业为 1 层，3 名同职业为 2 层；2 名 `Guard` 加 2 名 `Caster` 也是 2 层。

**数据链路**

- `global_buff_cc_chr_repeat_profession_dmg_down` -> `buff_cc_chr_repeat_profession_dmg_down`。
- `CheckMainCharacterCondition` 只作为入口去重：Global child 可能分发到多名干员，但只有 `Owner` 是当前主控干员的那份主 Buff 负责扫描队伍，避免同一词条被重复计算。
- 通过去重检查后，主 Buff 扫描我方队伍，统计各职业人数并计算重复层数 `total`。
- 随后给队伍目标组创建 `buff_cc_chr_repeat_profession_dmg_down_instance`，传入 `total * dmg_scale`；因此生效对象是全队，而不是只有重复职业成员。没有重复职业时传入值为 0，不产生实际减伤。
- 涉及 ID：`global_buff_cc_chr_repeat_profession_dmg_down`、`buff_cc_chr_repeat_profession_dmg_down`、`buff_cc_chr_repeat_profession_dmg_down_instance`。

### 暂拟：队列：旁击

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

队友普通攻击伤害降低 75%。

**当前数据状态**

- 有 Global Buff 入口，当前 CcTag 未引用。
- 默认值：`dmg_scale=-0.75`。

**数据链路**

- `global_buff_cc_chr_teammate_normal_attack_dmg_down` -> `buff_cc_chr_teammate_normal_attack_dmg_down`。
- child Buff 筛选队友与普通攻击伤害。
- 涉及 ID：`global_buff_cc_chr_teammate_normal_attack_dmg_down`、`buff_cc_chr_teammate_normal_attack_dmg_down`。

### 暂拟：队列：分担

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

非主控队友受到伤害降低 50%，主控干员不受影响。
按照词条规律这里应该是受到的伤害提高才合理，推测后面会改成正数。

**当前数据状态**

- 有 Global Buff 入口，当前 CcTag 未引用。
- 默认值：`dmg_down=-0.5`。这个数值写入 Defender 侧 `ProdCalcZone`，该乘区按 `1 + addition` 生效，所以实际受伤倍率为 `1 + (-0.5) = 0.5`，即受到伤害减半。

**数据链路**

- `global_buff_cc_chr_teammate_take_dmg_down` -> `buff_cc_chr_teammate_take_dmg_down`。
- child Buff 挂在我方干员身上；当持有该 Buff 的干员作为受击方时，才把修正写入该受击方的 Defender 侧乘区。
- 条件里先检查 Buff 的 `Owner` 是否为当前主控干员；如果是主控，就执行 `ReturnFalseAction`，本次 modifier 不生效。
- 因此它只在非主控队友作为受击方时生效。队友攻击敌人时，敌人虽然是那次伤害的 Defender，但敌人身上没有这个 child Buff，不会触发本条修正；它也不是把主控受到的伤害转移给队友，或让全队共享伤害。
- 涉及 ID：`global_buff_cc_chr_teammate_take_dmg_down`、`buff_cc_chr_teammate_take_dmg_down`。

### 暂拟：队列：蓄压

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

干员每次施放终结技后，提高自身后续终结技能量需求。

**当前数据状态**

- 有 Global Buff 入口，当前 CcTag 未引用。
- 预留两档：`usp_up=0.2` / `usp_up=0.5`，对应每层终结技能量需求 +20% / +50%。
- instance 使用 `Stack` 叠层，`maxStackCnt=99`。因此多次施放终结技后会继续叠加；若同一干员连续施放 2 次，lv1 默认会有 2 层，总计需求 +40%。

**数据链路**

- `global_buff_cc_chr_ult_sp_cost_increase_lv1` / `lv2` -> `buff_cc_chr_ult_sp_cost_increase`。
- 主 Buff 监听 `OnAfterSkillApplyCost`，确认本次技能类型是 `UltimateSkill` 后，给技能拥有者创建 `buff_cc_chr_ult_sp_cost_increase_instance`。
- 底层通过 instance 修改 `MaxUltimateSp` 实现。它不是直接改变本次终结技扣费；触发时本次消耗已经完成，影响的是之后的终结技能量需求。
- 涉及 ID：`global_buff_cc_chr_ult_sp_cost_increase_lv1`、`global_buff_cc_chr_ult_sp_cost_increase_lv2`、`buff_cc_chr_ult_sp_cost_increase`、`buff_cc_chr_ult_sp_cost_increase_instance`。

### 暂拟：队列：滞能

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

干员终结技能量获取速度降低。

**当前数据状态**

- 有 Global Buff 入口，当前 CcTag 未引用。
- Global 默认 `usp_scale=-0.1`，BuffData 默认 `usp_scale=0.5`，当前未有 CcTag 覆盖，最终数值不能定稿。

**数据链路**

- `global_buff_cc_chr_usp_speed_down` -> `buff_cc_chr_usp_speed_down`。
- child Buff 修改 `UltimateSpGainScalar`。
- 涉及 ID：`global_buff_cc_chr_usp_speed_down`、`buff_cc_chr_usp_speed_down`。

### 暂拟：环境：钝化

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

ATB（技力） 恢复速度降低。

**当前数据状态**

- GlobalBuffData-only，当前 CcTag 未引用。
- 默认值：`ratio=-0.1`。

**数据链路**

- `global_buff_cc_chr_ATB_recoverspeed_down`。
- 该项没有 child BuffData，通过 `ATB（技力）Recover` globalModifier 生效。
- 涉及 ID：`global_buff_cc_chr_ATB_recoverspeed_down`。

### 暂拟：改写：精锐

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

通过关卡事件提升敌方或关卡精英等级。

**当前数据状态**

- GlobalBuffData-only，当前 CcTag 未引用。
- 当前 GlobalBuffData 无默认黑板。

**数据链路**

- `global_buff_cc_level_elite_levelup`。
- 通过 `SendBattleSignalToLevel` 发送关卡事件。
- 涉及 ID：`global_buff_cc_level_elite_levelup`。

### 暂拟：环境：深冻

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

角色进入冻结表现状态，播放冻结效果并触发冻结附着事件。

**当前数据状态**

- 当前未见入口。
- 默认持续时间 `duration=15`。

**数据链路**

- `buff_cc_chr_frozenonchar_extend_instance`。
- 包含动画时间缩放、特效和 `TriggerCharSpellInflictionEvent`。
- 涉及 ID：`buff_cc_chr_frozenonchar_extend_instance`。

### 暂拟：环境：回灌

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

查找场上敌人，并对每个敌人执行回血结算。

**当前数据状态**

- 当前未见入口。
- 默认敌方回复比例 `eny_heal_ratio=0.05`。

**数据链路**

- `buff_cc_chr_heal_reflect_to_eny_stack`。
- 当前“同步生长”使用 heal/shield 两条 stack 分支，未见创建这个通用 stack。
- 涉及 ID：`buff_cc_chr_heal_reflect_to_eny_stack`。

### 暂拟：改写：凝冻

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

敌人对主控干员造成寒冷附着时，额外触发 1 层寒冷附着，并设置 0.1 秒冷却标记。

**当前数据状态**

- 当前未见入口。
- 触发事件：敌方 Buff 的 `OnOutputBuff`。
- 触发条件：输出的 Buff 带有 `Skill/Enemy/Common/SpellInflictOnChar/CrystInflictOnChar` 标签，且输出目标是当前主控干员。
- 冷却限制：若拥有者身上不存在同名 timed marker，则允许触发；触发后创建 `buff_cc_enemy_cryst_inflict_to_frozen` marker，持续 `cd=0.1` 秒。
- 实际效果：执行 `SpellInflictionOnChar`，对目标追加 1 层 `Cryst` 附着。黑板里的 `layer=3` 当前未被该 action 读取，不能写成“3 层触发”。

**数据链路**

- `buff_cc_enemy_cryst_inflict_to_frozen` 监听敌人输出寒冷附着。
- 条件通过后，对主控干员执行 `SpellInflictionOnChar(inflictionType=Cryst, inflictionCount=1)`。
- 随后创建同名 timed marker 作为 0.1 秒冷却。
- 涉及 ID：`buff_cc_enemy_cryst_inflict_to_frozen`。


### 暂拟：改写：休养

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

敌人一段时间未受到伤害后，开始周期性回复生命；再次受伤会重置。

**当前数据状态**

- 当前未见入口。
- 默认倒计时为 5 秒：受伤后先创建 `buff_cc_enemy_heal_not_take_damage_countdown`，如果这 5 秒内再次受伤，会先移除已经存在的回血 instance，并重新创建倒计时。
- 倒计时结束后创建 `buff_cc_enemy_heal_not_take_damage_instance`。该 instance 每 1 秒触发一次，每次回复 `hp_ratio=0.01` 最大生命值，也就是每秒 1% 最大生命。

**数据链路**

- `buff_cc_enemy_heal_not_take_damage` -> `buff_cc_enemy_heal_not_take_damage_countdown` -> `buff_cc_enemy_heal_not_take_damage_instance`。
- 主 Buff 在受伤时重置回血流程；倒计时结束后由 instance 周期性执行回血。
- 涉及 ID：`buff_cc_enemy_heal_not_take_damage`、`buff_cc_enemy_heal_not_take_damage_countdown`、`buff_cc_enemy_heal_not_take_damage_instance`。

### 暂拟：改写：濒愈

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

敌人受伤后若生命低于 10% 且仍有触发次数，会获得 15 秒延迟回血 Buff；该 Buff 结束时回复 20% 最大生命。

**当前数据状态**

- 当前未见入口。
- 触发事件：`buff_cc_enemy_low_hp_heal` 监听 `OnTakeDamage`。
- 触发条件：受伤后自身生命比例低于 `hp_ratio=0.1`，且动态黑板 `tag >= 1`。
- 触发后：给自身创建 `buff_cc_enemy_heal_on_finish`，传入 `hp_recover=0.2` 和持续时间 15 秒；随后 `tag` 减 1，因此默认只触发一次。
- 延迟回血：`buff_cc_enemy_heal_on_finish` 存续期间播放回血特效，结束时执行 `HealAction`，按自身最大生命值的 20% 回复。

**数据链路**

- `buff_cc_enemy_low_hp_heal` 负责低血量判定和触发次数消耗。
- `buff_cc_enemy_heal_on_finish` 是 15 秒延迟回血 Buff，在 `OnBuffFinish` 执行回血。
- 涉及 ID：`buff_cc_enemy_low_hp_heal`、`buff_cc_enemy_heal_on_finish`。

### 暂拟：改写：全域屏障

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

敌人获得破防与法术附着免疫。

**当前数据状态**

- 当前未见入口。
- 默认持续时间 `duration=5`。

**数据链路**

- `buff_cc_enemy_periodic_inflict_resist_instance`。
- 当前“改写：屏障”入口按元素创建专门免疫 Buff，没有创建该全域 instance。
- 涉及 ID：`buff_cc_enemy_periodic_inflict_resist_instance`。

### 暂拟：改写：稳态

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

敌人最大失衡值提高。

**当前数据状态**

- 当前未见入口。
- 默认 `poise_up=0.15`，作用于 `MaxPoise`，即最大失衡值；具体倍率表现取决于 `BaseMultiplier` 公式。

**数据链路**

- `buff_cc_enemy_poise_up`。
- 涉及 ID：`buff_cc_enemy_poise_up`。

### 暂拟：改写：稳固

> 非原游戏内容：以下名称与描述由本文根据数据行为编写，不属于游戏内正式 CcTag 文案。

**暂拟描述**

敌人受到异常效果后获得霸体，异常结束后移除。

**当前数据状态**

- 当前未见入口。
- 无默认数值黑板。

**数据链路**

- `buff_cc_eny_abnormal_to_superarmor` -> `buff_cc_eny_abnormal_to_superarmor_instance` / `buff_cc_eny_abnormal_to_superarmor_do_finish`。
- instance 执行 `SetSuperArmorAction`，do_finish 负责结束清理。
- 涉及 ID：`buff_cc_eny_abnormal_to_superarmor`、`buff_cc_eny_abnormal_to_superarmor_instance`、`buff_cc_eny_abnormal_to_superarmor_do_finish`。

### 当前词条的内部派生 Buff

这些 BuffData 已经被当前 CcTag 相关系统间接使用，但不是玩家能单独选择的词条入口，因此不拟写成独立词条。

- `buff_cc_chr_combo_skill_cryst_inflict_stack`：由 `buff_cc_chr_combo_skill_cryst_inflict` 创建，属于“队列：热流失”内部结构。
- `buff_cc_chr_cryst_dmg_down`：由 `buff_cc_chr_dmg_down_after_inflict` 创建，属于“队列：扼制”内部结构。
- `buff_cc_chr_dmg_reduce_maxhp_instance`：由 `buff_cc_chr_dmg_reduce_maxhp` 创建，属于“队列：衰竭”内部结构。
- `buff_cc_chr_fire_dmg_down`：由 `buff_cc_chr_dmg_down_after_inflict` 创建，属于“队列：扼制”内部结构。
- `buff_cc_chr_heal_reflect_to_eny_effect`：由 `buff_cc_chr_heal_reflect_to_eny_stack_heal_do` 创建，属于“环境：同步生长”内部结构。
- `buff_cc_chr_heal_reflect_to_eny_heal`：由 `buff_cc_chr_heal_reflect_to_eny` 创建，属于“环境：同步生长”内部结构。
- `buff_cc_chr_heal_reflect_to_eny_shield`：由 `buff_cc_chr_heal_reflect_to_eny` 创建，属于“环境：同步生长”内部结构。
- `buff_cc_chr_heal_reflect_to_eny_stack_heal`：由 `buff_cc_chr_heal_reflect_to_eny_heal` 创建，属于“环境：同步生长”内部结构。
- `buff_cc_chr_heal_reflect_to_eny_stack_heal_do`：由 `buff_cc_chr_heal_reflect_to_eny_stack_heal`, `buff_cc_chr_heal_reflect_to_eny_stack_shield` 创建，属于“环境：同步生长”内部结构。
- `buff_cc_chr_heal_reflect_to_eny_stack_shield`：由 `buff_cc_chr_heal_reflect_to_eny_shield` 创建，属于“环境：同步生长”内部结构。
- `buff_cc_chr_natural_dmg_down`：由 `buff_cc_chr_dmg_down_after_inflict` 创建，属于“队列：扼制”内部结构。
- `buff_cc_chr_normal_skill_cryst_inflict_stack`：由 `buff_cc_chr_normal_skill_cryst_inflict` 创建，属于“队列：失温”内部结构。
- `buff_cc_chr_phy_dmg_down`：由 `buff_cc_chr_dmg_down_after_inflict` 创建，属于“队列：扼制”内部结构。
- `buff_cc_chr_pulse_dmg_down`：由 `buff_cc_chr_dmg_down_after_inflict` 创建，属于“队列：扼制”内部结构。
- `buff_cc_chr_ult_dmg_down_gradual_stack`：由 `buff_cc_chr_ult_dmg_down_gradual` 创建，属于“队列：折刃”内部结构。
- `buff_cc_enemy_common_movespeedup_dmg_limit_base`：由 `buff_cc_enemy_common_movespeedup` 创建，属于“改写：奔腾”内部结构。
- `buff_cc_enemy_common_movespeedup_dmg_limit_instance`：由 `buff_cc_enemy_common_movespeedup_dmg_limit_base` 创建，属于“改写：奔腾”内部结构。
- `buff_cc_enemy_heal_under_control_instance`：由 `buff_cc_enemy_heal_under_control` 创建，属于“改写：愈合”内部结构。
- `buff_cc_enemy_heal_under_control_stack`：由 `buff_cc_enemy_heal_under_control` 创建，属于“改写：愈合”内部结构。
- `buff_cc_enemy_heal_under_control_timer`：由 `buff_cc_enemy_heal_under_control_instance` 创建，属于“改写：愈合”内部结构。
- `buff_cc_enemy_inflict_stack_resist_add_listener`：由 `buff_cc_enemy_inflict_stack_resist` 创建，属于“改写：裹附”内部结构。
- `buff_cc_enemy_inflict_stack_resist_consume_delay`：由 `buff_cc_enemy_inflict_stack_resist_consume_listener` 创建，属于“改写：裹附”内部结构。
- `buff_cc_enemy_inflict_stack_resist_consume_listener`：由 `buff_cc_enemy_inflict_stack_resist` 创建，属于“改写：裹附”内部结构。
- `buff_cc_enemy_inflict_stack_resist_cryst`：由 `buff_cc_enemy_inflict_stack_resist_add_listener` 创建，属于“改写：裹附”内部结构。
- `buff_cc_enemy_inflict_stack_resist_fire`：由 `buff_cc_enemy_inflict_stack_resist_add_listener` 创建，属于“改写：裹附”内部结构。
- `buff_cc_enemy_inflict_stack_resist_natural`：由 `buff_cc_enemy_inflict_stack_resist_add_listener` 创建，属于“改写：裹附”内部结构。
- `buff_cc_enemy_inflict_stack_resist_phy`：由 `buff_cc_enemy_inflict_stack_resist_add_listener` 创建，属于“改写：裹附”内部结构。
- `buff_cc_enemy_inflict_stack_resist_pulse`：由 `buff_cc_enemy_inflict_stack_resist_add_listener` 创建，属于“改写：裹附”内部结构。
- `buff_cc_enemy_periodic_inflict_resist_cryst`：由 `buff_cc_enemy_periodic_inflict_resist` 创建，属于“改写：屏障”内部结构。
- `buff_cc_enemy_periodic_inflict_resist_fire`：由 `buff_cc_enemy_periodic_inflict_resist` 创建，属于“改写：屏障”内部结构。
- `buff_cc_enemy_periodic_inflict_resist_natural`：由 `buff_cc_enemy_periodic_inflict_resist` 创建，属于“改写：屏障”内部结构。
- `buff_cc_enemy_periodic_inflict_resist_phy`：由 `buff_cc_enemy_periodic_inflict_resist` 创建，属于“改写：屏障”内部结构。
- `buff_cc_enemy_periodic_inflict_resist_pulse`：由 `buff_cc_enemy_periodic_inflict_resist` 创建，属于“改写：屏障”内部结构。

## 附录 1：什么是 Global Buff

普通玩家可以把 Global Buff 理解为“词条入口”或“全局开关”。它不一定直接显示为一个角色身上的 Buff，但会在战斗开始后把真正的效果分发出去。

它常见有三种形式：

1. **分发 child BuffData**：例如“队列：萎缩”先启用 `global_buff_cc_chr_main_attribute_down`，再给当前小队成员挂 `buff_cc_chr_main_attribute_down`。CcTag 里的 `attr=0.9/0.8/0.6` 会传到 child Buff，成为最终数值。
2. **直接修改全局系统**：例如“环境：厌氧”使用 `global_buff_cc_chr_dash_recover_speed_down`，没有 child BuffData，而是通过 `DashRecover` 的 globalModifier 修改体力恢复速度。
3. **发送关卡事件**：例如“环境：时限”和“环境：枯萎”没有普通 BuffData，Global Buff 通过 `SendBattleSignalToLevel` 让关卡系统调整倒计时或治愈团块。

因此，阅读危机合约数据时不能只看 `BuffData/buff_cc*.json`。如果某个 CcTag 的 termType 是 `SelfGlobalBuff`，真正生效的数值通常要沿着 `CcTagTable -> GlobalBuffData -> child BuffData / globalModifier / level event` 这条链路查。当前 CcTag 黑板值优先级最高，GlobalBuffData 和 BuffData 里的默认值更多是占位或备用。

## 附录 2：当前已上线词条详解

### 环境：过速

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 100003 | 3 | 环境：过速 | 干员连携技冷却时间-{1-cd_scale:0%}，战技伤害-{-dmg_scale:0%} | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_combo_special_cc0` cd_scale=0.4, dmg_scale=-0.6 |

**效果概述**

连携技冷却缩短，但战技伤害降低。

**当前数值**

- 100003：连携技冷却变为 40%（等价于冷却时间 -60%）；战技伤害 -60%。
- 该词条是已上线的 `special_cc0` 密钥指标之一；选择后用于解锁后续部分词条。

**数据链路**

- CcTag 100003 -> `global_buff_cc_chr_combo_special_cc0` -> `buff_cc_chr_combo_special_cc0`。
- `cd_scale` 从 CcTag 传给 child Buff；`dmg_scale=-0.6` 与 child Buff 默认值一致。
- 涉及 GlobalBuffData：`global_buff_cc_chr_combo_special_cc0`。
- 涉及 BuffData：`buff_cc_chr_combo_special_cc0`。

**机制注记**

该词条经 Global Buff 分发，Global Buff 是机制链路的一部分。`global_buff_cc_chr_combo_special_cc0` 默认 `cd_scale=0.2`，当前词条覆盖为 `0.4`。

### 改写：刺激

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 100201 | 1 | 改写：刺激Ⅰ | 敌人造成伤害+{dmg_up:0%}/+{@100202@dmg_up:0%} | EnemyBuff（直接给敌人挂 Buff）: `buff_cc_enemy_common_dmg_up` dmg_up=0.3 |
| 100202 | 2 | 改写：刺激Ⅱ | 敌人造成伤害+{@100201@dmg_up:0%}/+{dmg_up:0%} | EnemyBuff（直接给敌人挂 Buff）: `buff_cc_enemy_common_dmg_up` dmg_up=0.8 |

**效果概述**

敌人造成的各类型伤害提高。

**当前数值**

- I / 100201：敌人伤害 +30%。
- II / 100202：敌人伤害 +80%。

**数据链路**

- CcTag 直接以 EnemyBuff 方式应用 `buff_cc_enemy_common_dmg_up`。
- 该 Buff 修改物理、灼热、电磁、寒冷、自然、以太等伤害提高属性。
- 涉及 BuffData：`buff_cc_enemy_common_dmg_up`。

**机制注记**

BuffData 默认 `dmg_up=0.1` 不是当前词条数值；当前 CcTag 覆盖为 +30% / +80%。

### 队列：失温

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 100301 | 1 | 队列：失温Ⅰ | 干员每施放{times:0}/{@100302@times:0}次战技，主控干员获得一层寒冷附着。每名干员3秒冷却时间 | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_normal_skill_cryst_inflict` times=2 |
| 100302 | 2 | 队列：失温Ⅱ | 干员每施放{@100301@times:0}/{times:0}次战技，主控干员获得一层寒冷附着。每名干员3秒冷却时间 | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_normal_skill_cryst_inflict` times=1 |

**效果概述**

干员反复施放战技后，主控干员获得寒冷附着。

**当前数值**

- I / 100301：每施放 2 次战技触发。
- II / 100302：每施放 1 次战技触发。
- 每名干员有 3 秒冷却。

**数据链路**

- CcTag -> `global_buff_cc_chr_normal_skill_cryst_inflict` -> `buff_cc_chr_normal_skill_cryst_inflict`。
- 主 Buff 创建/移除 `buff_cc_chr_normal_skill_cryst_inflict_stack` 作为计数标记。
- 涉及 GlobalBuffData：`global_buff_cc_chr_normal_skill_cryst_inflict`。
- 涉及 BuffData：`buff_cc_chr_normal_skill_cryst_inflict`、`buff_cc_chr_normal_skill_cryst_inflict_stack`。

**机制注记**

这是多等级词条，必须按 2 次 / 1 次列出；`stack` Buff 是内部计数，不是独立词条。

### 队列：热流失

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 100401 | 1 | 队列：热流失Ⅰ | 干员每施放{times:0}/{@100402@times:0}次连携技，主控干员获得一层寒冷附着。每名干员3秒冷却时间 | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_combo_skill_cryst_inflict` times=2 |
| 100402 | 2 | 队列：热流失Ⅱ | 干员每施放{@100401@times:0}/{times:0}次连携技，主控干员获得一层寒冷附着。每名干员3秒冷却时间 | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_combo_skill_cryst_inflict` times=1 |

**效果概述**

干员反复施放连携技后，主控干员获得寒冷附着。

**当前数值**

- I / 100401：每施放 2 次连携技触发。
- II / 100402：每施放 1 次连携技触发。
- 每名干员有 3 秒冷却。

**数据链路**

- CcTag -> `global_buff_cc_chr_combo_skill_cryst_inflict` -> `buff_cc_chr_combo_skill_cryst_inflict`。
- 主 Buff 创建/移除 `buff_cc_chr_combo_skill_cryst_inflict_stack` 作为计数标记。
- 涉及 GlobalBuffData：`global_buff_cc_chr_combo_skill_cryst_inflict`。
- 涉及 BuffData：`buff_cc_chr_combo_skill_cryst_inflict`、`buff_cc_chr_combo_skill_cryst_inflict_stack`。

**机制注记**

机制与“失温”相同，但监听的是连携技。

### 队列：折刃

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 100501 | 1 | 队列：折刃Ⅰ | 干员每施放一次终结技，该干员之后的终结技伤害-{-dmg_scale_per_layer:0%}/-{@100502@-dmg_scale_per_layer:0%} | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_ult_dmg_down_gradual` dmg_scale_per_layer=-0.5 |
| 100502 | 2 | 队列：折刃Ⅱ | 干员每施放一次终结技，该干员之后的终结技伤害-{@100501@-dmg_scale_per_layer:0%}/-{-dmg_scale_per_layer:0%} | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_ult_dmg_down_gradual` dmg_scale_per_layer=-1 |

**效果概述**

干员每次施放终结技后，该干员之后的终结技伤害按层数降低。

**当前数值**

- I / 100501：每层终结技伤害 -50%。
- II / 100502：每层终结技伤害 -100%。

**数据链路**

- CcTag -> `global_buff_cc_chr_ult_dmg_down_gradual`。
- Global Buff 同时挂 `buff_cc_chr_ult_dmg_down_gradual` 与 `buff_cc_chr_ult_dmg_down_gradual_instance`。
- 主 Buff 在终结技后创建 `buff_cc_chr_ult_dmg_down_gradual_stack`；instance 读取 stack 数并按层降低终结技伤害。
- 涉及 GlobalBuffData：`global_buff_cc_chr_ult_dmg_down_gradual`。
- 涉及 BuffData：`buff_cc_chr_ult_dmg_down_gradual`、`buff_cc_chr_ult_dmg_down_gradual_instance`、`buff_cc_chr_ult_dmg_down_gradual_stack`。

**机制注记**

该系统不是由 stack 再创建 instance；Global Buff 会预先挂主 Buff 和 instance，stack 只负责记录终结技使用层数。

### 队列：斩首

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 100601 | 1 | 队列：斩首Ⅰ | 主控干员受到伤害+{dmg_scale:0%}/+{@100602@dmg_scale:0%} | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_main_dmg_taken_up` dmg_scale=0.5 |
| 100602 | 2 | 队列：斩首Ⅱ | 主控干员受到伤害+{@100601@dmg_scale:0%}/+{dmg_scale:0%} | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_main_dmg_taken_up` dmg_scale=1 |

**效果概述**

主控干员受到伤害提高。

**当前数值**

- I / 100601：主控干员受伤 +50%。
- II / 100602：主控干员受伤 +100%。

**数据链路**

- CcTag -> `global_buff_cc_chr_main_dmg_taken_up` -> `buff_cc_chr_main_dmg_taken_up`。
- 涉及 GlobalBuffData：`global_buff_cc_chr_main_dmg_taken_up`。
- 涉及 BuffData：`buff_cc_chr_main_dmg_taken_up`。

**机制注记**

BuffData 默认 `dmg_scale=0.1` 不是当前词条数值；当前 CcTag 覆盖为 +50% / +100%。

### 队列：脱力

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 100803 | 3 | 队列：脱力 | 干员普通攻击伤害-{-dmg_scale:0%} | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_normal_attack_dmg_down` dmg_scale=-0.7 |

**效果概述**

干员普通攻击伤害降低。

**当前数值**

- 100803：普通攻击伤害 -70%。

**数据链路**

- CcTag -> `global_buff_cc_chr_normal_attack_dmg_down` -> `buff_cc_chr_normal_attack_dmg_down`。
- 涉及 GlobalBuffData：`global_buff_cc_chr_normal_attack_dmg_down`。
- 涉及 BuffData：`buff_cc_chr_normal_attack_dmg_down`。

**机制注记**

GlobalBuffData 默认为 -60%，当前 CcTag 覆盖为 -70%。

### 队列：扼制

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 100901 | 1 | 队列：扼制Ⅰ | 干员使敌人的破防或法术附着层数增加后，该干员造成的对应类型伤害-{-dmg_scale:0%}/-{@100902@-dmg_scale:0%}，持续10秒 | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_dmg_down_after_inflict` dmg_scale=-0.45 |
| 100902 | 2 | 队列：扼制Ⅱ | 干员使敌人的破防或法术附着层数增加后，该干员造成的对应类型伤害-{@100901@-dmg_scale:0%}/-{-dmg_scale:0%}，持续10秒 | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_dmg_down_after_inflict` dmg_scale=-0.9 |

**效果概述**

干员使敌人破防或法术附着层数增加后，该干员对应类型伤害暂时降低。

**当前数值**

- I / 100901：对应类型伤害 -45%，持续 10 秒。
- II / 100902：对应类型伤害 -90%，持续 10 秒。

**数据链路**

- CcTag -> `global_buff_cc_chr_dmg_down_after_inflict` -> `buff_cc_chr_dmg_down_after_inflict`。
- 主 Buff 根据触发类型创建 `buff_cc_chr_phy_dmg_down`、`buff_cc_chr_fire_dmg_down`、`buff_cc_chr_pulse_dmg_down`、`buff_cc_chr_cryst_dmg_down`、`buff_cc_chr_natural_dmg_down`。
- 涉及 GlobalBuffData：`global_buff_cc_chr_dmg_down_after_inflict`。
- 涉及 BuffData：`buff_cc_chr_cryst_dmg_down`、`buff_cc_chr_dmg_down_after_inflict`、`buff_cc_chr_fire_dmg_down`、`buff_cc_chr_natural_dmg_down`、`buff_cc_chr_phy_dmg_down`、`buff_cc_chr_pulse_dmg_down`。

**机制注记**

BuffData 默认 `dmg_scale=-0.1` 只是备用值；当前多等级必须写为 -45% / -90%。

### 改写：屏障

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 101001 | 1 | 改写：屏障 | 每个敌人每{duration:0}秒只能被施加一次破防或同类型的法术附着 | EnemyBuff（直接给敌人挂 Buff）: `buff_cc_enemy_periodic_inflict_resist` duration=5 |

**效果概述**

每个敌人对破防或同类型法术附着有周期性免疫窗口。

**当前数值**

- 101001：每 5 秒只能被施加一次破防或同类型法术附着。

**数据链路**

- CcTag 直接应用 `buff_cc_enemy_periodic_inflict_resist`。
- 主 Buff 按类型创建 `buff_cc_enemy_periodic_inflict_resist_phy`、`fire`、`pulse`、`cryst`、`natural` 等免疫 Buff。
- 涉及 BuffData：`buff_cc_enemy_periodic_inflict_resist`、`buff_cc_enemy_periodic_inflict_resist_cryst`、`buff_cc_enemy_periodic_inflict_resist_fire`、`buff_cc_enemy_periodic_inflict_resist_natural`、`buff_cc_enemy_periodic_inflict_resist_phy`、`buff_cc_enemy_periodic_inflict_resist_pulse`。

**机制注记**

`buff_cc_enemy_periodic_inflict_resist_instance` 当前没有被该入口创建，不能把它当作当前实装路径的一部分。

### 改写：愈合

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 101101 | 1 | 改写：愈合Ⅰ | 敌人受到控制效果影响时，每秒回复{hp_ratio:0%}/{@101102@hp_ratio:0%}最大生命值 | EnemyBuff（直接给敌人挂 Buff）: `buff_cc_enemy_heal_under_control` hp_ratio=0.05 |
| 101102 | 2 | 改写：愈合Ⅱ | 敌人受到控制效果影响时，每秒回复{@101101@hp_ratio:0%}/{hp_ratio:0%}最大生命值 | EnemyBuff（直接给敌人挂 Buff）: `buff_cc_enemy_heal_under_control` hp_ratio=0.15 |

**效果概述**

敌人处于控制效果时持续回血。

**当前数值**

- I / 101101：每秒回复 5% 最大生命值。
- II / 101102：每秒回复 15% 最大生命值。

**数据链路**

- CcTag 直接应用 `buff_cc_enemy_heal_under_control`。
- 主 Buff 创建 `buff_cc_enemy_heal_under_control_stack`、`buff_cc_enemy_heal_under_control_instance`，instance 再创建 `buff_cc_enemy_heal_under_control_timer` 执行回血。
- 涉及 BuffData：`buff_cc_enemy_heal_under_control`、`buff_cc_enemy_heal_under_control_instance`、`buff_cc_enemy_heal_under_control_stack`、`buff_cc_enemy_heal_under_control_timer`。

**机制注记**

BuffData 内置默认值不作为当前词条数值；当前黑板覆盖为 5% / 15%。

### 环境：分隔

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 101201 | 2 | 环境：分隔 | 战斗开始后，禁止切换主控干员 | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_level_mute_switch_player_pre` - |

**效果概述**

战斗开始后禁止切换主控干员。

**当前数值**

- 101201：无数值黑板。

**数据链路**

- CcTag -> `global_buff_cc_level_mute_switch_player_pre`。
- 当前 GlobalBuffData 没有 child BuffData，主要表现为关卡/提示事件。
- 涉及 GlobalBuffData：`global_buff_cc_level_mute_switch_player_pre`。
- 涉及 BuffData：无。

**机制注记**

`buff_cc_level_mute_switch_player_info` 与 `_pre` 两个 BuffData 文件存在，但当前 CcTag 入口使用的是 GlobalBuffData。

### 环境：厌氧

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 101301 | 1 | 环境：厌氧 | 体力恢复速度-{-ratio:0%} | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_dash_recover_speed_down` ratio=-0.5 |

**效果概述**

体力恢复速度降低。

**当前数值**

- 101301：`ratio=-0.5`，按当前 runtime 的 Multiplier 公式是恢复速度变为 50%，即 -50%。

**数据链路**

- CcTag -> `global_buff_cc_chr_dash_recover_speed_down`。
- 该 Global Buff 没有 child BuffData，通过 `DashRecover` 的 globalModifier 生效。
- 涉及 GlobalBuffData：`global_buff_cc_chr_dash_recover_speed_down`。
- 涉及 BuffData：无。

**机制注记**

这里不按 x(-0.5) 解读；当前模拟器里 Multiplier 表示 `current * (1 + ratio)`。同名 `buff_cc_chr_dash_recover_speed_down` 文件存在，但当前 CcTag 不通过它生效。

### 环境：禁锢

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 101303 | 3 | 环境：禁锢 | 禁止闪避 | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_level_mute_evade` - |

**效果概述**

禁止闪避。

**当前数值**

- 101303：无数值黑板。

**数据链路**

- CcTag -> `global_buff_cc_level_mute_evade` -> `buff_cc_chr_mute_evade`，并附带小队提示事件。
- 涉及 GlobalBuffData：`global_buff_cc_level_mute_evade`。
- 涉及 BuffData：`buff_cc_chr_mute_evade`。

**机制注记**

这是 Global Buff 包装后的禁用类效果。

### 队列：衰竭

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 101402 | 3 | 队列：衰竭 | 近战干员受到伤害的{hp_down_ratio_melee:0%}会转为减少生命值上限，远程干员转化率为{hp_down_ratio:0%} | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_dmg_reduce_maxhp` hp_down_ratio=0.5, hp_down_ratio_melee=0.3 |

**效果概述**

干员受伤时，将部分伤害转化为生命值上限降低。

**当前数值**

- 101402：近战干员转化 30%；远程干员转化 50%。

**数据链路**

- CcTag -> `global_buff_cc_chr_dmg_reduce_maxhp` -> `buff_cc_chr_dmg_reduce_maxhp`。
- 主 Buff 受伤时创建 `buff_cc_chr_dmg_reduce_maxhp_instance`，由 instance 修改最大生命值。
- 涉及 GlobalBuffData：`global_buff_cc_chr_dmg_reduce_maxhp`。
- 涉及 BuffData：`buff_cc_chr_dmg_reduce_maxhp`、`buff_cc_chr_dmg_reduce_maxhp_instance`。

**机制注记**

当前 CcTag 的两个参数都要写出；不要只写 `hp_down_ratio=0.5`。

### 改写：遗毒

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 101501 | 1 | 改写：遗毒Ⅰ | 敌人被击败后会留下有毒物质，干员处于其中时每秒受到{atk_scale:0%}/{@101502@atk_scale:0%}最大生命值伤害 | EnemyBuff（直接给敌人挂 Buff）: `buff_cc_enemy_death_ground_area` atk_scale=0.02 |
| 101502 | 2 | 改写：遗毒Ⅱ | 敌人被击败后会留下有毒物质，干员处于其中时每秒受到{@101501@atk_scale:0%}/{atk_scale:0%}最大生命值伤害 | EnemyBuff（直接给敌人挂 Buff）: `buff_cc_enemy_death_ground_area` atk_scale=0.05 |

**效果概述**

敌人被击败后留下地面区域，干员处于其中会按最大生命值受伤。

**当前数值**

- I / 101501：每秒 2% 最大生命值伤害。
- II / 101502：每秒 5% 最大生命值伤害。

**数据链路**

- CcTag 直接应用 `buff_cc_enemy_death_ground_area`。
- 该 Buff 在敌人生命归零时生成 ability entity，并指定 `cc_enemy_death_ground_area_skill`。
- `cc_enemy_death_ground_area_skill` 在范围内给目标挂 `buff_cc_enemy_death_ground_area_dmg`，并把 `atk_scale` 传入伤害 Buff。
- 涉及 SkillData：`cc_enemy_death_ground_area_skill`。
- 涉及 BuffData：`buff_cc_enemy_death_ground_area`、`buff_cc_enemy_death_ground_area_dmg`。

**机制注记**

地面区域由 ability entity 承载；当前已确认入口 Buff、AbilityEntity Skill 与伤害 Buff 的链路。

### 环境：融化 / 升华 / 电解 / 切削

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 101701 | 1 | 环境：融化 | 主控干员受到的冻结时间增加至{duration:0}秒，施放灼热类型技能可以解除冻结 | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_frozenonchar_extend` duration=15<br>SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_fire_skill_clear_frozenonchar` - |
| 101801 | 1 | 环境：升华 | 主控干员受到的冻结时间增加至{duration:0}秒，施放自然类型技能可以解除冻结 | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_frozenonchar_extend` duration=15<br>SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_natural_skill_clear_frozenonchar` - |
| 101901 | 1 | 环境：电解 | 主控干员受到的冻结时间增加至{duration:0}秒，施放电磁类型技能可以解除冻结 | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_frozenonchar_extend` duration=15<br>SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_pulse_skill_clear_frozenonchar` - |
| 102401 | 1 | 环境：切削 | 主控干员受到的冻结时间增加至{duration:0}秒，施放物理类型技能可以解除冻结 | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_frozenonchar_extend` duration=15<br>SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_phy_skill_clear_frozenonchar` - |

**效果概述**

主控干员冻结时间延长至 15 秒，并指定一种技能类型可以解除冻结。

**当前数值**

- 101701 融化：灼热类型技能解除冻结。
- 101801 升华：自然类型技能解除冻结。
- 101901 电解：电磁类型技能解除冻结。
- 102401 切削：物理类型技能解除冻结。
- 四个词条都包含 `global_buff_cc_chr_frozenonchar_extend`，冻结时间均为 15 秒。

**数据链路**

- 共同入口：`global_buff_cc_chr_frozenonchar_extend` -> `buff_cc_chr_frozenonchar_extend`。
- 解除入口分别是 `global_buff_cc_chr_fire_skill_clear_frozenonchar`、`natural`、`pulse`、`phy`，对应 child Buff 监听施放技能前的类型检查并移除冻结。
- 涉及 GlobalBuffData：`global_buff_cc_chr_fire_skill_clear_frozenonchar`、`global_buff_cc_chr_frozenonchar_extend`、`global_buff_cc_chr_natural_skill_clear_frozenonchar`、`global_buff_cc_chr_phy_skill_clear_frozenonchar`、`global_buff_cc_chr_pulse_skill_clear_frozenonchar`。
- 涉及 BuffData：`buff_cc_chr_fire_skill_clear_frozenonchar`、`buff_cc_chr_frozenonchar_extend`、`buff_cc_chr_natural_skill_clear_frozenonchar`、`buff_cc_chr_phy_skill_clear_frozenonchar`、`buff_cc_chr_pulse_skill_clear_frozenonchar`。

**机制注记**

这些不是数值等级，而是解除元素不同的变体。`buff_cc_chr_frozenonchar_extend_instance` 当前没有被该 global 路径创建，需标为预留/未引用。

### 环境：枯萎

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 102001 | 1 | 环境：枯萎Ⅰ | 波次间隔只产生1个治愈团块 | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_level_reduce_heal_ball` num=-2 |
| 102002 | 2 | 环境：枯萎Ⅱ | 波次间隔不产生治愈团块 | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_level_reduce_heal_ball_2` num=-3 |

**效果概述**

减少波次间隔产生的治愈团块。

**当前数值**

- I / 102001：波次间隔只产生 1 个治愈团块。
- II / 102002：波次间隔不产生治愈团块。

**数据链路**

- 102001 -> `global_buff_cc_level_reduce_heal_ball`。
- 102002 -> `global_buff_cc_level_reduce_heal_ball_2`。
- 两者都没有 child BuffData，通过关卡事件 `SendBattleSignalToLevel` 生效。
- 涉及 GlobalBuffData：`global_buff_cc_level_reduce_heal_ball`、`global_buff_cc_level_reduce_heal_ball_2`。
- 涉及 BuffData：无。

**机制注记**

`global_buff_cc_level_reduce_heal_ball_2` 的默认 `num=-2` 会被当前 CcTag 覆盖为 `num=-3`。

### 环境：时限

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 102101 | 1 | 环境：时限Ⅰ | 倒计时-{-time:0}/-{@102102@-time:0}秒 | ReduceChallengeTime（挑战时间变化）: `global_buff_cc_level_countdown_reduce` time=-100 |
| 102102 | 2 | 环境：时限Ⅱ | 倒计时-{@102101@-time:0}/-{-time:0}秒 | ReduceChallengeTime（挑战时间变化）: `global_buff_cc_level_countdown_reduce` time=-200 |

**效果概述**

挑战倒计时减少。

**当前数值**

- I / 102101：倒计时 -100 秒。
- II / 102102：倒计时 -200 秒。

**数据链路**

- CcTag termType=3，指向 `global_buff_cc_level_countdown_reduce`。
- 没有 child BuffData，通过关卡事件 `SendBattleSignalToLevel` 修改倒计时。
- 涉及 GlobalBuffData：`global_buff_cc_level_countdown_reduce`。
- 涉及 BuffData：无。

**机制注记**

虽然没有 `BuffData`，它仍然是当前 CcTag 的多等级项。

### 改写：奔腾

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 102302 | 2 | 改写：奔腾 | 敌人移动速度+{speedup_scale-1:0%}，0.1秒内受到的伤害不会超过最大生命值的{dmg_scale:0%} | EnemyBuff（直接给敌人挂 Buff）: `buff_cc_enemy_common_movespeedup` speedup_scale=2, dmg_scale=0.25 |

**效果概述**

敌人移动速度提高，并获得短时间单次受伤上限。

**当前数值**

- 102302：移动速度 x2（+100%）；0.1 秒内受到的伤害不超过最大生命值 25%。

**数据链路**

- CcTag 直接应用 `buff_cc_enemy_common_movespeedup`。
- 主 Buff 创建 `buff_cc_enemy_common_movespeedup_dmg_limit_base`，后者再创建 `buff_cc_enemy_common_movespeedup_dmg_limit_instance`。
- 涉及 BuffData：`buff_cc_enemy_common_movespeedup`、`buff_cc_enemy_common_movespeedup_dmg_limit_base`、`buff_cc_enemy_common_movespeedup_dmg_limit_instance`。

**机制注记**

这是“移速提高 + 伤害限制”组合，不只是简单移速词条。

### 队列：萎缩

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 102801 | 1 | 队列：萎缩Ⅰ | 干员主能力值-{1-attr:0%}/-{@102802@1-attr:0%}/-{@102803@1-attr:0%} | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_main_attribute_down` attr=0.9 |
| 102802 | 2 | 队列：萎缩Ⅱ | 干员主能力值-{@102801@1-attr:0%}/-{1-attr:0%}/-{@102803@1-attr:0%} | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_main_attribute_down` attr=0.8 |
| 102803 | 3 | 队列：萎缩Ⅲ | 干员主能力值-{@102801@1-attr:0%}/-{@102802@1-attr:0%}/-{1-attr:0%} | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_main_attribute_down` attr=0.6 |

**效果概述**

干员主能力值降低。

**当前数值**

- I / 102801：主能力值 x0.9（-10%）。
- II / 102802：主能力值 x0.8（-20%）。
- III / 102803：主能力值 x0.6（-40%）。

**数据链路**

- CcTag -> `global_buff_cc_chr_main_attribute_down` -> `buff_cc_chr_main_attribute_down`。
- 涉及 GlobalBuffData：`global_buff_cc_chr_main_attribute_down`。
- 涉及 BuffData：`buff_cc_chr_main_attribute_down`。

**机制注记**

GlobalBuffData 默认 `attr=-200` 不是当前词条值；当前 CcTag 覆盖为 0.9 / 0.8 / 0.6。

### 改写：裹附

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 103102 | 1 | 改写：裹附 | 每个敌人每有一层破防或法术附着，受到的对应类型伤害-{-dmg_scale:0%}。该效果会在破防或法术附着结束后延迟0.1秒消失 | EnemyBuff（直接给敌人挂 Buff）: `buff_cc_enemy_inflict_stack_resist` dmg_scale=-0.1 |

**效果概述**

敌人身上的破防或法术附着层数会降低其受到的对应类型伤害。

**当前数值**

- 103102：每层对应类型伤害 -10%；效果在破防或附着结束后延迟 0.1 秒消失。

**数据链路**

- CcTag 直接应用 `buff_cc_enemy_inflict_stack_resist`。
- 主 Buff 创建 add/consume 两个 listener，再按类型创建 `buff_cc_enemy_inflict_stack_resist_phy`、`fire`、`pulse`、`cryst`、`natural`。
- 涉及 BuffData：`buff_cc_enemy_inflict_stack_resist`、`buff_cc_enemy_inflict_stack_resist_add_listener`、`buff_cc_enemy_inflict_stack_resist_consume_delay`、`buff_cc_enemy_inflict_stack_resist_consume_listener`、`buff_cc_enemy_inflict_stack_resist_cryst`、`buff_cc_enemy_inflict_stack_resist_fire`、`buff_cc_enemy_inflict_stack_resist_natural`、`buff_cc_enemy_inflict_stack_resist_phy`、`buff_cc_enemy_inflict_stack_resist_pulse`。

**机制注记**

这是按层数动态生成的抗性系统，正文应把 listener 和元素子 Buff 作为内部结构说明。

### 环境：震荡

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 103203 | 3 | 环境：震荡 | 干员除普通攻击、战技、连携技和终结技以外的伤害+{dmg_up:0%}，战技伤害-{-dmg_scale:0%} | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_physical_and_inflict_enhance_special_cc0` dmg_up=1, dmg_scale=-0.6 |

**效果概述**

干员特定伤害提高，同时战技伤害降低。

**当前数值**

- 103203：除普通攻击、战技、连携技和终结技以外的伤害 +100%；战技伤害 -60%。
- 该词条是已上线的 `special_cc0` 密钥指标之一；选择后用于解锁后续部分词条。

**数据链路**

- CcTag -> `global_buff_cc_chr_physical_and_inflict_enhance_special_cc0` -> `buff_cc_chr_physical_and_inflict_enhance_special_cc0`。
- 涉及 GlobalBuffData：`global_buff_cc_chr_physical_and_inflict_enhance_special_cc0`。
- 涉及 BuffData：`buff_cc_chr_physical_and_inflict_enhance_special_cc0`。

**机制注记**

GlobalBuffData 默认 `dmg_up=2`，当前 CcTag 覆盖为 `dmg_up=1`；应按当前词条写 +100%。

### 环境：同步生长

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 103302 | 2 | 环境：同步生长 | 主控干员每实际回复{chr_heal_ratio:0%}最大生命值或获得最大生命值{chr_shield_ratio:0%}的护盾时，场上敌人回复{eny_heal_ratio:0%}最大生命值 | SelfGlobalBuff（先挂 Global Buff，再分发/修改全局系统）: `global_buff_cc_chr_heal_reflect_to_eny` chr_heal_ratio=0.1, eny_heal_ratio=0.08, chr_shield_ratio=0.2 |

**效果概述**

主控干员获得足量治疗或护盾时，场上敌人回血。

**当前数值**

- 103302：主控实际回复 10% 最大生命值，或获得 20% 最大生命值护盾时，敌人回复 8% 最大生命值。

**数据链路**

- CcTag -> `global_buff_cc_chr_heal_reflect_to_eny` -> `buff_cc_chr_heal_reflect_to_eny`。
- 主 Buff 创建治疗监听 `buff_cc_chr_heal_reflect_to_eny_heal` 和护盾监听 `buff_cc_chr_heal_reflect_to_eny_shield`；二者再创建 stack/do/effect Buff。
- 涉及 GlobalBuffData：`global_buff_cc_chr_heal_reflect_to_eny`。
- 涉及 BuffData：`buff_cc_chr_heal_reflect_to_eny`、`buff_cc_chr_heal_reflect_to_eny_effect`、`buff_cc_chr_heal_reflect_to_eny_heal`、`buff_cc_chr_heal_reflect_to_eny_shield`、`buff_cc_chr_heal_reflect_to_eny_stack_heal`、`buff_cc_chr_heal_reflect_to_eny_stack_heal_do`、`buff_cc_chr_heal_reflect_to_eny_stack_shield`。

**机制注记**

`buff_cc_chr_heal_reflect_to_eny_effect` 只有表现效果；`stack_heal_do` 内是 HealAction + effect，不应未经确认写成伤害执行。

### 改写：活性

| Tag | Score | 官方名称 | 表内描述模板 | term |
|---|---:|---|---|---|
| 900101 | 1 | 改写：活性Ⅰ | 敌人生命值+{hp_up-1:0%}/+{@900102@hp_up-1:0%}/+{@900103@hp_up-1:0%} | EnemyBuff（直接给敌人挂 Buff）: `buff_cc_enemy_common_hp_up` hp_up=1.5 |
| 900102 | 2 | 改写：活性Ⅱ | 敌人生命值+{@900101@hp_up-1:0%}/+{hp_up-1:0%}/+{@900103@hp_up-1:0%} | EnemyBuff（直接给敌人挂 Buff）: `buff_cc_enemy_common_hp_up` hp_up=2 |
| 900103 | 3 | 改写：活性Ⅲ | 敌人生命值+{@900101@hp_up-1:0%}/+{@900102@hp_up-1:0%}/+{hp_up-1:0%} | EnemyBuff（直接给敌人挂 Buff）: `buff_cc_enemy_common_hp_up` hp_up=3 |

**效果概述**

敌人最大生命值提高。

**当前数值**

- I / 900101：敌人生命 x1.5（+50%）。
- II / 900102：敌人生命 x2.0（+100%）。
- III / 900103：敌人生命 x3.0（+200%）。

**数据链路**

- CcTag 直接以 EnemyBuff 方式应用 `buff_cc_enemy_common_hp_up`。
- 涉及 BuffData：`buff_cc_enemy_common_hp_up`。

**机制注记**

`buff_cc_enemy_common_hp_up` 使用 `FinalMultiplier(hp_up)`，该数值不应写成固定 +150% 或 x2.5；按当前表描述应写为 +50% / +100% / +200%。

## 附录 3：全量 BuffData 列表

本表列出全部 97 个 `buff_cc*` 文件，用于确认每个 BuffData 在当前词条、内部派生结构或预留数据中的位置。

| BuffData | 归类 | 入口 | 关系 | 数据摘要 |
|---|---|---|---|---|
| `buff_cc_chr_combo_cd_up` | 当前未开放/预留：暂拟：队列：迟滞 | 当前 CcTag 未引用<br>Global child: `global_buff_cc_chr_combo_cd_up` (传入 cd<-cd) | 无内部派生 | 属性: Specific/ComboSkillCooldownFinalAddition FinalAddition(cd) |
| `buff_cc_chr_combo_skill_cryst_inflict` | 当前词条相关：队列：热流失 | 当前入口： 100401 via `global_buff_cc_chr_combo_skill_cryst_inflict` {times=2}; 100402 via `global_buff_cc_chr_combo_skill_cryst_inflict` {times=1}<br>Global child: `global_buff_cc_chr_combo_skill_cryst_inflict` (传入 times<-times) | 创建 `buff_cc_chr_combo_skill_cryst_inflict_stack`<br>可移除 `buff_cc_chr_combo_skill_cryst_inflict_stack` | Ability.OnAfterSkillApplyCost: CheckSkillType, CheckTimedMarkerCondition, SimpleCalcBBAction, IfElseAction+IfElseActionData |
| `buff_cc_chr_combo_skill_cryst_inflict_stack` | 当前词条相关：队列：热流失 | 当前 CcTag 未引用 | 由 `buff_cc_chr_combo_skill_cryst_inflict` 创建<br>由 `buff_cc_chr_combo_skill_cryst_inflict` 可移除<br>被 `buff_cc_chr_combo_skill_cryst_inflict` 检查/计数 | 纯标记/空行为 Buff |
| `buff_cc_chr_combo_skill_dmg_down` | 当前未开放/预留：暂拟：队列：失衡 | 当前 CcTag 未引用<br>Global child: `global_buff_cc_chr_combo_skill_dmg_down` (传入 dmg_scale<-dmg_scale) | 无内部派生 | 伤害: Attacker[mask HasAll 8192] -> DamageScaleProcessor/ProdCalcZone(dmg_scale) |
| `buff_cc_chr_combo_special_cc0` | 当前词条相关：环境：过速 | 当前入口： 100003 via `global_buff_cc_chr_combo_special_cc0` {cd_scale=0.4, dmg_scale=-0.6}<br>Global child: `global_buff_cc_chr_combo_special_cc0` (传入 cd_scale<-cd_scale) | 无内部派生 | 属性: Specific/ComboSkillCooldownScalar FinalMultiplier(cd_scale)<br>伤害: Attacker[mask HasAll 256] -> DamageScaleProcessor/ProdCalcZone(dmg_scale) |
| `buff_cc_chr_consume_inflict_special_cc0` | 当前未开放/预留：暂拟：环境：逆流 | 当前 CcTag 未引用<br>Global child: `global_buff_cc_chr_consume_inflict_special_cc0` (传入 consume_dmg_scale_per_stack<-consume_dmg_scale_per_stack, dmg_scale<-dmg_scale) | 创建 `buff_cc_chr_consume_inflict_special_cc0_instance`, `buff_cc_chr_consume_inflict_special_cc0_stack` | 伤害: Attacker[NormalSkill/256] -> DamageScaleProcessor/ProdCalcZone(dmg_scale=-0.6)<br>Ability.OnConsumeBuff / OnAbsorbBuff: 消耗/吸收 `NoGuard` 或 `SpellInflict` 且层数 >=1 时，按层创建 stack 和 0.033 秒 instance |
| `buff_cc_chr_consume_inflict_special_cc0_instance` | 当前未开放/预留：暂拟：环境：逆流 | 当前 CcTag 未引用 | 由 `buff_cc_chr_consume_inflict_special_cc0` 创建<br>可移除 `buff_cc_chr_consume_inflict_special_cc0_stack` | Limited 0.033 秒；Buff.OnBuffFinish: 统计 stack 数量，计算 `consume_dmg_scale=consume_dmg_scale_per_stack*consume_stack`，造成 `MaxHp*consume_dmg_scale` 真实伤害，随后清除 stack |
| `buff_cc_chr_consume_inflict_special_cc0_stack` | 当前未开放/预留：暂拟：环境：逆流 | 当前 CcTag 未引用 | 由 `buff_cc_chr_consume_inflict_special_cc0` 创建<br>由 `buff_cc_chr_consume_inflict_special_cc0_instance` 可移除<br>被 `buff_cc_chr_consume_inflict_special_cc0_instance` 检查/计数 | 纯标记/空行为 Buff；每层代表本短窗口内 1 层被消耗/吸收的破防或法术附着 |
| `buff_cc_chr_cryst_dmg_down` | 当前词条相关：队列：扼制 | 当前 CcTag 未引用 | 由 `buff_cc_chr_dmg_down_after_inflict` 创建 | 伤害: Attacker[Cryst] -> DamageScaleProcessor/ProdCalcZone(dmg_scale) |
| `buff_cc_chr_cryst_inflict_extend` | 当前未开放/预留：暂拟：环境：凝滞 | 当前 CcTag 未引用<br>Global child: `global_buff_cc_chr_cryst_inflict_extend` (no assign) | 无内部派生 | Ability.OnAddedBuff: CheckBuffIdInContextAdvanced, SetBuffDurationAction |
| `buff_cc_chr_cryst_inflict_to_slowdown` | 当前未开放/预留：暂拟：环境：霜阻 | 当前 CcTag 未引用<br>Global child: `global_buff_cc_chr_cryst_inflict_to_slowdown` (传入 slowdown_scale_per_stack<-slowdown_scale_per_stack) | 无内部派生 | 属性: Specific/MoveSpeedScalar Multiplier(slowdown_scale); Specific/InAirMoveSpeedScalar Multiplier(slowdown_scale)<br>Ability.OnAddedBuff: CheckBuffIdInContextAdvanced, SaveBuffStackNumAdvanced, SimpleCalcBBAction, StoreAttributeValue, StoreAttributeValue; Ability.OnFinishedBuff: CheckBuffIdInContextAdvanced, ModifyDynamicBlackboard, ModifyDynamicBlackboard, StoreAttributeValue, StoreAttributeValue |
| `buff_cc_chr_dash_recover_speed_down` | 当前未开放/预留：暂拟：环境：厌氧（备用入口） | 当前 CcTag 未引用；与正式“环境：厌氧”重叠，大概率旧入口或弃用方案 | 无内部派生 | BuffData.globalModifier: DashRecover Multiplier(ratio=-0.5) |
| `buff_cc_chr_dmg_down_after_consume` | 当前未开放/预留：暂拟：队列：耗竭 | 当前 CcTag 未引用<br>Global child: `global_buff_cc_chr_dmg_down_after_consume` (传入 dmg_scale<-dmg_scale, duration<-duration) | 创建 `buff_cc_chr_dmg_down_after_consume_instance` | 消耗/吸收法术附着且层数 >=1 后创建 instance；被消耗或吸收的法术附着类型不决定降伤类型<br>Ability.OnConsumeBuff: CheckBuffIdInContextAdvanced, CheckConsumeBuffLayer, CreateBuffAction; Ability.OnAbsorbBuff: CheckBuffIdInContextAdvanced, CheckConsumeBuffLayer, CreateBuffAction |
| `buff_cc_chr_dmg_down_after_consume_instance` | 当前未开放/预留：暂拟：队列：耗竭 | 当前 CcTag 未引用 | 由 `buff_cc_chr_dmg_down_after_consume` 创建 | 伤害: Attacker[无条件] -> DamageScaleProcessor/ProdCalcZone(dmg_scale)，默认 -90% 持续 10 秒 |
| `buff_cc_chr_dmg_down_after_inflict` | 当前词条相关：队列：扼制 | 当前入口： 100901 via `global_buff_cc_chr_dmg_down_after_inflict` {dmg_scale=-0.45}; 100902 via `global_buff_cc_chr_dmg_down_after_inflict` {dmg_scale=-0.9}<br>Global child: `global_buff_cc_chr_dmg_down_after_inflict` (传入 dmg_scale<-dmg_scale, duration<-duration) | 创建 `buff_cc_chr_cryst_dmg_down`, `buff_cc_chr_fire_dmg_down`, `buff_cc_chr_natural_dmg_down`, `buff_cc_chr_phy_dmg_down`, `buff_cc_chr_pulse_dmg_down` | Ability.OnOutputBuff: CheckBuffIdInContextAdvanced, CreateBuffAction, CheckBuffIdInContextAdvanced, CreateBuffAction, CheckBuffIdInContextAdvanced... |
| `buff_cc_chr_dmg_down_by_distance` | 当前未开放/预留：暂拟：队列：远隔 | 当前 CcTag 未引用<br>Global child: `global_buff_cc_chr_dmg_down_by_distance` (传入 distance_min<-distance_min, distance_max<-distance_max, dmgdown_max<-dmgdown_max) | 无内部派生 | 伤害: Attacker[目标相等, SaveTargetDistanceAction, SimpleCalcBBAction, SimpleCalcBBAction, IfElseAction+IfElseActionData, IfElseAction+IfElseActionData, SimpleCalcBBAction] -> DamageScaleProcessor/ProdCalcZone(dmgdown_scale)<br>`dmgdown_scale=clamp((distance-distance_min)/(distance_max-distance_min),0,1)*dmgdown_max`，默认 4m=0、7m=-45%、10m=-90%<br>Buff.OnBuffEnable: SimpleCalcBBAction, SimpleCalcBBAction |
| `buff_cc_chr_dmg_reduce_maxhp` | 当前词条相关：队列：衰竭 | 当前入口： 101402 via `global_buff_cc_chr_dmg_reduce_maxhp` {hp_down_ratio=0.5, hp_down_ratio_melee=0.3}<br>Global child: `global_buff_cc_chr_dmg_reduce_maxhp` (传入 hp_down_ratio<-hp_down_ratio) | 创建 `buff_cc_chr_dmg_reduce_maxhp_instance` | Ability.OnTakeDamage: SaveDamageContext, IfElseAction+IfElseActionData, SimpleCalcBBAction, StoreEntityProperty, SetHpFloor |
| `buff_cc_chr_dmg_reduce_maxhp_instance` | 当前词条相关：队列：衰竭 | 当前 CcTag 未引用 | 由 `buff_cc_chr_dmg_reduce_maxhp` 创建 | 属性: Specific/MaxHp BaseFinalAddition(hp_down) |
| `buff_cc_chr_fire_dmg_down` | 当前词条相关：队列：扼制 | 当前 CcTag 未引用 | 由 `buff_cc_chr_dmg_down_after_inflict` 创建 | 伤害: Attacker[Fire] -> DamageScaleProcessor/ProdCalcZone(dmg_scale) |
| `buff_cc_chr_fire_skill_clear_frozenonchar` | 当前词条相关：环境：融化 / 升华 / 电解 / 切削 | 当前入口： 101701 via `global_buff_cc_chr_fire_skill_clear_frozenonchar` {}<br>Global child: `global_buff_cc_chr_fire_skill_clear_frozenonchar` (no assign) | 无内部派生 | Ability.OnBeforeCastSkill: CheckSkillDamageType, CheckSkillType, FinishBuffAdvanced |
| `buff_cc_chr_frozenonchar_extend` | 当前词条相关：环境：融化 / 升华 / 电解 / 切削 | 当前入口： 101801 via `global_buff_cc_chr_frozenonchar_extend` {duration=15}; 101901 via `global_buff_cc_chr_frozenonchar_extend` {duration=15}; 101701 via `global_buff_cc_chr_frozenonchar_extend` {duration=15}; 102401 via `global_buff_cc_chr_frozenonchar_extend` {duration=15}<br>Global child: `global_buff_cc_chr_frozenonchar_extend` (no assign) | 无内部派生 | Ability.OnAddedBuff: CheckBuffIdInContextAdvanced, CheckMainCharacterCondition, SetBuffDurationAction |
| `buff_cc_chr_frozenonchar_extend_instance` | 当前未开放/预留：暂拟：环境：深冻 | 当前 CcTag 未引用 | 无内部派生 | 标签: Skill/Enemy/Common/SpellStatusOnChar/FrozenOnChar, Status/DisableFaceToAttacker<br>Buff.DuringBuffEnable: SetAnimTimeScaleAction, EffectAction, EffectAction, EffectAction; Buff.OnBuffEnable: TriggerCharSpellInflictionEvent |
| `buff_cc_chr_heal_reflect_to_eny` | 当前词条相关：环境：同步生长 | 当前入口： 103302 via `global_buff_cc_chr_heal_reflect_to_eny` {chr_heal_ratio=0.1, eny_heal_ratio=0.08, chr_shield_ratio=0.2}<br>Global child: `global_buff_cc_chr_heal_reflect_to_eny` (传入 chr_heal_ratio<-chr_heal_ratio, eny_heal_ratio<-eny_heal_ratio, chr_shield_ratio<-chr_shield_ratio) | 创建 `buff_cc_chr_heal_reflect_to_eny_heal`, `buff_cc_chr_heal_reflect_to_eny_shield` | Buff.OnBuffEnable: CreateBuffAction |
| `buff_cc_chr_heal_reflect_to_eny_effect` | 当前词条相关：环境：同步生长 | 当前 CcTag 未引用 | 由 `buff_cc_chr_heal_reflect_to_eny_stack_heal_do` 创建 | Buff.OnBuffEnable: EffectAction |
| `buff_cc_chr_heal_reflect_to_eny_heal` | 当前词条相关：环境：同步生长 | 当前 CcTag 未引用 | 由 `buff_cc_chr_heal_reflect_to_eny` 创建<br>创建 `buff_cc_chr_heal_reflect_to_eny_stack_heal`<br>可移除 `buff_cc_chr_heal_reflect_to_eny_stack_heal` | Ability.OnReceiveHeal: CheckMainCharacterCondition, CompareFloat, SaveBuffStackNumAdvanced, FinishBuffAdvanced, SimpleCalcBBAction... |
| `buff_cc_chr_heal_reflect_to_eny_shield` | 当前词条相关：环境：同步生长 | 当前 CcTag 未引用 | 由 `buff_cc_chr_heal_reflect_to_eny` 创建<br>创建 `buff_cc_chr_heal_reflect_to_eny_stack_shield`<br>可移除 `buff_cc_chr_heal_reflect_to_eny_stack_shield` | Ability.OnAfterAddedShield: CheckMainCharacterCondition, CompareFloat, SaveBuffStackNumAdvanced, FinishBuffAdvanced, SimpleCalcBBAction... |
| `buff_cc_chr_heal_reflect_to_eny_stack` | 当前未开放/预留：暂拟：环境：回灌 | 当前 CcTag 未引用 | 无内部派生 | Buff.OnBuffEnable: FindTargetAction, ForEachAction |
| `buff_cc_chr_heal_reflect_to_eny_stack_heal` | 当前词条相关：环境：同步生长 | 当前 CcTag 未引用 | 由 `buff_cc_chr_heal_reflect_to_eny_heal` 创建<br>创建 `buff_cc_chr_heal_reflect_to_eny_stack_heal_do`<br>由 `buff_cc_chr_heal_reflect_to_eny_heal` 可移除<br>被 `buff_cc_chr_heal_reflect_to_eny_heal` 检查/计数 | Buff.OnBuffEnable: FindTargetAction, ForEachAction |
| `buff_cc_chr_heal_reflect_to_eny_stack_heal_do` | 当前词条相关：环境：同步生长 | 当前 CcTag 未引用 | 由 `buff_cc_chr_heal_reflect_to_eny_stack_heal`, `buff_cc_chr_heal_reflect_to_eny_stack_shield` 创建<br>创建 `buff_cc_chr_heal_reflect_to_eny_effect` | Buff.OnBuffEnable: HealAction, CreateBuffAction |
| `buff_cc_chr_heal_reflect_to_eny_stack_shield` | 当前词条相关：环境：同步生长 | 当前 CcTag 未引用 | 由 `buff_cc_chr_heal_reflect_to_eny_shield` 创建<br>创建 `buff_cc_chr_heal_reflect_to_eny_stack_heal_do`<br>由 `buff_cc_chr_heal_reflect_to_eny_shield` 可移除<br>被 `buff_cc_chr_heal_reflect_to_eny_shield` 检查/计数 | Buff.OnBuffEnable: FindTargetAction, ForEachAction |
| `buff_cc_chr_inflict_after_spell_status` | 当前未开放/预留：暂拟：队列：追附 | 当前 CcTag 未引用<br>Global child: `global_buff_cc_chr_inflict_after_spell_status` (传入 inflict_stack<-inflict_stack) | 无内部派生 | Ability.OnBeforeOutputBuff: 造成 Frozen/Burning/Conduct/Corrupt 法术异常时，对当前主控分别施加 Cryst/Fire/Pulse/Natural 法术附着，默认 1 层 |
| `buff_cc_chr_main_attribute_down` | 当前词条相关：队列：萎缩 | 当前入口： 102802 via `global_buff_cc_chr_main_attribute_down` {attr=0.8}; 102803 via `global_buff_cc_chr_main_attribute_down` {attr=0.6}; 102801 via `global_buff_cc_chr_main_attribute_down` {attr=0.9}<br>Global child: `global_buff_cc_chr_main_attribute_down` (传入 attr<-attr) | 无内部派生 | 属性: Main/ComboSkillCooldownFinalAddition FinalMultiplier(attr) |
| `buff_cc_chr_main_dmg_taken_up` | 当前词条相关：队列：斩首 | 当前入口： 100601 via `global_buff_cc_chr_main_dmg_taken_up` {dmg_scale=0.5}; 100602 via `global_buff_cc_chr_main_dmg_taken_up` {dmg_scale=1}<br>Global child: `global_buff_cc_chr_main_dmg_taken_up` (传入 dmg_scale<-dmg_scale) | 无内部派生 | 伤害: Defender[主控] -> DamageScaleProcessor/ProdCalcZone(dmg_scale) |
| `buff_cc_chr_mute_evade` | 当前词条相关：环境：禁锢 | 当前入口： 101303 via `global_buff_cc_level_mute_evade` {}<br>Global child: `global_buff_cc_level_mute_evade` (no assign) | 无内部派生 | 标签: Status/DisableDash |
| `buff_cc_chr_natural_dmg_down` | 当前词条相关：队列：扼制 | 当前 CcTag 未引用 | 由 `buff_cc_chr_dmg_down_after_inflict` 创建 | 伤害: Attacker[Natural] -> DamageScaleProcessor/ProdCalcZone(dmg_scale) |
| `buff_cc_chr_natural_skill_clear_frozenonchar` | 当前词条相关：环境：融化 / 升华 / 电解 / 切削 | 当前入口： 101801 via `global_buff_cc_chr_natural_skill_clear_frozenonchar` {}<br>Global child: `global_buff_cc_chr_natural_skill_clear_frozenonchar` (no assign) | 无内部派生 | Ability.OnBeforeCastSkill: CheckSkillDamageType, CheckSkillType, FinishBuffAdvanced |
| `buff_cc_chr_normal_attack_dmg_down` | 当前词条相关：队列：脱力 | 当前入口： 100803 via `global_buff_cc_chr_normal_attack_dmg_down` {dmg_scale=-0.7}<br>Global child: `global_buff_cc_chr_normal_attack_dmg_down` (传入 dmg_scale<-dmg_scale) | 无内部派生 | 伤害: Attacker[mask HasAll 128] -> DamageScaleProcessor/ProdCalcZone(dmg_scale) |
| `buff_cc_chr_normal_skill_cryst_inflict` | 当前词条相关：队列：失温 | 当前入口： 100301 via `global_buff_cc_chr_normal_skill_cryst_inflict` {times=2}; 100302 via `global_buff_cc_chr_normal_skill_cryst_inflict` {times=1}<br>Global child: `global_buff_cc_chr_normal_skill_cryst_inflict` (传入 times<-times) | 创建 `buff_cc_chr_normal_skill_cryst_inflict_stack`<br>可移除 `buff_cc_chr_normal_skill_cryst_inflict_stack` | Ability.OnAfterSkillApplyCost: CheckSkillType, CheckTimedMarkerCondition, SimpleCalcBBAction, IfElseAction+IfElseActionData |
| `buff_cc_chr_normal_skill_cryst_inflict_stack` | 当前词条相关：队列：失温 | 当前 CcTag 未引用 | 由 `buff_cc_chr_normal_skill_cryst_inflict` 创建<br>由 `buff_cc_chr_normal_skill_cryst_inflict` 可移除<br>被 `buff_cc_chr_normal_skill_cryst_inflict` 检查/计数 | 纯标记/空行为 Buff |
| `buff_cc_chr_normal_skill_dmg_down` | 当前未开放/预留：暂拟：队列：抑技 | 当前 CcTag 未引用<br>Global child: `global_buff_cc_chr_normal_skill_dmg_down` (传入 dmg_scale<-dmg_scale) | 无内部派生 | 伤害: Attacker[mask HasAll 256] -> DamageScaleProcessor/ProdCalcZone(dmg_scale) |
| `buff_cc_chr_normal_skill_global_cd` | 当前未开放/预留：暂拟：队列：锁技 | 当前 CcTag 未引用<br>Global child: `global_buff_cc_chr_normal_skill_global_cd_lv1` (传入 cd<-cd) | 创建 `buff_cc_chr_normal_skill_global_cd_instance` | Ability.OnBeforeCastSkill: CheckSkillType, CreateBuffAction |
| `buff_cc_chr_normal_skill_global_cd_instance` | 当前未开放/预留：暂拟：队列：锁技 | 当前 CcTag 未引用 | 由 `buff_cc_chr_normal_skill_global_cd` 创建 | 标签: Status/DisableNormalSkill |
| `buff_cc_chr_normal_special_cc0` | 当前未开放/预留：暂拟：环境：紊流 | 当前 CcTag 未引用<br>Global child: `global_buff_cc_chr_normal_special_cc0` (传入 skill_ratio<-skill_ratio, dmg_scale<-dmg_scale) | 无内部派生 | 伤害: Attacker[NormalSkill/256] -> DamageScaleProcessor/ProdCalcZone(dmg_scale=-0.6)<br>Ability.OnObtainATB（技力）: Skill/Gain 来源技力触发（不限战技），读取本次技力值后乘 `skill_ratio=2` 并补发 ATB（技力） |
| `buff_cc_chr_phy_dmg_down` | 当前词条相关：队列：扼制 | 当前 CcTag 未引用 | 由 `buff_cc_chr_dmg_down_after_inflict` 创建 | 伤害: Attacker[Physical] -> DamageScaleProcessor/ProdCalcZone(dmg_scale) |
| `buff_cc_chr_phy_skill_clear_frozenonchar` | 当前词条相关：环境：融化 / 升华 / 电解 / 切削 | 当前入口： 102401 via `global_buff_cc_chr_phy_skill_clear_frozenonchar` {}<br>Global child: `global_buff_cc_chr_phy_skill_clear_frozenonchar` (no assign) | 无内部派生 | Ability.OnBeforeCastSkill: CheckSkillDamageType, CheckSkillType, FinishBuffAdvanced |
| `buff_cc_chr_physical_and_inflict_enhance_special_cc0` | 当前词条相关：环境：震荡 | 当前入口： 103203 via `global_buff_cc_chr_physical_and_inflict_enhance_special_cc0` {dmg_up=1, dmg_scale=-0.6}<br>Global child: `global_buff_cc_chr_physical_and_inflict_enhance_special_cc0` (传入 dmg_up<-dmg_up, dmg_scale<-dmg_scale) | 无内部派生 | 伤害: Attacker[mask ExceptAny 9088] -> DamageScaleProcessor/ProdCalcZone(dmg_up); Attacker[mask HasAll 256] -> DamageScaleProcessor/ProdCalcZone(dmg_scale) |
| `buff_cc_chr_pulse_dmg_down` | 当前词条相关：队列：扼制 | 当前 CcTag 未引用 | 由 `buff_cc_chr_dmg_down_after_inflict` 创建 | 伤害: Attacker[Pulse] -> DamageScaleProcessor/ProdCalcZone(dmg_scale) |
| `buff_cc_chr_pulse_skill_clear_frozenonchar` | 当前词条相关：环境：融化 / 升华 / 电解 / 切削 | 当前入口： 101901 via `global_buff_cc_chr_pulse_skill_clear_frozenonchar` {}<br>Global child: `global_buff_cc_chr_pulse_skill_clear_frozenonchar` (no assign) | 无内部派生 | Ability.OnBeforeCastSkill: CheckSkillDamageType, CheckSkillType, FinishBuffAdvanced |
| `buff_cc_chr_repeat_profession_dmg_down` | 当前未开放/预留：暂拟：队列：重编 | 当前 CcTag 未引用<br>Global child: `global_buff_cc_chr_repeat_profession_dmg_down` (传入 dmg_scale<-dmg_scale) | 创建 `buff_cc_chr_repeat_profession_dmg_down_instance` | Buff.OnBuffEnable: CheckMainCharacterCondition 用于入口去重，只让 Owner 为当前主控干员的那份主 Buff 执行队伍扫描；随后统计 Guard/Defender/Supporter/Caster/Assault/Vanguard 人数；重复层数 `total=sum(max(职业人数-1,0))`，若实际队伍人数与六类统计不一致，会用差额重写 Assault 计数；随后 `total *= dmg_scale` |
| `buff_cc_chr_repeat_profession_dmg_down_instance` | 当前未开放/预留：暂拟：队列：重编 | 当前 CcTag 未引用 | 由 `buff_cc_chr_repeat_profession_dmg_down` 创建，目标为队伍目标组 | 伤害: Attacker[无条件] -> DamageScaleProcessor/ProdCalcZone(dmg_scale)，`dmg_scale` 为重复层数乘入口参数，默认每层 -25% |
| `buff_cc_chr_teammate_normal_attack_dmg_down` | 当前未开放/预留：暂拟：队列：旁击 | 当前 CcTag 未引用<br>Global child: `global_buff_cc_chr_teammate_normal_attack_dmg_down` (传入 dmg_scale<-dmg_scale) | 无内部派生 | 伤害: Attacker[IfElseAction+IfElseActionData, mask HasAll 128] -> DamageScaleProcessor/ProdCalcZone(dmg_scale) |
| `buff_cc_chr_teammate_take_dmg_down` | 当前未开放/预留：暂拟：队列：分担 | 当前 CcTag 未引用<br>Global child: `global_buff_cc_chr_teammate_take_dmg_down` (传入 dmg_down<-dmg_down) | 无内部派生 | 持有该 child Buff 的干员作为受击方时，写入 Defender 侧 DamageScaleProcessor/ProdCalcZone(dmg_down)；若 Owner 是当前主控干员则 ReturnFalse。默认 `dmg_down=-0.5`，乘区按 `1+addition` 结算，非主控队友受伤倍率为 0.5 |
| `buff_cc_chr_ult_dmg_down_gradual` | 当前词条相关：队列：折刃 | 当前入口： 100501 via `global_buff_cc_chr_ult_dmg_down_gradual` {dmg_scale_per_layer=-0.5}; 100502 via `global_buff_cc_chr_ult_dmg_down_gradual` {dmg_scale_per_layer=-1}<br>Global child: `global_buff_cc_chr_ult_dmg_down_gradual` (no assign) | 创建 `buff_cc_chr_ult_dmg_down_gradual_stack` | Ability.OnBeforeCastSkill: CheckSkillType, CreateBuffAction |
| `buff_cc_chr_ult_dmg_down_gradual_instance` | 当前词条相关：队列：折刃 | 当前入口： 100501 via `global_buff_cc_chr_ult_dmg_down_gradual` {dmg_scale_per_layer=-0.5}; 100502 via `global_buff_cc_chr_ult_dmg_down_gradual` {dmg_scale_per_layer=-1}<br>Global child: `global_buff_cc_chr_ult_dmg_down_gradual` (传入 dmg_scale_per_layer<-dmg_scale_per_layer) | 无内部派生 | 伤害: Attacker[mask HasAll 512, SaveBuffStackNumAdvanced, ModifyDynamicBlackboard, SimpleCalcBBAction] -> DamageScaleProcessor/ProdCalcZone(dmg_scale) |
| `buff_cc_chr_ult_dmg_down_gradual_stack` | 当前词条相关：队列：折刃 | 当前 CcTag 未引用 | 由 `buff_cc_chr_ult_dmg_down_gradual` 创建<br>被 `buff_cc_chr_ult_dmg_down_gradual_instance` 检查/计数 | 纯标记/空行为 Buff |
| `buff_cc_chr_ult_sp_cost_increase` | 当前未开放/预留：暂拟：队列：蓄压 | 当前 CcTag 未引用<br>Global child: `global_buff_cc_chr_ult_sp_cost_increase_lv1` (传入 usp_up<-usp_up)<br>`global_buff_cc_chr_ult_sp_cost_increase_lv2` (传入 usp_up<-usp_up) | 创建 `buff_cc_chr_ult_sp_cost_increase_instance` | Ability.OnAfterSkillApplyCost: 本次终结技消耗完成后，CheckSkillType(UltimateSkill)，给技能拥有者创建 instance |
| `buff_cc_chr_ult_sp_cost_increase_instance` | 当前未开放/预留：暂拟：队列：蓄压 | 当前 CcTag 未引用 | 由 `buff_cc_chr_ult_sp_cost_increase` 创建；Stack，最多 99 层 | 属性: Specific/MaxUltimateSp BaseMultiplier(usp_up)，默认每层使后续终结技能量需求 +20% / +50% |
| `buff_cc_chr_usp_speed_down` | 当前未开放/预留：暂拟：队列：滞能 | 当前 CcTag 未引用<br>Global child: `global_buff_cc_chr_usp_speed_down` (传入 usp_scale<-usp_scale) | 无内部派生 | 属性: Specific/UltimateSpGainScalar FinalMultiplier(usp_scale) |
| `buff_cc_enemy_common_dmg_up` | 当前词条相关：改写：刺激 | 直接: 100201 EnemyBuff {dmg_up=0.3}; 100202 EnemyBuff {dmg_up=0.8} | 无内部派生 | 属性: Specific/PhysicalDamageIncrease BaseAddition(dmg_up); Specific/FireDamageIncrease BaseAddition(dmg_up); Specific/PulseDamageIncrease BaseAddition(dmg_up); Specific/CrystDamageIncrease BaseAddition(dmg_up); Specific/NaturalDamageIncrease BaseAddition(dmg_up); Specific/EtherDamageIncrease BaseAddition(dmg_up) |
| `buff_cc_enemy_common_hp_up` | 当前词条相关：改写：活性 | 直接: 900101 EnemyBuff {hp_up=1.5}; 900102 EnemyBuff {hp_up=2}; 900103 EnemyBuff {hp_up=3} | 无内部派生 | 属性: Specific/MaxHp FinalMultiplier(hp_up) |
| `buff_cc_enemy_common_movespeedup` | 当前词条相关：改写：奔腾 | 直接: 102302 EnemyBuff {speedup_scale=2, dmg_scale=0.25} | 创建 `buff_cc_enemy_common_movespeedup_dmg_limit_base` | 属性: Specific/MoveSpeedScalar Multiplier(speedup_scale); Specific/InAirMoveSpeedScalar Multiplier(speedup_scale)<br>Buff.OnBuffEnable: CreateBuffAction |
| `buff_cc_enemy_common_movespeedup_dmg_limit_base` | 当前词条相关：改写：奔腾 | 当前 CcTag 未引用 | 由 `buff_cc_enemy_common_movespeedup` 创建<br>创建 `buff_cc_enemy_common_movespeedup_dmg_limit_instance` | 伤害: Defender[无条件] -> DamageTextProcessor/()<br>Buff.OnBuffEnable: SimpleCalcBBAction; Ability.OnBeforeTakeDamage: StoreEntityProperty, StoreAttributeValue, ModifyDynamicBlackboard, ModifyDynamicBlackboard, CompareFloat... |
| `buff_cc_enemy_common_movespeedup_dmg_limit_instance` | 当前词条相关：改写：奔腾 | 当前 CcTag 未引用 | 由 `buff_cc_enemy_common_movespeedup_dmg_limit_base` 创建 | Buff.DuringBuffEnable: SetHpFloor; Ability.OnReceiveHeal: SaveHealValue, StoreAttributeValue, ModifyDynamicBlackboard, ModifyDynamicBlackboard, CreateBuffAction |
| `buff_cc_enemy_cryst_inflict_to_frozen` | 当前未开放/预留：暂拟：改写：凝冻 | 当前 CcTag 未引用 | 无内部派生 | 监听敌人输出寒冷附着；目标为主控且冷却 marker 不存在时，对主控追加 1 层 Cryst 附着，并创建 0.1 秒 timed marker |
| `buff_cc_enemy_death_ground_area` | 当前词条相关：改写：遗毒 | 直接: 101501 EnemyBuff {atk_scale=0.02}; 101502 EnemyBuff {atk_scale=0.05} | 生成 ability entity，使用 `cc_enemy_death_ground_area_skill` | Ability.OnOwnerHpZero: SpawnAbilityEntity |
| `buff_cc_enemy_death_ground_area_dmg` | 当前词条相关：改写：遗毒 | 经 `cc_enemy_death_ground_area_skill` 应用于地面区域内目标 | 由 `buff_cc_enemy_death_ground_area` 生成的 ability entity skill 使用 | Buff.OnBuffTrigger: DamageAction+DamageActionData |
| `buff_cc_enemy_heal_not_take_damage` | 当前未开放/预留：暂拟：改写：休养 | 当前 CcTag 未引用 | 创建 `buff_cc_enemy_heal_not_take_damage_countdown`<br>可移除 `buff_cc_enemy_heal_not_take_damage_instance` | Ability.OnTakeDamage: 受伤时移除回血 instance，并创建 5 秒倒计时 |
| `buff_cc_enemy_heal_not_take_damage_countdown` | 当前未开放/预留：暂拟：改写：休养 | 当前 CcTag 未引用 | 由 `buff_cc_enemy_heal_not_take_damage` 创建<br>创建 `buff_cc_enemy_heal_not_take_damage_instance` | Limited 5 秒；Buff.OnBuffFinish: CreateBuffAction |
| `buff_cc_enemy_heal_not_take_damage_instance` | 当前未开放/预留：暂拟：改写：休养 | 当前 CcTag 未引用 | 由 `buff_cc_enemy_heal_not_take_damage_countdown` 创建<br>由 `buff_cc_enemy_heal_not_take_damage` 可移除 | 触发间隔 1 秒；Buff.OnBuffTrigger: HealAction，每次回复 1% 最大生命；Buff.DuringBuffEnable: EffectAction |
| `buff_cc_enemy_heal_on_finish` | 当前未开放/预留：暂拟：改写：濒愈 | 当前 CcTag 未引用 | 由 `buff_cc_enemy_low_hp_heal` 创建 | 存续期间播放回血特效；结束时按 `hp_recover` 回复自身最大生命值比例 |
| `buff_cc_enemy_heal_under_control` | 当前词条相关：改写：愈合 | 直接: 101101 EnemyBuff {hp_ratio=0.05}; 101102 EnemyBuff {hp_ratio=0.15} | 创建 `buff_cc_enemy_heal_under_control_instance`, `buff_cc_enemy_heal_under_control_stack`<br>可移除 `buff_cc_enemy_heal_under_control_instance`, `buff_cc_enemy_heal_under_control_stack` | Ability.OnAddedBuff: CheckBuffIdInContextAdvanced, CheckSuperArmor, CreateBuffAction, CheckBuffIdInContextAdvanced, CheckSuperArmor...; Ability.OnFinishedBuff: CheckBuffIdInContextAdvanced, CheckSuperArmor, FinishBuffAdvanced, CheckBuffIdInContextAdvanced, CheckSuperArmor...; Ability.OnBeforeAddedBuff: CheckBuffIdInContextAdvanced, CheckBuffStackNumAdvanced, CreateBuffAction; Ability.OnFinishedBuff: CheckBuffIdInContextAdvanced, CheckBuffStackNumAdvanced, FinishBuffAdvanced |
| `buff_cc_enemy_heal_under_control_instance` | 当前词条相关：改写：愈合 | 当前 CcTag 未引用 | 由 `buff_cc_enemy_heal_under_control` 创建<br>创建 `buff_cc_enemy_heal_under_control_timer`<br>由 `buff_cc_enemy_heal_under_control` 可移除<br>被 `buff_cc_enemy_heal_under_control_timer` 检查/计数 | Buff.OnBuffEnable: CheckBuffStackNumAdvanced, CreateBuffAction; Buff.DuringBuffEnable: EffectAction |
| `buff_cc_enemy_heal_under_control_stack` | 当前词条相关：改写：愈合 | 当前 CcTag 未引用 | 由 `buff_cc_enemy_heal_under_control` 创建<br>由 `buff_cc_enemy_heal_under_control` 可移除<br>被 `buff_cc_enemy_heal_under_control` 检查/计数 | 纯标记/空行为 Buff |
| `buff_cc_enemy_heal_under_control_timer` | 当前词条相关：改写：愈合 | 当前 CcTag 未引用 | 由 `buff_cc_enemy_heal_under_control_instance` 创建<br>被 `buff_cc_enemy_heal_under_control_instance` 检查/计数 | Buff.OnBuffEnable: HealAction; Buff.OnBuffTrigger: IfElseAction+IfElseActionData |
| `buff_cc_enemy_inflict_stack_resist` | 当前词条相关：改写：裹附 | 直接: 103102 EnemyBuff {dmg_scale=-0.1} | 创建 `buff_cc_enemy_inflict_stack_resist_add_listener`, `buff_cc_enemy_inflict_stack_resist_consume_listener` | Buff.OnBuffEnable: CreateBuffAction |
| `buff_cc_enemy_inflict_stack_resist_add_listener` | 当前词条相关：改写：裹附 | 当前 CcTag 未引用 | 由 `buff_cc_enemy_inflict_stack_resist` 创建<br>创建 `buff_cc_enemy_inflict_stack_resist_cryst`, `buff_cc_enemy_inflict_stack_resist_fire`, `buff_cc_enemy_inflict_stack_resist_natural`, `buff_cc_enemy_inflict_stack_resist_phy`, `buff_cc_enemy_inflict_stack_resist_pulse`<br>可移除 `buff_cc_enemy_inflict_stack_resist_consume_delay`, `buff_cc_enemy_inflict_stack_resist_cryst`, `buff_cc_enemy_inflict_stack_resist_fire`, `buff_cc_enemy_inflict_stack_resist_natural`, `buff_cc_enemy_inflict_stack_resist_phy`, `buff_cc_enemy_inflict_stack_resist_pulse` | Ability.OnAddedBuff: CheckBuffIdInContextAdvanced, SaveBuffStackNumAdvanced, SimpleCalcBBAction, FinishBuffAdvanced, FinishBuffAdvanced...; Ability.OnAddedBuff: CheckBuffIdInContextAdvanced, SaveBuffStackNumAdvanced, SimpleCalcBBAction, FinishBuffAdvanced, FinishBuffAdvanced... |
| `buff_cc_enemy_inflict_stack_resist_consume_delay` | 当前词条相关：改写：裹附 | 当前 CcTag 未引用 | 由 `buff_cc_enemy_inflict_stack_resist_consume_listener` 创建<br>由 `buff_cc_enemy_inflict_stack_resist_add_listener` 可移除<br>可移除 `buff_cc_enemy_inflict_stack_resist_cryst`, `buff_cc_enemy_inflict_stack_resist_fire`, `buff_cc_enemy_inflict_stack_resist_natural`, `buff_cc_enemy_inflict_stack_resist_phy`, `buff_cc_enemy_inflict_stack_resist_pulse` | Buff.OnBuffFinish: SwitchAction |
| `buff_cc_enemy_inflict_stack_resist_consume_listener` | 当前词条相关：改写：裹附 | 当前 CcTag 未引用 | 由 `buff_cc_enemy_inflict_stack_resist` 创建<br>创建 `buff_cc_enemy_inflict_stack_resist_consume_delay` | Ability.OnFinishedBuff: CheckBuffIdInContextAdvanced, CreateBuffAction, CheckBuffIdInContextAdvanced, CreateBuffAction, CheckBuffIdInContextAdvanced... |
| `buff_cc_enemy_inflict_stack_resist_cryst` | 当前词条相关：改写：裹附 | 当前 CcTag 未引用 | 由 `buff_cc_enemy_inflict_stack_resist_add_listener` 创建<br>由 `buff_cc_enemy_inflict_stack_resist_add_listener`, `buff_cc_enemy_inflict_stack_resist_consume_delay` 可移除 | 伤害: Defender[Cryst] -> DamageScaleProcessor/ProdCalcZone(dmg_scale) |
| `buff_cc_enemy_inflict_stack_resist_fire` | 当前词条相关：改写：裹附 | 当前 CcTag 未引用 | 由 `buff_cc_enemy_inflict_stack_resist_add_listener` 创建<br>由 `buff_cc_enemy_inflict_stack_resist_add_listener`, `buff_cc_enemy_inflict_stack_resist_consume_delay` 可移除 | 伤害: Defender[Fire] -> DamageScaleProcessor/ProdCalcZone(dmg_scale) |
| `buff_cc_enemy_inflict_stack_resist_natural` | 当前词条相关：改写：裹附 | 当前 CcTag 未引用 | 由 `buff_cc_enemy_inflict_stack_resist_add_listener` 创建<br>由 `buff_cc_enemy_inflict_stack_resist_add_listener`, `buff_cc_enemy_inflict_stack_resist_consume_delay` 可移除 | 伤害: Defender[Natural] -> DamageScaleProcessor/ProdCalcZone(dmg_scale) |
| `buff_cc_enemy_inflict_stack_resist_phy` | 当前词条相关：改写：裹附 | 当前 CcTag 未引用 | 由 `buff_cc_enemy_inflict_stack_resist_add_listener` 创建<br>由 `buff_cc_enemy_inflict_stack_resist_add_listener`, `buff_cc_enemy_inflict_stack_resist_consume_delay` 可移除 | 伤害: Defender[Physical] -> DamageScaleProcessor/ProdCalcZone(dmg_scale) |
| `buff_cc_enemy_inflict_stack_resist_pulse` | 当前词条相关：改写：裹附 | 当前 CcTag 未引用 | 由 `buff_cc_enemy_inflict_stack_resist_add_listener` 创建<br>由 `buff_cc_enemy_inflict_stack_resist_add_listener`, `buff_cc_enemy_inflict_stack_resist_consume_delay` 可移除 | 伤害: Defender[Pulse] -> DamageScaleProcessor/ProdCalcZone(dmg_scale) |
| `buff_cc_enemy_low_hp_heal` | 当前未开放/预留：暂拟：改写：濒愈 | 当前 CcTag 未引用 | 创建 `buff_cc_enemy_heal_on_finish` | 受伤后若生命低于 10% 且 `tag>=1`，创建 15 秒延迟回血 Buff，并将 `tag` 减 1 |
| `buff_cc_enemy_periodic_inflict_resist` | 当前词条相关：改写：屏障 | 直接: 101001 EnemyBuff {duration=5} | 创建 `buff_cc_enemy_periodic_inflict_resist_cryst`, `buff_cc_enemy_periodic_inflict_resist_fire`, `buff_cc_enemy_periodic_inflict_resist_natural`, `buff_cc_enemy_periodic_inflict_resist_phy`, `buff_cc_enemy_periodic_inflict_resist_pulse` | Ability.OnEnemyAfterTakeSpellInfliction: IfElseAction+IfElseActionData, IfElseAction+IfElseActionData, IfElseAction+IfElseActionData, IfElseAction+IfElseActionData; Ability.OnAddedBuff: CheckBuffIdInContextAdvanced, CreateBuffAction |
| `buff_cc_enemy_periodic_inflict_resist_cryst` | 当前词条相关：改写：屏障 | 当前 CcTag 未引用 | 由 `buff_cc_enemy_periodic_inflict_resist` 创建 | 标签: Immune/ImmuneSpellInflict/ImmuneCrystInflict |
| `buff_cc_enemy_periodic_inflict_resist_fire` | 当前词条相关：改写：屏障 | 当前 CcTag 未引用 | 由 `buff_cc_enemy_periodic_inflict_resist` 创建 | 标签: Immune/ImmuneSpellInflict/ImmuneFireInflict |
| `buff_cc_enemy_periodic_inflict_resist_instance` | 当前未开放/预留：暂拟：改写：全域屏障 | 当前 CcTag 未引用 | 无内部派生 | 标签: Immune/ImmuneSpellInflict, Immune/ImmuneNoGuard |
| `buff_cc_enemy_periodic_inflict_resist_natural` | 当前词条相关：改写：屏障 | 当前 CcTag 未引用 | 由 `buff_cc_enemy_periodic_inflict_resist` 创建 | 标签: Immune/ImmuneSpellInflict/ImmuneNaturalInflict |
| `buff_cc_enemy_periodic_inflict_resist_phy` | 当前词条相关：改写：屏障 | 当前 CcTag 未引用 | 由 `buff_cc_enemy_periodic_inflict_resist` 创建 | 标签: Immune/ImmuneNoGuard |
| `buff_cc_enemy_periodic_inflict_resist_pulse` | 当前词条相关：改写：屏障 | 当前 CcTag 未引用 | 由 `buff_cc_enemy_periodic_inflict_resist` 创建 | 标签: Immune/ImmuneSpellInflict/ImmunePulseInflict |
| `buff_cc_enemy_poise_up` | 当前未开放/预留：暂拟：改写：稳态 | 当前 CcTag 未引用 | 无内部派生 | 属性: Specific/MaxPoise BaseMultiplier(poise_up) |
| `buff_cc_eny_abnormal_to_superarmor` | 当前未开放/预留：暂拟：改写：稳固 | 当前 CcTag 未引用 | 创建 `buff_cc_eny_abnormal_to_superarmor_do_finish`, `buff_cc_eny_abnormal_to_superarmor_instance`<br>可移除 `buff_cc_eny_abnormal_to_superarmor_do_finish` | Ability.OnBeforeAddedBuff: CheckBuffIdInContextAdvanced, CheckBuffStackNumAdvanced, FinishBuffAdvanced, CreateBuffAction; Ability.OnFinishedBuff: CheckBuffIdInContextAdvanced, CheckBuffStackNumAdvanced, CreateBuffAction |
| `buff_cc_eny_abnormal_to_superarmor_do_finish` | 当前未开放/预留：暂拟：改写：稳固 | 当前 CcTag 未引用 | 由 `buff_cc_eny_abnormal_to_superarmor` 创建<br>由 `buff_cc_eny_abnormal_to_superarmor` 可移除<br>可移除 `buff_cc_eny_abnormal_to_superarmor_instance` | Buff.OnBuffFinish: CheckBuffStackNumAdvanced, FinishBuffAdvanced |
| `buff_cc_eny_abnormal_to_superarmor_instance` | 当前未开放/预留：暂拟：改写：稳固 | 当前 CcTag 未引用 | 由 `buff_cc_eny_abnormal_to_superarmor` 创建<br>由 `buff_cc_eny_abnormal_to_superarmor_do_finish` 可移除 | Buff.DuringBuffEnable: SetSuperArmorAction, EffectAction |
| `buff_cc_level_mute_switch_player_info` | 当前未开放/预留：暂拟：环境：隔断 | 当前 CcTag 未引用 | 可移除 `buff_cc_level_mute_switch_player_info_pre` | Buff.OnBuffStart: FinishBuffAdvanced; Buff.DuringBuffEnable: ShowSquadTipsAction |
| `buff_cc_level_mute_switch_player_info_pre` | 当前未开放/预留：暂拟：环境：隔断 | 当前 CcTag 未引用 | 由 `buff_cc_level_mute_switch_player_info` 可移除 | Buff.DuringBuffEnable: ShowSquadTipsAction |

## 附录 4：全量 GlobalBuffData 列表

本表列出所有 42 个 `global_buff_cc*`。有些 Global Buff 没有 child BuffData，而是直接修改体力、ATB（技力） 或关卡事件。

| GlobalBuffData | 当前 CcTag | 默认黑板 | 生效方式 | 备注 |
|---|---|---|---|---|
| `global_buff_cc_chr_ATB_recoverspeed_down` | 当前 CcTag 未引用 | ratio=-0.1 | globalModifier `ATB（技力）Recover` / `Multiplier`（ratio） | 当前未开放/预留；若后续进入 CcTag，以 CcTag 黑板覆盖值为准。 |
| `global_buff_cc_chr_combo_cd_up` | 当前 CcTag 未引用 | cd=5 | `buff_cc_chr_combo_cd_up`（传入 cd<-cd） | 当前未开放/预留；若后续进入 CcTag，以 CcTag 黑板覆盖值为准。 |
| `global_buff_cc_chr_combo_skill_cryst_inflict` | 100401, 100402 | times=2 | `buff_cc_chr_combo_skill_cryst_inflict`（传入 times<-times） | 当前词条：队列：热流失 |
| `global_buff_cc_chr_combo_skill_dmg_down` | 当前 CcTag 未引用 | dmg_scale=-0.9 | `buff_cc_chr_combo_skill_dmg_down`（传入 dmg_scale<-dmg_scale） | 当前未开放/预留；若后续进入 CcTag，以 CcTag 黑板覆盖值为准。 |
| `global_buff_cc_chr_combo_special_cc0` | 100003 | cd_scale=0.2 | `buff_cc_chr_combo_special_cc0`（传入 cd_scale<-cd_scale） | 当前词条：环境：过速 |
| `global_buff_cc_chr_consume_inflict_special_cc0` | 当前 CcTag 未引用 | consume_dmg_scale_per_stack=0.05, dmg_scale=-0.6 | `buff_cc_chr_consume_inflict_special_cc0`（传入 consume_dmg_scale_per_stack<-consume_dmg_scale_per_stack, dmg_scale<-dmg_scale） | 当前未开放/预留；战技伤害 -60%，消耗/吸收破防或法术附着后按层造成目标最大生命 5% 真实伤害。若后续进入 CcTag，以 CcTag 黑板覆盖值为准。 |
| `global_buff_cc_chr_cryst_inflict_extend` | 当前 CcTag 未引用 | - | `buff_cc_chr_cryst_inflict_extend` | 当前未开放/预留；若后续进入 CcTag，以 CcTag 黑板覆盖值为准。 |
| `global_buff_cc_chr_cryst_inflict_to_slowdown` | 当前 CcTag 未引用 | slowdown_scale_per_stack=-0.25 | `buff_cc_chr_cryst_inflict_to_slowdown`（传入 slowdown_scale_per_stack<-slowdown_scale_per_stack） | 当前未开放/预留；若后续进入 CcTag，以 CcTag 黑板覆盖值为准。 |
| `global_buff_cc_chr_dash_recover_speed_down` | 101301 | ratio=-0.5 | globalModifier `DashRecover` / `Multiplier`（ratio） | 当前词条：环境：厌氧 |
| `global_buff_cc_chr_dmg_down_after_consume` | 当前 CcTag 未引用 | dmg_scale=-0.9, duration=10 | `buff_cc_chr_dmg_down_after_consume`（传入 dmg_scale<-dmg_scale, duration<-duration） | 当前未开放/预留；消耗或吸收法术附着后统一降低后续造成伤害，法术附着种类不决定降伤类型。 |
| `global_buff_cc_chr_dmg_down_after_inflict` | 100901, 100902 | dmg_scale=-0.1, duration=10 | `buff_cc_chr_dmg_down_after_inflict`（传入 dmg_scale<-dmg_scale, duration<-duration） | 当前词条：队列：扼制 |
| `global_buff_cc_chr_dmg_down_by_distance` | 当前 CcTag 未引用 | distance_min=4, distance_max=10, dmgdown_max=-0.9 | `buff_cc_chr_dmg_down_by_distance`（传入 distance_min<-distance_min, distance_max<-distance_max, dmgdown_max<-dmgdown_max） | 当前未开放/预留；公式为 `clamp((distance-4)/6,0,1)*-0.9`。 |
| `global_buff_cc_chr_dmg_reduce_maxhp` | 101402 | hp_down_ratio=0.5, hp_down_ratio_melee=0.3 | `buff_cc_chr_dmg_reduce_maxhp`（传入 hp_down_ratio<-hp_down_ratio） | 当前词条：队列：衰竭 |
| `global_buff_cc_chr_fire_skill_clear_frozenonchar` | 101701 | - | `buff_cc_chr_fire_skill_clear_frozenonchar`（传入 layer<-layer） | 当前词条：环境：融化 / 升华 / 电解 / 切削 |
| `global_buff_cc_chr_frozenonchar_extend` | 101701, 101801, 101901, 102401 | duration=15 | `buff_cc_chr_frozenonchar_extend`（传入 layer<-layer） | 当前词条：环境：融化 / 升华 / 电解 / 切削 |
| `global_buff_cc_chr_heal_reflect_to_eny` | 103302 | chr_heal_ratio=0.1, eny_heal_ratio=0.05, chr_shield_ratio=0.2 | `buff_cc_chr_heal_reflect_to_eny`（传入 chr_heal_ratio<-chr_heal_ratio, eny_heal_ratio<-eny_heal_ratio, chr_shield_ratio<-chr_shield_ratio） | 当前词条：环境：同步生长 |
| `global_buff_cc_chr_inflict_after_spell_status` | 当前 CcTag 未引用 | inflict_stack=1 | `buff_cc_chr_inflict_after_spell_status`（传入 inflict_stack<-inflict_stack） | 当前未开放/预留；干员造成 Frozen/Burning/Conduct/Corrupt 法术异常时，对自身施加对应的 Cryst/Fire/Pulse/Natural 法术附着。 |
| `global_buff_cc_chr_main_attribute_down` | 102801, 102802, 102803 | attr=-200 | `buff_cc_chr_main_attribute_down`（传入 attr<-attr） | 当前词条：队列：萎缩 |
| `global_buff_cc_chr_main_dmg_taken_up` | 100601, 100602 | dmg_scale=0.1 | `buff_cc_chr_main_dmg_taken_up`（传入 dmg_scale<-dmg_scale） | 当前词条：队列：斩首 |
| `global_buff_cc_chr_natural_skill_clear_frozenonchar` | 101801 | - | `buff_cc_chr_natural_skill_clear_frozenonchar`（传入 layer<-layer） | 当前词条：环境：融化 / 升华 / 电解 / 切削 |
| `global_buff_cc_chr_normal_attack_dmg_down` | 100803 | dmg_scale=-0.6 | `buff_cc_chr_normal_attack_dmg_down`（传入 dmg_scale<-dmg_scale） | 当前词条：队列：脱力 |
| `global_buff_cc_chr_normal_skill_cryst_inflict` | 100301, 100302 | times=2 | `buff_cc_chr_normal_skill_cryst_inflict`（传入 times<-times） | 当前词条：队列：失温 |
| `global_buff_cc_chr_normal_skill_dmg_down` | 当前 CcTag 未引用 | dmg_scale=-0.9 | `buff_cc_chr_normal_skill_dmg_down`（传入 dmg_scale<-dmg_scale） | 当前未开放/预留；若后续进入 CcTag，以 CcTag 黑板覆盖值为准。 |
| `global_buff_cc_chr_normal_skill_global_cd_lv1` | 当前 CcTag 未引用 | cd=8 | `buff_cc_chr_normal_skill_global_cd`（传入 cd<-cd） | 当前未开放/预留；若后续进入 CcTag，以 CcTag 黑板覆盖值为准。 |
| `global_buff_cc_chr_normal_special_cc0` | 当前 CcTag 未引用 | recover_ratio=1, skill_ratio=2, dmg_scale=-0.6 | `buff_cc_chr_normal_special_cc0`（传入 skill_ratio<-skill_ratio, dmg_scale<-dmg_scale）<br>globalModifier `ATB（技力）Recover` / `Multiplier`（recover_ratio） | 当前未开放/预留；`recover_ratio=1` 是默认占位，后续若进入 CcTagTable 应由真实黑板覆盖。玩家效果应写作技力自然恢复速度下降，Skill/Gain 来源技力额外补发 2 倍数值（不限战技），战技伤害 -60%。 |
| `global_buff_cc_chr_phy_skill_clear_frozenonchar` | 102401 | - | `buff_cc_chr_phy_skill_clear_frozenonchar`（传入 layer<-layer） | 当前词条：环境：融化 / 升华 / 电解 / 切削 |
| `global_buff_cc_chr_physical_and_inflict_enhance_special_cc0` | 103203 | dmg_up=2, dmg_scale=-0.6 | `buff_cc_chr_physical_and_inflict_enhance_special_cc0`（传入 dmg_up<-dmg_up, dmg_scale<-dmg_scale） | 当前词条：环境：震荡 |
| `global_buff_cc_chr_pulse_skill_clear_frozenonchar` | 101901 | - | `buff_cc_chr_pulse_skill_clear_frozenonchar`（传入 layer<-layer） | 当前词条：环境：融化 / 升华 / 电解 / 切削 |
| `global_buff_cc_chr_repeat_profession_dmg_down` | 当前 CcTag 未引用 | dmg_scale=-0.25 | `buff_cc_chr_repeat_profession_dmg_down`（传入 dmg_scale<-dmg_scale） | 当前未开放/预留；扫描队伍职业重复数，每个同职业额外名额默认使全队造成伤害 -25%。若后续进入 CcTag，以 CcTag 黑板覆盖值为准。 |
| `global_buff_cc_chr_teammate_normal_attack_dmg_down` | 当前 CcTag 未引用 | dmg_scale=-0.75 | `buff_cc_chr_teammate_normal_attack_dmg_down`（传入 dmg_scale<-dmg_scale） | 当前未开放/预留；若后续进入 CcTag，以 CcTag 黑板覆盖值为准。 |
| `global_buff_cc_chr_teammate_take_dmg_down` | 当前 CcTag 未引用 | dmg_down=-0.5 | `buff_cc_chr_teammate_take_dmg_down`（传入 dmg_down<-dmg_down） | 当前未开放/预留；默认让非主控队友受到伤害减半，主控干员不触发。若后续进入 CcTag，以 CcTag 黑板覆盖值为准。 |
| `global_buff_cc_chr_ult_dmg_down_gradual` | 100501, 100502 | dmg_scale=-0.5, dmg_scale_per_layer=-0.5 | `buff_cc_chr_ult_dmg_down_gradual`<br>`buff_cc_chr_ult_dmg_down_gradual_instance`（传入 dmg_scale_per_layer<-dmg_scale_per_layer） | 当前词条：队列：折刃 |
| `global_buff_cc_chr_ult_sp_cost_increase_lv1` | 当前 CcTag 未引用 | usp_up=0.2 | `buff_cc_chr_ult_sp_cost_increase`（传入 usp_up<-usp_up） | 当前未开放/预留；每次施放终结技后给自身叠 1 层，后续终结技能量需求 +20%。若后续进入 CcTag，以 CcTag 黑板覆盖值为准。 |
| `global_buff_cc_chr_ult_sp_cost_increase_lv2` | 当前 CcTag 未引用 | usp_up=0.5 | `buff_cc_chr_ult_sp_cost_increase`（传入 usp_up<-usp_up） | 当前未开放/预留；每次施放终结技后给自身叠 1 层，后续终结技能量需求 +50%。若后续进入 CcTag，以 CcTag 黑板覆盖值为准。 |
| `global_buff_cc_chr_usp_speed_down` | 当前 CcTag 未引用 | usp_scale=-0.1 | `buff_cc_chr_usp_speed_down`（传入 usp_scale<-usp_scale） | 当前未开放/预留；若后续进入 CcTag，以 CcTag 黑板覆盖值为准。 |
| `global_buff_cc_level_countdown_reduce` | 102101, 102102 | time=0 | level/event：`SendBattleSignalToLevel` | 当前词条：环境：时限 |
| `global_buff_cc_level_elite_levelup` | 当前 CcTag 未引用 | - | level/event：`SendBattleSignalToLevel` | 当前未开放/预留；若后续进入 CcTag，以 CcTag 黑板覆盖值为准。 |
| `global_buff_cc_level_mute_evade` | 101303 | - | `buff_cc_chr_mute_evade`<br>附带事件：`ShowSquadTipsAction` | 当前词条：环境：禁锢 |
| `global_buff_cc_level_mute_switch_player` | 当前 CcTag 未引用 | - | level/event：`AbilityActions.FinishGlobalBuffAction`, `ShowSquadTipsAction` | 与正式“环境：分隔”的 `_pre` 入口功能重叠；启动时会结束 `_pre`，大概率为旧入口或未采用方案。 |
| `global_buff_cc_level_mute_switch_player_pre` | 101201 | - | level/event：`ShowSquadTipsAction` | 当前词条：环境：分隔 |
| `global_buff_cc_level_reduce_heal_ball` | 102001 | num=-2 | level/event：`SendBattleSignalToLevel` | 当前词条：环境：枯萎 |
| `global_buff_cc_level_reduce_heal_ball_2` | 102002 | num=-2 | level/event：`SendBattleSignalToLevel` | 当前词条：环境：枯萎 |
