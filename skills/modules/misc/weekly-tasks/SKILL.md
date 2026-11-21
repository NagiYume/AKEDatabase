---
name: weekly-tasks
description: 维护 AKEDatabase 的每周任务模块（weekly_tasks）。ActivityWeeklyTaskTable 按 ACTIVITY_ID 筛任务，ActivityWeeklyTaskMileStoneTable 提供里程碑，奖励经 RewardTable 展开物品。
---

# 每周任务

ActivityWeeklyTaskTable 按 ACTIVITY_ID 筛任务，ActivityWeeklyTaskMileStoneTable 提供里程碑，奖励经 RewardTable 展开物品。

## 从哪里开始

- 杂项子入口 `/?plugin=misc&id=weekly_tasks`，杂项内。页面在[weekly_tasks.html](../../../../plugin/misc/weekly_tasks.html)。
- 相关脚本包括 [misc-weekly-tasks.js](../../../../plugin/js/misc-weekly-tasks.js)。
- 子页面由[杂项控制器](../../../modules/misc/SKILL.md)挂载。条目子路由由父模块传给 `context.routeId`。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 显示单位 | [misc-weekly-tasks.js](../../../../plugin/js/misc-weekly-tasks.js) · `displayTarget` |
| 里程碑 | [misc-weekly-tasks.js](../../../../plugin/js/misc-weekly-tasks.js) · `renderMilestones` |
| 周切换 | [misc-weekly-tasks.js](../../../../plugin/js/misc-weekly-tasks.js) · `setSelectedWeek` |

## 修改与排查

查目标显示先看 displayTarget 的 progressToCompare 与 displayFactor；查周次看活动时间和 setSelectedWeek，支持 weekN 条目定位。

里程碑奖励与单条任务得分是两套记录。跨周切换和定时刷新使用父模块 context，以免离开页面后继续更新旧视图。

[模块索引](../../index.md) · [项目记忆](../../../memory.md)
