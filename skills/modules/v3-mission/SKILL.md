---
name: v3-mission
description: 维护 AKEDatabase 的任务模块（v3_mission）。loadCore 从 MissionRuntimeAsset 资产索引建立清单，再由 loadMission / loadMeta 获取任务运行文件和补充信息。
---

# 任务

loadCore 从 MissionRuntimeAsset 资产索引建立清单，再由 loadMission / loadMeta 获取任务运行文件和补充信息。关卡脚本、敌人、对话及奖励按需补齐。

## 从哪里开始

- 注册入口 `/?plugin=v3_mission`，隐藏。页面在[v3_mission.html](../../../plugin/v3_mission.html)。
- 相关脚本包括 [module-overview.js](../../../plugin/js/module-overview.js)、[mission.js](../../../plugin/js/mission.js)、[ake-asset-index.js](../../../plugin/js/ake-asset-index.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 资产目录与基础索引 | [mission.js](../../../plugin/js/mission.js) · `loadCore` |
| 任务运行文件 | [mission.js](../../../plugin/js/mission.js) · `loadMission` |
| 运行时对话引用 | [mission.js](../../../plugin/js/mission.js) · `collectRuntimeDialogueRefs` |

## 修改与排查

先区分任务、Quest、Objective 与事件。mainPathQuests 给出主线路径；可选任务和前置关系不能只按字典枚举顺序排。还原对话时查 collectRuntimeDialogueRefs 与场景脚本。

若全目录为空先检查索引中的任务基础字段，再查单文件。调整叙事收录同时对照档案库和搜索，记录任务独有与共用的内容来源。

专项依据见[叙事收录与差分](../../tablecfg-analysis/references/narrative-analysis.md)。

[模块索引](../index.md) · [项目记忆](../../memory.md)
