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

## 危机合约数据

- `ActivityContingencyContractTable.gameId → ContingencyContractTable.contractGroupMap.contractMap.tagId → CcTagTable` 决定词条收录；`CcTagTable.name.id`、`desc.id` 是可能超出 JavaScript 安全整数范围的文本 ID。任务则从活动的 `activityId` 经 `ActivityConditionalMultiStageTaskConfigTable.TaskConfigMap.taskGroupId` 关联任务组。按实际记录和精确 ID 匹配，不能从名称或排序推断关系。
- `plugin/js/v2-cc.js` 的 `attachContractValues` 读取数据域 `public/<gameId>.json`，用资产索引 `ccData.files` 的 MD5 作为请求版本；本地 `public/cc_data/` 不纳入 Git。schema 1 的 `tags` 同时兼容第一期 `tagTerms` 和第二期服务端 `text.name`、`text.desc` 多语言数组及 `serverBlackboards`。文件和索引的游戏版本与网站版本、其他资产 revision 独立。
- 本会话对 1.6 的游戏二进制分析和实际抓包表明：消息 2550 `ScSyncMultiLangConfig` 的 repeated bytes 字段 1 是多语言正文；当次数据采用 `lz4:<解压长度>:<Base64>`，解压为文本 ID 到 14 语言字符串数组，简中下标 0、英文下标 1。消息 2551 `ScSyncClientConfig` 的 `config_type=1` 下发词条黑板；当次块经 Protobuf 解析得到 `tagId` 和有序黑板，不应把 bytes 在 JSON 里显示成 Base64 误认为内部格式就是 JSON。不能由黑板值反推效果类型或 Buff ID。
- 描述可能以 `{key:格式}` 或 `{@其他tagId@表达式:格式}` 引用值。`buildBlackboardValueMap` 优先读取服务端有序黑板，再用已知 `tagTerms` 补充，重复键保留首个值；`replacePlaceholders` 处理跨词条引用。未找到的值保持未解析，不能把缺失当成 0，也不能把 Buff 默认参数当作正式合约值。实际敌人计算另需可靠的 Buff 映射，`mappingUnavailable` 是明确缺口，不因抓到文本和黑板就自动补全。
- 合约副本关系为 `gameId → DungeonTable.dungeonSeriesId`，同一系列可包含多个 `gameId`。共用的系列详情返回系列内全部关卡，合约页应在 `v2-cc.js` 按当前 `gameId` 选出关卡，再消费场景刷怪数据；不能改成让所有副本调用方只收到一个关卡。

## 怪物变种与属性计算

- 先由 `EnemyTable.attrTemplateId → EnemyAttributeTemplateTable` 取得对应等级的原始属性；`EnemyTable.attrModifiers` 属于怪物变种自身的修正，先单独结算，再把结果作为后续 Buff 的基础值。出生 Buff、刷怪器 `enemyLibrary[].bornBuffList` 和已选合约指标 Buff 在后续阶段按其属性与乘区聚合；条件性脚本 Buff 仅在对应预览中参与，不视为恒定生效。具体生效范围仍须以关联和实际条件为准。
- `plugin/js/ake-stats.js` 的 `analyzeAttrWithModifiers` 接收独立的 `variantModifiers`；同阶段 `BaseMultiplier`、`Multiplier` 按 `max(1 + 各项之和, 0)` 聚合，`BaseFinalMultiplier`、`FinalMultiplier` 按值相乘。各阶段顺序为基础加算、基础乘算、基础最终加算、基础最终乘算、加算、乘算、最终加算、最终乘算；原始属性覆盖在相应阶段的修正之前。`combineModifiers` 的展示汇总应与该聚合方式一致。公式仅在系数小于零时显示 `max`，保留变种与 Buff 的括号边界。
- 危机合约 `v2-cc.js` 的初次卡片和切换指标刷新、副本及影拓丰碑 `v2-dungeon.js`、敌人 `v2-enemy.js`、战争回响 `season-tower.js` 经 `ake-enemy-renderer.js` 或直接调用共享计算器；修改其中一侧时同时追踪其他入口。合约中 `enemyIdPrefix` 约束图片映射的目标敌人；`buff_cc_eny_damage_resist` 的 `DuringBuffEnable → OverrideRawAttributeAction.attributeOverrides` 是原始抗性覆盖，不是普通加成。
- 对照算例：60 级 `eny_0097_hsmino2_cc`，模板生命 297005、变种 `attrModifiers` 的 `Multiplier` 为 1.5；第二期刷怪器对该敌人传入 `buff_common_maxhpup.ratio=0.3`，已映射指标 `buff_cc_enemy_common_hp_up_mult.hp_up=1.2`，期望 `(297005 × (1 + 1.5)) × (1 + 0.3 + 1.2) = 1856281.25`。参见 `public/TableCfg/EnemyTable.json`、`EnemyAttributeTemplateTable.json`、`public/Json/SpawnerConfig/indie_ccdg002/` 和 `public/cc_data/indie_contract002.json`。这是静态算例；完整属性上下限钳制、条件效果和游戏内结果仍需核验，不能宣称已完整模拟战斗。

## 解析工具的运行与验收边界

- TableCfg 的桌面实现位于 `tools/ake-data-tool/ake_tool/tablecfg_parser.py`、`unpacker.py`；服务端在 `tools/ake-server-tool/ake_server/vendor/` 保留副本，由 `tablecfg_extract.py` 独立进程调用。修复协议或错误处理时核对两套调用方。完整解析成功后才替换正式导出，取消或失败不能暴露半成品；服务健康、进程退出成功、文件数相同均不能单独证明解析内容等价。
- 服务端 `worker.py` 的计划和完成记录绑定 `parser_sha256`，`replay.py` 同样需要当前解析器身份。迁移时允许已发布且未变化版本的旧 SDK 完成记录通过既有检查，以免仅更换解析器就重复发布；新任务或显式 replay 仍按 Python 指纹生成计划。查 `legacy_completed` 的全部条件，不要把旧记录兼容扩展为绕过校验。发布状态应读取 `Storage.commit()` 返回的实际远端 manifest，历史版本发布不一定改变远端 `latest`。
- Json 的 Python 入口是 Windows x64 IL2CPP 宿主：`json_unpacker.py::resolve_json_runtime()` 要求唯一且完整的版本运行时；`REQUIRED_RUNTIME` 包含 `GameAssembly.dll`、`UnityPlayer.dll`、`baselib.dll`、`Endfield.exe`、metadata 与资源文件。`json_host/icalls.json` 也属于必要宿主资源。去除 Java/JAR 不等于去除游戏 DLL，不能据此宣布 Linux 原生支持；解析格式还涉及 MemoryPack、字符串池、转换器与游戏后处理。
- Json 路由依据实际载荷和运行时类型维护在 `json_host/schemas.py`。未知项保留报告，StringPool 等已识别辅助输入与未支持项分开统计。扩展路由先检查解密正文格式、managed 类型及是否需要后处理；文件名不保证与类型同名。检查 native 类型时先以 `class_from_type()` 将 `Il2CppType*` 转为 class，再传 `type_name()`，混用指针曾导致诊断进程访问冲突。
- 获得解析验证授权时，可先做每类小样本，再跑完整流水线；使用独立输出及隔离状态，记录 VFS/运行时版本、选中数、成功数、失败数、未支持与辅助项。复读产出 JSON 并检查根及关键字段，不把成功数视为完整语义证明；无实际样本的类型保留未验证状态。子进程由调用方直接管理取消和超时，完整报告成功后才提升输出并撤销旧发布授权。解析验证与上传 R2 是独立动作，本会话“不要上传 R2”适用于当次验证，不是全仓禁止发布规则。

## 桌面增量发布与历史保留

以下边界来自桌面 `ake-data-tool` 的单用户串行使用决定及提交 `c2baaf55`，不自动适用于服务端或多个进程同时修改同一输出。该优化当次仅静态复读，未完成运行回归。

- **分清生成、移动与复制**　追踪磁盘开销时看实际 `write`、`copy_file_contents`、`rename/os.replace` 调用。Json 独立解析目录提升为 `json-output` 不复制内容；字符串池暂存属于解析辅助输入。TableCfg 和 Json 的本地发布共用 `file_copy.py::sync_tree_contents()`，只复制变化文件，保留解析源供重试；单文件仍临时写入后替换。其清理旧文件发生在对应目录文件写入成功后，整批发布不具备事务回滚，中断可能留下新旧混合结果，须重跑发布完成后再上传。不能把“完整解析后提升输出”与“整个 public 原子切换”混为一谈。
- **图片范围**　独立运行的增量文件移动至持久素材目录，同卷重命名，跨卷才复制后删除源。发布依据 `deltaExportPaths`，不重新扫描整个历史素材库；`output/<profile>/assets` 是累积库，`image-runs/<profile>` 才是历史运行记录。历史运行目录保留不代表保留每次完整素材快照。Map 摘要、配置与状态身份、上传前 `(size, md5)` 比较仍有意义，图片远端历史文件不因本地历史清理而删除。
- **共享缓存边界**　`file_facts.py` 供下载、文件复制、Map 摘要、资产索引和 TableCfg 验证复用；按路径、设备/文件身份、大小、纳秒时间、模式和链接数判定文件状态，最多 65,536 项，仅进程内有效，重启不继承信任。下载将已计算的 MD5 交给正式文件，复制可复用或边写边计算摘要，不能把这种复用写成“完全取消校验”。`asset_index.py::_json_meta()` 的 Mission 元数据还依赖同名 `_meta.json`，缓存身份必须包含该 sidecar 的存在与状态。新增依赖时同步扩展失效条件；不假定刻意保持全部文件元信息的外部改写可被发现。
- **续传标记兼容**　`release.py::upload_table_cfg()` 的 pending 包含 `version`、`remote` 和 `transferComplete`；新流程传输前写 false，完成后写 true，再提交 manifest。旧 marker 当初只在成功传输后生成，故缺字段按 true 兼容；不能将这一解释用于其他任意旧状态。传输中断、数据已传完但清单未提交是两个不同恢复阶段。
- **清理触发与统计**　`export_history.py::prune_exports()` 按目录修改时间保留历史；有保护引用时优先保留，保护数量超过上限时不会强删。TableCfg 在下载或解析阶段处理 `jobs`，单位是版本任务，`keep_job_files=false` 仍可在发布后移除当前任务；图片/Json 由 `run_steps()` 的 finally 调用 `_prune_export_history()`，仅选择对应解析步骤才触发，失败尝试也参与保留。Json 有当前输出时保留 2 个历史、无当前输出时保留 3 个；旧验证目录须含 `data` 或 `output/data` 才纳入，另纳入旧诊断 `output`。启动 GUI 本身不触发；图片/Json 清理异常会记录日志待下次解析重试。需要证明磁盘已清理时，应读取日志及实际目录，不能只凭代码已合入或解析成功推断。

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
