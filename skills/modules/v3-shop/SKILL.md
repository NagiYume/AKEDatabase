---
name: v3-shop
description: 维护 AKEDatabase 的商店模块（v3_shop）。按商店组打开详情，组内可切换分店；商品经商店配置、ShopGoodsTable、RewardTable 与 ItemTable 展开。
---

# 商店

按商店组打开详情，组内可切换分店；商品经商店配置、ShopGoodsTable、RewardTable 与 ItemTable 展开。现金商店及调度渠道有自己的关联。

## 从哪里开始

- 注册入口 `/?plugin=v3_shop`，普通入口。页面在[v3_shop.html](../../../plugin/v3_shop.html)。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[module-overview.js](../../../plugin/js/module-overview.js)、[v3-shop.js](../../../plugin/js/v3-shop.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 分店归属 | [v3-shop.js](../../../plugin/js/v3-shop.js) · `shopsForGroup` |
| 商品来源 | [v3-shop.js](../../../plugin/js/v3-shop.js) · `rawGroupProducts` |
| 轮换排期 | [v3-shop.js](../../../plugin/js/v3-shop.js) · `prepareWeeklyRotations` |

## 修改与排查

商品不见时先核对 shopsForGroup 和 rawGroupProducts，再看 renderProduct 的价格、限购与解锁条件。物资调度等级与升级消耗在 renderChannelTimeline / renderChannelUnlocks。

武库轮换含历史排期例外。新增商品应继续收录；排期无法覆盖的商品保留诊断，详见开发 skill 的数据契约。

专项依据见[排期例外](../../akedatabase-development/references/data-contracts.md)。

[模块索引](../index.md) · [项目记忆](../../memory.md)
