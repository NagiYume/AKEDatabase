---
name: v3-achievement
description: 维护 AKEDatabase 的奖章模块（v3_achievement）。achievementManifest 读 AchievementTypeTable.achievementGroupData 与 AchievementTable。
---

# 奖章

achievementManifest 读 AchievementTypeTable.achievementGroupData 与 AchievementTable。目录可按分类显示，新增标记的业务单位是具体奖章。

## 从哪里开始

- 注册入口 `/?plugin=v3_achievement`，普通入口。页面在[v3_achievement.html](../../../plugin/v3_achievement.html)。页面调用 `AKEV3.activate('achievement')`，先由适配器生成数据，再交给控制器。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[module-overview.js](../../../plugin/js/module-overview.js)、[achievement.js](../../../plugin/js/achievement.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 目录与分组 | [v3-table-data.js](../../../plugin/js/v3-table-data.js) · `achievementManifest` |
| 组内引用 | [v3-table-data.js](../../../plugin/js/v3-table-data.js) · `achievementDetail` |
| 等级与条件 | [achievement.js](../../../plugin/js/achievement.js) · `renderAchievementLevels` |

## 修改与排查

从 achievementDetail 追分类内的分组和奖章等级，再在 renderGroupAchievements / renderAchievementLevels 查名称、达成条件及进度显示。

镀层条件和图标曾单独修复。改动时分别核对普通奖章、同组多级与限时镀层，分类有新增也需保留具体新奖章身份。

[模块索引](../index.md) · [项目记忆](../../memory.md)
