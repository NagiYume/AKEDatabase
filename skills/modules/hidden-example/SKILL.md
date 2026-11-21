---
name: hidden-example
description: 维护 AKEDatabase 的隐藏模块示例模块（hidden-example）。清单中仍启用的隐藏占位片段，hidden.html 只包含带 data-i18n 的空状态文字，无独立控制器或数据请求。
---

# 隐藏模块示例

清单中仍启用的隐藏占位片段，hidden.html 只包含带 data-i18n 的空状态文字，无独立控制器或数据请求。

## 从哪里开始

- 注册入口 `/?plugin=hidden-example`，隐藏。页面在[hidden.html](../../../plugin/hidden.html)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 占位文案 | [hidden.html](../../../plugin/hidden.html) · `data-i18n` |
| 导航登记 | [manifest.json](../../../plugin/manifest.json) · `hidden-example` |

## 修改与排查

调整提示改 modules.hidden.testTitle 的语言资源；排查显隐检查主清单 hidden 和导航配置。页面自身只承担示例显示。

需要创建有业务数据的新页面时走模块创建 skill，选择具有相近列表与生命周期的业务页面作为参考。

[模块索引](../index.md) · [项目记忆](../../memory.md)
