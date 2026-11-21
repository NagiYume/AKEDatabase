---
name: v3-dungeon
description: 维护 AKEDatabase 的副本模块（v3_dungeon）。dungeonManifest 从 DungeonSeriesTable 枚举系列，按 includeDungeonIds 取 DungeonTable；dungeonDetail 组织奖励、场景以及该系列的关卡详情。
---

# 副本

dungeonManifest 从 DungeonSeriesTable 枚举系列，按 includeDungeonIds 取 DungeonTable；dungeonDetail 组织奖励、场景以及该系列的关卡详情。

## 从哪里开始

- 注册入口 `/?plugin=v3_dungeon`，普通入口。页面在[v3_dungeon.html](../../../plugin/v3_dungeon.html)。页面调用 `AKEV3.activate('dungeon')`，先由适配器生成数据，再交给控制器。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[module-overview.js](../../../plugin/js/module-overview.js)、[ake-stats.js](../../../plugin/js/ake-stats.js)、[ake-combat-data.js](../../../plugin/js/ake-combat-data.js)、[ake-enemy-renderer.js](../../../plugin/js/ake-enemy-renderer.js)、[v2-dungeon.js](../../../plugin/js/v2-dungeon.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 系列范围 | [v3-table-data.js](../../../plugin/js/v3-table-data.js) · `dungeonManifest` |
| 系列内关卡与资源 | [v3-table-data.js](../../../plugin/js/v3-table-data.js) · `dungeonDetail` |
| 关卡详情 | [v2-dungeon.js](../../../plugin/js/v2-dungeon.js) · `renderDungeonCard` |

## 修改与排查

关卡缺失先查系列到关卡的外键。怪物、等级或出生 Buff 缺失时同时查场景的 SpawnerConfig 与 LevelScriptData，脚本中可直接定义敌人或附加条件。

renderDungeonCard 与影拓丰碑共用。危机合约在自己的控制器按 gameId 筛关，不要在共享 dungeonDetail 裁掉同系列其他关卡。

站位图读取刷怪配置中各波次的 `action.position.x/z`。`renderSpawnMap` 调用 [AKECombatData.spawnMapProjection](../../../plugin/js/ake-combat-data.js)，按全部波次的最大坐标绝对值确定两轴共同范围。网格间距、敌人标记共用同一比例，原点在中心，正 Z 朝上。

[模块索引](../index.md) · [项目记忆](../../memory.md)
