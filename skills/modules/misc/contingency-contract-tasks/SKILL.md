---
name: contingency-contract-tasks
description: 维护 AKEDatabase 的合约任务模块（contingency_contract_tasks）。本页处理指定活动的任务组、完成条件、奖励和开放区间。
---

# 合约任务

本页处理指定活动的任务组、完成条件、奖励和开放区间。用 ActivityContingencyContractTable 的 activityId 找 gameId，再关联对应组。

## 从哪里开始

- 杂项子入口 `/?plugin=misc&id=contingency_contract_tasks`，杂项内。页面在[contingency_contract_tasks.html](../../../../plugin/misc/contingency_contract_tasks.html)。
- 相关脚本包括 [misc-contingency-contract-tasks.js](../../../../plugin/js/misc-contingency-contract-tasks.js)。
- 子页面由[杂项控制器](../../../modules/misc/SKILL.md)挂载。条目子路由由父模块传给 `context.routeId`。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 任务期 | [misc-contingency-contract-tasks.js](../../../../plugin/js/misc-contingency-contract-tasks.js) · `ACTIVITY_ID` |
| 目标 | [misc-contingency-contract-tasks.js](../../../../plugin/js/misc-contingency-contract-tasks.js) · `conditionView` |
| 解锁 | [misc-contingency-contract-tasks.js](../../../../plugin/js/misc-contingency-contract-tasks.js) · `releaseView` |

## 修改与排查

任务组为空先核对 ACTIVITY_ID 与 FALLBACK_GAME_ID；缺少活动映射会给出回退提示。任务的 completeConditionId 和 rewardId 分别用于条件和奖励，不依赖怪物计算。

勿将当前活动常量或第一期回退 ID 推广到多期合约页面。任务描述可在指标表缺失时正常显示。

[模块索引](../../index.md) · [项目记忆](../../../memory.md)
