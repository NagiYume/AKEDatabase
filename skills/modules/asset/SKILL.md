---
name: asset
description: 维护 AKEDatabase 的资产模块（asset）。资产页使用统一索引中的 Json 与图片文件记录构建目录树，展示目录统计、搜索、预览、下载与版本标记。
---

# 资产

资产页使用统一索引中的 Json 与图片文件记录构建目录树，展示目录统计、搜索、预览、下载与版本标记。路径别名只用于显示。

## 从哪里开始

- 注册入口 `/?plugin=asset`，普通入口。页面在[asset.html](../../../plugin/asset.html)。
- 相关脚本包括 [ake-asset-index.js](../../../plugin/js/ake-asset-index.js)、[asset.js](../../../plugin/js/asset.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 版本维度 | [asset.js](../../../plugin/js/asset.js) · `parseAssetVersion` |
| 文件记录与标记 | [asset.js](../../../plugin/js/asset.js) · `makeFile` |
| 停止旧列表 | [asset.js](../../../plugin/js/asset.js) · `stopProgressiveRender` |

## 修改与排查

文件找不到时先核实 dataset、相对路径与大小写；再查 fileUrl、entryPath 和目录/搜索过滤。新增标记检查 parseAssetVersion 及所选游戏大版本或 Hotfix 基线。

选择文件夹后采用渐进渲染，切换目录要停止旧任务。索引 revision 与单个文件 version 意义不同，后者不能直接拼成历史文件下载路径。

[模块索引](../index.md) · [项目记忆](../../memory.md)
