---
name: v3-enemy
description: 维护 AKEDatabase 的敌人模块（v3_enemy）。目录以 EnemyTemplateDisplayInfoTable 的模板为单位。
---

# 敌人

目录以 EnemyTemplateDisplayInfoTable 的模板为单位。EnemyTable.templateId 将多个变种挂到模板，变种的 attrTemplateId 再连属性模板。

## 从哪里开始

- 注册入口 `/?plugin=v3_enemy`，普通入口。页面在[v3_enemy.html](../../../plugin/v3_enemy.html)。页面调用 `AKEV3.activate('enemy')`，先由适配器生成数据，再交给控制器。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[module-overview.js](../../../plugin/js/module-overview.js)、[ake-stats.js](../../../plugin/js/ake-stats.js)、[ake-advanced-links.js](../../../plugin/js/ake-advanced-links.js)、[v2-enemy.js](../../../plugin/js/v2-enemy.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 模板和变种关联 | [v3-table-data.js](../../../plugin/js/v3-table-data.js) · `enemyDetail` |
| 构建变种行 | [v2-enemy.js](../../../plugin/js/v2-enemy.js) · `buildVariantRows` |
| 分阶段应用修正 | [ake-stats.js](../../../plugin/js/ake-stats.js) · `analyzeAttrWithModifiers` |

## 修改与排查

数量或变种缺失从 enemyManifest / enemyDetail 查；单个变种的显示差异看 buildVariantRows / renderVariants。等级、模板、变种及 Buff 的计算共用 ake-stats.js。

跨玩法属性不同先核对具体敌人、等级和关卡出生修正。用同一模板名对比可能选中了不同变种。合约有可追溯的生命值算例，见项目记忆。

[模块索引](../index.md) · [项目记忆](../../memory.md)
