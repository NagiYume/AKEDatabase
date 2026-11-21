---
name: season-tower
description: 维护 AKEDatabase 的战争回响模块（season_tower）。SeasonTowerTable.weeks.includeGameIdList → SeasonTowerGameGroupTable.stars.gameId → DungeonTable.sceneId。
---

# 战争回响

SeasonTowerTable.weeks.includeGameIdList → SeasonTowerGameGroupTable.stars.gameId → DungeonTable.sceneId。按赛季/周/难度展示轮换、特性、奖励和怪物。

## 从哪里开始

- 注册入口 `/?plugin=season_tower`，普通入口。页面在[season_tower.html](../../../plugin/season_tower.html)。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[ake-stats.js](../../../plugin/js/ake-stats.js)、[ake-combat-data.js](../../../plugin/js/ake-combat-data.js)、[ake-enemy-renderer.js](../../../plugin/js/ake-enemy-renderer.js)、[season-tower.js](../../../plugin/js/season-tower.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 加载选中赛季 | [season-tower.js](../../../plugin/js/season-tower.js) · `loadSeasonData` |
| 战斗资源 | [season-tower.js](../../../plugin/js/season-tower.js) · `loadCombat` |
| 按周展示 | [season-tower.js](../../../plugin/js/season-tower.js) · `renderWeek` |

## 修改与排查

列表正确而某周缺怪物，从 loadSeasonData 到 loadCombat、loadSpawners 与 loadBuffs 检查具体场景。查看 renderWeek、renderDifficulty，分清数据遗漏和默认收起。

选择赛季后才加载其数据。多个难度共用的特性可在上层合并显示，但仍保留各难度自己的敌人和修正。时间 ID 缺失的处理见数据契约。

专项依据见[轮换时间契约](../../akedatabase-development/references/data-contracts.md)。

[模块索引](../index.md) · [项目记忆](../../memory.md)
