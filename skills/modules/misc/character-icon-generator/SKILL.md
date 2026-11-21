---
name: character-icon-generator
description: 维护 AKEDatabase 的角色图标生成器模块（character_icon_generator）。读取 CharacterTable、CharGrowthTable、SkillPatchTable 供选角色与技能，组合角色图、背景、外环、技能等素材，在画布预览后导出 PNG。
---

# 角色图标生成器

读取 CharacterTable、CharGrowthTable、SkillPatchTable 供选角色与技能，组合角色图、背景、外环、技能等素材，在画布预览后导出 PNG。

## 从哪里开始

- 杂项子入口 `/?plugin=misc&id=character_icon_generator`，杂项内。页面在[character_icon_generator.html](../../../../plugin/misc/character_icon_generator.html)。
- 相关脚本包括 [misc-character-icon-generator.js](../../../../plugin/js/misc-character-icon-generator.js)。
- 子页面由[杂项控制器](../../../modules/misc/SKILL.md)挂载。条目子路由由父模块传给 `context.routeId`。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 导出尺寸 | [misc-character-icon-generator.js](../../../../plugin/js/misc-character-icon-generator.js) · `getOutputDimensions` |
| 图层绘制 | [misc-character-icon-generator.js](../../../../plugin/js/misc-character-icon-generator.js) · `renderPreview` |
| 保存 PNG | [misc-character-icon-generator.js](../../../../plugin/js/misc-character-icon-generator.js) · `downloadPng` |

## 修改与排查

造型错位或拉伸从 getOutputDimensions、imageDimensions 到 renderPreview 查目标画布与素材原始比例；缺图先看 loadUiAsset / loadOptionalUiAsset 的实际路径。

自定义宽高可以非正方形，保持构图比例并居中。技能类型与伤害属性决定不同背景图层，开关、预览与 downloadPng 要操作同一构图。

[模块索引](../../index.md) · [项目记忆](../../../memory.md)
