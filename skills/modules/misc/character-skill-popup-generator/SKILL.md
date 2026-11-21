---
name: character-skill-popup-generator
description: 维护 AKEDatabase 的角色技能弹窗生成器模块（character_skill_popup_generator）。从角色成长、技能补丁、天赋等记录生成指定等级的技能弹窗；可手工编辑文字与背景，再用 Canvas 导出。
---

# 角色技能弹窗生成器

从角色成长、技能补丁、天赋等记录生成指定等级的技能弹窗；可手工编辑文字与背景，再用 Canvas 导出。

## 从哪里开始

- 杂项子入口 `/?plugin=misc&id=character_skill_popup_generator`，杂项内。页面在[character_skill_popup_generator.html](../../../../plugin/misc/character_skill_popup_generator.html)。
- 相关脚本包括 [ake-watermark.js](../../../../plugin/js/ake-watermark.js)、[misc-character-skill-popup-generator.js](../../../../plugin/js/misc-character-skill-popup-generator.js)。
- 子页面由[杂项控制器](../../../modules/misc/SKILL.md)挂载。条目子路由由父模块传给 `context.routeId`。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 描述参数 | [misc-character-skill-popup-generator.js](../../../../plugin/js/misc-character-skill-popup-generator.js) · `descriptionValuePatch` |
| 内嵌图标 | [misc-character-skill-popup-generator.js](../../../../plugin/js/misc-character-skill-popup-generator.js) · `loadRichTextImages` |
| 编辑态元数据 | [misc-character-skill-popup-generator.js](../../../../plugin/js/misc-character-skill-popup-generator.js) · `buildWatermarkMetadata` |

## 修改与排查

描述数值从等级和 selectedPatch / descriptionValuePatch 检查；内嵌图标与超链接从 RichTextStyleTable、HyperlinkTextTable 和 loadRichTextImages 查。

游戏式深色弹窗固定取第二组富文本样式。编辑态的预览与导出共享水印逻辑，改元数据时与图片水印解析器配套。

[模块索引](../../index.md) · [项目记忆](../../../memory.md)
