---
name: watermark-decoder
description: 维护 AKEDatabase 的图片水印解析器模块（watermark_decoder）。读取用户选择或粘贴的图片，调用 ake-watermark.js 解析，取得的元数据在 renderMetadata 展示。
---

# 图片水印解析器

读取用户选择或粘贴的图片，调用 ake-watermark.js 解析，取得的元数据在 renderMetadata 展示。写入端位于技能弹窗生成器。

## 从哪里开始

- 杂项子入口 `/?plugin=misc&id=watermark_decoder`，需要访问权限。页面在[watermark_decoder.html](../../../../plugin/misc/watermark_decoder.html)。
- 相关脚本包括 [ake-watermark.js](../../../../plugin/js/ake-watermark.js)、[misc-watermark-decoder.js](../../../../plugin/js/misc-watermark-decoder.js)。
- 子页面由[杂项控制器](../../../modules/misc/SKILL.md)挂载。条目子路由由父模块传给 `context.routeId`。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 图片输入 | [misc-watermark-decoder.js](../../../../plugin/js/misc-watermark-decoder.js) · `selectFile` |
| 解析 | [misc-watermark-decoder.js](../../../../plugin/js/misc-watermark-decoder.js) · `decodeSelectedFile` |
| 结果 | [misc-watermark-decoder.js](../../../../plugin/js/misc-watermark-decoder.js) · `renderMetadata` |

## 修改与排查

无结果先区分图片输入/解码失败、未识别出水印和元数据不全；入口函数为 selectFile 与 decodeSelectedFile，算法改动应追共享脚本。

读取侧需兼顾历史输出与不同画布比例。该工具在杂项清单中受访问条件约束；普通读图不需要查询游戏表。

[模块索引](../../index.md) · [项目记忆](../../../memory.md)
