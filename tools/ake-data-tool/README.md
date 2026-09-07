# AKE Data Tool

AKE Data Tool 用于获取《终末地》最新热更新索引，准备 VFS，调用
`beyond-sdk.jar` 解析 TableCfg、Json 和图片，并将结果发布到 AKEDatabase 的
`public` 目录。需要时，工具还可以通过 rclone 将 TableCfg、Json 和图片上传到
Cloudflare R2。

工具只会从游戏安装目录复制文件，不会移动、修改或硬链接游戏文件。工作目录中的
VFS 也是独立内容副本。

## 功能概览

- 查询官方当前游戏版本、Seed、Hotfix 和 `rand_str`
- 下载并解密 `main`、`initial` 索引，支持重试、续传、大小和 MD5 校验
- 优先复用版本及校验值匹配的本地游戏资源，缺失时再从 Hotfix 下载
- 使用 `beyond-sdk.jar` 解析 TableCfg、Json 和图片
- 允许 beyond-sdk 在自身任务需要时下载 VFS、IL2CPP 运行时和其他依赖
- 将解析结果发布到 `public/TableCfg`、`public/Json` 或 `public/images`
- 通过 rclone 管理 R2 上的 TableCfg 版本和 `manifest.json`
- 比较并以本地图片、Json 或两者为准同步 R2
- 支持通过本地 `asset-sync-index.json` 比较资产差异
- 在资产同步前后检查整个 R2 Bucket 的容量，10 GB 上限包含安全余量
- 提供手动更新、自动监听、图片解析、Json 解析、资产上传和 R2 版本管理分页
- 将 TableCfg、图片和 Json 任务日志写入本工具根目录的 `logs` 文件夹

## 一、准备运行环境

### 1. Python

建议安装 64 位 Python 3.10 或更高版本，并确保安装时启用“Add Python to PATH”。
首次使用，在 `tools/ake-data-tool` 中运行：

```powershell
.\setup-venv.bat
```

脚本会创建 `.venv`，并安装以下依赖：

- `requests`：访问官方 Seed/Hotfix 接口并下载资源
- `PyQt6`：图形界面

之后运行：

```powershell
.\run-gui.bat
```

也可以在该目录中手动启动：

```powershell
python -m ake_tool.cli gui
```

### 2. Java 和 beyond-sdk

TableCfg、Json 和图片解析都需要 `beyond-sdk.jar`。请准备：

- 与当前 `beyond-sdk.jar` 兼容的 64 位 Java
- 当前版本的 `beyond-sdk.jar`
- 足够的内存或虚拟内存；图片和 Json 解析使用 `-Xmx32G`

如果 `java.exe` 已加入 `PATH`，“Java 命令”填写 `java` 即可；否则填写完整路径，例如：

```text
C:\Program Files\Java\jdk-21\bin\java.exe
```

`beyond-sdk.jar` 可以放在任意目录，随后在“工具配置”中选择实际文件。

### 3. 磁盘空间

统一工作目录会保存索引、Hotfix 缓存、独立 VFS 副本和解析输出。图片 VFS 本身可能超过
36 GiB，建议为工作目录预留至少 50 GiB 可用空间。不要将统一工作目录设为磁盘根目录，
也不要将它放在游戏的 `StreamingAssets` 或 `Persistent` 目录内部。

### 4. rclone（仅 R2 功能需要）

只在使用以下功能时需要 rclone：

- TableCfg 上传到 R2
- 自动监听后上传到 R2
- 图片或 Json 资产差异比较及同步
- 读取或删除 R2 TableCfg 版本

只发布到本地 `public` 时可以不安装 rclone，并保持“上传到 R2”未勾选。工具不随源码
附带 rclone，请从 rclone 官方发布包中取得 `rclone.exe`，解压后在“工具配置”中选择其
完整路径。rclone 不必加入系统 `PATH`。

## 二、配置 Cloudflare R2 和 rclone

### 1. 准备 R2 信息

在 Cloudflare 控制台中准备以下信息：

- Account ID
- R2 S3 API Endpoint，格式通常为
  `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- R2 Access Key ID
- R2 Secret Access Key
- Bucket 名称，例如 `akedatabase`

创建 R2 API Token 时，建议将权限限制在要使用的单个 Bucket。工具需要读取、列出、上传、
覆盖和删除对象，因此完整使用 R2 功能时需要该 Bucket 的 Object Read & Write 权限。不要使用
Cloudflare 的网页公开域名（例如 `https://data.example.com`）作为 Endpoint；rclone 需要的是
R2 的 S3 API Endpoint。

### 2. 创建 rclone Remote

在 PowerShell 中进入 `rclone.exe` 所在目录，然后运行：

```powershell
.\rclone.exe config
```

按交互提示配置：

1. 选择 `n`，新建 Remote。
2. Remote 名称填写 `r2`，或者使用你自己的名称。
3. Storage 类型选择 `s3`。
4. Provider 选择 `Cloudflare`。
5. `env_auth` 选择 `false`，使用后续输入的密钥。
6. 填写 R2 Access Key ID。
7. 填写 R2 Secret Access Key。
8. Endpoint 填写 `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`。
9. Region 留空或使用 rclone 为 Cloudflare 提供的默认值。
10. ACL 使用默认值或 `private`。
11. 一般不需要高级配置，确认并保存 Remote。

rclone 不同版本的选项编号可能不同，应根据选项名称选择，不要照抄编号。创建后的配置结构
大致如下，密钥值以本机 rclone 实际保存的内容为准：

```ini
[r2]
type = s3
provider = Cloudflare
access_key_id = <R2_ACCESS_KEY_ID>
secret_access_key = <R2_SECRET_ACCESS_KEY>
endpoint = https://<ACCOUNT_ID>.r2.cloudflarestorage.com
acl = private
```

可以用下面的命令查看 rclone 实际使用的配置文件位置：

```powershell
.\rclone.exe config file
```

不要把 `rclone.conf`、Access Key 或 Secret Access Key 提交到仓库，也不要把密钥写进
`config.local.json`。AKE Data Tool 只保存 Remote 名称和 Bucket 名称，认证信息始终由
rclone 自己读取。

### 3. 进行只读连通性检查

以下命令不会上传、覆盖或删除对象：

```powershell
.\rclone.exe listremotes
.\rclone.exe lsd "r2:"
.\rclone.exe lsf "r2:akedatabase" --max-depth 1 --s3-no-check-bucket
```

预期结果：

- `listremotes` 中存在 `r2:`
- `lsd "r2:"` 能列出目标 Bucket
- `lsf` 能列出 Bucket 根目录内容

如果 Remote 或 Bucket 使用了其他名称，需要同步替换命令中的 `r2` 和 `akedatabase`。

### 4. 填入工具配置

在“工具配置”分页填写：

| 界面字段 | 示例 | 含义 |
| --- | --- | --- |
| `rclone` | `D:\Program Files\rclone\rclone.exe` | `rclone.exe` 的完整路径 |
| `rclone Remote` | `r2` | `rclone config` 中 `[r2]` 的名称，不带冒号 |
| `R2 Bucket` | `akedatabase` | Bucket 名称，不带 Remote、冒号或目录路径 |

不要在 `rclone Remote` 中填写 `r2:akedatabase`，也不要在 `R2 Bucket` 中填写
`public/images`。工具会自动组合出以下目标：

```text
r2:akedatabase/manifest.json
r2:akedatabase/public/<游戏版本>/<Hotfix>/TableCfg
r2:akedatabase/public/images
r2:akedatabase/public/Json
```

“读取远端版本”和“比较本地与远端”只读取 R2。“按本地资产同步到 R2”、TableCfg 的
“上传”步骤以及“删除远端版本”会修改远端数据；资产同步还会删除远端存在但本地不存在的对象。

## 三、工具配置分页

首次启动会在 `tools/ake-data-tool` 中生成 `config.local.json`。推荐通过 GUI 的“工具配置”
分页修改配置。点击“保存配置”会保存整个页面的全部配置，包括图片正则规则，不是只保存
当前输入框或当前分页。

### 基础路径和网络设置

| 字段 | 建议配置 | 说明 |
| --- | --- | --- |
| `AppCode` | 保持项目当前有效值 | 用于访问官方 Seed/Hotfix 接口；不能为空或包含空格 |
| `rclone` | `rclone.exe` 的完整路径 | 只在 R2 操作中检查文件是否存在 |
| `public` | AKEDatabase 根目录下的 `public` | TableCfg、Json 和图片的本地发布根目录 |
| `main`、`initial` | 两项都勾选 | beyond-sdk 的 TableCfg 流程强制要求两部分索引 |
| `TableCfg` | 勾选 | 当前 TableCfg 流程只允许该区块 |
| `MD5 校验` | 勾选 | 按官方索引校验资源内容，建议始终启用 |
| `保留任务文件` | 按需 | 保留工作目录中的任务输入和输出，便于续传和单步调试 |
| `超时` | `60` 秒 | 单次网络请求超时，允许范围为 10–600 秒 |
| `重试` | `3` | 下载失败后的最大尝试次数，至少为 1 |

`public` 必须指向正确的仓库目录。配置错误会把发布目标指向其他位置，因此首次配置时应
特别检查路径末尾确实是 `AKEDatabase\public`。

### beyond-sdk 与游戏资源

| 字段 | 建议配置 | 说明 |
| --- | --- | --- |
| `beyond-sdk.jar` | 当前 SDK 文件的完整路径 | TableCfg、Json 和图片解析共用 |
| `Java 命令` | `java` 或 `java.exe` 完整路径 | 必须能启动 64 位 Java |
| `StreamingAssets` | 游戏的 `Endfield_Data\StreamingAssets` | 可选的本地资源来源 |
| `Persistent` | 游戏的 `Endfield_Data\Persistent` | 可选的本地热更新资源来源 |
| `统一工作目录` | 独立且空间充足的目录，如 `E:\AKEImageWork` | 保存所有任务输入、缓存、状态和解析输出 |

游戏目录不存在或留空时，工具不会因此报错，而是从最新 Hotfix 下载缺失资源。存在游戏目录时，
工具只会读取并复制版本匹配的文件；不会在游戏目录中移动、修改、删除文件，也不会创建硬链接。

工作目录不能是磁盘根目录，不能等于游戏资源目录，也不能位于游戏资源目录内部。每次准备 VFS
时都会检查工作副本是否为独立文件。

当前各解析流程准备的区块为：

| 流程 | VFS 区块 | 区块 ID |
| --- | --- | --- |
| TableCfg | `TableCfg` | `42A8FCA6` |
| Json | `Json`、`InitialExtendData`、`ExtendData` | `775A31D1`、`D6E622F7`、`3C9D9D2D` |
| 图片 | `Bundle`、`InitialBundle`、`BundleManifest` | `7064D8E2`、`0CE8FA57`、`1CDDBF1F` |

工具会在启动 beyond-sdk 前优先准备并校验这些资源，但不会禁止 SDK 的下载请求。若 SDK 判断
VFS、IL2CPP 运行时或其他内部依赖仍然缺失，可以继续从官方来源下载并写入统一工作目录。

### 自动监听设置

| 字段 | 说明 |
| --- | --- |
| `监听间隔` | 1–86400 秒，决定检查官方 Hotfix 的频率 |
| `启动时检查更新` | 启动监听后立即读取当前版本；没有已发布基线时，第一次只建立初始版本，不触发更新 |
| `上传到 R2` | 勾选后才在发布到 `public/TableCfg` 后继续上传 R2；未勾选时只发布本地 |

自动监听只处理 TableCfg，不会自动解析或上传 Json 和图片，也不会修改仓库根目录的
`version.json` 或执行 Git 操作。

### 手动版本设置

通常保持“手动版本”关闭，让工具跟踪官方当前版本。需要处理历史版本时才启用，并填写：

- 游戏版本：三段式版本号，例如 `1.2.5`
- `rand_str`：该游戏版本对应的值
- 上传后设为 R2 latest：只有明确要把历史版本切换成线上最新版本时才勾选

手动模式中的 R2 游戏版本取自生成的 Hotfix URL 的 `version` 参数，Hotfix 版本取自
`main.version`。自动监听始终忽略手动版本输入。

### 图片筛选规则

图片解析分页中的 `containers_filter` 决定 beyond-sdk 解析哪些容器。推荐使用规则表维护：

- “包含”规则加入允许解析的路径或正则片段
- “排除”规则从包含结果中剔除路径或文件
- 修改规则表后，工具会重新生成最终正则
- 点击“恢复默认”可恢复项目维护的默认素材目录
- 保存工具配置时，规则表和生成后的最终正则会一起写入 `config.local.json`

输入框既接受纯正则，也接受完整的 `--containers_filter "正则"` 参数。默认路径带有目录边界，
例如 `charremoteicon` 不会意外匹配 `charremoteicon700`。物品、敌人和奖章等同时存在大小图标时，
默认规则只解析项目使用的大图目录。

除非已经确认网站需要新目录，否则不要扩大默认规则。图片发布会以本次解析的 `output/assets`
为来源，错误的规则会带来额外解析和上传内容。

### 资产差异设置

“资产上传”分页可分别勾选图片、Json，或同时选择两者。

- 未勾选“本地差异比对”：直接枚举并比较本地和 R2 对象
- 勾选“本地差异比对”：使用统一工作目录中的 `asset-sync-index.json`，按路径、大小和 MD5 比较
- 本地索引只在资产成功同步到 R2 后更新
- 已完成一次比较且配置未变化时，正式同步复用当前差异计划，不会再次比较
- Json 同步前需要先执行“生成/更新 Json 索引”
- 差异列表会完整显示新增、覆盖和删除项

`asset-sync-index.json` 是 R2 当前资产状态的本地快照。不要在不确定远端状态时手工修改它；如果
本地索引可能过期，应取消“本地差异比对”，重新与远端比较。

正式同步会让远端 `public/images` 或 `public/Json` 与本地对应目录一致，包含删除远端多余文件。
同步前请仔细查看完整差异列表。工具会计算整个 Bucket 的当前容量和预计容量，并为上限保留
1 MB 安全余量；达到限制时拒绝上传。

## 四、直接编辑 config.local.json

只有在 GUI 无法启动或需要批量迁移配置时，才建议直接编辑 `config.local.json`。可以参考
`config.example.json`。常用结构如下：

```json
{
  "appcode": "6LL0KJuqHBVz33WK",
  "rclone_path": "D:\\Program Files\\rclone\\rclone.exe",
  "public_dir": "D:\\path\\to\\AKEDatabase\\public",
  "parts": ["main", "initial"],
  "blocks": ["TableCfg"],
  "request_timeout": 60,
  "retries": 3,
  "verify_md5": true,
  "keep_job_files": true,
  "watch_interval": 60,
  "watch_update_on_start": true,
  "watch_upload_r2": false,
  "manual_version_enabled": false,
  "manual_seed_version": "",
  "manual_rand_str": "",
  "manual_publish_latest": false,
  "r2_remote": "r2",
  "r2_bucket": "akedatabase",
  "asset_local_compare": false,
  "image_sdk_path": "D:\\path\\to\\beyond-sdk.jar",
  "java_path": "java",
  "game_streaming_assets_dir": "E:\\path\\to\\Endfield_Data\\StreamingAssets",
  "game_persistent_dir": "E:\\path\\to\\Endfield_Data\\Persistent",
  "image_work_dir": "E:\\AKEImageWork",
  "image_verify_md5": true
}
```

JSON 中的 Windows 反斜杠必须写成 `\\`。关闭 GUI 后再手工编辑；GUI 保存配置时会用当前页面的
完整值覆盖文件。`required_tables` 和图片规则等未在上面展开的字段应保留
`config.example.json` 中的现有值。

可通过以下命令查看工具当前读取到的配置和配置文件位置：

```powershell
python -m ake_tool.cli config
```

该命令只显示配置，不连接官方服务器或 R2。

## 五、首次配置后的使用顺序

1. 运行 `setup-venv.bat`，再运行 `run-gui.bat`。
2. 在“工具配置”中填写 `public`、Java、`beyond-sdk.jar` 和统一工作目录。
3. 有本地游戏文件时填写 `StreamingAssets` 和 `Persistent`；没有时可留空。
4. 需要 R2 时完成 rclone Remote 配置，再填写 rclone、Remote 和 Bucket。
5. 点击“保存配置”。
6. TableCfg 使用“手动更新”或“自动监听”。
7. 图片和 Json 分别在各自解析分页执行准备、解析和发布步骤。
8. 需要上传共享资产时，在“资产上传”中选择图片、Json，先生成 Json 索引并比较差异，再同步。

TableCfg 完整流程为：

```text
检查版本 -> 准备 VFS -> beyond-sdk 解析 -> 验证 -> 发布 public -> 可选上传 R2
```

Json 发布只替换解析输出中与现有 `public/Json` 子目录同名的目录，其他输出不会发布。图片发布
使用本次解析的 `output/assets`，并完整替换 `public/images/assets`。

## 六、命令行用法

命令必须在 `tools/ake-data-tool` 目录中运行：

```powershell
python -m ake_tool.cli check
python -m ake_tool.cli run
python -m ake_tool.cli run --steps download,unpack,validate
python -m ake_tool.cli stage publish
python -m ake_tool.cli stage upload
python -m ake_tool.cli config
```

TableCfg 可用步骤为：

```text
check, download, unpack, validate, publish, upload
```

单步执行依赖上一步已经在同一工作目录中产生有效状态和文件。`upload` 会写入 R2；只需要本地
结果时不要包含该步骤。

## 七、工作目录和日志

假设统一工作目录为 `E:\AKEImageWork`，主要内容如下：

```text
E:\AKEImageWork\
├─ VFS\                         # 图片和 Json 的独立 VFS 工作副本
├─ output\                      # 图片解析输出
├─ json-output\                 # Json 解析输出
├─ indexes\                     # 当前 Hotfix 的 main/initial 索引
├─ hotfix-cache\                # 缺失资源的下载缓存
├─ jobs\                        # TableCfg 任务输入和解析输出
├─ il2cpp-host-runtime\         # TableCfg 解析所需的本地运行时缓存
├─ image-state.json             # 图片和 Json 分步任务状态
├─ state.json                   # TableCfg 成功步骤状态
├─ asset-sync-index.json        # 可选的本地资产差异快照
├─ release-pending\             # TableCfg 发布未完成标记
└─ r2-delete-pending\           # R2 版本清理未完成标记

tools\ake-data-tool\logs\
├─ table-job-*.log
├─ image-job-*.log
└─ json-job-*.log
```

解析或下载新版本时，工具会清理工作目录中的旧版本任务数据和旧解析输出，不创建旧数据备份。
日志固定存放在 `tools/ake-data-tool/logs`，不会写入统一工作目录。调用 beyond-sdk 前，完整命令行
会同时显示在 GUI 日志和对应日志文件中。

## 八、常见配置错误

### `rclone 不存在`

“工具配置”中的 `rclone` 必须指向实际的 `rclone.exe` 文件，而不是安装目录。只做本地发布时，
取消所有 R2 上传操作即可。

### `didn't find section in config file` 或找不到 Remote

`rclone Remote` 与 `rclone config` 中的名称不一致。运行 `rclone listremotes`，将显示的名称去掉
末尾冒号后填入工具。

### `AccessDenied`、`Unauthorized` 或 `403`

检查 Access Key、Secret Access Key、R2 Endpoint 和 Bucket 权限。需要完整同步和版本管理时，
Token 必须允许目标 Bucket 的对象读写和删除。

### `bucket not found` 或目标路径重复

`R2 Bucket` 只能填写 Bucket 名称，例如 `akedatabase`，不能填写 `r2:akedatabase`、URL 或
`akedatabase/public`。

### `beyond-sdk.jar 不存在`

选择实际 JAR 文件，不要只填写所在目录。TableCfg、Json 和图片的解析步骤都会使用同一个配置。

### Java 无法分配 32 GB 内存

确认使用 64 位 Java，并确保系统有足够的物理内存或页面文件。图片和 Json 解析固定使用
`-Xmx32G`。

### SDK 开始下载 VFS 或 IL2CPP 依赖

这是允许的行为。AKE Data Tool 会优先准备已知资源，但不再向 beyond-sdk 传入
`--no-vfs-update`，也不在 IL2CPP 缓存缺失时提前终止。可在 `tools/ake-data-tool/logs` 中查看
完整 SDK 命令和下载输出。

### 工作目录配置无效

不要填写磁盘根目录，也不要填写 `StreamingAssets`、`Persistent` 或它们的子目录。选择一个
独立、可写且空间充足的目录。

### 本地差异索引与远端不一致

取消“本地差异比对”，执行一次直接远端比较。确认差异正确并成功同步后，本地
`asset-sync-index.json` 会更新为新的远端基线。

## 九、安全说明

- “比较本地与远端”和 rclone 连通性命令只读，不会修改 R2。
- “按本地资产同步到 R2”会上传本地差异，并删除远端多余图片或 Json。
- “删除远端版本”会永久删除所选 TableCfg 版本的数据，并更新远端 `manifest.json`。
- 自动监听只有勾选“上传到 R2”时才修改远端。
- 任何 R2 写入操作前都应确认 Remote、Bucket、完整差异列表和预计容量。
- `config.local.json` 不应包含 R2 密钥；密钥由 rclone 配置管理。
- 工具不会修改根目录 `version.json`，也不会执行 Git commit 或 push。
