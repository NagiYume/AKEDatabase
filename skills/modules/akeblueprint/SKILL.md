---
name: akeblueprint
description: 维护 AKEBluePrint 跨服蓝图转换工具的站外导航入口。
---

# AKEBluePrint

[模块清单](../../../plugin/manifest.json)的 `akeblueprint` 条目使用 `externalUrl`，在桌面和移动导航中直接链接至 [AKEBluePrint](https://blueprint.akedata.wiki/)。访问 `/?plugin=akeblueprint` 时由[应用控制器](../../../plugin/js/index-app.js)重定向。修改目标地址时改清单中的 HTTPS 链接。

[搜索用表索引](../../../plugin/js/search-index.js)记录此入口的来源。转换功能由目标站点维护，无本站 HTML 片段、TableCfg 用表或条目路由。

[模块索引](../index.md) · [项目记忆](../../memory.md)
