---
name: v3-archive
description: 维护 AKEDatabase 的档案库模块（v3_archive）。buildIndexes 汇合 Prts 系列表、RichContentTable、RadioTable、地图与关卡脚本引用，生成可按类别和地区定位的条目。
---

# 档案库

buildIndexes 汇合 Prts 系列表、RichContentTable、RadioTable、地图与关卡脚本引用，生成可按类别和地区定位的条目。阅读弹窗类型有时需经 ReadingPopUpTable 转成正文 contentId。

## 从哪里开始

- 注册入口 `/?plugin=v3_archive`，普通入口。页面在[v3_archive.html](../../../plugin/v3_archive.html)。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[module-overview.js](../../../plugin/js/module-overview.js)、[ake-voice-player.js](../../../plugin/js/ake-voice-player.js)、[v3-archive.js](../../../plugin/js/v3-archive.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 来源聚合 | [v3-archive.js](../../../plugin/js/v3-archive.js) · `buildIndexes` |
| 关卡阅读引用 | [v3-archive.js](../../../plugin/js/v3-archive.js) · `indexedReadingReferences` |
| 情报采集 | [v3-archive.js](../../../plugin/js/v3-archive.js) · `renderInvestigation` |

## 修改与排查

缺正文时分别检查内容引用、资产索引元数据及实际源文件。地图调查、任务文本、音像逐句字幕与情报采集使用不同的条目身份，按标题合并会丢失来源。

标题本地化补全曾引起修改误标。调整差分时对照 readingEntrySignatures；保留对话顺序、分支及多处引用。深入步骤见 TableCfg 的 narrative-analysis.md。

专项依据见[叙事收录与差分](../../tablecfg-analysis/references/narrative-analysis.md)。

[模块索引](../index.md) · [项目记忆](../../memory.md)
