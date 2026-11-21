---
name: tech-tree
description: 维护 AKEDatabase 的工业科技树模块（tech_tree）。FacSTTGroupTable、FacSTTLayerTable、FacSTTNodeTable 提供组、层和节点；条件、前置层/节点、消耗和机器关联在 tech-tree.js 组织。
---

# 工业科技树

FacSTTGroupTable、FacSTTLayerTable、FacSTTNodeTable 提供组、层和节点；条件、前置层/节点、消耗和机器关联在 tech-tree.js 组织。

## 从哪里开始

- 注册入口 `/?plugin=tech_tree`，普通入口。页面在[tech_tree.html](../../../plugin/tech_tree.html)。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[ake-catalog.js](../../../plugin/js/ake-catalog.js)、[tech-tree-view.js](../../../plugin/js/tech-tree-view.js)、[tech-tree.js](../../../plugin/js/tech-tree.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 科技数据整合 | [tech-tree.js](../../../plugin/js/tech-tree.js) · `build` |
| 节点前置关系 | [tech-tree-view.js](../../../plugin/js/tech-tree-view.js) · `preNode` |

## 修改与排查

节点或设施归属异常时先检查 groupId、preNode、preLayer 与科技到机器的映射；节点存在但连线遮挡或位置异常才查 tech-tree-view.js。

详情与图中节点共享条目身份。新增操作但设施名称缺证据时，保留配置值及诊断。涉及设施卡的修改要对照工业设施入口。

[模块索引](../index.md) · [项目记忆](../../memory.md)
