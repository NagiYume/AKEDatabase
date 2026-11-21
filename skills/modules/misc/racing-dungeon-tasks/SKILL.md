---
name: racing-dungeon-tasks
description: 维护 AKEDatabase 的奇境任务模块（racing_dungeon_tasks）。按活动与竞速玩法配置读取阶段、任务、里程碑及奖励。
---

# 奇境任务

按活动与竞速玩法配置读取阶段、任务、里程碑及奖励。活动开放、阶段解锁与任务达成分别有时间、条件和分数来源。

## 从哪里开始

- 杂项子入口 `/?plugin=misc&id=racing_dungeon_tasks`，杂项内。页面在[racing_dungeon_tasks.html](../../../../plugin/misc/racing_dungeon_tasks.html)。
- 相关脚本包括 [misc-racing-dungeon-tasks.js](../../../../plugin/js/misc-racing-dungeon-tasks.js)。
- 子页面由[杂项控制器](../../../modules/misc/SKILL.md)挂载。条目子路由由父模块传给 `context.routeId`。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 配置缺失时的回退 | [misc-racing-dungeon-tasks.js](../../../../plugin/js/misc-racing-dungeon-tasks.js) · `FALLBACK_GAME_ID` |
| 任务条件 | [misc-racing-dungeon-tasks.js](../../../../plugin/js/misc-racing-dungeon-tasks.js) · `conditionView` |
| 奖励项 | [misc-racing-dungeon-tasks.js](../../../../plugin/js/misc-racing-dungeon-tasks.js) · `rewardItems` |

## 修改与排查

某阶段错配先核对 ACTIVITY_ID、FALLBACK_GAME_ID、stageId 和 unlockStageId；阈值看 completeScore，任务条件另沿 completeConditionId 读取。

保留普通与重要里程碑标记。缺少时间或关卡表时，不能把其他阶段的时间或奖励安到当前条目。

[模块索引](../../index.md) · [项目记忆](../../../memory.md)
