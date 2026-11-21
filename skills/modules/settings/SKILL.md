---
name: settings
description: 维护 AKEDatabase 的全局设置模块（settings）。侧栏底部的设置按钮与弹窗主要在 index-app.js。
---

# 全局设置

侧栏底部的设置按钮与弹窗主要在 index-app.js。清单另注册 settings.html 小页面，settings.js 的 init 只连接本页主题与隐藏开关。

## 从哪里开始

- 注册入口 `/?plugin=settings`，底部设置。页面在[settings.html](../../../plugin/settings.html)。
- 相关脚本包括 [index-app.js](../../../plugin/js/index-app.js)、[settings.js](../../../plugin/js/settings.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 首页设置弹窗 | [index-app.js](../../../plugin/js/index-app.js) · `settingsModal` |
| 怪物属性项目 | [index-app.js](../../../plugin/js/index-app.js) · `modalEnemyAttrEnabled` |
| 模块内基础控件 | [settings.js](../../../plugin/js/settings.js) · `init` |

## 修改与排查

改主题、数据版本、怪物属性项目、打开新标签页等用户日常操作，先定位首页弹窗控件及其配置读写，再找使用该配置的具体模块。

例如属性勾选异常，应核对 modalEnemyAttrEnabled 和下游怪物渲染；只改 settings.html 不会更新首页弹窗。

[模块索引](../index.md) · [项目记忆](../../memory.md)
