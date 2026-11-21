---
name: protocol-pass-tasks
description: 维护 AKEDatabase 的协议通行证任务模块（protocol_pass_tasks）。按赛季展示通行证任务、周标签与等级奖励。
---

# 协议通行证任务

按赛季展示通行证任务、周标签与等级奖励。seasonGroups 和 parentLabelMap 将任务标签归到赛季，等级按 levelGroupId 与超等级组定位。

## 从哪里开始

- 杂项子入口 `/?plugin=misc&id=protocol_pass_tasks`，杂项内。页面在[protocol_pass_tasks.html](../../../../plugin/misc/protocol_pass_tasks.html)。
- 相关脚本包括 [misc-protocol-pass-tasks.js](../../../../plugin/js/misc-protocol-pass-tasks.js)。
- 子页面由[杂项控制器](../../../modules/misc/SKILL.md)挂载。条目子路由由父模块传给 `context.routeId`。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 奖励轨道 | [misc-protocol-pass-tasks.js](../../../../plugin/js/misc-protocol-pass-tasks.js) · `TRACK_REWARD_FIELDS` |
| 任务归属 | [misc-protocol-pass-tasks.js](../../../../plugin/js/misc-protocol-pass-tasks.js) · `seasonGroups` |
| 等级奖励 | [misc-protocol-pass-tasks.js](../../../../plugin/js/misc-protocol-pass-tasks.js) · `renderLevels` |

## 修改与排查

某一奖励轨道缺失先查 TRACK_REWARD_FIELDS 的 freeRewardId、originiumRewardId、payRewardId，再查奖励包。任务周次从标签及其开放时间推导。

赛季有效期、任务有效期与循环等级奖励各自独立。维护展示要兼顾基础、源石、协议定制三轨和重复奖励等级。

[模块索引](../../index.md) · [项目记忆](../../../memory.md)
