---
name: monument
description: 维护 AKEDatabase 的影拓丰碑模块（monument）。monumentPeriodData 从高难活动、阶段、完成条件、HighDifficultyGameIdToSeriesIdTable 和 TimeRangeTable 找期次及系列。
---

# 影拓丰碑

monumentPeriodData 从高难活动、阶段、完成条件、HighDifficultyGameIdToSeriesIdTable 和 TimeRangeTable 找期次及系列。monumentManifest 构造专项目录，详情复用 dungeonDetail。

## 从哪里开始

- 注册入口 `/?plugin=monument`，普通入口。页面在[monument.html](../../../plugin/monument.html)。页面调用 `AKEV3.activate('monument')`，先由适配器生成数据，再交给控制器。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[module-overview.js](../../../plugin/js/module-overview.js)、[ake-stats.js](../../../plugin/js/ake-stats.js)、[ake-combat-data.js](../../../plugin/js/ake-combat-data.js)、[ake-enemy-renderer.js](../../../plugin/js/ake-enemy-renderer.js)、[v2-dungeon.js](../../../plugin/js/v2-dungeon.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 期次 | [v3-table-data.js](../../../plugin/js/v3-table-data.js) · `monumentPeriodData` |
| 专题系列 | [v3-table-data.js](../../../plugin/js/v3-table-data.js) · `monumentManifest` |
| 共用详情 | [v3-table-data.js](../../../plugin/js/v3-table-data.js) · `dungeonDetail` |

## 修改与排查

期次或排序不对时查阶段 → 玩法 → 系列 → 开放时间。关卡、奖励、怪物卡或横幅则查 v2-dungeon.js 中的丰碑分支。

独立专题与普通副本同时展示对应关卡，这是创建模块时的需求。维护专题过滤、深链与布局时保留普通副本入口。

[模块索引](../index.md) · [项目记忆](../../memory.md)
