---
name: update-copy
description: 维护 AKEDatabase 的更新文案生成模块（update_copy）。以选定的两份 TableCfg 版本计算新增条目，definitions 定义所支持的业务对象。
---

# 更新文案生成

以选定的两份 TableCfg 版本计算新增条目，definitions 定义所支持的业务对象。默认比较相邻热更新，生成可复制的中文说明。

## 从哪里开始

- 杂项子入口 `/?plugin=misc&id=update_copy`，需要访问权限。页面在[update_copy.html](../../../../plugin/misc/update_copy.html)。
- 相关脚本包括 [ake-asset-index.js](../../../../plugin/js/ake-asset-index.js)、[misc-update-copy.js](../../../../plugin/js/misc-update-copy.js)。
- 子页面由[杂项控制器](../../../modules/misc/SKILL.md)挂载。条目子路由由父模块传给 `context.routeId`。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 比较范围 | [misc-update-copy.js](../../../../plugin/js/misc-update-copy.js) · `definitions` |
| 提取稳定身份 | [misc-update-copy.js](../../../../plugin/js/misc-update-copy.js) · `build` |
| 双版本比较 | [misc-update-copy.js](../../../../plugin/js/misc-update-copy.js) · `generate` |

## 修改与排查

新增判定取各模块实际业务键，例如装备按单件、商店按商品另计新店。档案还会用共享索引辅助定位；比较表时注意两次查询分别使用所选 version。

用户在建页时明确排除前瞻、只统计新增、每组最多列五个名称。调整覆盖范围要同步对应模块的归属逻辑，并保持此工具自己的访问条件。

[模块索引](../../index.md) · [项目记忆](../../../memory.md)
