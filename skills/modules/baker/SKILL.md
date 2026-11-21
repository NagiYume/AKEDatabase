---
name: baker
description: 维护 AKEDatabase 的Baker 通讯模块（baker）。SNSChatTable、SNSDialogTopicTable、SNSDialogTable 与 SNSDialogOptionTable 共同描述联系人、话题、消息和选项；ItemTable 用于物品附件。
---

# Baker 通讯

SNSChatTable、SNSDialogTopicTable、SNSDialogTable 与 SNSDialogOptionTable 共同描述联系人、话题、消息和选项；ItemTable 用于物品附件。

## 从哪里开始

- 注册入口 `/?plugin=baker`，普通入口。页面在[baker.html](../../../plugin/baker.html)。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[module-overview.js](../../../plugin/js/module-overview.js)、[baker.js](../../../plugin/js/baker.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 联系人和话题 | [baker.js](../../../plugin/js/baker.js) · `buildRows` |
| 消息与分支 | [baker.js](../../../plugin/js/baker.js) · `renderConversation` |
| 表情素材 | [baker.js](../../../plugin/js/baker.js) · `loadStickerIndex` |

## 修改与排查

列表错分查 buildRows / conversationGroups；分支错序查 preContentId、nextContentId 和 dialogOptionIds，再看 renderConversation。一个联系人可有多个独立对话。

有些表情只能用资产索引加旧范围映射定位。新增表情找不到时保留诊断，不以新图排序推断序号。

[模块索引](../index.md) · [项目记忆](../../memory.md)
