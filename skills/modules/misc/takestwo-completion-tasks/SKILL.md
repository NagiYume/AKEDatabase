---
name: takestwo-completion-tasks
description: 维护 AKEDatabase 的竞技大会完成度任务模块（takestwo_completion_tasks）。从活动阶段配置找 dungeonIds、开放时间和挑战分组，再用任务的 completeConditionId、目标及奖励构造完成度任务。
---

# 竞技大会完成度任务

从活动阶段配置找 dungeonIds、开放时间和挑战分组，再用任务的 completeConditionId、目标及奖励构造完成度任务。

## 从哪里开始

- 杂项子入口 `/?plugin=misc&id=takestwo_completion_tasks`，杂项内。页面在[takestwo_completion_tasks.html](../../../../plugin/misc/takestwo_completion_tasks.html)。
- 相关脚本包括 [misc-takestwo-completion-tasks.js](../../../../plugin/js/misc-takestwo-completion-tasks.js)。
- 子页面由[杂项控制器](../../../modules/misc/SKILL.md)挂载。条目子路由由父模块传给 `context.routeId`。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 缺省关卡 | [misc-takestwo-completion-tasks.js](../../../../plugin/js/misc-takestwo-completion-tasks.js) · `KNOWN_NORMAL_DUNGEONS` |
| 阶段关联 | [misc-takestwo-completion-tasks.js](../../../../plugin/js/misc-takestwo-completion-tasks.js) · `configuredDungeonIds` |
| 完成度目标 | [misc-takestwo-completion-tasks.js](../../../../plugin/js/misc-takestwo-completion-tasks.js) · `completionTasks` |

## 修改与排查

先查 stageList 和配置中的 dungeonIds。KNOWN_NORMAL_DUNGEONS 是缺配置时的八关回退，真实配置优先；修改关卡映射时同时核对普通与困难分组。

任务的达成条件、目标和奖励与关卡入口的开放状态分别展示。后续活动不能仅沿用当前 ACTIVITY_ID 和回退编号推断。

[模块索引](../../index.md) · [项目记忆](../../../memory.md)
