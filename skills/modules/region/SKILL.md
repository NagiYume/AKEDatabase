---
name: region
description: 维护 AKEDatabase 的地区建设模块（region）。buildDomain 以地区为单位聚合建设等级、据点、设施、矿点和奖励；矿点还读 LevelData 索引元数据。
---

# 地区建设

buildDomain 以地区为单位聚合建设等级、据点、设施、矿点和奖励；矿点还读 LevelData 索引元数据。靶场条目由 buildArcheryData 单独组织。

## 从哪里开始

- 注册入口 `/?plugin=region`，普通入口。页面在[region.html](../../../plugin/region.html)。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[ake-asset-index.js](../../../plugin/js/ake-asset-index.js)、[region.js](../../../plugin/js/region.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 地区聚合 | [region.js](../../../plugin/js/region.js) · `buildDomain` |
| 靶场关联 | [region.js](../../../plugin/js/region.js) · `buildArcheryData` |
| 矿点明细 | [region.js](../../../plugin/js/region.js) · `renderMineDetails` |

## 修改与排查

矿点条目与每分钟产量异常时分别核对场景、纯度、设备和地区等级增产阈值 isMineOutputUp；文件版本参与新增判断，同文件内矿点可能共用标记。

renderMineDetails、renderSettlementSection 与 renderFacilitySection 分别负责不同数据。日期或矿点版本问题先核对所选数据基线，再改显示。

[模块索引](../index.md) · [项目记忆](../../memory.md)
