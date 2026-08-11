# 终末地数据导论

>自从终末地二测开始，就不断地有攻略者在探索终末地的各类数值以及伤害的计算方法，在666bj老师发布了[[零号委托] 终末地数据机制导论](https://ngabbs.com/read.php?tid=46094556&rand=604)后，大部分的攻略者都是基于他这篇文章中所提出的伤害计算公式进行的排轴与伤害模拟。然而，为了便于大家理解，666bj老师在该文章中对终末地的部分伤害逻辑进行了概括和简化处理，并不能准确地还原游戏内的实际伤害逻辑，因此笔者写了这篇文章以分析游戏数据的底层逻辑
>
## 1.属性

### 1.1 基础属性

截至1.2版本，终末地的生物（包括但不限于角色和怪物，下面统一用角色代替）共存在93种属性（**Attribute**），这些属性决定了一个角色的基础信息，常见的属性有：等级，生命值，攻击力，防御力，角色的四个能力（力量、敏捷、意志、智识），游戏中点开角色详细面板中能够显示的所有属性都是会被记录的。具体的对应关系可以参考附录A。

### 1.2 干员职业

游戏中，干员职业一共有6种，其在游戏数据中的对应关系如下

| ID   | 英文代号     | 中文名称 |
| :--- | :----------- | :------- |
| 0    | GUARD        | 近卫     |
| 1    | *SNIPER*     | *狙击*   |
| 2    | DEFENDER     | 重装     |
| 3    | *MEDIC*      | *医疗*   |
| 4    | SUPPORTER    | 辅助     |
| 5    | CASTER       | 术师     |
| 6    | *SPECIALIST* | *特种*   |
| 7    | VANGUARD     | 先锋     |
| 8    | ASSAULT      | 突击     |


其中标注为斜体的职业并没有在终末地中实装，但是存在于明日方舟中。

### 1.3 干员属性

游戏中，干员属性一共有6种，对应如下

| 英文代号 | 中文名称 |
| :------- | :------- |
| Cryst    | 寒冷     |
| Fire     | 灼热     |
| Pulse    | 电磁     |
| Natural  | 自然     |
| Physical | 物理     |

数据来源CharTypeTable

注意区分干员属性类型和伤害类型，全部伤害类型如下


| 英文代号        | 中文名称   |
| :-------------- | :--------- |
| Physical        | 物理伤害   |
| *Real*          | *真实伤害* |
| Fire            | 灼热伤害   |
| Pulse           | 电磁伤害   |
| Cryst (Crystal) | 寒冷伤害   |
| *LifeDrain*     | *吸血伤害* |
| Natural         | 自然伤害   |
| Ether           | 超域伤害   |

标斜体的伤害类型未在游戏中实装。

### 1.4 武器类型

游戏中共有五种武器类型，对应如下

| ID   | 英文代号  | 中文名称 |
| :--- | :-------- | :------- |
| 1    | Sword     | 单手剑   |
| 2    | Wand      | 施术单元 |
| 3    | Claymores | 双手剑   |
| 4    | *Gun*     | *枪械*   |
| 5    | Lance     | 长柄武器 |
| 6    | Pistol    | 手铳     |

标斜体的武器类型未在游戏中实装。


## 2.属性修改

游戏中对角色属性的修改是非常常见的，例如角色的的天赋，装备，武器或者携带的buff都会影响到角色的基础属性。那么，游戏是如何知道自己应该修改哪个属性的哪个乘区，以及修改多少数值的呢？

### 2.1 属性修改的实现方式

我们先来看这一段数据，这是陈千语的其中一个好感天赋

```json
"chr_0005_chen_5": {
    "attributeNodeInfo": {
        "attributeModifier": {
            "attrType": 40,
            "attrValue": 15,
            "modifierType": 5,
            "modifyAttributeType": 0
        },
        "breakStage": 3,
        "desc": {
            "id": 4354373478570167969,
            "text": "干员敏捷能力值提升15。"
        },
        "favorability": 300,
        "title": {
            "id": -6847073591967786888,
            "text": "游刃"
        }
    },
    ...
}
```


注意`attributeModifier`(属性修改器)部分，这部分提供了四个参数，分别是

`attrType`：属性类型，即需要进行修改的基础属性是什么，这里的40根据上文对照可知是角色的敏捷值

`atttrValue`：属性数值，即对基础属性进行多少数值的修改

`modifierType`：加成类型：即使用什么算法对该基础数值进行加成，具体的对应算法请参考下文，这里指的是基础加算

`modifyAttributeType`：是一种对特殊属性加成的判断，当其不为空时，会按照以下规则进行加成：

| id   | 名称     | 效果                            |
| :--- | :------- | :------------------------------ |
| 0    | Specific | 按AttributeType（Attrtype）修改 |
| 1    | Main     | 修改主能力                      |
| 2    | Sub      | 修改副能力                      |
| 3    | All      | 修改全能力（常用于全能力提升）  |



### 2.2 属性修改类型

终末地中对于基础属性的修改（**AttributeModify**）共有8种方式，详细的类型参考见下表（表格为了体现加成顺序，没有按照id排序）

| ID   | 修正器                | 作用阶段 | 语义          | 典型来源              |
| :--- | :-------------------- | :------- | :------------ | :-------------------- |
| 5    | `baseAddition`        | 基础     | 固定数值加成  | 角色/敌人自身属性成长 |
| 6    | `baseMultiplier`      | 基础     | 百分比增减    | 天赋、潜能加成        |
| 7    | `baseFinalAddition`   | 基础     | 最终固定追加  | 装备固定值            |
| 8    | `baseFinalMultiplier` | 基础     | 最终倍率      | 全局属性倍率          |
| 0    | `addition`            | 主修正   | 固定数值 Buff | Buff "+100 攻击力"    |
| 1    | `multiplier`          | 主修正   | 百分比 Buff   | Buff "攻击力 +30%"    |
| 3    | `finalAddition`       | 主修正   | 最终固定追加  | 最终伤害附加          |
| 4    | `finalMultiplier`     | 主修正   | 最终倍率      | 伤害倍率、暴击倍率    |

### 2.3 属性修改顺序

```plain
     rawValue
        │
        + baseAddition
        │
   ┌─ Clamp  ─┐  ← 第1次
   │  min,max │
   └──────────┘
        │
  × Max(0, baseMultiplier)
        │
  + baseFinalAddition
        │
  × baseFinalMultiplier
        │
   ┌─ Clamp  ─┐  ← 第2次 (B = _CalculateBaseAttribute 输出)
   │  min,max │
   └──────────┘
        │
  + addition
        │
  × Max(0, multiplier)
        │
  + finalAddition
        │
  × finalMultiplier
        │
   ┌─ Clamp  ─┐  ← 第3次 (最终结果)
   │  min,max │
   └──────────┘
        │
     result
```


## 3.数据获取

通过前面的内容，我们已经知道了该如何计算各个属性的数值，那么我们该从哪里获得角色的属性信息以及加成信息呢？下面我们就将以[AKEData](www.akedata.top)作为数据源，来分析一下这些数据是怎么得出来的

在AKEData中，提供了大部分数据在游戏内的原始存储信息，这些内容可以在`public/CH/v2_xxx`和`public/Json`中找到，如果你觉得这些数据难以理解，那么可以看`public/CH/`目录下的其他文件。这些文件经过二次加工，更方便人类阅读和理解的数据，我们后面的讲解将主要基于原始数据展开。

游戏的几乎所有数值数据都存储在一个名为`TableCfg`（TableConfig）的目录下，在这个目录下，存放着数百个json文件，我们想要的所有数据都分散在各个文件中，他们按照一定的规则进行存储，AKEData为了便于大家查阅，将属于某个角色/武器的数据都归类整理到了同一个文件中，下面我们将对这些数据进行举例说明

### 3.1 角色数据

这里我们以陈千语为例，来分析一下这些数据的构成

首先我们会发现，对于一个角色来说，他的数据被存储在了下图中显示的几个table中

```json
{
    "charId": "chr_0005_chen",
    "name": "陈千语",
    "charactertable": {
    },
    "chargrowthtable": {
    },
    "characterpotentialtable": {
    },
    "potentialtalenteffecttable": {
    },
    "skillpatchtable": {
    },
    "spaceshipcharskilltable": {
    },
    "spaceshipskilltable": {
    },
    "itemtable": {
    },
    "charprofessiontable": {
    }
}
```


接下来我们一一展开这些数据来看他的构成

#### 3.1.1 charactertable

charactertable中记录的是角色的基础信息，由于大部分内容可以根据其字段的名称和内容猜测大概，此处只给出部分较为抽象数据的解释

```json
"charactertable": {
    "attributes": [
    ],
    "charBattleTagIds": [
        "tag_03",
        "tag_26"
    ],
    "charId": "chr_0005_chen",
    "charPassiveUIPrefabName": "",
    "charTypeId": "Physical",
    "cvName": {
    },
    "defaultWeaponId": "wpn_sword_0003",
    "department": "ENDFIELD INDUSTRIES",
    "dontInterruptCombo": true,
    "engName": "Chen Qianyu",
    "mainAttrType": 40,
    "name": {
        "id": 3128157701878862541,
        "text": "陈千语"
    },
    "phoneticName": "",
    "profession": 0,
    "profileRecord": [
    ],
    "profileVoice": [
    ],
    "rarity": 5,
    "resilienceDeductionFactor": 0.14,
    "sortOrder": 5,
    "subAttrType": 39,
    "superArmor": 0,
    "weaponType": 1,
    "charBattleTag": [
        "击飞",
        "失衡"
    ]
},
```
`attributes`：存储了角色的基础属性，这是一个拥有94项的数组，数组中的每一项对应一个等级的角色基础数值，多出来的四项是因为角色存在四个突破阶段，每个突破阶段的突破前后有独立的数值（虽然目前看来数值都是相同的），这部分内容最多但是结构是最简单的，你可以通过这里查到角色的每一级数值。要查找相应等级的数值，只需要找到包含了Level: 对应等级的属性列表即可。

`mainAttrType`：角色的主能力

`subAttrType`：角色的副能力

#### 3.1.2 chargrowthtable

chargrowthtable记录的是角色的是角色的技能和天赋成长信息

```json
"chargrowthtable": {
    "charBreakCostMap": {
    },
    "charId": "chr_0005_chen",
    "charTypeId": "Physical",
    "defaultWeaponId": "wpn_sword_0003",
    "engName": "Chen Qianyu",
    "mainAttrType": 40,
    "name": {
        "id": 3128157701878862541,
        "text": "陈千语"
    },
    "profession": 0,
    "rarity": 5,
    "skillGroupMap": {
    },
    "skillLevelUp": [
    ],
    "subAttrType": 39,
    "talentNodeMap": {
    },
    "weaponType": 1
},
```

`charBreakCostMap`：角色的每个突破阶段（精英化）所消耗的材料

`skillGroupMap`：角色的技能组，每个角色都有四类技能组（普攻、战技、连携技、终结技），游戏中根据`skillGroupType`判断该技能属于哪一类技能，对于每一类技能组，都存在着一个或多个技能，他们被记录在了`skillIdList`中，例如，陈千语的普攻技能组里有7个技能
```json
"skillIdList": [
    "chr_0005_chen_attack1",
    "chr_0005_chen_attack2",
    "chr_0005_chen_attack3",
    "chr_0005_chen_attack4",
    "chr_0005_chen_attack5",
    "chr_0005_chen_power_attack",
    "chr_0005_chen_plunging_attack_end"
]
```
这说明陈千语的普攻技能包括五段普通攻击、处决攻击和下落攻击，这也是为什么通常情况下处决攻击能够吃到普通攻击伤害加成的原因

`skillLevelUp`：记录了角色每个技能每升一级所消耗的材料数量

`talentNodeMap`：记录了角色每个天赋升级所消耗的材料数量，以及每个天赋对于角色属性的修改情况（关于`attributeModifier`部分的介绍请查看上面的章节）

#### 3.1.3 characterpotentialtable

characterpotentialtable记录的是角色潜能的基础信息，里面说明了角色提升潜能所需要消耗的材料，以及每一级潜能能够解锁的效果和道具

#### 3.1.4 potentialtalenteffecttable

potentialtalenteffecttable记录的是角色的天赋和潜能对角色属性的影响，下面我们将通过陈千语的几个天赋来说明这些内容是如何生效的
```json
"chr_0005_chen_talent_1_1": {
    "dataList": [
        {
            "attachBuff": {
                "blackboard": [
                    {
                        "key": "atk",
                        "value": 0.04,
                        "valueStr": ""
                    },
                    {
                        "key": "duration",
                        "value": 10,
                        "valueStr": ""
                    },
                    {
                        "key": "max_stack",
                        "value": 5,
                        "valueStr": ""
                    }
                ],
                "buffId": "buff_chr_0005_chen_talent_0"
            },
            "attachSkill": {
            },
            "attrModifier": {
            },
            "modifyType": 5,
            "skillBbModifier": {
            },
            "skillParamModifier": {
            }
        }
    ],
    "desc": {
        "id": 3686020396391044978,
        "text": "技能每次命中敌人后，攻击力<@ba.vup>+{atk:0%}</>，持续{duration:0}秒，该效果最多叠加{max_stack:0}层。"
    },
    "id": "chr_0005_chen_talent_1_1"
```

这是陈千语的天赋“斩锋”，游戏实现这个天赋效果的原理是为角色添加一个名为`buff_chr_0005_chen_talent_0`的buff，这个buff需要三个参数进行触发，分别是`atk`，`duration`，`max_stack`（请注意，这里的参数名称并不是固定的关键字，会根据buff的实际情况发生变化，此处可以根据技能描述和参数的英文含义进行猜测），他们被写在`blackboard`中被传入buff并产生实际影响，至于具体的影响将在后面章节进行解释

该天赋只是添加了一个buff，并没有对其他属性进行修改，因此其余项都是默认值

对于`desc.text`部分，游戏中采用了一种富文本标记的方法渲染文本，这种方法会将大括号`{}`内的内容按照规则进行显示，冒号左边为该参数对应的实际数值，冒号右边为该数值的显示格式，通常有百分比形式（0%）和原始数据形式（0），因此，该文本在游戏中显示为：

>技能每次命中敌人后，攻击力+4%，持续10秒，该效果最多叠加5层。

由于文档渲染和篇幅限制，无法显示**+4%**文本的蓝色高亮，这部分内容实际上受到`<@ba.vup></>`标签控制。AKEData直接读取`HyperlinkTextTable.json`和`RichTextStyleTable.json`，并将其中的术语文本与样式定义转换为网页可显示的格式。

#### 3.1.5 skillpatchtable

skillpatchtable记录的是角色的技能数值，里面记录了每个技能的倍率，描述，冷却时间以及会代入skilldata的数值

#### 3.1.6 其他table

其他的table作为辅助数据，记录的是一些描述性的内容，在此不过多赘述

### 3.2 武器数据

相比于角色数据，武器数据的内容更加简单，下面是武器数据的格式（以扶摇为例）

```json
{
    "weaponId": "wpn_sword_0011",
    "weaponbasictable": {
    },
    "itemtable": {
    },
    "skillpatchtable": {
    },
    "weaponbreakthroughtemplatetable": {
    },
    "weaponupgradetemplatetable": {
    },
    "weaponupgradetemplatesumtable": {
    },
    "weapontalenttemplatetable": {
    }
}
```

#### 3.2.1 weaponbasictable

weaponbasictable记录的是武器的一些基础信息，下面是扶摇的信息

```json
"weaponbasictable": {
    "breakthroughTemplateId": "weapon_breakthrough_456star_A_2",
    "engName": {
        "id": -6433348788349033441,
        "text": "Rapid Ascent"
    },
    "levelTemplateId": "weapon_upgrade_curve_6star_1",
    "maxLv": 90,
    "modelPath": "Gameplay/Prefabs/Weapons/wpn_sword_0011.prefab",
    "potentialUpItemList": [],
    "rarity": 6,
    "talentTemplateId": "wpn_potential_456star",
    "weaponDesc": {
        "id": -2020131378380124644,
        "text": "..."
    },
    "weaponId": "wpn_sword_0011",
    "weaponPotentialSkill": "sk_wpn_sword_0011",
    "weaponSkillList": [
        "wpn_attr_main_high",
        "wpn_sp_attr_crirate_high",
        "sk_wpn_sword_0011"
    ],
    "weaponType": 1
},
```

`breakthroughTemplateId`：该武器突破时采用哪一套突破材料，游戏中一共有20套不同的突破材料组合，其中3星武器有10套，456星武器有10套（分别是ABCDE的1和2），每个武器的突破材料均写在了对应的`weaponbreakthroughtemplatetable`中

`levelTemplateId`：该武器的数值成长曲线，武器成长曲线共有21条，其中3星武器有3条（0.95x，1x，1.05x），4星武器有4条（0.9x，0.95x，1x，1.1x），5星武器有8条（0.9x，0.95x，0.97x，0.98x，1x，1.03x，1.05x，1.1x），6星武器有6条（0.98x，0.99x，1x，1.01x，1.02x，1.03x），扶摇采用的是6星1倍的数值成长，每个武器的数值成长以及每级消耗素材均写在了对应的`weaponupgradetemplatetable`中（你也可以在`weaponupgradetemplatesumtable`查到总消耗素材）

`talentTemplateId`：该武器的技能等级随着武器突破解锁的等级上限，目前游戏中只存在3星武器与456星武器的差别，你可以在`weapontalenttemplatetable`查到相关信息

`weaponPotentialSkill`：武器的第三技能

`weaponSkillList`：武器的三个技能列表

#### 3.2.2 其他表格

`skillpatchtable`：同角色数据

`itemtable`：包含了数据中所有提及的物品信息

### 3.3 敌人数据

敌人数据与角色数据其实差不多，但是游戏中并不会给出敌人每个技能的具体机制与数值描述，因此很多数据都存在缺失，下面是一个敌人数据的示例（以破潮之像为例）

```json
{
    "templateId": "eny_0090_wgabyss",
    "enemytemplatedisplayinfotable": {
    },
    "enemytable": {
    },
    "enemyattributetemplatetable": {
    },
    "enemyabilitydesctable": {
    },
    "displayenemytypetable": {
    },
    "distributioninfotable": {
    },
    "name": "破潮之像"
}
```

#### 3.3.1 enemytemplatedisplayinfotable

```json
"enemytemplatedisplayinfotable": {
    "abilityDescIds": [
        "eny_0090_wgabyss_ability_1",
        "eny_0090_wgabyss_ability_2",
        "eny_0090_wgabyss_ability_3",
        "eny_0090_wgabyss_ability_4"
    ],
    "description": {
        "id": 1914028455911553613,
        "text": "..."
    },
    "displayType": 4,
    "distributionIds": [
        "distribution_world_energy_point07"
    ],
    "name": {
        "id": 5935714591311021148,
        "text": "破潮之像"
    },
    "nickname": {
        "id": -5407819063369129084,
        "text": "破潮之像"
    },
    "tags": [],
    "templateId": "eny_0090_wgabyss"
}
```

`abilityDescIds`：敌人的天赋描述，通常一个敌人有1~4条天赋描述，这些天赋描述存储在`enemyabilitydesctable`中

`distributionIds`：敌人的出现位置，可以在`distributioninfotable`中查到

#### 3.3.2 enemytable

enemytable中存储了该敌人的所有变种怪物信息，破潮之像就存在6个变种，此处以影拓丰碑·浊流具现·霜冻联结中的怪物为例进行说明
```json
"enemytable": {
    "eny_0090_wgabyss_hdg011": {
        "aiTemplateId": "aiconf_eny_0090_wgabyss_hdg010",
        "attrModifiers": [
            {
                "attrType": 1,
                "attrValue": 0.5,
                "modifierType": 1,
                "modifyAttributeType": 0
            }
        ],
        "attrTemplateId": "eny_0090_wgabyss_hdg010",
        "autoLockCancelTime": -1,
        "autoLockCancelType": 0,
        "bornBuffs": [
            "buff_eny_0091_wgshoal_hdg010"
        ],
        "enemyId": "eny_0090_wgabyss_hdg011",
        "isDangerous": false,
        "modelId": "",
        "serverDeathCheck": false,
        "showBigEffect": true,
        "showBigHeadbar": true,
        "templateId": "eny_0090_wgabyss"
    },
    "eny_0090_wgabyss": {
        ...
    }
}
```

`attrModifiers`：属性修改，这里对怪物的最大生命值进行了增加50%的修改
`attrTemplateId`：属性加成基于的怪物模板，对相同名称的不同怪物变种，使用的基础属性模板也有可能不同
>需要特别说明的是，鹰角网络内部的命名实际上十分混乱，这个怪物应该是hdg011关卡的怪物，但是这里使用的模板和buff却都带了hdg010后缀，所以有理由猜测他们调整过关卡顺序配置。类似的情况实际上还有很多，对笔者的前期研究造成了很大的障碍，限于篇幅在此不过多赘述。

`bornBuffs`：怪物生成时携带的buff，这个buff为出生自带，且一般情况下不会被清除
`isDangerous`：是否危险的标志，通常用于触发角色语音
`showBigEffect`：是否使用大特效，这里可以理解为是否使用全局特效
`showBigHeadbar`：是否置顶显示怪物血条

#### 3.3.3 enemyattributetemplatetable
enemyattributetemplatetable记录了每个怪物模板的基础数值

```json
"enemyattributetemplatetable": {
    "eny_0090_wgabyss_hdg010": {
        "aoiRadius": 0,
        "attackValueAgainstTower": 50,
        "breakingAttackedAtbObtain": 50,
        "crystDmgResistScalar": 0.92,
        "fireDmgResistScalar": 0.92,
        "initialSuperArmor": 30,
        "levelDependentAttributes": [
        ],
        "levelIndependentAttributes": {
        },
        "maxResilience": 65,
        "naturalDmgResistScalar": 0.92,
        "physicalDmgResistScalar": 0.92,
        "poiseKnotBuffList": [],
        "poiseKnotPctList": [],
        "pulseDmgResistScalar": 0.92,
        "pushedBackCoefficient": 0.3,
        "resilienceDecreaseWhenHurt": 0,
        "resilienceFullRecoverTime": 0,
        "resilienceRecover": 0,
        "resilienceRecoverInterval": 0,
        "superArmorWhenResilienceZero": 0,
        "templateId": "eny_0090_wgabyss_hdg010",
        "zeroPoiseSuperArmor": 30
    },
    "eny_0090_wgabyss": {
        ...
    }
}
```
怪物的数值参数基本上都可以在附录A中找到，部分找不到的参数也可以在AKEData的敌人页面中查到对应的中文描述
比较有趣的是，敌人的基础属性被分为了`levelDependentAttributes`（等级依赖属性，即随着等级改变而发生改变的属性）和`levelIndependentAttributes`（等级独立属性，即随着等级改变不发生改变的属性）。通常情况下，敌人只有最大生命值和攻击力两个属性会随着等级发生改变，防御力虽然也写在了等级依赖属性中但是恒为100，其他属性均不随等级变化发生改变

### 3.4 装备数据

在AKEData中，装备数据按照装备套组类型进行分组存储，每一个装备套组的数据存储在同一个json文件下，对于没有装备套组效果的装备，统一视为独立装备（suit_none），由于此处独立装备的定义与游戏中存在出入，因此后续的说明中只会以套组装备为例，不会涉及到独立装备的说明

接下来我们以点剑装备组为例，来说明装备数据的存储规则

```json
{
    "suitId": "suit_phy01",
    "equipsuittable": {
    },
    "equiptable": {
    },
    "itemtable": {
    },
    "skillpatchtable": {
    },
    "equipformulatable": {
    },
    "equipformulareversetable": {
    },
    "equippacktable": {
    },
    "equippackformulatable": {
    },
    "equipenhancecosttable": {},
    "equipenhanceguaranteetimesruletable": {},
    "equipconst": {
    },
    "equiptechconst": {
    }
}
```

#### 3.4.1 equipsuittable

equipsuittable存储的是装备套组的基础信息

```json
"equipsuittable": {
    "equipList": [
        "item_equip_t4_suit_phy01_body_01",
        "item_equip_t4_suit_phy01_body_02",
        "item_equip_t4_suit_phy01_hand_01",
        "item_equip_t4_suit_phy01_hand_02",
        "item_equip_t4_suit_phy01_edc_01",
        "item_equip_t4_suit_phy01_edc_02",
        "item_equip_t4_suit_phy01_edc_03",
        "item_equip_t4_suit_phy01_body_03",
        "item_equip_t4_suit_phy01_hand_03",
        "item_equip_t4_suit_phy01_edc_04"
    ],
    "list": [
        {
            "equipCnt": 3,
            "skillID": "passive_equipsuit_physuit_01",
            "skillLv": 1,
            "suitID": "suit_phy01",
            "suitLogoName": "icon_pack_wuling_suit_phy01",
            "suitName": {
                "id": 2969356566561953360,
                "text": "点剑"
            }
        }
    ]
},
```

`equipList`：该装备套组包含哪些装备

#### 3.4.2 equiptable
equiptable包含了每件装备的详细属性信息，这里以点剑轻装甲为例进行说明
```json
"item_equip_t4_suit_phy01_body_01": {
    "displayAttrModifiers": [
    ],
    "displayBaseAttrModifier": {
    },
    "domainId": "domain_2",
    "equipAttrModifiers": [
        {
            "attrIndex": 1,
            "attrType": 39,
            "attrValues": [
                87,
                95,
                104,
                113
            ],
            "modifierType": 5,
            "modifyAttributeType": 0
        },
    ],
    "itemId": "item_equip_t4_suit_phy01_body_01",
    "minWearLv": 70,
    "partType": 0,
    "suitID": "suit_phy01"
}
```
事实上，对于装备数据来说，`displayAttrModifiers`和`displayBaseAttrModifier`的数据大部分是冗余的，唯一有意义的字段是`enhanceGuaranteeTimesRuleId`，它决定了该装备该词条的精锻保底规则，目前一共有3种精锻保底规则，你可以在`equipenhanceguaranteetimesruletable`中查到
`domainId`：该装备所属的地区
`equipAttrModifiers`装备属性修改，`attrIndex`对应的是装备的四个词条（其中0对应的防御力词条），`attrValues`记录了词条的四个等级对应的四个数值
`partType`是装备的部位类型，目前一共有三个部位，对应如下
| id  | 英文名 | 中文名 |
| --- | ------ | ------ |
| 0   | body   | 护甲   |
| 1   | hand   | 护手   |
| 2   | edc    | 配件   |

#### 3.4.3 skillpatchtable
skillpatchtable记录的是装备套组的技能

#### 3.4.4 equipformulatable
equipformulatable记录的是转隔壁的制作配方


### 3.5 副本数据

### 3.6 SkillData

### 3.7 BuffData

### 3.8 伤害乘区
游戏内定义了以下几种伤害乘区：

| 英文名 | 中文名 | 乘区内叠加 |
| ------ | ------ | ------ |
| ProdCalcZone | 独立增减伤 | 乘算 |
| NormalCalcZone | 通用增减伤 | 加算 |
| EnhancedDmgIncrease | 增幅 | 加算 |
| VulnerableDmgIncrease | 脆弱增伤 | 加算 |
| AbnormalAndBurstIncrease | 法术爆发与异常增伤 | 加算 |
| ComboCalcZone | 连击增伤 | 加算 |

在一次DamageAction中，游戏会生成攻击方和防守方的属性快照，并分别在攻击方和防守方生成以上6个乘区。所有乘区的初始值为1.0。

#### 3.8.1 防守方乘区
防守方乘区的生成较为简单，目前游戏中仅处理了脆弱乘区。脆弱增伤区会简单地加上防守方属性快照中对应伤害类型的脆弱值。
#### 3.8.2 攻击方乘区
攻击方乘区则要考虑较多的属性。

独立增减伤区：如果本次伤害属于异常伤害，则乘上攻击方快照中的源石技艺强度给予的伤害加成，每点源石技艺强度提供1%的异常伤害加成。

通用增减伤区：
 - 对应伤害类型的增伤
 - 如果不是异常伤害，则加上对应技能类型的增伤
 - 如果防守方处于失衡状态，再加上`对失衡目标伤害加成`

增幅区：加上攻击方快照中对应属性的增幅值

法术爆发与异常增伤：如果本次伤害属于法术异常，则加上对应异常类型的增伤
#### 3.8.3 最终结算
