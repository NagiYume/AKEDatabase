---
name: ake-data-tool
description: 维护 AKEDatabase 的 Windows 桌面 AKE Data Tool。用于修改 TableCfg、图片、Json、GlobalBuff 解析、VFS 增量、导出保留、R2 发布计划或断点恢复。
---

# AKE Data Tool

用户操作、安装和配置见[工具说明](../../tools/ake-data-tool/README.md)，开发及发布范围见[工具 AGENTS.md](../../tools/ake-data-tool/AGENTS.md)。网站读到的文件来自不同阶段：下载完成、工作区解析完成、发布到本地 public、上传文件、提交远端索引分别有自己的状态。

## 按问题选调用链

| 入口 | 当前实现 | 修改时要保留的关系 |
| --- | --- | --- |
| GUI、CLI、监听 | [gui.py](../../tools/ake-data-tool/ake_tool/gui.py) 的工作线程和各分页；[cli.py](../../tools/ake-data-tool/ake_tool/cli.py) 的命令分派 | GUI 有标准与完整图片、Json、GlobalBuff 各自的流程；CLI 的 run/stage 走 TableCfg。监听是否上传由配置单独决定。 |
| TableCfg | [pipeline.py](../../tools/ake-data-tool/ake_tool/pipeline.py) 的 Pipeline.run_steps → VfsUpdater → [PythonTableUnpacker](../../tools/ake-data-tool/ake_tool/unpacker.py) → [tablecfg_parser.py](../../tools/ake-data-tool/ake_tool/tablecfg_parser.py) | 两份分区索引提供输入；每个版本的任务快照与持久 VFS 分开。validate 针对实际表输出，本地发布后才进入可选的 upload。改解码器时与 Linux 服务 vendored 实现对照。 |
| 图片 | [image_assets.py](../../tools/ake-data-tool/ake_tool/image_assets.py) 的 prepare_vfs / extract / publish → [image_memory_runner.py](../../tools/ake-data-tool/ake_tool/image_memory_runner.py) → [python_image_runner.py](../../tools/ake-data-tool/ake_tool/python_image_runner.py) | 工作进程使用 vendored UnityPy。standard/full 分别持有筛选规则、输出和 Map 身份；full 比对可参考 standard 历史。内置资源缺失时，使用游戏目录回退前要比对版本化 GameAssembly。 |
| Json | ImageAssetPipeline.prepare_json_vfs / extract_json → [runtime_download.py](../../tools/ake-data-tool/ake_tool/runtime_download.py) → [json_unpacker.py](../../tools/ake-data-tool/ake_tool/json_unpacker.py) → [export_json.py](../../tools/ake-data-tool/ake_tool/json_host/export_json.py) | 解析前为目标 Seed 准备 Windows x64 IL2CPP 运行时。独立子进程有取消、超时和结果报告，核对 selected、written、failed 与 unsupported 的含义。publish_json 按导出目录和根文件保留相对路径。 |
| GlobalBuff | 同一流水线的 prepare_globalbuff_vfs / extract_globalbuff / publish_globalbuff，导出器为 [globalbuff_export.py](../../tools/ake-data-tool/ake_tool/globalbuff_export.py) | 从已验证的 Bundle 相关区块提取，产物到 public/Dump/GlobalBuffData。报告、本地发布状态、文件摘要与目标版本一致后，ReleaseManager 才能建立对应的资产计划。与普通 BuffData 的目录和语义分开。 |
| 远端与元数据 | [release.py](../../tools/ake-data-tool/ake_tool/release.py) 的 upload_table_cfg、plan_asset_sync 和 plan_narrative_metadata_refresh；[asset_index.py](../../tools/ake-data-tool/ake_tool/asset_index.py) | 先分清 TableCfg 的根版本清单、共享资产索引、图片历史 Map。图片计划不会删除历史图片；Json 与 Dump 按各自计划的范围判断差异。只刷叙事元数据时不能连带重传资源内容。 |

## 如何定位中断或遗漏

- **工作副本与校验。** 在工作目录按游戏大版本、Seed、Hotfix 和区块身份查 `vfs-versions.json`、VFS 及任务记录。跨大版本准备工作文件与同大版本补丁的选择顺序见 [VFS 热更新契约](../akedatabase-development/references/vfs-hotfix-updates.md)。一次区块事务必须在候选文件均校验后提升。
- **IL2CPP 运行时缺失。** Json、图片和 GlobalBuff 共用运行时准备。唯一且完整的旧版 Seed 目录可直接复用。否则，从已准备状态保存的 `seed_package_path` 读取鹰角 CDN 的 `game_files`，按清单大小和 MD5 下载缺失文件至 `il2cpp-host-runtime/<game>/downloads/<seed>-<包地址摘要>/`。启动器提供 `game_files_md5` 时同时核对清单摘要。已有准备状态只要保留包地址和 Seed 标识便能继续使用。图片流程还会从该清单选取 Unity 内置资源。
- **1.7.2 Bundle 解码越界。** UnityPy 遇到 `Endfield payload exceeds bounds` 时暂时跳过受影响的图片解析任务，记录根 Bundle、选中的资源路径及异常到本次运行目录的 `skipped-bundles.json`。检查其他 Bundle 的输出时，`image-state.json` 中对应 profile 的 `skippedBundleCount` 标识结果有缺项。正常解析的图片可继续发布，远端 Asset map 等完整重跑后再提交。修复底层格式时核对 `0x80` 标志后的四字节扩展和该类块的载荷解码。
- **Json 个别文件解析失败。** 宿主正常结束、有完整报告且至少写出一个文件时，桌面流程使用成功结果。失败路径和堆栈分别见 `json-output/export-report-0.json` 和 `json-output/.perlica/endfield-json-errors/`。本地发布保留同路径的旧文件，`image-state.json` 的 `json_publish_skips` 让 R2 比较与同步跳过这些路径的文件与索引变更。重跑并发布后按新报告更新跳过范围。
- **图片已解析但无法发布。** 在 `image-state.json` 查对应 profile、版本、parser digest、fullMapPath、deltaMapPath、pendingMapPath 与 deltaExportPaths。规则、解析器或版本变化均可能使之前的计划失效。范围外历史文件保留。累积的 `output/<profile>` 与单次 `image-runs` 用途不同。
- **同一任务重复传输。** 先区分“文件传完”和“清单提交完成”。TableCfg 的 pending 记录在传输前创建，transferComplete 用于续传；共享资产另有同步计划与回读。计划内包含内容上传、覆盖、索引更新和允许的删除，各项分别核对。
- **解析有结果、网站缺条目。** 先跟踪工作目录输出、public 中对应文件、远端计划与索引记录，再定位页面的数据加载器。工具改动的验收证据和历史保留策略见[解析与发布契约](../akedatabase-development/references/data-contracts.md#解析工具的运行与验收边界)。
