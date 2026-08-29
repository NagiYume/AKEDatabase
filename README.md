# AKEDatabase - 明日方舟：终末地数据库

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
![Static](https://img.shields.io/badge/Static-HTML%2FCSS%2FJS-blue)
![Last Commit](https://img.shields.io/github/last-commit/nagiyume/akedatabase)

> 《明日方舟：终末地》非官方数据查询与研究站。项目是无后端、无构建步骤的静态 HTML/CSS/JavaScript 应用；网站代码与游戏数据分离，游戏数据由 Cloudflare R2 提供。

AKEData 面向日常查询、攻略研究和游戏机制分析，当前公开模块以 v3 为主。v3 从完整 `TableCfg` 和 `public/Json` 动态建立实体关系；既有查询页复用经过验证的 v2 页面控制器和样式，商店、档案库等模块则按数据结构使用独立控制器。

在线站点：[https://www.akedata.wiki](https://www.akedata.wiki)（原 `akedata.top` 已重定向至此）

## 当前版本

`1.2.16` 为正式版，新增地图文本和任务文本档案分类，完善地区与类型筛选、版本差异识别和文本解析，并改进档案库的返回状态恢复体验。

资产数据现在通过远端 `asset-sync-index` 统一描述图片和 Json 数据版本，资产模块支持按目录浏览、图片预览和文件下载；资产版本与 `version.json` 中负责 TableCfg 的游戏版本相互独立。旧的 Json `manifest.json` 不再参与运行时资产索引生成。

资产模块现会同时解析统一索引中的游戏版本和 `@` 后 Hotfix 编号，按完整的最高资产版本标记新增或覆盖的图片、Json 文件，并通过“仅看新增”筛选快速定位当前版本内容。Sprite 目录提供本地化别名，新增标记会显示在文件夹和文件层级，目录、搜索结果和文件列表会优先排列新增内容；根目录提供游戏图标、游戏地图等快捷跳转，快速跳转和资产目录还可以在桌面端与移动端独立折叠。

角色图标生成器支持 `1024 × 1024` 预设和自定义宽高，锁定长宽比时会自动同步尺寸；技能带属性构图可以按技能类型、伤害属性和用户选择的图层生成背景素材。新增角色技能弹窗生成器，支持游戏富文本、技能参数、分支技能、终结技消耗与冷却时间，以及天赋和属性节点等级展示；自主编辑模式会为预览图和导出图写入隐蔽定位水印，并提供独立的水印解析器。

应用启动和模块加载改为并行预取、顺序执行。数据加载器提供有限并发、请求去重、优先级调度、批量 Table 加载和加载统计；大型 JSON 的解析交由 Worker，文本表改为本地化数据与中文回退按需查询，减少主线程阻塞。

缓存层缩短 IndexedDB 对首屏网络请求的等待，并合并 IndexedDB 读写事务；进度显示使用帧调度更新。Service Worker 改为后台启动，不再阻塞首页进入。

活动详情新增游戏内活动说明，并补充签到、等级、任务、里程碑、回流、角色试用、周年阶段和新手福利奖励。活动附属表只在打开对应活动详情后按需加载，减少活动起始页的流量；活动总览图片改为保持原比例并靠右显示。

主侧栏和各模块侧栏允许继续缩窄，有图标的条目会进入仅图标模式。亮色、暗色和护眼主题现分别记录资源版本，便于只刷新实际发生变化的主题文件。

## 功能

- 角色、武器、敌人、装备、物品、商店、副本、活动、奖章、档案库、杂项、Baker 通讯和危机合约查询
- PRTS 档案一览、地图文本、任务文本、地区与类型筛选、正文及字幕全文搜索、档案组深链接和富文本详情
- Baker 联系人、群聊与干员会话浏览、全文搜索、分支选择和多媒体消息展示
- 商店组分类浏览、分商店切换、价格折扣、限购兑换与奖励内容展示
- 商店开放条件、物资调度等级商品解锁，以及装备制造模板和成品获取来源追踪
- 装备模板箱点位按需读取 LevelData，并实时生成 OEM 直达短链
- 武库交易所武器轮换日历、实时倒计时与卡池内容权重
- 每周、通行证、演武、合约、奇境和竞技大会任务，以及对应的积分、里程碑与奖励解析
- 协议通行证按赛季、类别和周次筛选，并展示三档完整等级奖励
- 角色与技能组合图标预览、最高 1024 像素预设、自定义比例、透明背景和 PNG 下载
- 角色技能弹窗生成、富文本与链接图标渲染、技能参数和节点等级展示、自主编辑与水印解析
- 名称、ID、稀有度、类型、职业、元素等多维搜索和筛选
- 角色、武器和敌人的等级属性展示
- 副本波次、生成器、出生位置和 Buff 属性计算
- LevelScriptData 静态敌人、出生 Buff、条件 Buff 与怪物属性公式追踪
- 副本、危机合约和战争回响共用怪物卡片与新元素抗性数据
- 按来源汇总的属性加成，以及隐藏模式关闭时的内部 ID 保护
- 点击常驻的原始值与计算公式浮层
- 游戏富文本、术语链接和双层说明浮窗
- 活动起始页日历时间轴与战争回响轮换/难度折叠
- 亮色、暗色、护眼三种主题
- 隐藏模块、默认等级、URL 同步和默认开启的长图导出设置
- 模块和实体深链接
- 桌面与移动端响应式布局
- 带访问令牌的资产目录、目录别名、Hotfix 感知的新增标记、折叠导航、图片预览和文件下载
- 首页数据更新时间倒计时、可重复查看的多语言网站公告和公告版本更新自动提醒
- Latest 与上一个游戏版本最终 Hotfix 的数据差异、可见内容 Diff 及新增/修改标签
- 首页底部展示工信部备案号并链接至备案管理系统

## 当前模块

`plugin/manifest.json` 是模块注册表。`priority` 越小越靠前；`hidden: true` 的模块默认不显示，但可在设置中开启；`disabled: true` 的模块不会进入运行时模块列表。

### 公开模块

| ID | 模块 | 主要数据源 |
|---|---|---|
| `season_tower` | 战争回响 | SeasonTower、Dungeon、GameMechanic、Reward、Enemy 等 TableCfg，SpawnerConfig、LevelScriptData、BuffData |
| `v3_character` | 角色 | TableCfg、`public/CH/maps.json` |
| `v3_weapon` | 武器 | TableCfg |
| `v3_enemy` | 敌人 | TableCfg |
| `v3_equip` | 装备 | TableCfg、LevelData（仅点击 OEM 点位时读取）、`public/CH/maps.json` |
| `v3_activity` | 活动 | TableCfg |
| `v3_shop` | 商店 | TableCfg（ShopGroup/Shop/ShopGoods/CashShop 系列、GachaWeaponPool/Content） |
| `v3_item` | 物品 | TableCfg、`public/CH/maps.json` |
| `v3_dungeon` | 副本 | TableCfg、LevelData、SpawnerConfig、LevelScriptData、BuffData |
| `v3_achievement` | 奖章 | TableCfg |
| `misc` | 杂项 | TableCfg（周期与玩法任务、通行证等级奖励、角色及技能索引）、`public/misc` 合成素材 |
| `baker` | Baker | SNSChat、SNSDialog、SNSDialogOption、SNSDialogTopic、Item 等 TableCfg |
| `v3_cc` | 危机合约 | TableCfg、SpawnerConfig、LevelScriptData、BuffData |
| `v3_archive` | 档案库 | PrtsPage/PrtsCategory/PrtsFirstLv/PrtsAllItem/PrtsReading、DialogTextTable、RichContentTable、RadioTable、ReadingPopUpTable/ReadingPopUpIconTable、LevelDescTable |
| `asset` | 资产 | 远端 `asset-sync-index`、图片与 Json 资产；需要访问令牌 |
| `research` | 研究 | `public/CH/research` Markdown |
| `about` | 关于 | 静态内容、赞助信息 |

### 隐藏模块

- `v3_mission`：任务流程与剧情对话，仍在开发中。
- `hidden-example`：隐藏模块行为测试。

### 禁用模块

- `v2_cc`、`v2_character`、`v2_weapon`、`v2_enemy`、`v2_equip`、`v2_item`、`v2_dungeon`：已由对应 v3 模块取代的聚合数据版本。
- `v3_skill`、`v3_buff`：战斗与 Buff 深度解析页面，代码仍保留，`1.2.10` 暂时禁用。
- `buff`、`skill_v2`、`spawn`：BuffData、SkillData 和 SpawnerConfig 调试模块。
- 旧版 v1 模块、旧 Skill 模块及旧活动、奖章页面仍保留文件，但目前在 manifest 中禁用。

## 项目结构

```text
AKEDatabase/
├─ index.html                     # 应用外壳、设置弹窗和全局脚本入口
├─ ake-sw.js                      # 图片逻辑路径到 R2 的根作用域网络代理
├─ version.json                   # 应用、模块、脚本、公告版本及数据域配置
├─ plugin/
│  ├─ manifest.json               # 顶层模块注册表
│  ├─ misc.html                   # 杂项二级模块宿主
│  ├─ misc/
│  │  ├─ manifest.json            # 杂项子模块注册表
│  │  └─ *.html                   # 杂项子模块 DOM 壳
│  ├─ v3_*.html                   # v3 模块 DOM 壳
│  ├─ v2_*.html                   # v2 模块 DOM 壳
│  └─ js/
│     ├─ index-app.js             # 模块加载、路由、设置和富文本运行时
│     ├─ ake-ui.js                # 二级目录、筛选、控件、卡片、状态页和表格等公共 UI 组件
│     ├─ sidebar-resize.js        # 主侧栏与模块侧栏调宽及窄栏模式
│     ├─ module-view-state.js     # 访问期内的模块路由与滚动状态恢复
│     ├─ ake-data-source.js       # R2 清单、版本选择和逻辑 URL 解析
│     ├─ ake-cache.js             # 按数据域和版本隔离的 fetch 缓存策略
│     ├─ ake-data-loader.js       # 有限并发、去重、优先级和批量数据加载
│     ├─ ake-data-worker.js       # 大型 JSON 的后台解析 Worker
│     ├─ ake-stats.js             # 属性和 modifier 计算
│     ├─ ake-enemy-renderer.js    # 副本、危机合约和战争回响的共享怪物渲染器
│     ├─ v3-table-data.js         # TableCfg/Json 到 v2 UI 数据契约的适配层
│     ├─ misc.js                  # 杂项清单、二级路由与生命周期宿主
│     ├─ misc-*.js                # 杂项子模块控制器
│     └─ <module>.js              # 各模块控制器
├─ theme/
│  ├─ light.css                   # 亮色主题
│  ├─ dark.css                    # 暗色主题
│  ├─ yellow.css                  # 护眼主题
│  ├─ misc.css                    # 杂项宿主与子模块样式
│  └─ <module>.css                # 模块样式
├─ public/
│  ├─ CH/                         # 中文聚合数据、研究文档、i18n、maps 和 tip.md
│  ├─ EN/                         # 英文 i18n、maps 和 tip.md 等语言资源
│  ├─ <语言>/                     # 各语言 i18n.json、maps.json 和网站公告 tip.md
│  ├─ misc/                       # 角色图标生成器随站点发布的合成素材
│  └─ TableCfg、Json、images      # 本地游戏数据可保留，但由 .gitignore 排除
├─ tools/
│  ├─ ake-data-tool/              # TableCfg、图片解析和资产上传工具
│  ├─ sync-r2.ps1                 # 交互式/参数式 R2 发布脚本
│  └─ r2-cors.json                # R2 CORS 配置模板
├─ .kilo/skills/akedatabase/      # Agent 项目知识 skill
├─ .vscode/settings.json          # Live Server 端口配置
├─ LICENSE
└─ README.md
```

## Cloudflare R2 数据发布

生产数据域为 `https://data.akedata.wiki`，Bucket 名称为 `akedatabase`。R2 对象布局如下：

```text
manifest.json
public/
├─ <gameVersion>/<hotfixVersion>/TableCfg/*.json
├─ Json/**
└─ images/assets/beyond/dynamicassets/gameplay/**
```

只有 `TableCfg` 按游戏版本和 Hotfix 建立不可变目录；`Json` 与 `images` 始终维护一份当前数据。`manifest.json` 包含所有可选版本、`latest` 指针和共享数据修订号，并在每次发布的最后一步上传。

凭据只保存在本机 rclone 配置中，不得写入仓库。对象级令牌没有创建 Bucket 的权限，因此脚本始终向 rclone 传递 `--s3-no-check-bucket`。

### 交互式发布

Windows PowerShell 执行策略阻止本地脚本时，使用：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\sync-r2.ps1
```

脚本会要求输入热更新链接，并自动以链接的 `version` 参数作为游戏版本、以接口响应的 `main.version` 作为 Hotfix 版本。热更新链接留空时改为手动输入两个版本号。远端 `manifest.latest` 只用于维护版本清单，不再作为本次上传的版本号来源。正式上传前会显示版本来源、文件数量、体积和目标路径，默认选择否时只执行 dry-run。

### 参数式发布

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\sync-r2.ps1 `
  -HotfixUrl 'https://launcher.hypergryph.com/api/game/get_latest_resources?...' `
  -DataRoot .\public `
  -Remote r2 `
  -Bucket akedatabase `
  -SyncShared `
  -PublishLatest `
  -Apply
```

无法使用热更新链接时，可显式传入 `-GameVersion 1.4.4 -HotfixVersion 8618533-5` 进入手动模式。`-HotfixUrl` 与手动版本参数不能同时使用。

版本目录存在时脚本默认拒绝覆盖。共享目录默认使用增量 `copy`，只有显式传入 `-PruneShared` 才会删除远端多余对象。回滚不需要移动数据，只需重新发布清单并让 `latest` 指向已存在版本。

只修改 `Json` 或 `images` 时使用共享数据模式。该模式不会读取或上传 TableCfg，也不会改变 `latest`；脚本会更新 `sharedRevision`，使网页立即使用新的缓存命名空间：

```powershell
# 先运行并在最后选择“否”，确认 dry-run 计划
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\sync-r2.ps1 -SharedOnly

# 确认无误后正式上传
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\sync-r2.ps1 -SharedOnly -Apply
```

AKE Data Tool 的“资产上传”分页可以单独选择图片、Json 或同时选择两者。工具先保存本地与远端的差异计划，再使用 `rclone sync --delete-before` 执行镜像同步；同步前后都会读取整个 Bucket 的对象总量，并按删除前上传峰值检查 10 GB 容量上限。任一所选资产发生变化时，零差异复查通过后都会更新 `manifest.sharedRevision`。该流程与上面的 PowerShell 共享数据模式相互独立。

图片工具以配置中的 `containers_filter` 作为唯一素材范围：解析开始前清空上次输出，发布时清理原 `public/images/assets`，再将本次 `output/assets` 中的全部图片按原始相对路径完整复制过去，不再额外套用发布目录白名单；SDK 生成的根目录解析索引 `assets.map` 不会发布。默认解析清单包括档案库使用的 `sprites/prts`（递归覆盖 `icon`）、`sprites/reading`、`sprites/readingpoplogo` 和 `prefabs/nonnarrative`，并收集 `sprites/itemtips` 物品提示素材与 `sprites/mainhud` 主界面素材；物品图标默认仅解析 `sprites/itemiconbig`，不请求 `sprites/itemicon` 小图目录。

### 本地数据

`version.json` 的 `debugmode` 为 `true` 且版本选择为 `latest` 时，网站使用当前页面同源数据；因此 VS Code Live Server 会读取本地 `/public/TableCfg`、`/public/Json` 和 `/public/images`。本地没有 `manifest.json` 时自动兼容未版本化目录 `/public/TableCfg`。显式选择固定版本时会改用生产数据域中的对应历史版本，并在刷新后保留选择。发布网站前必须将 `debugmode` 恢复为 `false`。

使用 `Latest` 时，v3 数据模块会自动将当前数据与上一个游戏版本中 `publishedAt` 最新的 Hotfix 对比。新增条目始终排在列表最前并显示“新增”标签；活动模块不参与新增判定。装备模块按单件装备 ID 判定新增，只要套组（包括独立装备组）包含新增装备，就会给套组打“新增”标签，并在详情内将具体新增装备置顶、单独标记。奖章模块同样按具体奖章 ID 判定新增，同时标记所属分类与详情中的新增奖章。档案库按 `PrtsAllItem.id`、`PrtsReading` 条目和 `DialogTextTable` 对话组识别新增或修改内容：起始一览将发生变化的档案组集中置顶，目录在各分类内置顶，新增条目也会在详情中优先排列并单独标记；任务文本仅因本地化标题或副标题补全不会被误标为修改，`text_` 内容在缺少富文本正文时会回退到同后缀的 `radio_` 文本。基线表不可用时会关闭本次档案比对，避免误标。档案库同时使用绿色分区、卡片背景与标签强化新增状态；其他通用卡片的外圈仍沿用稀有度样式。全局设置中的“显示版本间数据改动（测试功能）”默认关闭；开启后，修改条目也会置顶并显示“修改”标签。打开“修改”条目后，当前版本和基准版本会分别经过同一个详情渲染器，只对页面实际显示的文本执行序列 Diff；删除的旧内容使用红色、增加的新内容使用绿色，隐藏字段和未渲染配置不会参与比较。单个条目最多展示 500 行可见差异。选择固定历史版本时不显示差异标签或详情差异。

`debugmode` 为 `false` 时，设置弹窗的“请求域名”仍可手动切换数据服务。版本选择默认保存为 `latest`，也可以固定到清单中的某个版本。

## 运行架构

### 应用启动

`index.html` 先以 `no-store` 读取根目录 `version.json`，再按 `jsversion`（缺失时回退到 `appversion`）查询参数依次加载：

1. `plugin/js/ake-image-fallback.js`
2. `plugin/js/index-parse-fallback.js`
3. `plugin/js/i18n.js`
4. `plugin/js/ake-ui.js`
5. `plugin/js/toast.js`
6. `plugin/js/ake-data-source.js`
7. `plugin/js/ake-cache.js`
8. `plugin/js/ake-data-worker.js`
9. `plugin/js/ake-data-loader.js`
10. `plugin/js/ake-asset-index.js`
11. `plugin/js/sidebar-resize.js`
12. `plugin/js/module-view-state.js`
13. `plugin/js/v3-table-data.js`
14. `plugin/js/index-app.js`

入口会先并发预取这些脚本，再按上述顺序执行；模块 HTML 中的外部脚本也会先并发预取，再按原始 DOM 顺序执行。Service Worker 在应用启动后后台注册，不作为首页进入条件。

`index-app.js` 读取 `plugin/manifest.json`，过滤禁用模块，按 `priority` 排序，然后生成桌面侧栏和移动端菜单。

设置弹窗中的应用版本和网站最后修改时间来自 `version.json`；游戏版本与 Hotfix 只来自 R2 `manifest.json` 当前选择的版本。`version.json` 不保存 `gameversion` 或 `hotfixversion`，也不参与线上游戏数据版本决策。`updatedAt` 在游戏数据版本或 `appversion` 任一更新时刷新。首页不显示版本号，而是读取 `totime` 和 `desc` 显示下次数据更新倒计时及可选更新原因。发布新的代码、CSS、模块结构或界面语言版本时，由维护者明确设置 `appversion`。`debugmode` 为 `true` 时强制使用当前同源本地数据，并在每次刷新时清空持久响应缓存、绕过浏览器缓存。

点击模块后，框架通过 `window.akeFetch` 获取模块 HTML并插入 `#contentArea`。因为动态插入的 `<script>` 不会自动执行，加载器会先并发获取所有外部脚本源码，再按 DOM 顺序重新创建脚本节点并等待源码完成。

`ake-data-loader.js` 默认使用桌面端 6 路、移动端 4 路并发，最高限制为 8 路。Table 请求通过 `window.AKEV3.table(name, version)` 和 `window.AKEV3.tables(entries, options)` 进入统一调度器，并继续保留请求去重、AbortSignal、数据源选择、Latest/固定版本和 `sharedRevision` 隔离。

同一标签页内，模块 HTML、脚本源码和 CSS 按规范化 URL 缓存。首次进入模块时加载器会执行控制器并挂载 DOM；离开模块时，当前 DOM 会暂存到页面内存，返回时直接恢复，不重复获取资源或重新执行控制器，因此页面、已选条目、筛选和展开等交互状态可以延续。模块 CSS 每个 URL 只创建一次，并按当前模块启用或禁用。

模块 HTML 使用 `pluginversion` 中对应模块 ID 的版本号，JavaScript 使用 `jsversion` 中对应脚本路径的版本号；字段缺失时才回退到 `appversion`。这些资源采用浏览器 `force-cache`，因此未改动的模块和脚本可以继续复用缓存。CSS 和其余应用资源仍使用 `appversion`。TableCfg 的持久缓存命名空间只由数据域和当前 Hotfix 决定，应用版本变化不会使其失效；Json/images 只使用独立的 `sharedRevision`，不随应用版本或 Hotfix 变化。网站自身的语言、公告和研究资料继续使用同源 `/public/**` 路径。

### 缓存分层

- localStorage：保存主题、隐藏开关、默认等级、URL 设置、数据域、版本选择、令牌和各侧栏宽度等小型偏好；所有访问都有异常保护。
- 页面内存：缓存模块 HTML、脚本源码、CSS Promise、模块 DOM、各模块当前条目及按条目区分的滚动位置，以及 v3 已解析的 TableCfg/I18n/maps。数据加载器还负责请求去重、优先级队列、共享取消等待和加载统计。模块浏览状态仅在同一次访问内有效，刷新后清空。
- IndexedDB：数据库 `akedata-data-cache` 使用“数据域 + TableCfg Hotfix”或“数据域 + sharedRevision”命名空间保存 `akeFetch` 响应；多个版本可以共存。
- 图片路由：模块 HTML 和图片属性写入 DOM 时会同步将 `/public/images/**` 改写为当前数据域的绝对 URL；运行时新增或修改的图片、`srcset`、海报及内联背景图另由 DOM 观察器复查，避免浏览器先向网站域名发出请求。
- Service Worker：根目录 `ake-sw.js` 为尚未改写或绕过 `akeFetch` 的 `/public/images/**` 请求提供后备代理。数据域与 `sharedRevision` 同时编码在 Worker 注册 URL 中，确保 Worker 休眠后重新启动仍会直接请求数据域，而不会回退到网站域名。
- Worker：大型 JSON 在后台 Worker 中完成长整数保护和解析；Worker 不可用时自动回退到主线程解析。
- HTTP Cache：继续负责版本化的 HTML、JS、CSS 和网络响应。

切换游戏版本不会清空其他版本的 IndexedDB 数据；数据域也属于缓存键，生产数据与本地数据不会混用。IndexedDB、Service Worker 或 localStorage 不可用时，页面自动降级到内存缓存和普通网络请求，不阻止应用启动。`version.json` 与 R2 `manifest.json` 每次启动均使用 `no-store` 请求。

全局设置中的“强制刷新网页缓存”会清空页面内存与 IndexedDB 响应缓存，并以一次性时间戳重新加载当前页面。该操作保留语言、主题、令牌等 localStorage 设置；浏览器 HTTP 缓存通过时间戳 URL 绕过，而不是尝试删除用户的全局浏览器缓存。

Service Worker 首次安装或应用版本更新并取得页面控制权时，会按 `appversion` 在当前会话中执行一次刷新，使 favicon、首页图片等早于缓存脚本发起的 `/public/` 请求也经过 Service Worker。

### 首页公告与倒计时

首页公告和更新倒计时由 `plugin/js/index-app.js` 渲染，配置来自根目录 `version.json`：

| 字段 | 用途 |
|---|---|
| `appversion` | 网站 HTML、JavaScript、CSS 与 Service Worker 的缓存版本 |
| `pluginversion` | 按模块 ID 记录模块 HTML 版本；未更新模块继续使用缓存 |
| `jsversion` | 按脚本路径记录 JavaScript 版本；未更新脚本继续使用缓存 |
| `dataBaseUrl` | 游戏数据请求域名 |
| `dataManifestPath` | 数据域中的版本清单路径 |
| `tipversion` | 公告版本，通常填写公告最后更新时间；值变化后首页自动弹出新公告 |
| `updatedAt` | 网站最后一次修改时间；游戏数据版本或 `appversion` 更新时都必须刷新 |
| `updatedBy` | 最后修改者 |
| `totime` | 下次数据更新时间；未携带时区时按东八区 `UTC+08:00` 解析 |
| `desc` | 数据更新原因；空字符串、纯空格或字段缺失时不显示 |
| `debugmode` | Latest 使用本地数据并绕过缓存；固定版本仍使用线上清单 |

示例：

```json
{
  "tipversion": "2026-07-16 01:43:08",
  "totime": "2026-07-16 06:30:00",
  "desc": "同步最新游戏数据"
}
```

倒计时每秒以浏览器本地系统时间重新计算。`totime` 可写为不带时区的 `YYYY-MM-DD HH:mm:ss`，此时默认东八区；也可提供 `2026-07-16T06:30:00+08:00` 或带 `Z` 的 ISO 时间。到期后倒计时归零，不显示负数。

每种界面语言从自己的公告文件读取内容：

```text
public/CH/tip.md
public/EN/tip.md
public/<其他语言>/tip.md
```

首页右上角“网站公告”按钮可随时手动打开当前语言公告。浏览器使用 localStorage 键 `akedata-tipversion` 记录已读公告版本；当 `tipversion` 与已读值不同时，进入主页会自动弹出公告，成功加载并显示后才标记为已读。直接通过深链接进入模块时不会立即弹出，返回主页后再检测。

`tip.md` 请求以 `tipversion` 作为 URL 版本参数并保持在网站同源，不进入 R2 游戏数据缓存。更新公告时必须同步更新所有语言的 `tip.md` 并手动修改 `tipversion`；修改倒计时字段不需要改变公告已读状态。

首页底部固定展示备案号 `浙ICP备2026014728号-1`，链接至 `https://beian.miit.gov.cn/#/Integrated/index`。

加载 `/public/**` 数据时，页面顶部按“已加载字节数 / 数据总字节数”显示进度。默认显示进度和总体字节量；开启“显示隐藏模块”后，额外显示当前文件路径、来源（网络、内存或 IndexedDB）以及当前文件字节数。未开启隐藏模块但连续加载超过 3 秒时，也会自动展开这些文件详情。响应尚未提供 `Content-Length` 时显示已加载字节量与不确定进度动画，不再按文件数量估算进度。

Service Worker 位于站点根目录 `/ake-sw.js`，可直接注册根作用域 `/`，Live Server 和生产服务器均无需额外配置 `Service-Worker-Allowed` 响应头。

### v3 数据适配

多数 v3 查询模块采用兼容层设计，而不是重复实现多套 UI：

1. `plugin/v3_<module>.html` 加载 `v3-table-data.js`。
2. 页面调用 `window.AKEV3.activate('<module>')`。
3. 对应 v2/旧版控制器照常请求 manifest 和详情。
4. v3 请求拦截器动态读取完整 TableCfg 和 Json 数据，生成内存中的兼容响应。
5. 既有控制器负责筛选、渲染、交互和深链接。

虚拟详情路径形如：

```text
/__v3/character/chr_0002_endminm.json
/__v3/enemy/eny_0045_agtrinit.json
/__v3/dungeon/indie_group_ccdg.json
```

这些 URL 不对应磁盘文件，由 `v3-table-data.js` 返回内存 `Response`。

商店、档案库等独立模块则直接调用 `window.AKEV3.table()` 读取并本地化 TableCfg，再由各自控制器建立索引、目录和详情。档案库以 `PrtsFirstLv.itemIds -> PrtsAllItem` 组织档案组和条目，并按条目类型关联 `RichContentTable` 或 `RadioTable`；它不依赖 v2 兼容响应。

### 数据职责

- `public/TableCfg`：角色、物品、副本、活动、奖励、技能补丁、PRTS 档案与富文本等完整结构化表。
- `public/Json`：TableCfg 无法完整表达的 Buff、SkillData、SpawnerConfig、LevelScriptData 和 LevelData。
- `public/CH`：简体中文资源目录，包含旧版/v2 聚合数据、研究文档与界面 `i18n.json`。
- `public/EN`：英文界面资源目录。
- `public/TC`：繁体中文资源目录，已补齐独立 `i18n.json` 与 `maps.json`。
- `public/JP`：日文资源目录，已补齐独立 `i18n.json` 与 `maps.json`。
- `public/KR`：韩文资源目录，已补齐独立 `i18n.json` 与 `maps.json`。
- `public/RU`、`MX`、`BR`、`DE`、`FR`、`VN`、`TH`、`ID`、`IT`：其余 TableCfg 语言目录，当前游戏文本已接入对应 `I18nTextTable_*`，但站点界面与枚举的独立本地化仍待完成。
- 每个语言目录的 `tip.md`：首页网站公告正文；公告按钮、倒计时和更新原因标签位于同目录 `i18n.json`。
- `public/images`：模块按固定路径约定组装图片 URL；档案库图标直接读取 `sprites/prts/icon`，正文与弹窗标识分别读取 `sprites/reading` 和 `sprites/readingpoplogo`。档案图标请求失败时使用站点根目录的 `icon_default_missing.png`。
- `public/misc`：角色图标生成器使用的组合框 UI 素材，随网站代码发布，不属于 R2 游戏图片代理目录。

副本型模块会通过 `DungeonTable.sceneId` 关联 `LevelData/<sceneId>`、`SpawnerConfig/<sceneId>` 和 `LevelScriptData/<sceneId>`；SpawnerConfig 中的 `enemyLibrary` 再关联 EnemyTable，出生 Buff 则按 ID 加载 `BuffData/<buffId>.json`。没有 SpawnerConfig 的关卡还可能直接在 `LevelScriptData.enemies` 定义敌人、等级和 `buffs`，这些 Buff 按 `enemyId + level` 匹配后直接并入出生面板。`ake-combat-data.js` 另将 LevelScript 的 `AddBuffToTarget*` / `AddBuffsToTargets*` 解析为条件性敌人 Buff，并优先沿动作数据引用定位 `SpawnerGetSpawnedEntityList` 或 `OnSpawnerEntitySpawn` 的具体 Spawner；这类动态 Buff 单独展示运行时属性变化，不会默认并入出生面板。该共享链路由普通副本、危机合约和战争回响共同使用。

装备页通常只通过 TableCfg 解析制造模板与成品的获取来源。只有用户点击探索来源的“在 OEM 查看”按钮时，才会按奖励 ID 推导场景与局部逻辑 ID、读取对应的 `LevelData/<sceneId>/<sceneId>_lv_data.json`，再用当前 `levelIdNum` 组合全局点位 ID 并实时计算 `https://oem.re/<短码>`。该流程不在页面加载阶段读取 LevelData，不依赖 LevelData manifest，也不维护静态 OEM 短码表。

### 属性映射与敌人抗性

开启“显示隐藏模块”后，数值提示统一由 `renderRawValueTip` 生成。仅做百分比、单位或精度格式化的字段继续显示数据源原始值；属性修正、Buff、词条、占位符表达式和代码合成值若改变了结果，则显示原始值、代入参数、完整计算公式和最终结果。怪物属性公式由 `AKEStats.getEnemyStatDetailsAtLevel()` 统一追踪，避免各模块只把计算后的最终值误标为“原始值”。

每个语言目录的 `maps.json` 都包含本地化显示名 `ATTR_MAP` 和枚举名 `ATTR_MAP_EN`。两张表必须使用相同且连续的数字 ID；新增或调整 Attribute 时，应同步更新全部 14 个语言目录，避免切换语言后出现未知属性或 Buff 无法关联属性 ID。

当前映射包含 ID 0–100。ID 94–99 依次为 `PhysicalResistance`、`NaturalResistance`、`CrystResistance`、`PulseResistance`、`FireResistance` 和 `EtherResistance`。怪物与副本页面以这些元素抗性参数为准；旧 ID 80–85 的 `*DmgResistScalar` 仍保留在完整映射中供原始数据查阅，但不会在这两个模块的属性卡片、修正摘要或 Buff 提示中重复显示。

### i18n 与 Int64

网站界面文案采用显式 key，由每种语言目录下的单一文件统一管理：

```text
public/CH/i18n.json
public/EN/i18n.json
public/<其他语言>/i18n.json
```

这些文件都使用同一套 key 树，并按 `messages.common`、`messages.home`、`messages.version`、`messages.modules.<module>` 等 scope 隔离。启用模块的 HTML 使用 `data-i18n`/`data-i18n-placeholder`，控制器脚本通过 `window.akeI18n.scope('<scope>')` 读取翻译，不再通过中文原文做运行时替换。首页公告按钮使用 `home.announcement`，倒计时和更新原因分别使用 `version.countdown` 与 `version.updateReason`。

游戏 TableCfg 文本与界面文案分离。当前运行时支持以下语言代码：

```text
CH TC EN JP KR RU MX BR DE FR VN TH ID IT
```

其中：

- 对外语言 `CH` 使用 `public/TableCfg/I18nTextTable_CN.json`
- 对外语言 `TC` 使用 `public/TableCfg/I18nTextTable_TC.json`
- 对外语言 `EN` 使用 `public/TableCfg/I18nTextTable_EN.json`
- 其余语言 `XX` 使用 `public/TableCfg/I18nTextTable_XX.json`

其中中文目录名固定为 `CH`，但 TableCfg 后缀仍然是 `CN`。网页完成首次加载后会立即预加载当前语言的 TextTable；`v3-table-data.js` 会复用该 Promise，并为非中文语言的缺失值回退到中文文本。表缓存按语言隔离，避免切换语言后继续复用首次水合的对象。

### 多语言 TODO

- 已完成独立站点翻译：`CH`、`TC`、`EN`、`JP`、`KR`
- 待完成独立站点翻译：`RU`、`MX`、`BR`、`DE`、`FR`、`VN`、`TH`、`ID`、`IT`
- 上述待办语言当前已可加载各自的 `public/TableCfg/I18nTextTable_*` 游戏文本，但 `public/<语言>/i18n.json` 与 `public/<语言>/maps.json` 仍需继续替换为对应语言的独立翻译版本。

TableCfg 文本引用中的 `id` 可能超出 JavaScript 安全整数范围。`v3-table-data.js` 在 `JSON.parse` 前将长整数文本 ID 转为字符串，避免精度丢失，然后递归为 `{ id, text }` 对象填充本地化文本。JSON 中的 `\uXXXX` 会由 `JSON.parse` 自动转换，无需二次解码。

## 本地运行

项目没有 npm 依赖和构建步骤。由于模块和数据使用 `fetch`，必须通过 HTTP 服务运行，不能直接使用 `file://` 打开。

### VS Code Live Server

仓库的 `.vscode/settings.json` 将端口设为 `5501`。从仓库根目录启动 Live Server 后访问：

```text
http://localhost:5501/
```

### Python

```powershell
python -m http.server 5501
```

然后访问：

```text
http://localhost:5501/
```

必须以仓库根目录作为站点根。项目大量使用 `/plugin/...`、`/theme/...` 和 `/public/...` 根绝对路径，不支持未经配置的子路径部署。

截图功能通过 CDN 加载 `html2canvas`；离线环境下普通查询仍可使用，但截图可能不可用。

## URL 路由

```text
/?plugin=<模块ID>
/?plugin=<模块ID>&id=<条目ID>
```

示例：

| URL | 说明 |
|---|---|
| `/?plugin=v3_character` | 打开角色模块 |
| `/?plugin=v3_character&id=chr_0002_endminm` | 定位到管理员 |
| `/?plugin=v3_enemy&id=eny_0045_agtrinit` | 定位到三位一体 |
| `/?plugin=v3_cc&id=indie_contract001` | 打开危机合约赛季 |
| `/?plugin=v3_dungeon&id=indie_group_ccdg` | 打开危机合约副本系列 |
| `/?plugin=v3_archive` | 打开全部档案一览 |
| `/?plugin=v3_archive&id=document_v0d8_10` | 打开指定档案组 |
| `/?plugin=misc&id=weekly_tasks/week3` | 打开杂项中的每周任务并定位第 3 周 |
| `/?plugin=misc&id=character_icon_generator` | 打开角色图标生成器 |

路由使用 `history.replaceState`。设置中的“保持 URL 完整”关闭后，初始深链接仍能读取，但页面会清理地址栏参数。

## 全局设置

主设置入口是 `index.html` 中的设置弹窗，不是 `plugin/settings.html`。

设置通过 localStorage 保存：

- 主题
- 语言（`CH TC EN JP KR RU MX BR DE FR VN TH ID IT`）
- 是否显示隐藏模块
- 是否显示截图导出按钮
- 角色、武器、敌人和技能默认等级
- 是否保持 URL 同步
- 已解锁的模块令牌
- 已读网站公告版本（`akedata-tipversion`）
- 主左侧栏及各模块副左侧栏宽度

保存设置后会广播 `globalConfigChanged`，模块据此刷新筛选和等级显示。语言切换会刷新页面，以重新加载当前语言的模块资源和 TableCfg hydration 缓存。恢复默认设置时也会清除已保存的侧栏宽度。

## 富文本

模块应通过 `window.parseText(text, imageBasePath)` 渲染可能包含游戏标签的文本。

支持的主要格式：

```text
<@styleId>文本</>
<#termId>术语</>
<image="path" scale=1.0>
```

样式和术语分别来自 `public/TableCfg/RichTextStyleTable.json` 与 `public/TableCfg/HyperlinkTextTable.json`。术语文本通过当前语言的 `I18nTextTable` 水合，样式表的 `preDef` 会转换为网页解析器兼容的文字颜色、遮蔽标记背景与图标配置。标题、目录名称等游戏文本也应通过该解析器渲染，例如 `<@nar.mark>■■■</>` 会保留游戏中的遮蔽效果。当前解析器假定数据可信，不应直接用于用户提交的未过滤 HTML。

## 开发新模块

### 注册模块

在 `plugin/manifest.json` 添加：

```json
{
  "id": "your_module",
  "title": "modules.your_module.title",
  "description": "modules.your_module.description",
  "priority": 30,
  "icon": "图标",
  "contentFile": "/plugin/your_module.html",
  "hidden": false
}
```

- `priority` 越小越靠前。
- `hidden: true` 可通过全局设置恢复。
- `disabled: true` 会在加载 manifest 时彻底移除。
- `title` 和 `description` 应填写 i18n key，并在 `public/<语言>/i18n.json` 中统一维护。
- `settings` 是保留 ID，不会作为普通模块显示。

### HTML、CSS 和控制器

模块 HTML 通常包含：

```html
<link rel="stylesheet" href="/theme/your_module.css">
<div class="your-module">...</div>
<script src="/plugin/js/your-module.js"></script>
```

控制器建议使用 IIFE，并遵循以下运行时约定：

- 请求资源使用 `window.akeFetch || fetch`，不要绕过缓存和 v3 拦截层。
- 初始化前可等待 `window.configLoaded`。
- 配置变化监听 `globalConfigChanged`。
- 富文本使用 `window.parseText`。
- 数值调试提示使用 `window.renderRawValueTip`。
- 条目导航使用 `window.__akeRouter.updateUrl(moduleId, id)`。
- manifest 加载后处理并清空 `window.__deepLinkId`。
- 同时验证桌面和小于 1000px 的移动端布局。

### 新增杂项子模块

杂项使用独立的二级注册表 `plugin/misc/manifest.json`。子模块至少填写 `id`、`title` 和 `contentFile`，可继续使用 `priority`、`hidden`、`disabled` 与 `token`；二级清单不接受 `icon` 或 `description`。子模块页面必须放在 `plugin/misc/`，控制器统一放在 `plugin/js/`。

```json
{
  "id": "your_misc_module",
  "title": "modules.misc.yourModule.title",
  "priority": 70,
  "contentFile": "/plugin/misc/your_misc_module.html"
}
```

页面中的外部脚本必须位于 `/plugin/js/`，且不能使用内联脚本。控制器通过 `window.AKEMisc.register(id, factory)` 注册；宿主会向 `factory` 提供当前根节点、TableCfg 读取、路由、取消信号、事件和定时器管理，并在切换子模块或离开杂项时统一销毁。子模块内部条目使用 `context.navigate(innerId)` 生成 `?plugin=misc&id=<子模块>/<条目>` 深链接。新增脚本后同步登记 `version.json` 的 `jsversion`，修改二级清单或页面结构时同时更新 `appversion` 与 `pluginversion.misc`。

杂项子模块读取游戏数据时继续使用宿主提供的 `context.table()` 或 `window.akeFetch`。仅供站点工具自身使用、需要与代码一同发布的静态素材可放在 `public/misc/`；游戏配置和常规游戏图片仍遵循 TableCfg、Json 与 R2 图片数据的既有职责划分。

### 新增 v3 适配器

若继续使用当前 v3 架构：

1. 在 `plugin/js/v3-table-data.js` 实现 manifest 和 detail adapter。
2. 将适配器加入 `adapters`。
3. 扩展请求正则和 `MODULE_ALIASES`。
4. 创建 `plugin/v3_<module>.html`。
5. 确保适配结果严格符合复用控制器的数据契约。
6. 检查关联的 TableCfg、Json 和图片路径。
7. 验证 Int64 文本引用、排序、隐藏项和深链接。

## 验证

仓库当前没有自动测试、lint、打包工具或 CI。提交前至少执行：

```powershell
python -m json.tool "plugin/manifest.json" > $null
python -m json.tool "plugin/misc/manifest.json" > $null
git diff --check
git status --short
```

浏览器回归至少覆盖：

1. 公开模块列表顺序，确认杂项位于奖章之后，并确认 `v3_skill`、`v3_buff` 不出现在桌面或移动端入口。
2. 十一个公开 v3 模块、战争回响专题和杂项七个子模块的列表与详情。
3. 搜索、筛选和默认等级。
4. 合法与非法深链接，包括杂项子模块和内部条目路由。
5. 显示隐藏模块后访问 v2 与开发工具模块，并检查任务 ID、条件目标及商店组/商店开放条件的显隐。
6. 亮色、暗色和护眼主题。
7. 桌面和移动端列表滚动，确认杂项左右区域独立滚动及商店移动端商店组按钮可用。
8. 协议通行证的赛季、类别、周次筛选，三档全等级与循环奖励；每周积分里程碑及自动换行的根脉历程奖励。
9. 商店商品的物资调度等级提示，以及装备制造模板和成品的各类获取来源。
10. OEM 按钮点击前不读取 LevelData，点击后能以实时计算的短链打开对应模板箱点位，且不请求 LevelData manifest。
11. 角色图标生成器的角色与技能选择、三种构图、1024 像素预设、自定义比例、技能带属性图层、透明背景和 PNG 下载；同时检查角色技能弹窗、富文本、节点等级、自主编辑和水印解析。
12. 资产模块的令牌访问、目录别名、游戏版本与 Hotfix 版本识别、新增标记、仅看新增筛选、快速跳转和目录折叠，并确认桌面端与移动端状态一致。
13. 档案库起始一览、分类目录、全文搜索、组内条目切换、档案组深链接、富文本标题、正文图片、主角差分图片和音像文字转录；使用 Latest 时检查新增档案区、分类内置顶、组内新增条目标记，并确认固定历史版本不显示新增状态。
14. 副本 SpawnerConfig、波次和 BuffData。
15. 富文本、遮蔽标记与两层 tooltip。
16. 截图、缓存刷新和 localStorage 设置恢复，并确认档案详情可完整导出长图。
17. 首页倒计时的东八区转换、空 `desc` 隐藏、到期归零。
18. 公告按钮重复查看、`tipversion` 变化自动弹出、各语言 `tip.md` 和移动端右上角布局。

## 已知限制

- 多数 v3 模块仍通过 TableCfg/Json 到 v2 UI 的兼容适配层工作，数据契约尚无类型或 schema。
- 档案库的音像存档当前仅展示文字转录，不提供音频读取或播放。
- 大型 TableCfg 会整表下载、解析、递归本地化并缓存，首次打开部分模块可能较慢。
- 各语言的 TableCfg 文本已接入，但部分站点界面和枚举仍沿用英文占位翻译。
- 路由使用 `replaceState`，没有完整的浏览器历史导航生命周期。
- 动态模块没有统一卸载钩子，长期运行时需注意全局监听器和动态样式。
- `optionalJson` 对缺少的 LevelData/SpawnerConfig 静默降级为基础 TableCfg 展示。
- 根绝对路径使项目默认要求部署在域名根路径。
- 客户端令牌和隐藏设置仅是 UI 门槛，不是安全边界。

## 许可证与版权

项目代码采用 [GNU Affero General Public License v3.0](./LICENSE)。通过网络提供基于本项目的修改版本时，需要遵守 AGPL-3.0 的源代码公开要求。

项目中的游戏配置和运行数据（`public/TableCfg`、`public/Json`、`public/CH`）以及游戏相关图片（`public/images`）版权归鹰角网络及相关权利方所有。本项目仅供学习、交流和研究，不得用于侵犯权利方权益或其他非法用途。

本项目是同好项目，与鹰角网络和 Gryphline 官方无关。所有商标归各自权利方所有。

## 数据合作

- [Perlica Bot](https://bot.perlica.tech/)：QQ 机器人与《终末地》游戏助手
- [终末地地图集](https://opendfieldmap.cn/)：地图工具
- [CEP 终末地基质规划器](https://end.canmoe.com/)：基质、精锻和养成规划工具
- [排轴终端 - Endaxis](https://www.end-axis.com/)：排轴模拟器
- [终末地战斗日志](https://zmdlogs.com/)：战斗数据记录和竞速排行
- [终末地一图流](https://ef.yituliu.cn/)：《明日方舟：终末地》材料价值计算、性价比计算，以及攒抽计算等其它小工具。

## 赞助支持

您的赞助将用于服务器维护，功能开发，内容创作。

| 支付宝 | 微信赞赏码 |
| --- | --- |
| ![](https://github.com/NagiYume/AKEDatabase/blob/main/public/images/about/alipay.png) | ![](https://github.com/NagiYume/AKEDatabase/blob/main/public/images/about/wechat.png) |


## 联系方式

- Bilibili：[@渚汐奏梦](https://space.bilibili.com/694452100)
- 用户反馈群：1091817282
- GitHub：[nagiyume/AKEDatabase](https://github.com/nagiyume/AKEDatabase)

项目开发中大量使用了 AI 工具辅助编程。数据和实现可能存在错误，请以游戏内实际表现为准。
