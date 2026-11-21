---
name: about
description: 维护 AKEDatabase 的关于模块（about）。页面展示项目说明和赞助等内容。
---

# 关于

页面展示项目说明和赞助等内容。about.html 管理静态区块，about.js 通过 akeFetch 读取 public/CH/about/sponsors.json，渲染赞助列表并处理空列表。

## 从哪里开始

- 注册入口 `/?plugin=about`，普通入口。页面在[about.html](../../../plugin/about.html)。
- 相关脚本包括 [about.js](../../../plugin/js/about.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 读取名单 | [about.js](../../../plugin/js/about.js) · `loadSponsors` |
| 显示名单 | [about.js](../../../plugin/js/about.js) · `renderSponsors` |

## 修改与排查

名单变动先查 sponsors.json，排序、卡片或空状态查 loadSponsors / renderSponsors；界面文案和图片替代文本还需核对对应 i18n 键。

页面卡片、站外链接和根 README 有各自维护位置。一次名单数据变更以实际来源文件为准。

[模块索引](../index.md) · [项目记忆](../../memory.md)
