---
name: v3-buff
description: 维护 AKEDatabase 的Buff模块（v3_buff）。目录按资产索引的 BuffData 文件组织，角色与敌人相关表补充归属。
---

# Buff

目录按资产索引的 BuffData 文件组织，角色与敌人相关表补充归属。选中条目后，v3-buff-data.js 的 analyzeBuff 解析事件、参数、动作和条件，v3-buff.js 组织详情。

## 从哪里开始

- 注册入口 `/?plugin=v3_buff`，普通入口。页面在[v3_buff.html](../../../plugin/v3_buff.html)。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[v3-buff-data.js](../../../plugin/js/v3-buff-data.js)、[module-overview.js](../../../plugin/js/module-overview.js)、[v3-buff.js](../../../plugin/js/v3-buff.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 资源列表 | [v3-buff.js](../../../plugin/js/v3-buff.js) · `loadManifest` |
| 归属目录 | [v3-buff.js](../../../plugin/js/v3-buff.js) · `buildDirectory` |
| 解析单个 Buff | [v3-buff-data.js](../../../plugin/js/v3-buff-data.js) · `analyzeBuff` |

## 修改与排查

分清哪一步有问题：文件遗漏检查 loadManifest，归组错误检查 buildDirectory，事件或公式缺项检查 analyzeBuff 和事件页。黑板字段按实际类型解释。

静态事件树保留条件与动作顺序。基础配置、携带者注入的黑板和最终战斗触发条件可能不同；缺少来源时保留未解析值。

[模块索引](../index.md) · [项目记忆](../../memory.md)
