---
name: v3-equip
description: 维护 AKEDatabase 的装备模块（v3_equip）。equipManifest / equipDetail 联结 EquipSuitTable、EquipTable 和 ItemTable。
---

# 装备

equipManifest / equipDetail 联结 EquipSuitTable、EquipTable 和 ItemTable。目录按套组组织，收录和版本新增判断仍需落实到单件装备，包含未归组装备。

## 从哪里开始

- 注册入口 `/?plugin=v3_equip`，普通入口。页面在[v3_equip.html](../../../plugin/v3_equip.html)。页面调用 `AKEV3.activate('equip')`，先由适配器生成数据，再交给控制器。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[module-overview.js](../../../plugin/js/module-overview.js)、[ake-advanced-links.js](../../../plugin/js/ake-advanced-links.js)、[v2-equip.js](../../../plugin/js/v2-equip.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 套装与独立部件 | [v3-table-data.js](../../../plugin/js/v3-table-data.js) · `equipManifest` |
| 关联材料与属性 | [v3-table-data.js](../../../plugin/js/v3-table-data.js) · `equipDetail` |
| 获取方式 | [v2-equip.js](../../../plugin/js/v2-equip.js) · `renderAcquisition` |

## 修改与排查

筛选异常要用命中的具体部件核对词条，详情再汇总套装技能、精锻和获取来源。改制造材料沿 EquipFormulaTable.level → EquipFormulaChainTable.chainList 查所有材料组合。

装备与物品页共用配方转换；同一配方的多个输入方案都应保留。模板箱点位涉及按需读取 LevelData，避免为目录提前加载。

专项依据见[装备配方契约](../../akedatabase-development/references/data-contracts.md)。

[模块索引](../index.md) · [项目记忆](../../memory.md)
