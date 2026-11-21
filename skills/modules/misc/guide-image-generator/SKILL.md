---
name: guide-image-generator
description: 维护 AKEDatabase 的兔头攻略图生成器模块（guide_image_generator）。整合干员、技能、武器和装备数据，支持横版、竖版布局、可编辑字段、图表、配置导入和 PNG 导出。
---

# 兔头攻略图生成器

整合干员、技能、武器和装备数据，支持横版、竖版布局、可编辑字段、图表、配置导入和 PNG 导出。

## 从哪里开始

- 杂项子入口 `/?plugin=misc&id=guide_image_generator`，需要访问权限。页面在[guide_image_generator.html](../../../../plugin/misc/guide_image_generator.html)。
- 相关脚本包括 [misc-guide-reference-draw.js](../../../../plugin/js/misc-guide-reference-draw.js)、[misc-guide-reference-template.js](../../../../plugin/js/misc-guide-reference-template.js)、[misc-guide-image-generator.js](../../../../plugin/js/misc-guide-image-generator.js)。
- 子页面由[杂项控制器](../../../modules/misc/SKILL.md)挂载。条目子路由由父模块传给 `context.routeId`。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 横版 | [misc-guide-image-generator.js](../../../../plugin/js/misc-guide-image-generator.js) · `renderHorizontal` |
| 竖版 | [misc-guide-image-generator.js](../../../../plugin/js/misc-guide-image-generator.js) · `renderVertical` |
| 配置恢复 | [misc-guide-image-generator.js](../../../../plugin/js/misc-guide-image-generator.js) · `loadConfig` |

## 修改与排查

内容联动看 buildAttributeNames、populateSelect 与 renderDynamicControls；绘制差异分 renderHorizontal、renderVertical，参考素材在 plugin/js/guide-reference，公用图元和模板在同名 JS。

只改布局时要检查旧配置经 loadConfig 载入后的默认值、手填字段和裁切。导出的画布应使用同一组布局参数。

[模块索引](../../index.md) · [项目记忆](../../../memory.md)
