---
name: factory
description: 维护 AKEDatabase 的工业设施图鉴模块（factory）。factory.js 的 specifications 声明不同设施专表，build(c) 以 buildingId 等稳定键将输送、电力、仓储、生产与流体参数归并至建筑。
---

# 工业设施图鉴

factory.js 的 specifications 声明不同设施专表，build(c) 以 buildingId 等稳定键将输送、电力、仓储、生产与流体参数归并至建筑。

## 从哪里开始

- 注册入口 `/?plugin=factory`，隐藏。页面在[factory.html](../../../plugin/factory.html)。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[ake-catalog.js](../../../plugin/js/ake-catalog.js)、[factory.js](../../../plugin/js/factory.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 设施类型数据 | [factory.js](../../../plugin/js/factory.js) · `specifications` |
| 各规格参数容器 | [factory.js](../../../plugin/js/factory.js) · `unitData` |
| 关联与收录 | [factory.js](../../../plugin/js/factory.js) · `build` |

## 修改与排查

目录中有设施但缺性能参数，先查该类型是否在 specifications 中，再看 unitData 对 beltData、pipeData、liquidUnitData、gridUnitData 的解包。

同一建筑可有多个来源。扩展规格时保留来源与单位，并对照科技树里的建筑/物品链接。隐藏模块开关影响能否从导航进入。

[模块索引](../index.md) · [项目记忆](../../memory.md)
