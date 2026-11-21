---
name: tutorial
description: 维护 AKEDatabase 的教学百科模块（tutorial）。WikiGroupTable / WikiCategoryTable 提供目录；WikiEntryDataTable 与 WikiTutorialPageTable 是主要记录。
---

# 教学百科

WikiGroupTable / WikiCategoryTable 提供目录；WikiEntryDataTable 与 WikiTutorialPageTable 是主要记录。教程页同时从 tutorialId 和 WikiTutorialPageByEntryTable.pageIds 建立反查。

## 从哪里开始

- 注册入口 `/?plugin=tutorial`，隐藏。页面在[tutorial.html](../../../plugin/tutorial.html)。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[ake-asset-index.js](../../../plugin/js/ake-asset-index.js)、[ake-catalog.js](../../../plugin/js/ake-catalog.js)、[tutorial.js](../../../plugin/js/tutorial.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 教程条目与页面集合 | [tutorial.js](../../../plugin/js/tutorial.js) · `build` |
| 多来源教程页合并 | [tutorial.js](../../../plugin/js/tutorial.js) · `pagesByTutorial` |
| 关联敌人 | [tutorial.js](../../../plugin/js/tutorial.js) · `refMonsterTemplateId` |

## 修改与排查

某页只在一种关系中出现时检查 pagesByTutorial 的合并和去重；图鉴还可指向物品、敌人模板、Prts 档案。空外键不应导致整个教程不可见。

同一教程有多页，条目 ID 与页 ID 用途不同。图片缺失时先核对素材路径与索引，再考虑调整页面。

[模块索引](../index.md) · [项目记忆](../../memory.md)
