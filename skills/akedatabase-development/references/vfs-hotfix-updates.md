# VFS 热更新补丁契约

来源是 2026-11-03 至 11-05 的补丁会话、串行实现 `66a42277` 及后来收录并行改动的 `6dbcda26`。这是游戏资源更新器约定，不是网站发版规则。交付和验证状态见[项目记忆](../../memory.md#工具链与增量处理)。

## 资源与候选匹配

- 从 launcher 的 `get_latest_resources` 返回值读取当版 `resources.path`；补丁清单为其下 `patch.json`，补丁 URL 为 `resources.path + '/Patch/' + candidate.patch`，`Patch` 大小写有意义。直接把补丁相对路径接到 `files/` 的假设已被 404 与正确路径的实际下载推翻，不硬编码某次 Hotfix 的随机 CDN 目录。
- 在 `11343132-9` 样本中，124 个目标的大小与 MD5 均与 main/initial 完整索引并集吻合，`diffType` 均为 1。它是部分文件的差分计划，不是完整 VFS 清单；BLC 和未覆盖目标仍按完整索引处理，不外推其他 diffType 兼容性。
- 目标 `name` 是不带 `VFS/` 的相对路径，目标 `size/md5` 校验结果；`patch[]` 的 `base_file/base_size/base_md5` 标识候选旧文件，`patch/patch_size` 标识补丁。多个候选是可选基线，不是依次执行的补丁链；不能仅凭版本号或看似哈希的文件名认定基线相符。main 与 initial 资源版本相同时，main 清单可能覆盖 initial 目标。
- 当次补丁由 HDiffPatch 5.1.3 的 `hpatchz old.chk diff new.chk` 成功应用，样本头为 `HDIFFSF20`。实现先找 `AKE_HPATCHZ_PATH` 或 PATH，否则下载并校验固定版本工具归档；工具不可用也应回退完整文件。应用后必须校验目标大小及 MD5。

## 版本、持久化与共享调用

- 工作根下 `VFS/` 保留补丁基线；`vfs-versions.json` 的 schema 1 按 `blocks` 记录 `gameVersion/seedVersion/hotfixVersion/mainVersion/initialVersion`、`verified` 和 `files` 的大小/MD5。只更新本次实际准备的区块，不能把整个工作根标成同一新版。
- `VfsUpdater.mode()` 以 `gameVersion` 判定是否同一资源大版本；未知基线、首次初始化、跨大版本不用补丁。目标文件已正确时先复用工作文件；只有完整初始化模式允许桌面从游戏目录复制。普通热更新补丁失败也不能转去游戏目录，而是下载目标原文件。服务端不配置游戏目录。
- 旧 `vfs_validation_records` 仅在记录的 `vfsRoot` 指向当前持久 VFS 且记录已验证时导入身份；导入后仍标为未验证并重新校验。解析 job 快照不应作为持久 VFS 的版本证明。
- 桌面 TableCfg 的 `pipeline.py`、图片/Json 的 `image_assets.py` 与服务端 `worker.py` 消费相同更新策略。Json 依赖 TableCfg、Json、InitialExtendData、ExtendData；图片涉及 Bundle、InitialBundle、BundleManifest。服务器该次部署仍只承担 TableCfg，更新器共享不意味着服务器新增 Json 解析能力。
- 持久 VFS 与解析 job 快照分离，旧任务清理不能先删除补丁基线。每区块先在 `vfs-staging/` 准备并校验所有输出，再记录 `verified=false` 和目标 `pending`，逐文件 `os.replace`，CHK 先于 BLC；成功后清旧文件并写新版本。单文件替换是原子的，整区块不是事务回滚：提升中断可能混合新旧文件，必须依赖 pending/未验证状态重试，不能声称取消在任意阶段都会恢复旧区块。工作根 `.vfs-update.lock` 由操作系统锁保护。

## 并行维护边界

两侧 `vfs_update.py::_patch_batch()` 使用最多 `min(4, downloader.concurrency, jobs数)` 个固定 worker，每个文件内部仍按下载 → 应用 → 校验执行，不同文件重叠。不是下载器 32 路与应用器 4 路的独立双队列。共享清单/工具准备使用资源锁，实际下载由下载器独立会话完成；回调串行调用、统计累加受锁保护，同一基线的摘要计算按路径串行。

delta 临时文件以资源路径、目标名、补丁路径组合的 SHA-256 命名，避免复用候选时互相覆盖及 Windows 长路径问题；规范化目标路径不得重复。异常或取消停止派发，等待活动线程退出后再清理或提升；可恢复的补丁失败留给完整下载。改变调度时同时检查两端调用方，当前副本已有后续差异，勿整文件互相覆盖。

## 小样本诊断入口与证据限制

获得验证授权后，先用隔离基线、输出和状态做小样本。已验证的官方样本：TableCfg 旧文件 `42A8FCA6/0E700A084A75431674C44490772CA79A.chk`，旧 MD5 `ca36ffb2445212cba08286cac3c4b75c`；目标 `42A8FCA6/6293F2DEACBD94B42D66CE749689D160.chk`，44 字节补丁生成 68,316 字节，目标 MD5 `9d8f4f564cc1afa4854cc0a3c703e4ee`，目标 Hotfix `11343132-9`。历史 CDN 路径可从 `tools/ake-data-tool/logs` 查版本响应；临时 fixture 是否仍存在需先确认。

串行版七项覆盖成功、同版复用、坏补丁回退、跨大版本游戏复制、跨大版本服务器下载、错误基线、应用阶段取消。Linux 曾因工具下载超时回退完整文件而未进入取消注入点；复用已校验的 hpatchz 后才实际覆盖该路径。诊断必须确认走到了待测分支，不能把 fallback 成功当作 patch 成功。

并行实现尚缺本会话运行验收，后续优先检查多个目标共用旧文件、补丁失败混合成功、取消及重跑、两端差异。少量真实补丁成功只证明样本与更新器分支，不证明完整 TableCfg/Json 解析或吞吐提升；清单估算节省量也不包含未覆盖文件、重试和工具下载。
