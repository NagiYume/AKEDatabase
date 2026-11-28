# AKEDatabase 项目总览

AKEDatabase（站名 AKEData）是《明日方舟：终末地》的非官方静态查询与研究站。读者可以查对象详情、追踪材料和奖励、查看副本与战斗配置，也可以阅读研究或使用杂项工具。网站用 HTML、CSS 和 JavaScript 按需组装页面，无前端构建步骤。桌面数据工具和 Linux 服务负责准备数据，浏览器从数据域消费已发布的文件。

接手已有改动时，先读[仓库开发规则](akedatabase-development/SKILL.md)，查[项目记忆](memory.md)里相应版本、模块及待核验事项，然后核对当前分支的源文件。面向使用者的介绍和更新明细分别在[项目主页](../README.md)和[站内日志](../public/CH/tip.md)。

**修改某个模块时，直接从[模块维护索引](modules/index.md)按站内名称或路由 ID 进入。** 每个现行主模块和杂项子模块各有一份 skill，列出入口 HTML、实际脚本、数据关联及具体排查点。桌面工具见 [AKE Data Tool](ake-data-tool/SKILL.md)，服务端见 [Linux TableCfg 服务](ake-server-tool/SKILL.md)。

## 从访问入口到条目详情

| 要回答的问题 | 从哪里读 | 需要追踪的关系 |
| --- | --- | --- |
| 页面怎样启动，某个模块为何可见？ | [首页](../index.html)、[应用控制器](../plugin/js/index-app.js)、[模块清单](../plugin/manifest.json) | 首页读取网站版本与公共脚本。模块清单记录入口、顺序和可见性，路由按模块 ID 加载 HTML 片段或跳转到 `externalUrl`。杂项另有[子模块清单](../plugin/misc/manifest.json)。 |
| 一个条目由谁取数、谁渲染？ | [v3 数据适配器](../plugin/js/v3-table-data.js)、对应的 `plugin/*.html` 与其加载的脚本 | 角色、敌人等 v3 入口复用既有控制器。商店、档案等有独立控制器。应由实际 HTML 追踪依赖，同名或同前缀不足以判断归属。 |
| 游戏表、补充配置、素材各在哪里？ | [数据源](../plugin/js/ake-data-source.js)、[公共加载器](../plugin/js/ake-data-loader.js)、[资产索引](../plugin/js/ake-asset-index.js)、[数据调用指南](../DATA_API.md) | 数据域根清单选出游戏版本及 Hotfix 的 TableCfg 目录；Json 与图片按资产索引定位。表外数据如危机合约指标需核对专用文件与索引。 |
| 为什么换版本或刷新后看见旧内容？ | [网站版本清单](../version.json)、[缓存实现](../plugin/js/ake-cache.js)、[Service Worker](../ake-sw.js) | 网站模块、脚本、CSS 的版本用于站点资源刷新；游戏 Hotfix、根清单 sharedRevision、资产索引 revision 各有独立语义。首页 CDN 缓存另见开发规则。 |
| 搜索结果如何落到正确条目？ | [模块用表索引](../plugin/js/search-index.js)、[归属与跳转](../plugin/js/search-data.js)、[模块内搜索](../plugin/js/ake-module-search.js) | 全站检索先找到文本，再由业务关联生成模块与条目深链。模块内拼音筛选有独立实现。 |

## 业务与维护入口

| 范围 | 工作入口 |
| --- | --- |
| 角色、武器、装备、物品、商店、养成 | 从模块清单进入详情，追踪主表、材料、获取途径与关联对象。涉及收录、配方或枚举例外时查[数据契约](akedatabase-development/references/data-contracts.md)。 |
| 敌人、副本、危机合约、战争回响、影拓丰碑 | 先区分玩法提供的场景、变种和 Buff，再看[公共属性计算](../plugin/js/ake-stats.js)与[怪物渲染器](../plugin/js/ake-enemy-renderer.js)。技能与 Buff 逻辑图由[动作图](../plugin/js/ake-action-graph.js)组织。 |
| 活动、任务、档案、Baker、地区建设 | 从实体记录追踪文本、选项、附件及地区。档案会跨表和关卡索引，证据与差分边界见[文本关联案例](tablecfg-analysis/references/narrative-analysis.md)。 |
| 帝江号、缘缘庄、工业科技树、杂项 | 后勤筛选有[类型化参数案例](tablecfg-analysis/references/spaceship-skills.md)。查生产上下游、替代配方、画布导出时读[配方流程](akedatabase-development/references/recipe-flow.md)。 |
| AKEGF 交换规范 | [模块维护入口](modules/akegf/SKILL.md) 包含分语言 Markdown、v1.1 与 v1.2 规范以及站内校验工具。 |
| AKEGF 公钥目录 | [公钥服务维护入口](akegf-verify/SKILL.md) 包含认证项目的公钥登记、撤销与 HTTPS 部署。 |
| 公共界面、翻译、研究 | [共享组件](../plugin/js/ake-ui.js)与 `theme/` 维护展示。界面键在 `public/<语言>/i18n.json`，研究、AKEGF、公告的 Markdown 均通过 [共享渲染器](../plugin/js/article-markdown.js) 接入 marked.js 和 highlight.js。研究正文示例在 [CH/research](../public/CH/research)。游戏文本另从对应语言的数据表读取。 |
| 桌面解析与发布 | [工具规则](../tools/ake-data-tool/AGENTS.md)和 [ake_tool](../tools/ake-data-tool/ake_tool) 管理热更新资源、解析、导出与同步。涉及工具实现时核对当前流水线。 |
| Linux TableCfg 服务 | [服务实现](../tools/ake-server-tool/ake_server)和[运维说明](../tools/ake-server-tool/OPERATIONS.md)覆盖版本监听、表提取、校验与发布。该服务只处理 TableCfg；部分解析和 VFS 逻辑在两套工具中均有实现。 |

## 按任务选 skill

- 日常开发、版本管理及交付遵循[项目开发 skill](akedatabase-development/SKILL.md)。本地运行、URL 和目录说明见[开发说明](../DEVELOPMENT.md)。
- 新增独立模块时读[模块创建](akedatabase-module-creation/SKILL.md)。涉及页面布局、目录或详情组件时读[页面风格](akedatabase-ui-style/SKILL.md)。
- 查字段含义、文本外键、收录或素材来源时读 [TableCfg 分析](tablecfg-analysis/SKILL.md)。保留数据版本和关联证据。
- 历史决定、完成情况和待确认项集中在[项目记忆](memory.md)。旧会话按[回填提示词](akedatabase-development/history-backfill.md)将有新增价值的内容合入同一处。
