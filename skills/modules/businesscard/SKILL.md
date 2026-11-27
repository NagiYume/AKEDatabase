---
name: businesscard
description: 维护隐藏名片预览的主题目录、背景关联与展开和收起布局。
---

# 名片预览

设置中开启隐藏模块后进入 `/?plugin=businesscard`。深链 `/?plugin=businesscard&id=<主题 ID>` 沿用站点的隐藏模块深链规则。入口为 [businesscard.html](../../../plugin/businesscard.html)，[businesscard.js](../../../plugin/js/businesscard.js) 通过 AKECatalog 管理目录、筛选和详情。

- `BusinessCardTopicTable` 的键作为主题和深链 ID，按 `sort` 排列。名称依照 `itemId → ItemTable.name` 本地化，失联记入目录诊断。全站搜索仅依据名片道具的名称和主题外键建立精确跳转。
- 主图在 `arts/ui/sprites/friend/businesscardbg/`。五个通行证主题按 Prefab 中 `ThemeBgImg.imgRefPath` 的实测值映射到异名主图，其余当前主题用主题 ID。换主题横图来自 `themeicon/themechangebg`。现有游戏资源从 `public/images` 读取。
- [布局规则](../../../theme/light.css) 使用固定的 1920 × 1080 坐标再随预览宽度等比缩放。依据 1.7.2 资源快照中的 `FriendBusinessCard`、`FriendBusinessCardTyphoeaPanel` 和 `FriendBusinessBp17Panel`。背景节点有 2320 × 950 底部锚定和 1920 × 1080 居中两种形式。展开显示奖章、展示干员和赛季，收起沿用 `CloseNode` 的右侧箭头占位和左侧资料。这里的两版固定预览独立于主题的 `expand` 默认值。
- 样例玩家和奖章固定，四位干员用 `CharacterTable` 补充名称和职业，依次为 1、2、3、4 潜且均为 90 级。浏览器默认字体，静态渲染。新增主题时按 Prefab 更新必要的图名例外与背景布局分类，排布和装饰细节以现有贴图及可确认的 Prefab 参数为准。
