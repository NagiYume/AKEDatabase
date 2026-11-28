---
name: about
description: 维护 AKEDatabase 的关于模块（about）。页面展示项目说明和赞助等内容。
---

# 关于

页面按根 README 整理项目介绍、数据调用、合作、赞助、致谢、联系方式和免责声明。静态区块由 about.html 管理，三主题样式使用共享组件与关于页作用域。

## 从哪里开始

- 注册入口 `/?plugin=about`，普通入口。页面在[about.html](../../../plugin/about.html)。
- 相关脚本包括 [about.js](../../../plugin/js/about.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 读取名单 | [about.js](../../../plugin/js/about.js) · `loadSponsors` |
| 名单与语言可见性 | [sponsors.json](../../../public/CH/about/sponsors.json) · `languages` |
| 显示名单 | [about.js](../../../plugin/js/about.js) · `renderSponsor` |
| 页面样式 | [light.css](../../../theme/light.css) · `@scope (.ake-about)` |

## 修改与排查

金额使用 `CNY 30.00` 格式。页面按金额数值降序排列，同金额按日期从新到旧。`time` 使用 `YYYY-MM-DD`，日期未知可省略。B 站充电记录填写实际贝壳收益，`method` 为 `bilibiliCharging`。按需填写 `languages`（如 `CH` 和 `TC`），缺省为各语言可见。排序、卡片或加载状态查 `loadSponsors` 和 `renderSponsor`，界面文案和图片替代文本核对中英文 i18n 的 `modules.about`。

页面卡片、站外链接和根 README 有各自维护位置。一次名单数据变更以实际来源文件为准。

[模块索引](../index.md) · [项目记忆](../../memory.md)
