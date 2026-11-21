# AKE Data Tool

Windows 桌面数据工具用于准备《终末地》Hotfix 资源、解析并发布网站使用的数据。选择流程时，先确定目标产物及发布位置。

| 产物 | 当前解析方式 | 本地发布目标 |
| --- | --- | --- |
| TableCfg | Python 解包器从 main、initial 索引准备 TableCfg 区块，解析 Spark 表并校验 JSON 输出 | `public/TableCfg` |
| 图片 | Python 工作进程使用仓库中的 UnityPy 子模块解析 Bundle。标准、完整两种 profile 分别维护规则与 Map | 本次授权导出的路径增量写入 `public/images` |
| Json | Windows x64 的隔离 Python 宿主使用匹配 Seed 的本地 IL2CPP 运行时导出；按报告核对结果 | `public/Json` 下保留导出的目录和根文件相对路径 |
| GlobalBuff | 从已准备的 Bundle 与匹配运行时单独提取，保留文件级摘要和解析报告 | `public/Dump/GlobalBuffData` |

GUI 将解析、本地发布和上传分为独立步骤。自动监听处理 TableCfg；资产上传页单独管理共享数据。维护者可从 [AKE Data Tool skill](../../skills/ake-data-tool/SKILL.md) 找各阶段的实现、状态记录及恢复入口。

## 一、准备运行环境

### 1. Python

建议安装 64 位 Python 3.10 或更高版本，并确保安装时启用“Add Python to PATH”。
首次使用，在 `tools/ake-data-tool` 中运行：

```powershell
.\setup-venv.bat
```

脚本会创建 `.venv` 并安装 [requirements.txt](requirements.txt) 中的依赖。图片解析使用仓库的 UnityPy 子模块；新检出缺少 `vendor/UnityPy/pyproject.toml` 时，先初始化仓库子模块，再运行设置脚本。启动 GUI 使用 `run-gui.bat`，命令行可用同一个虚拟环境执行 `python -m ake_tool.cli gui`。

### 2. 版本化运行时

TableCfg 使用随工具提供的 Python 解析器。Json、GlobalBuff 与图片需要目标 Seed 唯一、完整的 Windows x64 运行时。工具在统一工作目录的 `il2cpp-host-runtime` 下解析候选目录，优先核对游戏大版本与 Seed；所需 DLL 和资源列表见 [export_json.py](ake_tool/json_host/export_json.py) 的 `REQUIRED_RUNTIME`。有多个完整候选或缺文件时，按错误中的目标 Seed 核对本地目录。图片若引用 Unity 内置对象，还需检查匹配版本的游戏 Resources。

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

“读取远端版本”用于查看版本记录。正式上传、执行资产同步和删除指定 TableCfg 历史版本都会写入远端。GlobalBuff 对象在 `public/Dump/GlobalBuffData`，共享资产索引为根目录的 `asset-sync-index.json`。

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
| `main`、`initial` | 两项都勾选 | TableCfg 流程需要两部分索引 |
| `TableCfg` | 勾选 | 当前 TableCfg 流程只允许该区块 |
| `MD5 校验` | 勾选 | 按官方索引校验资源内容，建议始终启用 |
| `保留任务文件` | 按需 | 保留工作目录中的任务输入和输出，便于续传和单步调试 |
| `超时` | `60` 秒 | 单次网络请求超时，允许范围为 10–600 秒 |
| `重试` | `3` | 下载失败后的最大尝试次数，至少为 1 |

`public` 必须指向正确的仓库目录。配置错误会把发布目标指向其他位置，因此首次配置时应
特别检查路径末尾确实是 `AKEDatabase\public`。

### 游戏资源与工作目录

“游戏资源”中可设置 StreamingAssets、Persistent 和统一工作目录。选择与游戏安装目录分开的工作目录，保留独立 VFS 副本、版本状态和导出结果。同游戏大版本后续热更新优先以工作副本为补丁基线；基线不匹配或补丁不可用时可回退完整文件。

TableCfg 使用 TableCfg 区块；Json 准备 TableCfg、Json、InitialExtendData 与 ExtendData；图片与 GlobalBuff 准备 Bundle、InitialBundle、BundleManifest。下载、解析和上传并发各有独立设置。修改图片工作进程数或 Bundle 缓存预算时，以本机内存和待处理资源为依据。

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

图片解析分页中的 `containers_filter` 决定该 profile 解析哪些容器。推荐使用规则表维护：

- “包含”规则加入允许解析的路径或正则片段
- “排除”规则从包含结果中剔除路径或文件
- 修改规则表后，工具会重新生成最终正则
- 点击“恢复默认”可恢复项目维护的默认素材目录
- 保存工具配置时，规则表和生成后的最终正则会一起写入 `config.local.json`

输入框既接受纯正则，也接受完整的 `--containers_filter "正则"` 参数。默认路径带有目录边界，
例如 `charremoteicon` 不会意外匹配 `charremoteicon700`。物品、敌人和奖章等同时存在大小图标时，
默认规则只解析项目使用的大图目录。

标准与完整 profile 分别保存规则、输出、历史 Map 和发布状态。增量发布依据本次实际导出的 `deltaExportPaths`，累积图片目录中可能还保有以前版本的文件。

### 资产差异与容量

“资产上传”按所选图片、Json 或 GlobalBuff 类型生成计划。核对新增、覆盖、删除和仅更新索引元数据的范围，再执行对应计划。图片计划保留远端既有图片；“根据差分 Map 结果上传”只比较本次实际导出的图片，Json 仍按其完整数据范围比对。GlobalBuff 会校验同版本本地发布记录和远端 Dump 文件清单。

计划使用远端统一资产索引的 revision 与摘要作为基线。容量显示根据索引所记录的资产估算，超过 10 GB 时提示；该提醒不阻止上传，也不代表已枚举整个 Bucket。

## 四、配置文件

工具配置字段见 [config.example.json](config.example.json) 和 [AppConfig](ake_tool/config.py)。保存后读取本机 `config.local.json`。图片规则分 standard、full 两种；比较旧版本配置时按 profile 检查迁移结果。R2 密钥由 rclone 管理。

## 五、首次使用与定位失败

1. 在“工具配置”设置 public、独立工作目录以及需要使用的游戏资源路径。按需配置 R2；本地解析和发布可单独进行。
2. TableCfg 在“手动更新”依次检查版本、准备 VFS、解包、校验、发布本地。需要监听时在“自动监听”单独配置间隔和是否上传。
3. 对图片、Json 或 GlobalBuff，选择其独立分页，核对同一版本的输入与输出报告，再发布到对应 public 目录。Json 包含导出根文件及非空子目录；图片只合并本次导出范围。
4. 若需要上传，核对 TableCfg 的游戏版本与 Hotfix，或共享资产的 profile、Map、目标数据集与差异计划。中断后先查 pending 和回读状态，再决定续传哪一步。

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

完整 run 在启用 R2 时会包含 upload。仅处理指定阶段可用 --steps。CLI 另提供 narrative-index-plan / narrative-index-apply，前者将叙事索引元数据差异写入 --plan 指定的文件，后者执行该计划。

TableCfg 可用步骤为：

```text
check, download, unpack, validate, publish, upload
```

单步执行依赖上一步已经在同一工作目录中产生有效状态和文件。`upload` 会写入 R2；只需要本地
结果时不要包含该步骤。

## 七、工作目录和日志

在统一工作目录（如 `E:\AKEImageWork`）中按阶段查找：

| 路径 | 作用 |
| --- | --- |
| `VFS/`、`vfs-versions.json`、`indexes/` | 持久区块副本、基线身份与热更新索引 |
| `jobs/`、`state.json` | TableCfg 版本任务和阶段状态 |
| `output/<profile>/`、`image-runs/`、`map-cache/` | 累积图片、各次导出和历史 Map |
| `il2cpp-host-runtime/`、`json-output/`、`json-python-runs/` | 版本化运行时、当前 Json 结果和历史尝试 |
| `globalbuff-output/`、`globalbuff-runs/` | 当前 GlobalBuff 导出和运行历史 |
| `image-state.json`、`release-pending/` | 图片、Json、GlobalBuff 的阶段信息，以及独立的 TableCfg 上传恢复记录 |

GUI 任务日志在工具目录 `logs/`，Json 子进程在该次输出中写 `parser.log`。相应处理阶段会裁剪旧导出，单纯启动 GUI 不触发清理；保留策略会保护状态引用的 Map。

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

### 找不到唯一完整运行时或图片所需的内置资源

按目标 game_version / seed_version 核对 `il2cpp-host-runtime` 下的文件与候选数量。对于图片，先核对版本化运行时的 `Endfield_Data/Resources`；游戏目录回退还会检查 GameAssembly 文件身份。解析日志会指出缺失的依赖。

### 图片差分计划失效

核对版本、profile、解析器摘要和本次导出的 Map。更换规则、解析器或数据版本后，用对应的解析和发布状态重新比较。

### 工作目录配置无效

不要填写磁盘根目录，也不要填写 `StreamingAssets`、`Persistent` 或它们的子目录。选择一个
独立、可写且空间充足的目录。

### 计划基线与远端索引不一致

重新读取远端索引并按当前版本、数据集与 profile 建立差异计划。中断的传输先核对未完成记录与已传范围。

## 九、安全说明

- “比较本地与远端”和 rclone 连通性命令只读，不会修改 R2。
- 资产同步按计划执行；图片保留远端历史对象，Json 与 GlobalBuff 需单独核对删除范围。
- “删除远端版本”会永久删除所选 TableCfg 版本的数据，并更新远端 `manifest.json`。
- 自动监听只有勾选“上传到 R2”时才修改远端。
- 任何 R2 写入操作前都应确认 Remote、Bucket、完整差异列表和预计容量。
- `config.local.json` 不应包含 R2 密钥；密钥由 rclone 配置管理。
- 工具不会修改根目录 `version.json`，也不会执行 Git commit 或 push。
