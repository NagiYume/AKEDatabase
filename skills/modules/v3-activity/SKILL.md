---
name: v3-activity
description: 维护 AKEDatabase 的活动模块（v3_activity）。activityManifest 组织目录与时间轴；activityDetail 选中活动后再取说明、奖励、阶段和关卡等依赖。
---

# 活动

activityManifest 组织目录与时间轴；activityDetail 选中活动后再取说明、奖励、阶段和关卡等依赖。TimeRangeTable 提供实际起止时刻。

## 从哪里开始

- 注册入口 `/?plugin=v3_activity`，普通入口。页面在[v3_activity.html](../../../plugin/v3_activity.html)。页面调用 `AKEV3.activate('activity')`，先由适配器生成数据，再交给控制器。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[module-overview.js](../../../plugin/js/module-overview.js)、[activity.js](../../../plugin/js/activity.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 活动关联 | [v3-table-data.js](../../../plugin/js/v3-table-data.js) · `activityDetail` |
| 分组奖励 | [activity.js](../../../plugin/js/activity.js) · `renderRewardGroups` |
| 寻访卡池时间轴 | [activity.js](../../../plugin/js/activity.js) · `renderGachaRecords` |

## 修改与排查

新增通用阶段或奖励从 ACTIVITY_DETAIL_TABLES 与 activityDetail 的 activity ID 关联入手。生日等专用阶段缺通用外键，需按各自结构分派。

活动总奖励、关卡奖励和子任务奖励的粒度不同。若卡片有活动而详情缺奖励，先对照条件与归属，再检查 renderRewardGroups；避免把详情表前移到起始页加载。

[模块索引](../index.md) · [项目记忆](../../memory.md)
