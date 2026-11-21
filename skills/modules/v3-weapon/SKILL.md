---
name: v3-weapon
description: 维护 AKEDatabase 的武器模块（v3_weapon）。weaponManifest / weaponDetail 合并常规武器和 ForesightWeaponTable 的前瞻数据，按武器条目展示攻击成长、词条、基质推荐与阶段材料。
---

# 武器

weaponManifest / weaponDetail 合并常规武器和 ForesightWeaponTable 的前瞻数据，按武器条目展示攻击成长、词条、基质推荐与阶段材料。

## 从哪里开始

- 注册入口 `/?plugin=v3_weapon`，普通入口。页面在[v3_weapon.html](../../../plugin/v3_weapon.html)。页面调用 `AKEV3.activate('weapon')`，先由适配器生成数据，再交给控制器。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[module-overview.js](../../../plugin/js/module-overview.js)、[ake-advanced-links.js](../../../plugin/js/ake-advanced-links.js)、[v2-weapon.js](../../../plugin/js/v2-weapon.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 建立武器清单 | [v3-table-data.js](../../../plugin/js/v3-table-data.js) · `weaponManifest` |
| 组装详情 | [v3-table-data.js](../../../plugin/js/v3-table-data.js) · `weaponDetail` |
| 培养阶段 | [v2-weapon.js](../../../plugin/js/v2-weapon.js) · `renderBreakthrough` |
| 前瞻 | [v2-weapon.js](../../../plugin/js/v2-weapon.js) · `renderForesightWeaponDetail` |

## 修改与排查

清单有条目、详情缺材料时，在适配器核对武器键及阶段关系，再看 renderBreakthrough。前瞻详情走 renderForesightWeaponDetail，不能假定有满级面板或大立绘。

词条或技能链接改动需兼顾关联到该武器的干员详情；显示公式在控制器处理，原始数值保留供点击追溯。

[模块索引](../index.md) · [项目记忆](../../memory.md)
