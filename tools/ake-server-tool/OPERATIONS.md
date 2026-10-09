# AKE Server Tool

独立 Linux TableCfg 服务。项目位于 `tools/ake-server-tool`，与现有 `tools/ake-data-tool` 分开部署；运行不依赖主仓库、Qt、Windows 游戏目录、图片或 Json 解析流程。

## 运行边界

- 只下载 main/initial 索引中的 TableCfg 区块，只调用 `VFSTableCfgExtractor`。
- TableCfg 输出虽然使用 JSON 格式，但不涉及游戏 Json 区块或 `public/Json`。
- 默认每次检查完成后等待 5 秒；登录后可设置 1–86400 秒的整数间隔。失败时退避到最多 300 秒，成功后恢复所设置的间隔。
- 自动监听只轮询官方版本，不再每五分钟重复核验 TableCfg。已完成且 SDK 未变化的版本复用持久完成记录；启动或恢复监听时仅核对远端版本清单，不重新解析、扫描或核验表文件。新版本、未完成任务或 SDK 变化仍执行完整校验；显式 validate/once 命令保留主动核验能力。
- 自动写入仅限 `akedatabase/public/<game>/<hotfix>/TableCfg/**` 及根 `manifest.json` 的版本记录、latest、updatedAt。其他根字段，包括 sharedRevision，原样保留。
- 现存文件不同则拒绝覆盖。缺失文件使用 `If-None-Match: *` 上传；清单使用 ETag / `If-Match` 条件提交，防止丢失并发修改。历史版本已有清单记录时不抢占 latest。
- 不删除 R2 对象，不调用图片、Json、Map 或 asset-sync-index 发布接口。
- 当前官方版本发生变化时，在写入/提交前重新核对；变化则停止旧清单提交并进入下一轮。任务中途崩溃可以复用下载文件、校验过的解析产物和远端已上传文件。
- 所有表逐个验证 JSON。关键表为 ItemTable、CharacterTable、EnemyTable；不是表文件收录白名单。不会把 724 当作固定总数。

## 环境与配置

需要 Python 3.11+、与 SDK 兼容的 JDK 23+。本次实际验证为 Oracle JDK 25.0.4.1；下载后核验官方 SHA-256，来源记录在服务器 `/opt/ake-tablecfg/runtime/jdk-source.json`。后续选择其他 JDK 时重新验证 SDK 兼容性并遵守发行方许可。

在独立虚拟环境安装 `requirements.lock.txt` 可复现本次 Python 依赖。`requirements.txt` 提供允许的版本范围。

配置示例见 `config.example.json`。生产配置位于 `/etc/ake-tablecfg/config.json`，必须显式指定绝对路径。示例默认禁止上传且只绑定回环地址；生产配置已启用上传、绑定 443，并指定正式证书。运行状态、缓存和清单位于 `/var/lib/ake-tablecfg`，没有向代码目录或主仓库 public 写文件。

R2 凭据文件结构为 `endpoint`、`access_key_id`、`secret_access_key` 三个字段；不得放入 Git、日志或浏览器配置。服务器文件由 root 持有，ake-tablecfg 组可读，权限 0640。浏览器访问口令单独存放在 `/etc/ake-tablecfg/status-token`，与 R2 密钥无关。

## 命令

在 `/opt/ake-tablecfg/app` 下使用 `/opt/ake-tablecfg/venv/bin/python`：

```sh
python -m ake_server validate --config /etc/ake-tablecfg/config.json
python -m ake_server probe-r2 --config /etc/ake-tablecfg/config.json
python -m ake_server once --config /etc/ake-tablecfg/config.json
python -m ake_server serve --config /etc/ake-tablecfg/config.json
```

- `validate`：下载、解析、验证、核对远端、生成计划；即使配置启用上传也不上传。
- `probe-r2`：先要求有 validate 报告；读取真实 TableCfg 对象并比对 SHA-256；上传最多 8 MiB 分片后中止，不调用 CompleteMultipartUpload、不提交对象、不更新 manifest。持久化分片 ID 供异常清理。
- `once`：执行一轮；仅配置开启 `upload_enabled` 时允许发布。
- `serve`：启动监听和 HTTPS 状态服务。

所有命令使用同一工作目录排他锁。手工验证前停止本服务，完成后恢复；不要同时运行两个实例。不要停止同机 nginx 或 gi-literal-upload。Windows TableCfg 自动发布应在交接后保持关闭；服务器 CAS 不能让不使用条件写入的旧客户端自动获得并发保护。

每次解析成功先写 `jobs/<identity>/plan.json`，包含版本、SDK 摘要、目标桶/前缀和逐文件摘要，删除列表为空。正式上传前写 pending。清单回读成功后更新 completed，并清除 pending。状态损坏报错，不默认为完成。最多保留配置数量的普通旧任务（至少两份）；带 pending 的旧任务不自动清理，磁盘不足时拒绝新下载。

## systemd

服务文件在 `deploy/`，部署到 `/etc/systemd/system/`。新增专用用户 `ake-tablecfg`；使用独立虚拟环境和 SDK。不升级系统 Python，不修改 nginx、防火墙或已有服务。

```sh
systemctl status ake-tablecfg.service
journalctl -u ake-tablecfg.service -n 80 --no-pager
systemctl stop ake-tablecfg.service
systemctl start ake-tablecfg.service
```

资源限制为 JVM 堆 512 MiB、服务 MemoryHigh 960 MiB、MemoryMax 1 GiB、CPUQuota 100%、禁止 Swap。堆外内存、Python 和文件缓存共同计入服务内存，不应只按 Java 堆设置软限制。CAP_NET_BIND_SERVICE 仅用于绑定独立 443；文件系统只允许写工作目录、任务日志和私有临时目录。

解析连续 180 秒没有完成新的数据块时终止本轮并进入失败退避，仍保留 1800 秒总超时；可通过 extraction_idle_timeout 设置 30–1800 秒。该检测由主进程执行，不是独立于服务内存限制的外部看门狗。

代码更新前停止本服务，备份 `/opt/ake-tablecfg/app` 到另一个版本目录后替换代码，再启动。失败可恢复旧代码目录；工作数据、凭据和证书保持独立。无需改动网站 version.json。自动清理不会删除远端历史版本。

## HTTPS 状态接口

正式地址：`https://server-status.akedata.wiki/`。直接绑定独立 HTTPS 443，不经 nginx。DNS A 记录指向 `aaa.bbb.ccc.ddd`。

- `GET /`：公开状态页面，未登录也展示进度、健康状态、官方/远端版本、检查/完成时间、间隔、自动发布配置、表数量、远端缺失数和错误。
- `POST /api/login`：JSON `{ "token": "<status access token>" }`；成功设置 Secure、HttpOnly、SameSite=Strict 会话 Cookie。
- `GET /api/status`：未登录只返回上述公开字段及监听状态；登录后附加阶段、资源用量和近期事件。返回 authenticated 标识，公开 API 不包含日志或完整配置。
- `POST /api/watch`：仅登录后允许，以 JSON 提交 `{"action":"start"}`、`{"action":"stop"}` 或 `{"action":"interval","interval":5}`。要求 `X-AKE-Control: 1` 请求头和同源 Origin（如提供），不允许 CORS 跨域控制。非法整数、布尔值或超出 1–86400 范围的间隔会被拒绝。
- `GET /healthz`：最小存活/错误状态，不公开日志或配置。
- 页面每两秒拉取一次状态，连接中断时明确显示数据可能过期。所有页面时间固定 UTC+8，不依赖访问者电脑时区；服务新写入的时间戳也使用 +08:00。内存及磁盘余量以 MB 显示（1 MB = 1,000,000 字节），API 保留原始字节值。

监听控制只影响自动任务，不关闭 HTTPS 状态页面。停止时取消当前任务；正在执行的网络请求可以先返回，但在取消检查点停止后续流程。状态在停止期间显示 stopping，完成后显示 stopped；停止尚未完成时拒绝重新启动，避免并发任务。重新启动监听后重新核对远端。

开关、间隔和下载/上传并发数保存在 `/var/lib/ake-tablecfg/watch-settings.json`，不会写入 root 持有的配置文件；服务重启和证书续签后仍保留。修改间隔会唤醒等待中的监听；停止状态下修改间隔不会启动监听。接口没有修改 R2 目标、凭据或直接指定发布内容的能力。

下载和上传默认并发均为 32，允许登录后分别设置 1–64。接口为 `POST /api/watch`，上传 JSON `{"action":"concurrency","concurrency":32}`，下载 JSON `{"action":"download_concurrency","download_concurrency":32}`，认证与同源请求头要求同其他控制接口。每次下载任务/上传批次开始时固定并发数，运行中修改会在下一任务/批次生效。自动更新和独立模拟都读取该持久设置。页面区分当前任务与下次任务配置，并列出同时传输的文件。

下载使用有界线程池和各线程独立 HTTP 会话，保留 .part 断点、重试、大小/MD5 校验与原子替换；重复或冲突目标在调度前拒绝。进度按已完成字节和活动文件字节合计，文件计数为已完成数量。失败后停止派发新文件，已开始任务结束后保留断点。这里的并发数是同时传输的文件任务数量，并非独立操作系统进程数量；服务 TasksMax 调整为 128，为最多 64 个传输线程及状态请求留出余量，内存限制不变。

并发上传对每个文件保留原有条件写入、MD5 和远端完整性校验。上传完成列表在同一互斥锁下更新并原子写入，避免并发损坏断点；任一请求失败会停止派发新文件，已发出的请求结束后保留成功记录，不提交清单。重试只上传未完成文件。总进度按已完成字节加各活动文件字节聚合，不能把并发文件的列表序号当作完成数量。

### 实时任务进度与模拟

公开页面显示任务类型、阶段、当前文件名、文件序号/总数及阶段、字节进度条。下载以两个索引合并后的 TableCfg 文件总数和总字节计数；解析实时读取 SDK 输出，按实际完成的数据块计数；逐表校验显示每张表文件；上传显示正在发送的文件、文件字节数，以及服务器确认完成的文件数。未知总量时显示不定进度，不编造百分比。SDK 详细近期输出仍需登录查看。

模拟任务通过 `/var/lib/ake-tablecfg/replay-status.json` 向页面发布状态，不与暂停的自动监听混淆。文件包含任务标识、进程身份及最新阶段；进程意外退出时页面标记 interrupted，不继续宣称运行中。实际文件传输期间最多约每半秒刷新字节状态，网页每两秒读取。自动任务与模拟任务共用 operation.lock，避免并发发布；模拟运行时禁止从网页启动自动监听。

重传工具是显式的独立命令，不会被自动监听调用：

```sh
python -m ake_server.replay plan --config /etc/ake-tablecfg/config.json --version 1.5.3@10506507-7 --directory /var/lib/ake-tablecfg/replays/<run-id>
python -m ake_server.replay execute --config /etc/ake-tablecfg/config.json --version 1.5.3@10506507-7 --directory /var/lib/ake-tablecfg/replays/<run-id>
```

必须先暂停自动监听。plan 在独立目录重新下载、解析、验证并保存远端 ETag 和原 manifest；execute 实际重传相同内容，使用原 ETag 的 If-Match 条件，完成后只更新该版本 publishedAt 和根 updatedAt，保留一个版本条目。已上传列表持久化，重试只传剩余文件。版本、计划、SDK 或 manifest 身份变化时拒绝继续。

用户为本次模拟指定了“下载、解析、校验之前再次确认”的人工确认点：等待确认期间只展示 waiting_confirmation，不启动 plan 或 execute。2026-10-08 第一轮按用户新要求暂停于 93/724 个文件，尚未提交 manifest；记录保留在 `replays/20261008-1.5.3-10506507-7`。接入实时进度后，下一轮使用新的独立 run-id，回到上述确认点。

API 无 CORS 放行；登录有限流、请求大小/超时限制、连接线程数量上限。浏览器只以 textContent 显示状态，访问口令不放 URL 或 localStorage。更换 status-token 文件并重启本服务可撤销现有会话。

TLS 使用 Let's Encrypt ECC 证书，当前证书到期时间为 2027-01-05。acme.sh 3.1.6 使用独立 TLS-ALPN-01 签发，未使用或重载 nginx。

`ake-tablecfg-certificate.timer` 每日检查剩余有效期；少于 30 天时短暂停止本服务，释放 443，续签后恢复。失败也尝试恢复原服务；只操作新增服务。必须保持域名解析和公网 TCP 443 可达。续签日志见 `journalctl -u ake-tablecfg-certificate.service`。首次签发已成功；自动续签尚未到执行日期，不能把它描述为已实测成功。

## 2026-10-07 验证记录

| 项目 | 实测结果 |
| --- | --- |
| 官方版本 | 1.5.3@10506507-7 |
| Seed/Hotfix 查询 | 约 0.200 秒 |
| CDN 下载 | 201,819,588 字节，10.436 秒，包含文件校验 |
| 解析与全表校验 | 724 张表，308,550,880 字节，39.969 秒 |
| 验证服务总内存峰值 | 894,005,248 字节，约 852.5 MiB；上限 1 GiB |
| R2 内容核对 | 当前版本全部匹配，缺失 0 个 |
| R2 下载 | 30,751,401 字节，4.365 秒，约 6.719 MiB/s |
| R2 上传 | 8,388,608 字节，8.027 秒，约 0.997 MiB/s；测试分片已中止 |
| 已发布对象 | 测速前后 ETag 和 LastModified 未变化 |
| 公网 HTTPS | Windows 客户端获得 200，证书正常验证 |
| 初版状态认证 | 当时未登录 API 401，登录后 200；后续按需求调整为公开基础状态、认证后控制监听 |
| 自动监听 | 服务 active，5 秒间隔，upload_enabled=true |
| 原有服务 | nginx PID 18088、gi-literal-upload PID 22674，与操作前一致，启动时间未变化 |

原始报告：服务器 `/var/lib/ake-tablecfg/validation-report.json`、`transfer-report.json`。解析器原始日志位于相应 job 的 sdk.log。本轮没有新增版本需要发布，所以没有为验证而修改根 manifest；完整新版本发布/条件提交及故障恢复分支尚未做真实故障注入验收。没有运行主站测试、构建、lint 或浏览器自动化。

## 2026-10-08 重传模拟结果

版本 `1.5.3@10506507-7` 已完成重新下载、解析、724 张表校验、条件重传及清单提交回读。运行目录为 `/var/lib/ake-tablecfg/replays/20261008-rerun-1.5.3-10506507-7`，结果见其中的 `replay-report.json`。

串行阶段完成 215 个文件后按用户要求暂停；改为 32 并发后从断点上传剩余 509 个文件，共 262,826,940 字节，上传阶段 27.47 秒，约 9.57 MB/s。该耗时仅对应本次续传，不是全部 724 个文件或完整流程的耗时。最终累计 724/724 个对象完成重传，远端校验通过，于 UTC+8 2026-10-08 00:26:49 完成。版本清单仍只有一个对应版本条目，sharedRevision 和其他清单数据保持不变。

随后恢复原来的 5 秒自动监听，并保留上传并发配置 32。登录状态页面后可修改并发数，范围 1–32，下一上传批次生效；配置跨服务重启保留。已通过真实认证接口设置并在实际续传中使用 32 并发，未执行浏览器自动化。原 nginx 与 gi-literal-upload 进程 PID 保持 18088 和 22674。

## 2026-10-08 内存阻塞修复记录

10:01 开始的解析因 MemoryHigh=850 MiB 触发持续直接回收，Python 主线程停留在 mem_cgroup_handle_over_high；整机仍有可用内存，服务无 OOM kill。提高软限制后状态接口恢复，随后部署 512 MiB Java 堆、960 MiB 软限制及无进度超时。1 GiB 硬限制保持不变。

11:05:30 至 11:06:07 完成版本 1.5.3@10731330-8 的解析、校验和远端核对；本轮服务内存峰值 1,014,087,680 字节，软限制事件 2138 次，未触及硬限制、未发生 OOM kill，未再次持续卡住。这是本版本的运行结果，不代表所有未来版本的内存保证。该版本由用户手动更新，本轮日志没有上传或清单提交；随后按用户要求暂停自动监听，保留状态页面。原 nginx 和 gi-literal-upload 进程未改动。

## 协议代码来源

`ake_server/vendor` 中的下载、索引、协议、模型与文件安全辅助代码，以及 TableCfg Java 启动器，最初取自本仓库 `tools/ake-data-tool/ake_tool` 在提交 `3ec857779af4fe05a95e7f15b882d86c8f095320` 的快照。2026-10-08 同步桌面工具的并发下载器及 ProgressEvent.details，默认 32、最高 64。保留独立副本是为了此目录可单独打包部署，不导入桌面 GUI 或资产发布模块。协议调整时对照上游更新并记录差异。
