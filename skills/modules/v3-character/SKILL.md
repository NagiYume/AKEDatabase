---
name: v3-character
description: 维护 AKEDatabase 的干员模块（v3_character）。目录由 CharacterTable 枚举，按角色键补 CharGrowthTable、武器推荐和后勤数据。
---

# 干员

目录由 CharacterTable 枚举，按角色键补 CharGrowthTable、武器推荐和后勤数据。详情还包含技能、潜能、培养、赠礼与语音。

## 从哪里开始

- 注册入口 `/?plugin=v3_character`，普通入口。页面在[v3_character.html](../../../plugin/v3_character.html)。页面调用 `AKEV3.activate('character')`，先由适配器生成数据，再交给控制器。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[module-overview.js](../../../plugin/js/module-overview.js)、[ake-voice-player.js](../../../plugin/js/ake-voice-player.js)、[ake-model-viewer.js](../../../plugin/js/ake-model-viewer.js)、[ake-character-model-viewer.js](../../../plugin/js/ake-character-model-viewer.js)、[ake-advanced-links.js](../../../plugin/js/ake-advanced-links.js)、[v2-character.js](../../../plugin/js/v2-character.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 目录与前瞻合并 | [v3-table-data.js](../../../plugin/js/v3-table-data.js) · `characterManifest` |
| 单角色用表与材料 | [v3-table-data.js](../../../plugin/js/v3-table-data.js) · `characterDetail` |
| 正式详情 | [v2-character.js](../../../plugin/js/v2-character.js) · `renderDetail` |
| 前瞻详情 | [v2-character.js](../../../plugin/js/v2-character.js) · `renderForesightCharacterDetail` |

## 修改与排查

查漏收或前瞻条目先读 characterManifest、characterDetail；页面分支在 renderForesightCharacterDetail 与 renderDetail。回礼由 characterGiftRewardIds 定位 RewardTable，然后展开物品，通用赠礼物品表不能替代回礼来源。

技能或语音重复时区分角色技能组、后勤 skillIndex 与特殊情境语音。模型按钮使用 ake-character-model-viewer.js 按需加载，修改详情时保留这个加载时机。

[模块索引](../index.md) · [项目记忆](../../memory.md)
