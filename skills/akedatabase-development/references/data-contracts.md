# 数据契约与例外

## 来源与收录

| 范围 | 关联与收录规则 |
| --- | --- |
| v3 列表 | `v3-table-data.js` 的各 manifest 从主表枚举；装备以 EquipTable 检查单件收录，不仅检查套组 |
| 活动通用阶段/奖励 | `ACTIVITY_DETAIL_TABLES` 声明数据源，按 activity ID 关联；不按 panelId 限制通用表读取 |
| 活动特殊结构 | 无 activity ID 的生日阶段表仍按对应 panel 分派；`dungeon_fighting` 的专有表没有通用归属字段，不推测其他活动归属 |
| 装备配方 | `EquipFormulaTable.level -> EquipFormulaChainTable.chainList`；一个配方可有多条材料组合，两个页面共用 `AKEV3.equipmentRecipeVariants` |
| 工业环境 | `FactoryEnvDisplayTable.GenEnv`、`EnvIconAtlas`；两个页面共用 `AKEV3.factoryEnvironment` |
| 战争回响 | `SeasonTowerTable.weeks.includeGameIdList -> SeasonTowerGameGroupTable.stars.gameId -> DungeonTable.sceneId`；按场景读取资产索引，不固定系列/场景/星数 |
| 资产 | `akeAssetIndex` 的 Json 与 images 数据集；失败请求淘汰缓存，后续调用可以重试 |

主表默认必需。仅显式 `{ optional: true }` 的表允许 HTTP 404 返回空对象；网络、其他 HTTP 状态、解析和结构错误仍失败。可选模式与必需模式分别缓存。历史基线必需表失败时，由差分调用方降级为不标记差分。

## 明确保留的例外

- 环境文本 ID 和颜色：来自现有四环境显示映射，`FactoryEnvDisplayTable` 本身没有名称/颜色字段。本轮只合并实现，不将特效资源名视为颜色证据。适用于已映射的 GenEnv 1-4；未知值显示 `gasEnv ID`，标记 `unmapped`，不排除配方。
- Baker `sns_emoji_NNN`：旧八包顺序容量来自已有实现，当前 SNS 表未提供该序号到分包资源的明确关系。优先匹配资产索引中同名资源；旧范围保持原映射，新序号不按新增图片的排序猜测。未解析 ID 留在页面并可查看诊断。
- 商店每日轮换：现有 21 日排期、2026-01-22 起点及刷新偏移是沿用的历史排期，不声称由 TableCfg 推导或已获当前版本验证。商品列表仍由商店/奖励表枚举；排期未覆盖商品进入诊断，不能按表中顺序编造日期。周轮换的相邻稀有度配对仍是已有约定，需有明确排期源后再替换。
- 战争回响周时间 ID 仍遵循现有 `time_activity_seasontower_season_<season>_week_<week>` 约定，赛季周表没有显式 timeId；缺失时间不显示为进行中。有多个 ActivitySeasonTower 活动但无赛季关联时，使用模块名称而不任取一个活动。

## 手动诊断

这些调用会加载当前选择数据源的表，仅由用户主动执行，不在正常浏览时运行。先打开任一使用 AKEV3 的模块，在浏览器控制台执行：

```javascript
const report = await window.AKEV3.auditCoverage();
console.log(JSON.stringify(report, null, 2));
```

也可传 `['activity', 'item']` 限定范围。报告包含主表数量、实际适配列表数量、明确排除项、缺失/额外 ID、活动阶段覆盖、装备配方断链和表加载状态。`state: 'error'` 不等于零条数据。

此报告目前覆盖九类 v3 兼容适配器，不代表独立模块和所有奖励类型均已完整审计。它调用实际列表与活动详情构造函数，新增源表类型仍需要维护适配器与诊断；不能用报告无缺失证明未知玩法已被理解。

```javascript
window.AKEV3.getTableDiagnostics();
window.__akeBakerDiagnostics?.(); // 打开 Baker 后查看已展示内容中未解析的表情
window.__akeShopController?.getRotationDiagnostics(); // 打开商店后检查旧排期与当前商品
```

公共脚本修改时，应追踪 `index.html` 的启动脚本、模块 HTML 中的直接依赖和 `misc.js` 的动态加载入口，更新实际受影响模块版本。
