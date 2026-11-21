---
name: research
description: 维护 AKEDatabase 的研究模块（research）。中文文章清单为 public/CH/research/manifest.json；loadResearchManifest 建目录，loadDocDetail 读取 Markdown，parseMarkdown 与 buildToc 负责正文及目录。
---

# 研究

中文文章清单为 public/CH/research/manifest.json；loadResearchManifest 建目录，loadDocDetail 读取 Markdown，parseMarkdown 与 buildToc 负责正文及目录。

## 从哪里开始

- 注册入口 `/?plugin=research`，普通入口。页面在[research.html](../../../plugin/research.html)。
- 相关脚本包括 [module-overview.js](../../../plugin/js/module-overview.js)、[research.js](../../../plugin/js/research.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 文献目录 | [research.js](../../../plugin/js/research.js) · `loadResearchManifest` |
| 正文 | [research.js](../../../plugin/js/research.js) · `loadDocDetail` |
| 标题导航 | [research.js](../../../plugin/js/research.js) · `buildToc` |

## 修改与排查

文章不可见先查清单里的 id、分类、顺序和正文路径；标题跳转或行内内容有误再查本模块 Markdown 解析。新增正文也要落实清单条目。

研究文章可能包含预测和未证实公式。将段落用于页面计算前回查游戏配置或用户确认，保留文中适用版本。

[模块索引](../index.md) · [项目记忆](../../memory.md)
