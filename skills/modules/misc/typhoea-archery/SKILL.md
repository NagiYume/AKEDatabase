---
name: typhoea-archery
description: 维护 AKEDatabase 的提弗洛斯的靶场模块（typhoea_archery）。TyphoeaArcheryLevelTable、每日训练、模拟训练组与关卡等表组织等级、奖励、芯片和训练目标，与地区建设有另一个展示入口。
---

# 提弗洛斯的靶场

TyphoeaArcheryLevelTable、每日训练、模拟训练组与关卡等表组织等级、奖励、芯片和训练目标，与地区建设有另一个展示入口。

## 从哪里开始

- 杂项子入口 `/?plugin=misc&id=typhoea_archery`，杂项内。页面在[typhoea_archery.html](../../../../plugin/misc/typhoea_archery.html)。
- 相关脚本包括 [misc-typhoea-archery.js](../../../../plugin/js/misc-typhoea-archery.js)。
- 子页面由[杂项控制器](../../../modules/misc/SKILL.md)挂载。条目子路由由父模块传给 `context.routeId`。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 芯片显示 | [misc-typhoea-archery.js](../../../../plugin/js/misc-typhoea-archery.js) · `chipView` |
| 模拟关卡组 | [misc-typhoea-archery.js](../../../../plugin/js/misc-typhoea-archery.js) · `simLevelGroupId` |
| 地区入口 | [region.js](../../../../plugin/js/region.js) · `buildArcheryData` |

## 修改与排查

等级解锁看 unlockLevel、upgradeQuestId；模拟训练按 simLevelGroupId 和 simLevelId 查组与关卡。原始字段 Lockedchips 有大小写要求。

改芯片或奖励名称要沿芯片或物品关联；普通模式沿用无 ID 的缺失文案。修改通用关卡含义时与 region.js 的 buildArcheryData 对照。

[模块索引](../../index.md) · [项目记忆](../../../memory.md)
