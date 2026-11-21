---
name: model-viewer
description: 维护 AKEDatabase 的模型查看器模块（model-viewer）。独立查看器与干员详情嵌入共用 akeInitModelViewer；ake-model-viewer.js 管角色、动画选择与播放，ake-renderer.js 提供 endfield-viewer 自定义元素。
---

# 模型查看器

独立查看器与干员详情嵌入共用 akeInitModelViewer；ake-model-viewer.js 管角色、动画选择与播放，ake-renderer.js 提供 endfield-viewer 自定义元素。

## 从哪里开始

- 注册入口 `/?plugin=model-viewer`，隐藏。页面在[model-viewer.html](../../../plugin/model-viewer.html)。
- 相关脚本包括 [ake-renderer.js](../../../plugin/js/ake-renderer.js)、[ake-model-viewer.js](../../../plugin/js/ake-model-viewer.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 挂载独立或嵌入视图 | [ake-model-viewer.js](../../../plugin/js/ake-model-viewer.js) · `akeInitModelViewer` |
| 角色与动画 | [ake-model-viewer.js](../../../plugin/js/ake-model-viewer.js) · `loadSelectedCharacter` |
| 按需加载 | [ake-character-model-viewer.js](../../../plugin/js/ake-character-model-viewer.js) · `rendererScript` |

## 修改与排查

独立页可选角色，详情通过 options.characterId 固定角色。只在嵌入页失败时查 ake-character-model-viewer.js 的按需脚本加载以及容器卸载。

模型资源位于数据域的 endfield-bundles 路径，与普通 Sprite 索引分开；按选中的动画下载资源。切换角色时留意挂起请求和渲染器清理。

[模块索引](../index.md) · [项目记忆](../../memory.md)
