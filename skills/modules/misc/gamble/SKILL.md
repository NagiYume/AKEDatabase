---
name: gamble
description: 维护 AKEDatabase 的百趣演武模块（gamble）。life-catalog.js 的 definitions.gamble 按 hand、card、pool、effect、milestone、period 建立六类条目，gamble.js 将同类条目集中展示。
---

# 百趣演武

life-catalog.js 的 definitions.gamble 按 hand、card、pool、effect、milestone、period 建立六类条目，gamble.js 将同类条目集中展示。

## 从哪里开始

- 杂项子入口 `/?plugin=misc&id=gamble`，杂项内。页面在[gamble.html](../../../../plugin/misc/gamble.html)。
- 相关脚本包括 [v3-table-data.js](../../../../plugin/js/v3-table-data.js)、[ake-catalog.js](../../../../plugin/js/ake-catalog.js)、[life-catalog.js](../../../../plugin/js/life-catalog.js)、[gamble.js](../../../../plugin/js/gamble.js)。
- 子页面由[杂项控制器](../../../modules/misc/SKILL.md)挂载。条目子路由由父模块传给 `context.routeId`。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 类别业务内容 | [life-catalog.js](../../../../plugin/js/life-catalog.js) · `renderGamble` |
| 牌型视觉 | [gamble.js](../../../../plugin/js/gamble.js) · `handVisual` |
| 单条内容 | [gamble.js](../../../../plugin/js/gamble.js) · `content` |

## 修改与排查

牌型图示 showIcon 与 showNumber 按位置对应；卡片关联敌人、牌型 Buff 或池子时沿各自关联字段展开。改收录先看 definitions，再改分类内的卡片。

从独立入口迁入杂项后，旧条目与搜索命中仍需定位到相应分类中的条目。保留 kind:source-key，不按类别标题作身份。

[模块索引](../../index.md) · [项目记忆](../../../memory.md)
