---
name: cardgame
description: 维护牌局教学、结算、商店、牌型与多人房间目录。
---

# 牌局

普通入口 `/?plugin=cardgame`。页面 [cardgame.html](../../../plugin/cardgame.html) 使用 [cardgame.js](../../../plugin/js/cardgame.js) 和 AKECatalog。按玩法、遗物、附术、多人房间筛选，界面词条位于 modules.cardgame。

- 巫数乱斗读取 CardGameBlackjack*、CardGameShopGoodsTable、CardGameCardChangTable、CardGameCardEnhanceTable 和 CardGameRelicInfoTable。改牌按 shopGoodsId 与 enhanceType 关联。结算按轮次、名次读取，保留 rank 0。无文案商品保留栏位类型。
- 环带斗牌以 CardGameDoudizhuCardTypeTable 的两个 cardCombine 数组显示主牌和带牌，演出时间读 LandLoardConst。通用样式来自 CardMaterialTable 和 CardGameConst。
- 教学按 GameplayGuideTable.guideGroups 顺序，约定匹配 TextTable 的同玩法、同教学编号前缀，正文按键自然排序。缺少文本的引导组保留缺失状态。
- 多人房间读取 MultiplayerGameConst 的成就外键，NPC 按 templateId、avatarId 关联 CharacterTable、UserAvatarTable。表情按页签 emojiIds 排列，保留未编组表情；图片通过资产索引解析。
- 深链采用 guide:玩法键、relic:遗物键、enhance:附术键，其他分类使用页面固定分类 ID。同步 search-index.js、search-data.js 的用表与精确文本归属。
