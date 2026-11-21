---
name: simulation-training-tasks
description: 维护 AKEDatabase 的演武集算任务模块（simulation_training_tasks）。按当前活动常量取任务配置，用 completeConditionId 找条件行，再展开 rewardId、活动起止时间及各类目标。
---

# 演武集算任务

按当前活动常量取任务配置，用 completeConditionId 找条件行，再展开 rewardId、活动起止时间及各类目标。

## 从哪里开始

- 杂项子入口 `/?plugin=misc&id=simulation_training_tasks`，杂项内。页面在[simulation_training_tasks.html](../../../../plugin/misc/simulation_training_tasks.html)。
- 相关脚本包括 [misc-simulation-training-tasks.js](../../../../plugin/js/misc-simulation-training-tasks.js)。
- 子页面由[杂项控制器](../../../modules/misc/SKILL.md)挂载。条目子路由由父模块传给 `context.routeId`。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 活动范围 | [misc-simulation-training-tasks.js](../../../../plugin/js/misc-simulation-training-tasks.js) · `ACTIVITY_ID` |
| 达成条件 | [misc-simulation-training-tasks.js](../../../../plugin/js/misc-simulation-training-tasks.js) · `conditionView` |
| 任务分类 | [misc-simulation-training-tasks.js](../../../../plugin/js/misc-simulation-training-tasks.js) · `category` |

## 修改与排查

遇到‘描述正确、分类错误’先读 category(task)：当前分类含本地化描述的文字判断。条件类型和 progressToCompare 则来自结构字段；在其他语言或新类型上需分别核实。

排查积分显示保留条件记录与单位，缺条件时可以显示已取得的任务描述。现有 ACTIVITY_ID 针对单次活动。

[模块索引](../../index.md) · [项目记忆](../../../memory.md)
