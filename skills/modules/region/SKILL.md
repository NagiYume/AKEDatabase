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
| 基建区域 | [region.js](../../../plugin/js/region.js) · `loadFactoryAreas`、`renderFactoryArea` |
| 靶场关联 | [region.js](../../../plugin/js/region.js) · `buildArcheryData` |
| 矿点明细 | [region.js](../../../plugin/js/region.js) · `renderMineDetails` |

## 修改与排查

矿点条目与每分钟产量异常时分别核对场景、纯度、设备和地区等级增产阈值 isMineOutputUp；文件版本参与新增判断，同文件内矿点可能共用标记。

renderMineDetails、renderSettlementSection 与 renderFacilitySection 分别负责不同数据。日期或矿点版本问题先核对所选数据基线，再改显示。

## 基建区域

- 从 `DomainDataTable.levelGroup` 枚举场景，用 `FactoryMainRegionTable[场景].list[].{id,index}` 关联 `FactoryPanelStoreTable.{regionId,regionIndex}`，按 `sortId` 展示。商品的 `currencyType` 和 `cost` 决定花费。场景名称用 `LevelDescTable.showName`，已有的据点名称按 `SettlementBasicDataTable.{domainId,domainLevelId,facRegionIndex}` 挂到对应卡片。
- 展开栏目后，从资产索引读取本场景的 `*_lv_data.json`、`*_lv_data_sub_factory*.json`、`*_lv_data_sub_fac.json`。最后一种命名见源石研究园。以 `FactoryLevelRegionTable[场景].list` 匹配 `factoryRegions[].regionId`，再以主区域索引匹配 `areas[].index`。各级面积来自 `levelData[].levelBounds[].size.x/z`，多段范围分别呈现。缺失或冲突时显示面积不可用，控制台给出来源诊断；请求失败时收起后重新展开可重试。
- `goodType=1` 为面积升级，效果 3000 的参数依次为商品关联区域、目标等级、区域索引。`goodType=2` 为仓库存取线。武陵效果 5122 按参数中的设备和增量读取 `FactoryFreeBusTable.name`，同下标的 `busFreeShowCounts` 是升级前数量，和增量相加得到该设备的新上限；该次未变化的设备沿用已有值。四号谷地效果 5114 建造配置好的线路段。条件 5003 指向 `FacSTTNodeTable`，5046 指向前置商品，分别使用两张 FacPanelStore 描述表解析条件和效果。控制台报告无法关联的前置项与未适配枚举。
- `DomainDataTable.domainDevelopmentLevel[].domainDevelopmentLevelEffect[场景].bandwidth` 是地区建设的场景容量，地区等级产量使用该字段。据点管理读取 `SettlementBasicDataTable.settlementLevelMap[].bandwidth`。
- 2026-11-27 的用户截图给出旧水坝 `288/288`，提示对应 `ErrorCodeTable[2737]`（`ErrFactoryPlaceBuildingLimit`），包含待建造设备。2736 是用另一条提示展示的设备压力限制。客户端 `CommonToastConfig.lua::processFacNodeLimit` 将参数 0、1 分别格式化为当前量、上限。关卡文件和已读取的 TableCfg 尚未找到 2737 上限的来源，因此按用户要求撤下设备数量上限的页面展示。
- 全站搜索对商品、已显示的效果与条件、免费线路设备和相关科技名称使用同一商品到地区的关联。关卡文件内容由资产索引加载。

[模块索引](../index.md) · [项目记忆](../../memory.md)
