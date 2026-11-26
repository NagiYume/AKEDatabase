---
name: search
description: 维护 AKEDatabase 的全站搜索模块（search）。search.js 管输入与结果视图，search-index.js 声明模块可能使用的表，search-data.js 将远端文本命中关联到具体业务条目。
---

# 全站搜索

search.js 管输入与结果视图，search-index.js 声明模块可能使用的表，search-data.js 将远端文本命中关联到具体业务条目。

## 从哪里开始

- 注册入口 `/?plugin=search`，置顶搜索。页面在[search.html](../../../plugin/search.html)。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[life-catalog.js](../../../plugin/js/life-catalog.js)、[search-index.js](../../../plugin/js/search-index.js)、[search-data.js](../../../plugin/js/search-data.js)、[search.js](../../../plugin/js/search.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 文本 ID 精度 | [search-data.js](../../../plugin/js/search-data.js) · `parseResponse` |
| 记录归属 | [search-data.js](../../../plugin/js/search-data.js) · `targetsFor` |
| 结果分组 | [search.js](../../../plugin/js/search.js) · `groupedResults` |
| 高级搜索与分页 | [search.html](../../../plugin/search.html) · `searchAdvanced`，[search.js](../../../plugin/js/search.js) · `renderResults` |

## 修改与排查

查不到先区分远端接口无命中、版本不符、候选模块不可见、命中未归属四种情况。精确跳转应同时满足文本 ID、源记录路径和业务外键。

结果按可见主模块的导航优先级升序分节，同优先级沿用清单顺序。模块内按条目 ID 合并文本命中并保留首次出现顺序，归属未确认的命中统一放在末尾并保留候选提示。高级搜索的下拉选项来自当前结果中已确认归属的模块。选择模块后在当前结果上筛选并回到第一页，更换关键词后恢复全部结果。返回搜索时可从有效的会话记录恢复原筛选和页码。

接口 Id 可能超出 JS 安全整数。缓存按关键词、语言及数据源版本隔离。模块内拼音筛选由 ake-module-search.js 单独处理。

[模块索引](../index.md) · [项目记忆](../../memory.md)
