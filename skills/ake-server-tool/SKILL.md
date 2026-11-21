---
name: ake-server-tool
description: 维护 AKEDatabase 的 Linux TableCfg 服务。适用于调整监听、提取、对象比对、条件发布、回放与状态显示。
---

# Linux TableCfg 服务

服务独立监听官方游戏版本，只处理 TableCfg。操作入口见[运维说明](../../tools/ake-server-tool/OPERATIONS.md)。当前提取器以 [tablecfg_extract.py](../../tools/ake-server-tool/ake_server/tablecfg_extract.py) 和依赖锁为准，使用 Python 子进程加载 vendored PythonTableUnpacker。

| 调整内容 | 从哪里追踪 |
| --- | --- |
| 监听频率、取消、失败重试或展示的版本 | [worker.py](../../tools/ake-server-tool/ake_server/worker.py) 管理持久设置、进度、版本身份与阶段转换。[status.py](../../tools/ake-server-tool/ake_server/status.py) 提供状态界面所用的服务端入口。区分官方最新版本、正在处理的版本和远端已发布版本。 |
| 表解析或 VFS 补丁差异 | 提取子进程报告进度并计算 parser_digest；[vendored 源码](../../tools/ake-server-tool/ake_server/vendor)与桌面工具有共同实现。服务端没有本地游戏安装目录，回退到完整下载。对照[VFS 热更新契约](../akedatabase-development/references/vfs-hotfix-updates.md)。 |
| 已传文件、冲突与 latest 指针 | [storage.py](../../tools/ake-server-tool/ake_server/storage.py) 的 compare、publish、commit 分阶段执行。区分创建缺失对象与条件提交清单；已有文件冲突、版本切换或 ETag 变化时保留冲突信息。 |
| 历史任务和恢复 | [replay.py](../../tools/ake-server-tool/ake_server/replay.py) 负责回放，worker 有独立任务目录与进度。先核对任务身份与 checkpoint；正常监听、回放、实际部署应分别记录证据。 |

桌面工具还负责图片、Json、GlobalBuff 与共享资产索引，这些操作由 [AKE Data Tool](../ake-data-tool/SKILL.md) 维护。服务器运行状态和部署版本须由对应时点的运行证据确认。
