---
name: recipe-flow-viewer
description: 维护 AKEDatabase 的配方流程查看器模块（recipe_flow_viewer）。normalizeRecipes 将制造机、手工、枢纽、装备、飞船等来源转换为输入和产出；同一物品分别索引生产它的配方与消耗它的配方。
---

# 配方流程查看器

normalizeRecipes 将制造机、手工、枢纽、装备、飞船等来源转换为输入和产出；同一物品分别索引生产它的配方与消耗它的配方。

## 从哪里开始

- 杂项子入口 `/?plugin=misc&id=recipe_flow_viewer`，杂项内。页面在[recipe_flow_viewer.html](../../../../plugin/misc/recipe_flow_viewer.html)。
- 相关脚本包括 [misc-recipe-flow-viewer.js](../../../../plugin/js/misc-recipe-flow-viewer.js)。
- 子页面由[杂项控制器](../../../modules/misc/SKILL.md)挂载。条目子路由由父模块传给 `context.routeId`。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 来源统一 | [misc-recipe-flow-viewer.js](../../../../plugin/js/misc-recipe-flow-viewer.js) · `normalizeRecipes` |
| 流程图 | [misc-recipe-flow-viewer.js](../../../../plugin/js/misc-recipe-flow-viewer.js) · `renderProductionGraph` |
| 图像导出 | [misc-recipe-flow-viewer.js](../../../../plugin/js/misc-recipe-flow-viewer.js) · `exportGraphPng` |

## 修改与排查

缺少路径先对照 normalizeRecipes 的来源和稳定物品 ID，再查看 renderProductionGraph 与 renderDownstreamSection。替代配方、多输入多输出、循环与重复节点需保留可追溯关系。

PNG 导出走 exportGraphPng 的独立布局与样式快照。修改节点布局、缩放或导出先读开发 skill 的 references/recipe-flow.md。

专项依据见[配方画布约定](../../../akedatabase-development/references/recipe-flow.md)。

[模块索引](../../index.md) · [项目记忆](../../../memory.md)
