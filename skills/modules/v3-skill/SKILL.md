---
name: v3-skill
description: 维护 AKEDatabase 的战斗模块（v3_skill）。由索引中的 SkillData 构建技能目录，结合角色成长、技能补丁及敌人表确认归属。
---

# 战斗

由索引中的 SkillData 构建技能目录，结合角色成长、技能补丁及敌人表确认归属。v3-skill-data.js 处理技能参数、时间轴与指标，ake-action-graph.js 建图，图的显示由独立视图负责。

## 从哪里开始

- 注册入口 `/?plugin=v3_skill`，普通入口。页面在[v3_skill.html](../../../plugin/v3_skill.html)。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[ake-action-graph.js](../../../plugin/js/ake-action-graph.js)、[v3-skill-data.js](../../../plugin/js/v3-skill-data.js)、[module-overview.js](../../../plugin/js/module-overview.js)、[ake-action-graph-view.js](../../../plugin/js/ake-action-graph-view.js)、[v3-skill.js](../../../plugin/js/v3-skill.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 资源列表 | [v3-skill.js](../../../plugin/js/v3-skill.js) · `fetchManifest` |
| 静态语义解析 | [v3-skill-data.js](../../../plugin/js/v3-skill-data.js) · `analyzeSkill` |
| 节点与时间轴 | [v3-skill.js](../../../plugin/js/v3-skill.js) · `renderWorkspace` |

## 修改与排查

数值问题从 analyzeSkill 和 buildBlackboard 查技能等级与补丁；节点遗漏从动作图追原始路径；布局问题再看 ake-action-graph-view.js 与 renderWorkspace。

节点合并要保留原始位置，裁剪分类要保留判断条件与前置路径。子技能的局部时间需考虑生成时机，图上的分支不能证明实战中同时触发。

[模块索引](../index.md) · [项目记忆](../../memory.md)
