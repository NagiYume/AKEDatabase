---
name: v3-item
description: 维护 AKEDatabase 的物品模块（v3_item）。itemManifest / itemDetail 从 ItemTable 建立目录和详情，将用途、获取、制造与环境关联到同一物品。
---

# 物品

itemManifest / itemDetail 从 ItemTable 建立目录和详情，将用途、获取、制造与环境关联到同一物品。列表按物品身份查，源配方可能有多个产物及多个输入方案。

## 从哪里开始

- 注册入口 `/?plugin=v3_item`，普通入口。页面在[v3_item.html](../../../plugin/v3_item.html)。页面调用 `AKEV3.activate('item')`，先由适配器生成数据，再交给控制器。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[module-overview.js](../../../plugin/js/module-overview.js)、[v2-item.js](../../../plugin/js/v2-item.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 来源与用途 | [v3-table-data.js](../../../plugin/js/v3-table-data.js) · `itemDetail` |
| 获取途径 | [v2-item.js](../../../plugin/js/v2-item.js) · `renderObtainWays` |
| 配方展示 | [v2-item.js](../../../plugin/js/v2-item.js) · `renderCraftRecipes` |

## 修改与排查

描述或数值缺失看 renderProperties / renderUseEffects；材料、产物方向错误看 renderCraftRecipes 和共享适配器。装备模板配方用 equipmentRecipeVariants，工业环境用 factoryEnvironment。

杂项配方流程查看器会对同批关系建立上下游。新增一种生产来源时，对照两处的方向、单位及替代配方。

[模块索引](../index.md) · [项目记忆](../../memory.md)
