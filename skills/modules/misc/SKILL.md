---
name: misc
description: 维护 AKEDatabase 的杂项模块（misc）。父模块从 plugin/misc/manifest.json 注册并过滤子页面。
---

# 杂项

父模块从 plugin/misc/manifest.json 注册并过滤子页面。路由由子模块 ID 与可选条目组成，例如 `recipe_flow_viewer/<条目>`，父路由固定为 misc。

## 从哪里开始

- 注册入口 `/?plugin=misc`，普通入口。页面在[misc.html](../../../plugin/misc.html)。
- 相关脚本包括 [misc.js](../../../plugin/js/misc.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 解析子条目 | [misc.js](../../../plugin/js/misc.js) · `parseRoute` |
| 加载与切换 | [misc.js](../../../plugin/js/misc.js) · `loadSubmodule` |
| 生成子路由 | [misc.js](../../../plugin/js/misc.js) · `buildRoute` |

## 修改与排查

新增或改名从 normalizeManifest、parseRoute、buildRoute 与 loadSubmodule 查；子控制器通过 AKEMisc.register 注册，事件和计时器优先使用 context 提供的清理接口。

父模块有请求取消与 loadGeneration 检查；快速切换时旧任务应释放。子页 HTML 使用 pluginversion.misc，脚本按对应路径的 jsversion 加载。

[模块索引](../index.md) · [项目记忆](../../memory.md)
