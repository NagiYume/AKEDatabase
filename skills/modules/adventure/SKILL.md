---
name: adventure
description: 维护 AKEDatabase 的探索手册模块（adventure）。AdventureTaskTable 通过 belongingGroup 关联任务组，阶段奖励、世界等级、冒险等级和日活跃奖励另有主表。
---

# 探索手册

AdventureTaskTable 通过 belongingGroup 关联任务组，阶段奖励、世界等级、冒险等级和日活跃奖励另有主表。AKECatalog 按 kind 和源键生成条目。

## 从哪里开始

- 注册入口 `/?plugin=adventure`，隐藏。页面在[adventure.html](../../../plugin/adventure.html)。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[ake-catalog.js](../../../plugin/js/ake-catalog.js)、[adventure.js](../../../plugin/js/adventure.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 分类条目 | [adventure.js](../../../plugin/js/adventure.js) · `build` |
| 任务所属组 | [adventure.js](../../../plugin/js/adventure.js) · `belongingGroup` |
| 世界等级解锁 | [adventure.js](../../../plugin/js/adventure.js) · `taskUnlockGroupId` |

## 修改与排查

任务与阶段漏连先比对 taskIds 和 adventureBookStage；世界等级解锁还需查 taskUnlockGroupId。跳转、条件和奖励在 detail 回调展开。

混合目录内相同数字键可能属于不同类型。保留 task: 等类型前缀，以条目类型选择详情和深链。

[模块索引](../index.md) · [项目记忆](../../memory.md)
