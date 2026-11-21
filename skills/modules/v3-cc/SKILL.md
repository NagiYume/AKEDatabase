---
name: v3-cc
description: 维护 AKEDatabase 的危机合约模块（v3_cc）。ccManifest / ccDetail 按 gameId 合并合约、活动、词条、冲突、等级、任务和商店。
---

# 危机合约

ccManifest / ccDetail 按 gameId 合并合约、活动、词条、冲突、等级、任务和商店。词条数值另由资产索引定位 public/cc_data 下的分期配置。

## 从哪里开始

- 注册入口 `/?plugin=v3_cc`，普通入口。页面在[v3_cc.html](../../../plugin/v3_cc.html)。页面调用 `AKEV3.activate('cc')`，先由适配器生成数据，再交给控制器。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[module-overview.js](../../../plugin/js/module-overview.js)、[ake-stats.js](../../../plugin/js/ake-stats.js)、[ake-combat-data.js](../../../plugin/js/ake-combat-data.js)、[ake-enemy-renderer.js](../../../plugin/js/ake-enemy-renderer.js)、[v2-cc.js](../../../plugin/js/v2-cc.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 分期数据 | [v3-table-data.js](../../../plugin/js/v3-table-data.js) · `ccDetail` |
| 指标数值 | [v2-cc.js](../../../plugin/js/v2-cc.js) · `buildAllTagValueMaps` |
| 当前期关卡 | [v2-cc.js](../../../plugin/js/v2-cc.js) · `renderDungeonSection` |
| 属性计算 | [ake-stats.js](../../../plugin/js/ake-stats.js) · `analyzeAttrWithModifiers` |

## 修改与排查

选指标后数值异常，依次核对当前期、当前关卡、当前敌人、服务器黑板位置及匹配 Buff。变种先于携带 Buff，同区加成相加；跨期共用副本系列时先筛 gameId。

第一期历史 tagTerms 与第二期服务端文本、黑板并存。未映射、明确空黑板、合法数值零要区分；项目记忆保留 112402 与开天将算例。

专项依据见[合约数据契约](../../akedatabase-development/references/data-contracts.md#危机合约数据)。

[模块索引](../index.md) · [项目记忆](../../memory.md)
