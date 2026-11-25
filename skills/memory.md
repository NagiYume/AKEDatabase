# AKEDatabase 项目记忆

这里保存下一位维护者接手工作所需的版本沿革、决定、依据和未决事项。[总览](overview.md)用于找入口，[开发 skill](akedatabase-development/SKILL.md)维护工作规则。可按版本号、提交、模块名或字段名搜索本文。

## 当前交接

- **1.7 角色网格粒子渲染（2026-11-25）**　`beta` 的 `7369c0ad` 合入本地 `main`。[渲染脚本](../plugin/js/ake-renderer.js)用于独立模型查看器和干员详情内嵌视图，合并时以 `main` 的 `1.3.9-2` 为基线，同步 [version.json](../version.json) 中站点、两个模块及渲染脚本的缓存版本至 `1.3.9-2-pre1`。未运行浏览器验证。

- **影拓丰碑与牌局（2026-11-25）**　main 工作区：丰碑按 hdId 合并系列，兼容原系列深链；本期两个 Boss 用各自开放时段和共同活动结束时间。新增普通入口「牌局」，教学、结算、牌型、遗物、商店和多人房间数据及搜索接入见[模块说明](modules/cardgame/SKILL.md)。配置快照 12026241-3，静态审阅，未运行页面或测试。

- **新会话按任务读取 skill（2026-11-25）**　`main` 工作区未提交。根 [AGENTS.md](../AGENTS.md) 与[开发 skill](akedatabase-development/SKILL.md)改为按用户问题定位模块、规则与历史段落，取数、前端、搜索和版本规则已拆入独立参考页。已静态复核入口，未做新会话实测。

- **Json 逐项跳过（2026-11-25）**　`main` 工作区未提交。`json-job-20261125-063040-820711.log` 对应的宿主报告选中 24,634 项，写出 24,633 项，`GameplayConfig/MultiTriggerTable.json` 在 UTF-8 解码时失败，父进程因退出码 1 拒绝整批。现接受有成功输出且计数自洽的完成报告，失败仍保留诊断。本地发布保留同路径旧文件，`json_publish_skips` 将失败路径排除在 R2 比较与同步的文件和索引变更之外。未重跑解析、发布或上传。

- **1.7.2 桌面运行时下载与图片解析（2026-11-25）**　`main` 工作区未提交。Json、GlobalBuff 和图片共用 [runtime_download.py](../tools/ake-data-tool/ake_tool/runtime_download.py)。缺少完整本地运行时时，使用已准备状态的官方包地址和 `game_files` 清单逐文件校验并缓存。用户的 `image-job-20261125-062738-032925.log` 显示 1.7.2 图片运行时九项下载校验完成，Bundle 阶段在 `10f732046a45dc4554a6371f.ab` 和 `df095b0163539eeac659402b.ab` 报 `Endfield payload exceeds bounds`。两份逻辑 Bundle 的 VFS MD5 均匹配。独立读取元数据确认 `0x80` 块记录后有四字节扩展，补读后边界吻合，但现有 LZ4Inv 路径仍无法解码此类载荷。后续在 UnityPy 子模块修正块表并为图片工作进程提供按区间读取的节点流，[image_parallel.py](../tools/ake-data-tool/ake_tool/image_parallel.py) 按资源记录实际触及的扩展块。在 11 个此前整包跳过的 1.7.2 Bundle 中，2,425 个路径已有 2,404 个在内存生成并通过 PNG 完整性检查，另 21 个仍需解码 `0x85` 的两种扩展值（`b0c1dd0b`、`b0c9dd0b`）。未运行全量解析或发布，父仓库与子模块均未提交。详见 [AKE Data Tool](ake-data-tool/SKILL.md)。

- **1.3.9 工作区正式版（2026-11-24）**　main 未提交。网站版本及本轮资源缓存号为 1.3.9，AKEGF 规范仍为 v0.3 草案。根 README 与 public/<语言>/tip.md 同步更新，tipversion 已递增。AKEGF 按站点语言读取 public/<语言>/akegf 四份正文和界面翻译，覆盖 14 个语言目录。已静态核对资源、目录及文档入口，未执行运行验证；按用户指定仅完成工作区正式版。

- **站位图等比例修复**　`beta` 网站资源版本为 `1.3.8-1`。正方形绘图区原先分别按 X/Z 范围缩放。[ake-combat-data.js](../plugin/js/ake-combat-data.js) 的 `spawnMapProjection` 现在为两轴选用共同范围，[v2-dungeon.js](../plugin/js/v2-dungeon.js)、[v2-cc.js](../plugin/js/v2-cc.js) 和 [season-tower.js](../plugin/js/season-tower.js) 用同一比例绘制网格和标记。同步 [version.json](../version.json) 和对应模块说明。已对照脚本加载入口及绘制公式，未运行测试或浏览器验证。
- **网站基线**　2026-11-21 整理时，本地 `beta` 为 `9486b859`，`version.json.appversion` 为 `1.3.8`。该版本的提交为 `fb22b1e0`，已含中英文公告及 README。11 月 20 日的 `9486b859` 只改数据更新倒计时和说明。文中的版本均指网站版本，另有说明的除外。
- **证据范围**　下列里程碑按本地提交和[中文更新日志](../public/CH/tip.md)整理。提交可用 `git show <短哈希>` 查阅，某版本的完整交付要连同前一版本以来的改动一起看。本轮未核验线上部署或浏览器表现。
- **待核验 · 合约与怪物**　第二期仍有缺少 Buff 对应关系的指标，见下文「合约与属性」。属性值上下限的完整实现和游戏内结果仍待核验。参考样例有明确期望值，可用于以后获授权的验证。

## AKEGF 工具认证与接入说明

2026-11-25，main 工作区 1.3.9-pre7。公钥目录首页与 /v1/providers.json 由 registry.py 从已有单键记录生成，登记和撤销时更新。首页已部署至 verify.akedata.wiki，公网发现 akegf-example 与 starward-ake 共两把有效公钥，HTML 及允许跨域读取的 JSON 已与逐键接口核对。AKEGF 合作页底部读取同一列表，沿用文章样式展示指纹、状态、有效公钥 PEM 和逐键链接。主站改动仍在工作区，未执行浏览器视觉验收。

2026-11-25，main 工作区 1.3.9-pre6。添加 v0.4 未签名和签名多角色示例的下载入口，独立校验器目录同步签名档案。示例专用提供方 akegf-example 的 3072 位 PS256 公钥已部署，kid 为 8cOMDGbXz6FFT7xjWXaCU2vGAT9LoIM8LQjxWGlYh_o。运行部署检查时比对两版数据相同，OpenSSL 验证原签名通过、改星级后失败，公网接口返回对应有效公钥。签名示例只用于测试，校验器独立提示，不纳入正式历史、同步或排行。未运行浏览器验证。

2026-11-25，main 工作区 1.3.9-pre5。Starward 移除 AKEGF 签名实现与导出时的私钥访问，只输出未签名 v0.4，已重建到原 win-x64 Debug 目录。v0.4 标准明确两种信任状态。通过格式检查且使用目录中有效公钥验签成功的档案可用于持久历史和排行。未验证档案只允许当前会话的查看、筛选和统计，禁止持久保存、同步到账号或用于进阶服务。站内校验分别显示格式和信任状态，合作页及工具说明已同步。独立校验器标注仅做格式检查。未运行站内或独立浏览器验证。

2026-11-25，main 工作区 1.3.9-pre4。v0.4 Schema 仅对 draw 强制卡池、获得物、星级和时间，赠礼和 unknown 等非抽取流水可省略缺失项。同步站内与独立 Schema、14 个语言首页及标准字段表，并在示例保留一条缺星级的赠礼。Starward 导出器保留旧缓存可用字段，省略无可靠值的字段，抽取记录继续按四项必填校验。已在原 win-x64 Debug 路径重建并用生成的 Starward.dll 验证合成的缺项流水、部分历史与抽取缺项拒绝。站内和独立浏览器包未运行验证。

2026-11-25，按用户更正，将 Starward 签名改回 Windows 客户端。保留已登记的 starward-ake 公钥及 kid。私钥由当前 Windows 用户的 DPAPI 加密文件提供，客户端使用 PS256 自动签署 AKEGF v0.4；缺少私钥时提示未签名。上海服务恢复只读公钥查询，移除签名端点、服务单元及服务器留存的签名私钥和授权码。已验证公钥在线、旧 POST 返回 405，以及本地代码生成的测试档案能用登记公钥验签，改 UID 后失败。站内合作页版本为 1.3.9-pre3。真实账号的 WinUI 导出未实测。

2026-11-25，AKEGF 规范升为 v0.4，站内缓存版本为 1.3.9-pre2。站内校验器按 info.version 选 v0.3 或 v0.4 Schema；签名字段只属于 v0.4。同步各语言的当前版本、示例及下载入口，合作项目原有版本按实际记录保留。独立 AKEGF-SchemaVerify 同步规则、示例和签名档案保留原字段的逻辑，独立浏览器包待重新生成。

上海服务器新建 3072 位 starward-ake RSA 密钥并登记公钥，kid 为 gYv-VQSVBIRSHiKqxACp8Y52-pHeaf0mnjRRdUtPaV4。私钥由 systemd 载入，公网 HTTPS 签名路径需要操作者授权码。部署中以公开 v0.4 文件取得签名，OpenSSL 验签成功，修改 UID 后验签失败。公网公钥查询成功，签名无授权为 401，有授权为 200。Starward 的 NagiYume 分支工作区新增所选国服角色的本地导出与授权签名导出，使用 RoleId、真实服务器 ID 和缓存双类流水。缓存无法判定的事件以 unknown 导出，缺少必填数据时报告并中止。Starward 使用本机 10.0.302 SDK 在隔离输出路径完成 x64 Debug 构建。真实账号数据和 WinUI 交互验收待用户执行。

2026-11-25，main 工作区未提交，网站资源版本 1.3.9-pre1。AKEGF v0.3 在 info 中增加成对可选的 export_provider 和 rsa_signature，沿用旧多角色示例作为无签名样例。签名覆盖带前缀的 RFC 8785 规范化档案，浏览器通过 Web Crypto 验证 PS256。14 个语言首页的 Schema 与各标准字段表已同步，中英文补齐签名协议、登记流程和校验文案。独立 AKEGF-SchemaVerify 同步 Schema，仍负责格式检查。

[公钥目录](akegf-verify/SKILL.md)已部署至上海服务器。verify.akedata.wiki 通过 nginx 提供只读 HTTPS 查询，管理员以 registry.py 登记和撤销。已检查公网靶域证书、健康接口 200、未知公钥 404、跨域与禁止缓存响应头、写请求 405、HTTP 到 HTTPS 308，并确认续期定时器已启用。生产尚无经认证的项目公钥，真实签名往返和浏览器校验待验收。网站资源仍在工作区。

main 工作区（未提交），1.3.8-1-pre6。中英文 validator.md 在格式校验工具页内说明文件校验与导入导出往返认证，侧栏保持四项。标准文档明确字段读写规则，事件含义与卡池观察分列；合作页按指定版本 v0.3 展示，未确认的导入导出能力单列。已更新导航和搜索元数据，theme/light.css 限定本模块表格换行与目录链接样式。仅静态审阅，未作浏览器或运行验证。

## AKEGF 子页路由与 Markdown 引用

main 工作区（未提交），1.3.8-1-pre4。AKEGF 四页使用文档基名作为 id，桌面和移动目录共用链接与站内 URL 同步设置。theme/light.css 在研究、AKEGF 和公告的引用段落保留换行。本轮只读审阅中文正文。仅静态核对，未运行浏览器或测试。

## 站内 Markdown 渲染

main 工作区（未提交），1.3.8-1-pre3。研究、AKEGF 与公告通过 index-app.js 按需加载 article-markdown.js，共用 marked.js、DOMPurify 和 highlight.js。两项渲染依赖使用固定版本的 jsDelivr 浏览器模块，并在导入失败时读取同版本站内副本。保留研究目录、站点图片路径、灯箱和公告版本已读逻辑。仅静态审阅；实际显示、CDN 回退、主题与移动端待用户验收。

## AKEGF 模块迁移

main 工作区（未提交），1.3.8-1-pre2。AKEGF 公开模块沿用研究模块的文章排版和共享解析器，四页正文分别放在 public/CH/akegf、public/EN/akegf。plugin/js/akegf.js 读取本站 v0.3 Schema，对粘贴及本地文件执行格式和重复键检查。合作项目页记录本站与配套校验器。按仓库规则仅静态审阅，切页、窄屏、语言、主题及有效/无效档案待用户验收。

开发规范、模块创建、页面风格 skill 和 AGENTS.md 已统一为适配新功能可自行编写 CSS，沿用三主题与整体风格约定。

## 版本里程碑

每组保留影响维护的结果和版本锚点。正式版本及有独立交付内容的修订优先，`pre` 中进入后续正式版的工作随正式版记录。小提交用于解释实现原因和兼容边界。1.2.0 以前只保留后续仍依赖的背景。

### 1.3 系列

| 版本与提交 | 交付及对后续维护的影响 |
| --- | --- |
| 1.3.8 · `fb22b1e0` | 第二期合约指标、黑板与 Buff 接入怪物计算，先应用变种，再应用 Buff。同一乘算区加成相加，最终乘算区分别相乘。多个玩法共用属性逻辑，设置可选择显示项目。下文保留数据缺口和算例。 |
| 1.3.7-2 · `c18323d8`；1.3.7-1 · `00584edd` | 前者读取第二期服务端下发的多语言词条文本和黑板，保留第一期 `tagTerms` 格式；后者按当前 `gameId` 限制合约页面的副本，避免共用副本系列时跨期显示怪物。数据来源与边界见[合约数据契约](akedatabase-development/references/data-contracts.md#危机合约数据)。 |
| 1.3.7 · `8bd7ff00` | 第一期合约指标数值由索引定位的配置恢复。参数缺失时保留页面与未解析状态。TableCfg 和已接入的 JSON 路径增加请求失败提示，可选文件正常缺失和主动取消除外。 |
| 1.3.6 · `1bfe1aab` | 客栈经营和农牧生产合为缘缘庄；开放工业科技树；百趣演武移入杂项并兼容旧条目链接。取消 1.3.0 的空闲模块预加载，调用时加载。模块内支持拼音；全站搜索沿用原有机制。 |
| 1.3.5 · `cae853bc` | 角色详情按需加载模型预览，多模块统一详情、卡片和语音组件。档案阅读补充来源与任务收录边界；危机合约研究 v3/v4 保留预测性质。此时科技树与牌型图鉴仍为隐藏入口，后续开放见 1.3.6。 |
| 1.3.4 · `3cc8f670` | 开放帝江号。后勤按角色合并、按舱室和效果筛选，并读取类型化参数排序；线索概率使用提升档位。具体关联见[后勤技能](tablecfg-analysis/references/spaceship-skills.md)。 |
| 1.3.3 · `26c4e20c` | 技能节点图合并相同子图，保留原始位置和参数。分类裁剪应保留前置路径及条件输入。 |
| 1.3.2 · `629ac291` | 正式开放战斗与 Buff，角色、武器、装备和敌人可跳转进阶数据。逻辑图描述技能配置，实际战斗分支、触发和伤害仍依赖运行条件。 |
| 1.3.1 · `9f0c2eb5` | 角色与武器收录前瞻表，培养材料和搜索一并适配；前瞻记录缺失的属性、立绘等字段按实际覆盖展示。 |
| 1.3.0 · `11e7e334`；1.3.0-2 · `e77adf7a` | 启动减少串行等待，大依赖按需加载。全局搜索由文本命中追到有证据的条目路由；无精确归属时保留候选状态。修订版接入影拓丰碑，复用副本适配与展示。 |

### 1.2 系列

| 版本与提交（同一行按版本顺序） | 延续到后续开发的变化 |
| --- | --- |
| 1.2.20、1.2.21 · `1ba52333`、`582021f2` | 档案库增加情报采集与组内批注；差分可按大版本、Hotfix 或关闭，资产模块开放访问。随后攻略图支持横竖版与配置导入导出；公共属性计算支持先覆盖原始值，再应用修正。 |
| 1.2.18、1.2.19 · `15d9cae0`、`d486be44` | 新增地区建设与矿点、据点等筛选；角色补特殊语音。后续用真实关联跨模块跳转，条目链接遵循新标签页设置，目录切换仍在当前页。角色与档案支持四种语音语言。 |
| 1.2.16、1.2.17 · `ffc3c2af`、`ca7c87e1` | 档案新增地图和任务文本，按实际正文识别变更，标题本地化补全曾造成误标。配方流程查看器串联多类来源、替代配方与下游用途；启动恢复兼容旧 v2 深链。 |
| 1.2.14、1.2.15 · `91a1dee8`、`3a4bf5ff` | 资产目录依据统一索引标记新增。1.2.14 只分游戏版本，1.2.15 扩展到 Hotfix；比较范围在 1.2.20 再次调整。同期新增技能弹窗生成器，并扩展角色图标导出。 |
| 1.2.12、1.2.13 · `92436e99`、`a08ada26` | 角色技能分层，活动附属表按需加载，三主题 CSS 可独立版本化。随后 Json 与图片改走统一资产索引；公共加载器支持去重、有限并发及大型 JSON 的 Worker 解析。 |
| 1.2.10、1.2.10-1、1.2.11 · `cad1072e`、`537292c6`、`23c1c241` | 档案从档案组、载体与分类进入，按正文/字幕检索；修订版加入档案基线比对。随后主要模块统一二级目录、公共组件、加载与错误状态。 |
| 1.2.8、1.2.9 · `dd7145cd`、`5de8a316` | 桌面侧栏可调，同次访问恢复条目与滚动位置。杂项成为独立子模块入口，收录任务中心与图标生成器，按需加载地图奖励来源。 |
| 1.2.6、1.2.7 · `31c3b875`、`2b62daf7` | Baker 收录同一联系人的多段通讯、选项分支和附件，支持深链。副本区分首通与重复奖励，活动时间轴以实际起止时刻定位。 |
| 1.2.4、1.2.5 · `eb9c5b91`、`6005a6d0` | 商店按组、分店、商品与奖励关联。图片改用原始目录结构；模块 HTML 和 JS 分别用各自的资源版本控制缓存。 |
| 1.2.1、1.2.2、1.2.3 · `356c0486`、`8e3da86b`、`4858f467` | 改善图片数据域恢复，怪物来源补入 LevelScriptData；数值浮层可追原值与公式。副本、合约与战争回响共用怪物渲染；普通模式隐藏内部 ID，仍可查看计算过程。 |
| 1.2.0 · `6eba8ace`；数据域迁移 · `9c90a386`（pre1） | 网站与游戏数据分离，TableCfg 按版本保存，Json 和图片共享。Latest 起初与上一个游戏版本最终 Hotfix 比较；详情仅比较实际展示字段，装备按单件 ID 判断新增。可配置基线见 1.2.20。 |

**1.2.0 之前**　角色、敌人、副本有既有 v2 控制器（`46b09345`、`9b245971`、`c80b11ba`），之后的 v3 页面仍有复用。1.1 系列建立多语言和战争回响入口（`4d00a48a`、`108a7bcd`）。早期参数、界面和加载策略以当前实现为准。

## 需要延续的实现决定

### 模块设计的历史依据

以下条目把旧会话中的具体要求定位到当前代码。版本沿革见上表，继续修改时进入相应模块的 skill。

| 使用场景 | 保留的决定与依据 |
| --- | --- |
| [干员好感赠礼](modules/v3-character/SKILL.md) | 1.2.15 系列会话曾区分「给干员的礼物」与「干员回礼」。回礼按角色与阶段定位 RewardTable，展开物品后分别展示。查 `characterGiftRewardIds`；直接取通用 GiftItemTable 会答错方向。 |
| [地区矿点](modules/region/SKILL.md) | 1.2.18 系列会话确认增产档位与地区等级不是一一对应。按 `isMineOutputUp` 提升地图矿点的阶段，再按矿点数据计算及汇总产量。地区有多少个等级不能推出矿点有多少档。 |
| [影拓丰碑](modules/monument/SKILL.md)与[百趣演武](modules/misc/gamble/SKILL.md) | 丰碑新增专题入口时，用户要求普通副本原展示继续保留；`e77adf7a` 将专题接到共用详情。百趣演武将六个类别改为六个目录入口，选中即展示整类内容，仍需支持精确定位；后来在 1.3.6 迁入杂项。 |
| [更新文案生成](modules/misc/update-copy/SKILL.md) | 1.3.4 系列会话限定统计新增、排除前瞻，每组最多五个名称。商店按新增商品统计，新增商店另列。参见 `misc-update-copy.js` 的 `definitions` 与 `generate`。 |
| [配方 PNG](modules/misc/recipe-flow-viewer/SKILL.md)与[技能弹窗](modules/misc/character-skill-popup-generator/SKILL.md) | 流程查看器导出曾因克隆页面继承颜色样式出错，保留独立导出布局与样式快照。技能弹窗为了复现游戏深色面板，固定用第二组富文本样式；该选择仅针对生成器。 |

### 合约与属性

- **跨期隔离**　`00584edd` 修复多个赛季共用系列时混入其他期怪物的问题。第一、二期 `gameId` 分别为 `indie_contract001`、`indie_contract002`，都引用副本系列 `indie_group_ccdg`，但各有关卡和场景。系列详情返回全部关卡，合约控制器 `plugin/js/v2-cc.js` 必须先选当前 `gameId`；不要在供其他玩法共用的 `dungeonDetail` 中全局裁掉系列关卡。随后 `c18323d8` 接入服务端指标文本与数值，普通 I18n 表不足以重建第二期指标。
- **第一期配置与缺失状态**　用户指定以 AKEData 提交 `6609e9370d113ebc0bddc031d249afe529dc45b1` 的 TableCfg 为基准生成第一期配置，沿用原显示方式、不标注历史来源；实际本地文件 `public/cc_data/indie_contract001.json` 被 Git 忽略，R2 的 `public/indie_contract001.json` 使用 `ccData` 索引记录，数据版本 `1.6.4@11343132-9`。`4cf85cb2` 完成解析和索引校验适配，`8bd7ff00` 纳入 1.3.7；抓不到某关卡参数时用“数值未解析”，不能因此阻断页面。JSON 加载失败沿用各模块原有错误状态，额外显示通用缺失提示；该范围是当时用户确认的行为。提交和当次对象索引上传有会话记录，网站部署和浏览器表现未由本会话核实。
- **服务端文本与黑板**　最初本会话只抓到第二期 32/39 条，不能由此推定其余服务器不提供。2026-11-12 的新抓包补齐全部 39 条词条的 78 个名称/描述文本 ID 和黑板记录；本会话生成并上传 `indie_contract002.json`，更新 `asset-sync-index.json` 的 `ccData.files`，对象 MD5、索引 SHA-256 和公开地址响应均当次回读一致；数据版本为 `1.6.4@11529267-11`。这只证明文本和黑板覆盖，不能推导 Buff 映射完整；具体协议、语言和解析方法见[合约数据契约](akedatabase-development/references/data-contracts.md#危机合约数据)。后续 1.3.8 对映射的补充及当下缺口以紧接的条目为准，不能将 11 月 12 日对象视为当前线上状态。
- **第二期数据的证据边界**　2026-11-11，本会话先核对第一期 `tagTerms.buffId`、当前 `CcTagTable` 与 2551 协议：已抓到的是 `tagId` 和有序黑板，不能由此证明 Buff ID 随该消息下发，也不能排除其他战斗消息。用户随后明确指定以对照图为第一信息源，并确认将图中候选按黑板顺序绑定，包括标注待确认的 `112302`、`112402`、`112403`、`112501`；这是一批数据的人工映射决定，不是服务器关系已证实。`112402` 图片只给一个 Buff，第二个空黑板保留 `mappingUnavailable`；`112403` 按用户确认的候选顺序绑定，不把此顺序推广到其他指标。2026-11-21 的本地 `public/cc_data/indie_contract002.json` 有 39 个指标键，32 个带 `tagTerms`，其余 7 个缺映射；查新数据时分别检查文本、`serverBlackboards`、`tagTerms` 和目标敌人。该文件不在当前 Git 跟踪中。11 月 11 日本会话曾将当时的 32 条数据对象上传 R2 并回读：对象 MD5 为 `ae7f05f6f84194e09602b137f4192768`，索引 SHA-256 为 `0573b7cf2b833fbbc37d73ac60a26c4a45e421a9012a03ae7b5f5c3d4468b030`，公开地址返回 HTTP 200；11 月 12 日的后续数据覆盖见上一条，不能把这组哈希当作当前线上状态。本次回填未重验远端。
- **可复用算例**　用户指定 60 级 `eny_0097_hsmino2_cc` 的生命值表达式为 `(297005 × (1 + 1.5)) × (1 + 0.3 + 1.2)`，结果 1856281.25。用户明确将变种先结算为新怪物基础，再合并同区 Buff；此前将三项逐个相乘的实现被这一规则及[新乘区导论](../public/CH/research/藕粉选修三%20新乘区导论.md)取代。`fb22b1e0` 中的 `ake-stats.js` 及各玩法调用点可追踪两个阶段；数据来源、共享入口和公式边界见[怪物变种与属性计算](akedatabase-development/references/data-contracts.md#怪物变种与属性计算)。乘区系数的零下限和属性值本身的上下限是两个检查点；前者已见实现，后者仍缺完整核验。
- **变种加成重复渲染**　用户在本会话实际页面中发现连续选择、取消指标会重复显示“变种加成”：`v2-cc.js` 的卡片初次渲染和指标刷新都插入该块，刷新却只替换 `.v2cc-current-buffs`。本会话改为初次渲染变种块、刷新时只替换 Buff 区域，后由 `fb22b1e0` 提交；未在本会话运行浏览器回归验证。查修复时检查 `renderCcEnemyCard`、`refreshDungeonEnemyStats` 及隐藏模式下的两个渲染入口。
- **1.3.8 本会话交付范围**　本会话在当时 `main` 本地改动 `v2-cc.js`、`ake-stats.js`、`ake-enemy-renderer.js`、`v2-dungeon.js`、`v2-enemy.js`、`season-tower.js` 与 `version.json`，并按用户发版请求整理 README 和中英文公告；当时未由本会话提交或部署。之后当前 `beta` 可见提交 `fb22b1e0` 已包含这些网站代码及文档，提交来自后续状态证据，不代表本会话执行了提交；本次未核验部署。用户后来要求补全 1.3.7 至 1.3.8 的非工具更新公告，但本会话在盘点差异后被中断，未完成该项。按用户本次要求不续做；后续若仍需补全，先核对现有公告和 `8bd7ff00..fb22b1e0` 的相关提交。

### 工具链与增量处理

- **数据发布边界**　`cca6f38b` 新增独立 Linux TableCfg 服务；`f7ece63c` 将两套工具的 TableCfg 解析迁至 Python。排查解析差异时对照 `tools/ake-data-tool/ake_tool/tablecfg_parser.py` 与 `tools/ake-server-tool/ake_server/vendor/tablecfg_parser.py`。部署和生产运行状态需要当期证据。
- **本会话 TableCfg 迁移与部署（2026-10-29，beta）**　用户要求只读参考 `export_tablecfg.py`，需要的逻辑自行重写；本会话完成桌面及服务端 Python 解析、移除服务端 JAR 调用，并按明确请求提交 `f7ece63c`，未推送。两端采用 `cryptography` 的 BLC/CHK 解密与 Spark 解码；本地虚拟环境和服务器依赖已更新。服务器代码当时已上传至 `/opt/ake-tablecfg/app` 并部署，保留监听设置（启用、10 秒间隔）与其他服务；独立解析验证 770/770，JSON 和必需表检查通过，文件名集合与此前 SDK 输出一致。该证据不等于逐字段与 SDK 全量相等，也不保证其他游戏版本兼容。报告当时位于 `/var/lib/ake-tablecfg/python-validation-20261029-2235/validation-report.json`，备份位于 `/opt/ake-tablecfg/backups/python-parser-20261029-222855`；本次文档回填未访问服务器复核。验证没有上传 R2，独立工具改动没有调整网站版本。
- **自动更新后版本显示不一致的根因**　同属 `f7ece63c`：`ake_server/storage.py::Storage.commit()` 的已发布历史版本分支及提交后未向调用方返回实际清单，`worker.py` 又沿用提交前状态。修复为返回原有或回读验证后的 manifest，成功后由其 `latest` 更新 `remote_latest`，同时刷新 `remote_missing_files=0`，不能简单将远端版本硬设为本次解析目标。离线回归和当时部署后的 `/api/status` 均已检查；当时 `official_version` 与 `remote_latest` 同为 `1.6.4@11343132-9`、770 表、缺失 0。这是当时状态，不能作为当前线上状态。解析器指纹及旧 SDK 完成记录的兼容边界见[解析工具契约](akedatabase-development/references/data-contracts.md#解析工具的运行与验收边界)。
- **本会话 Windows Json 接入及八项补全**　用户随后限定仅修改 `ake-data-tool`、服务端暂不加入 Json。本会话参考 `beyond-sdk-py`，完成 `json_host/`、`json_unpacker.py` 及 `image_assets.py::extract_json()` 接入，配套修改 `config.py`、`gui.py`；当时留在 `beta` 未提交、未推送、未部署服务器。2026-11-21 本地历史核对发现这些文件和八条路由已由后续提交 `3b5b7922` 收录，取代“仍未提交”的旧状态，但不归因为本会话执行了该提交。最初 8 个 GameplayConfig 未支持并非无数据；检查实际运行时类型及解密正文后，确认它们是 JSON 正文并补上 managed 类型路由：`InnSceneLayoutTable`、`PaintingScrollConfigTable`、`PoiLevelChangePerformBindingTable`、`PoiLevelChangePerformDataTable`、`RanchConfigTable`、`SubGameMiscConfig`、`TempAbilityActivateConditionTable`、`TyphoeaArcheryAffixTableV2`。精确类名查 `json_host/schemas.py`，前两项分别为 `InnSceneLayoutTableData`、`PaintingScrollConfigDataTable`，不能仅按文件名猜类名。
- **Json 实测范围与 Linux 余项**　当时使用 1.6.4 运行时和 `initial_11262943-8_main_11262943-8` 的已准备 VFS（与上述服务器 Hotfix 不同），GameplayConfig 54/54 通过，八项根字段保留；完整 `ImageAssetPipeline.extract_json()` 导出 23,328 个 JSON，失败 0、未支持 0，约 119 秒，再读 JSON 无 null 根。30 项 StringPool 辅助输入单列，不能算成漏导；当次无 LipSync 样本，不能声称该类型已验证。使用隔离状态与输出，原状态文件未变；失败保留旧结果、成功撤销旧发布授权、缺少运行时拒绝执行均做过隔离回归，没有上传 R2。历史报告 `E:/AKEImageWork/json-python-validation/integrated-complete/validation-summary.json` 在本次回填时已找不到，数字依据会话记录，未重新解析。Python Json 仍通过 Windows x64 DLL 执行游戏反序列化，并非纯 Python/Linux 原生；用户最后提出 Linux 方案需求，本会话未完成检索或运行验证，Wine 只是待验证方向。后续先查 `json_unpacker.py::run_json_export()` 的平台限制及 `json_host/export_json.py::REQUIRED_RUNTIME`，不要将已验证的 Linux TableCfg 能力推广为 Json 支持。
- **合约抓包与离线日志**　本会话在当时 `main` 的 Git 忽略目录 `analysis/ida-endfield/` 准备 `capture_cc.py`、`decode_cc_packet.py`、`decode_multilang.py`；`capture_full.py` 和 `full_log_decoder.py` 随后增加 `--decode-log`，保留原始 Base64 并尽力解压、解析组装消息。2026-11-11 离线处理一份已有日志，482 条组装消息中 466 条匹配 Protobuf、16 条保留字段级结果，2550 和 2551 各解析 4 条；此过程未启动游戏，不能视作新版本实时联调通过。脚本不在 Git 中，依赖本机协议、工具和消息映射，迁移或复用前须核对其存在和版本；完整日志可能含账户与会话数据，不应提交或直接分享。用户对游戏联调要求事先批准，且启动游戏时不得运行 IDA。
- **VFS 热更新决定与实现（2026-11-03，beta）**　本次补丁会话中，用户最终指定工作目录 VFS 为第一可信来源，按区块记录大版本及 Hotfix，避免只跑 TableCfg 却把 Json 也标成新版。首次初始化或跨 `game_version` 时，先复用已验证的工作文件，桌面再尝试游戏目录，最后完整下载，不应用补丁；同大版本后续热更新只以工作 VFS 为补丁基线，不再从游戏目录取文件，失败回退完整下载。服务端遵循同一策略但没有游戏目录复制。`1.6.3 → 1.6.4` 的 seed 变化本身不等于跨 `game_version=1.6`。本会话实现并提交 `66a42277`，未推送、未改网站版本；桌面 `pipeline.py`、`image_assets.py` 和服务端 `worker.py` 接入两侧 `vfs_update.py`，持久 VFS 与解析任务快照分开，解决清理旧任务时丢失补丁基线的问题。协议、状态与并行约束见 [VFS 补丁契约](akedatabase-development/references/vfs-hotfix-updates.md)。
- **补丁实测与部署边界**　本会话先用官方 TableCfg/Json 的 44、116、133 字节小补丁验证 hpatchz 产物大小与 MD5，再以真实 44 字节补丁和隔离 HTTP fixture 验证更新器七种情况：成功、同版复用、坏补丁回退、跨大版本游戏复制、跨大版本服务器完整下载、错误基线回退、应用阶段取消保留旧基线与版本。Windows 桌面、Windows 服务端副本、Linux 服务用户均通过；这是串行版小范围更新器验证，没有完整热更新后的解析或性能实测。随后上传并部署服务器 `worker.py`、`vendor/vfs_update.py`、`vendor/file_facts.py` 至 `/opt/ake-tablecfg/app`，安装已校验的 Linux hpatchz 并重启 `ake-tablecfg.service`；保留原监听设置与其他服务。备份及报告入口 `/opt/ake-tablecfg/backups/vfs-patch-20261103-213019/patch-test-report.json`，本机历史报告在 `%TEMP%/ake-vfs-smoke-20261103/`。当时服务恢复空闲，版本 `1.6.4@11343132-9`、770 表、缺失 0，未因本次测试产生新的解析发布；不能将服务状态当成新版全流程验证。本次回填未重查服务器或这些临时报告。
- **并行补丁及后续状态（2026-11-05，main）**　用户确认继续修改 AKEDatabase 中两个工具后，本会话将两侧 `_patch_batch()` 改为固定数量线程，每个任务下载、应用并校验一个文件，不同文件可重叠；上限为 `min(4, downloader.concurrency, len(jobs))`，用于限制 hpatchz 内存及磁盘压力。保持补丁失败完整下载、区块暂存完成后统一提升、取消时等待活动线程结束，补上共享资源/回调锁及独立 delta 临时文件身份。会话结束时只有这两个 `vfs_update.py` 的本地改动，未运行并发测试、未提交或部署。2026-11-21 本地历史核对显示 `6dbcda26` 已收录这两文件的 198 行新增、26 行删除，取代“仍未提交”的状态；不表示该提交由本会话执行，其其他改动不计入本条。后续 `42208ab4` 又改过桌面副本，当前两端不能盲目整文件覆盖。并行版 Windows/Linux 回归、取消后重跑、同基线多目标与性能收益仍无本会话实测；串行版七项测试和部署不能继承为并行版验收。
- **独立仓库尝试的范围**　本会话曾按用户要求从 `66a42277` 将两个工具的跟踪文件及 LICENSE 提取到 `D:/资料/code/AKE-updater`，新增仓库入口文档并初始化 `main`；没有提交、远端或历史迁移，未复制本地配置、缓存和游戏输出，源仓库未移除工具。后续检查该目录已不存在，原因未确认；用户最终明确回到 AKEDatabase 两个工具继续修改。因此不能把独立仓库视为现行维护入口，也不在本次文档整理中重建它。
- **桌面解析与发布精简（2026-11-02，beta；网站基线 1.3.6）**　用户明确保证只有自己串行使用脚本，要求同时优化 TableCfg、图片、Json 的复制、暂存与重复校验；这是桌面工具的使用前提，不推广为 Linux 服务或多写入者环境的保证。初次分析确认 Json 的运行目录提升、暂存目录到 public 都是重命名，真正的全量内容复制只有解析输出到暂存这一步，不能把目录层数当成复制次数；冗余主要在重复发布仍全量复制、图片重复合并与扫描全部历史输出。本会话随后实际修改 12 个工具文件：TableCfg/Json 共用 `file_copy.py::sync_tree_contents()` 按变化文件发布；图片增量用 `move_file_contents()` 合并且发布只取 `deltaExportPaths`；`file_facts.py` 在进程内共享摘要、验证与元数据结果，下载同时计算 MD5；移除图片全输出树摘要及提交索引前专门防并发的额外回读，保留执行入口的计划检查和最终远端回读。Json 不再将 managed 序列化结果重新解析成 Python 对象，父进程也不再逐个扫描输出计数；原始 JSON 仍检查格式。`release.py::upload_table_cfg()` 改为传输前写 `transferComplete=false`，成功后写 true，避免中断后无 pending 可续传；旧 marker 缺该字段表示当时已传完。实现边界见[桌面增量发布与历史保留](akedatabase-development/references/data-contracts.md#桌面增量发布与历史保留)。
- **上述优化的交付证据**　本会话当时仅在 `beta` 完成本地修改和静态复读，没有提交、推送、解析运行、测试、R2 上传或部署，也未改网站版本。2026-11-21 回填时确认本地提交 `c2baaf55`（2026-11-02，`update ake-data-tool`）已收录上述 12 个文件及历史清理实现，且未修改 `version.json`；这取代“仍未提交”的状态，但不表示该提交由本会话执行。该提交可定位本会话改动，当前代码中的后续并行调度、VFS 补丁等不归入本会话成果。运行性能、取消后重跑、跨卷移动回退、上传续传与清理仍缺本会话实测，其他会话此前的解析验证不能视为本次优化的回归通过。
- **导出保留与未完成清理**　用户要求只保留最新 2～3 次，最终实现选 3：TableCfg 下载/解析阶段保留最近 3 个版本任务；图片解析结束（含失败路径）按 profile 保留 3 个运行目录，保护状态引用的 Map；Json 当前输出加 2 个历史尝试，旧 `json-python-validation` 导出和 `json-diagnostic-*/output` 一并参与排序。只启动工具不清理；图片累积素材库 `output/standard`、`output/full` 不是备份，不能按运行历史删除。旧条目“2026-11-01 只做静态审阅”不完整：本会话实际做过以上代码修改，但未运行验证。用户后来再次明确授权删除，手动删除/迁移仍被执行工具以 `blocked by policy` 拦截，未成功删除或迁移，不能归因为 Windows 或脚本已运行失败。当时确认的 6 个旧目录约 1.14 GB：`E:/AKEImageWork/image-runs/standard/` 下 `bd9f00b1197246958f3f969e40d0e702`、`d6d6e2698d0640b694c1ceea390d6c3c`，`json-python-validation/` 下 `smoke`、`all-types-sample`、`full`，以及 `json-diagnostic-20261015/output`。这是当时清单，当前是否仍存在或后来被自动清理未知；接续先读 `image-state.json` 的 `profiles.*.{fullMapPath,deltaMapPath,pendingMapPath}`、`image_assets.py::_prune_export_history()`、`export_history.py::prune_exports()` 和实际目录，不重放旧删除清单。本次仅文档回填，未复查磁盘清理或续做旧任务。

## 后续回填与日常维护

每轮实际修改后，交付前把本轮结果合入相关版本、专题或下面的工作记录。可用一行写清「日期 / 版本或分支 → 做成什么、为何如此 → 提交或文件与符号 → 实际验证、余项及下一处入口」。发布、上传、运行和提交分别留证。事实发生变化时在原条目补充取代它的版本，已解决的事项从当前交接中移出。纯只读任务遵循其写入边界。

旧会话回填优先补用户决定、难以从 diff 看出的因果、数据来源与未决事项。可复用的方法在相应 skill 或 reference 只维护一份，本文件留下由来与链接。提交标题、重复的公告文案、逐次工具调用、无后效的试错、无依据的预测和凭据均不收录。多个会话写入前重新读取目标段落，局部合并；存在冲突时保留各自的版本与证据。

### 工作记录

- **2026-11-21 · 模块交付规则**　用户明确要求新建模块或修改现有模块时同步维护对应 skill 和项目记忆。具体落点见[开发规则](akedatabase-development/SKILL.md#接续项目工作)，[模块创建规范](akedatabase-module-creation/SKILL.md#完成系统接入)也已将其列为交付项。

- **2026-11-21 · beta · 按模块交接**　按两份模块清单为 32 个已启用的主入口、14 个杂项子入口建立[独立维护文档与索引](modules/index.md)。隐藏或有访问条件的现行入口按真实状态标注。部分现行页面仍加载 `v2-*.js`，修改落点以入口 HTML 为准。历史整理核对了本机项目会话中可读的消息、已有版本记录和本分支源码；只剩索引的旧记录无法还原完整对话。
- **2026-11-21 · 数据工具文档**　[桌面解析与发布](ake-data-tool/SKILL.md)、[Linux 服务](ake-server-tool/SKILL.md)各有独立入口。[桌面工具说明](../tools/ake-data-tool/README.md)已按 Python TableCfg、UnityPy 图片、本地 IL2CPP Json、GlobalBuff 四条路径更新。当前 `release.py` 的共享资产 10 GB 阈值用于提醒，图片差分保留远端历史；旧版发布策略只能作为当时的记录。此次仅以本地代码和文档核对，无解析、上传或部署。

- **2026-11-21 · beta · 项目文档**　建立[项目总览](overview.md)、本记忆和[旧会话回填入口](akedatabase-development/history-backfill.md)，并将修改后更新记忆接入开发 skill。依据本地版本提交、站内日志、现行源码及相关历史会话整理。此次仅作静态核对，旧会话可补各自独有的决定、验证结果与遗留事项。
