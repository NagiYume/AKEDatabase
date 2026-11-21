---
name: inn
description: 维护 AKEDatabase 的缘缘庄模块（inn）。经营和农牧在一个目录内。
---

# 缘缘庄

经营和农牧在一个目录内。life-catalog.js 的 definitions.inn 合并农牧定义，inn.js 以类别呈现菜谱、饮品、主题、干员加成、动物与作物。

## 从哪里开始

- 注册入口 `/?plugin=inn`，普通入口。页面在[inn.html](../../../plugin/inn.html)。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[ake-catalog.js](../../../plugin/js/ake-catalog.js)、[life-catalog.js](../../../plugin/js/life-catalog.js)、[inn.js](../../../plugin/js/inn.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 经营和农牧目录 | [life-catalog.js](../../../plugin/js/life-catalog.js) · `definitions.inn` |
| 制作原料与解锁 | [inn.js](../../../plugin/js/inn.js) · `recipe` |
| 分类卡片挂载 | [inn.js](../../../plugin/js/inn.js) · `mountDetail` |

## 修改与排查

菜品价格取 price，制作时间取 timeCost；材料 ingredient 与 ingredientNum 按位置配对，长度失配会留下诊断。主题解锁沿 unlockTopicId 查 InnTopicTable。

干员加成按规则整组展示，旧 chef 条目仍能定位。较大类别分批渲染，修改卡片时保留切换类别后取消旧批次的行为。

[模块索引](../index.md) · [项目记忆](../../memory.md)
