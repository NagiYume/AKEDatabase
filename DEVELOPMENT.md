# AKEDatabase 开发说明

本文档面向本地运行、功能开发和数据维护。项目主页请查看 [README.md](./README.md)。

## 项目概览

AKEDatabase 是一个无后端、无构建步骤的静态 HTML/CSS/JavaScript 应用。网站代码位于仓库中，游戏数据通过配置的数据域加载：

- `public/TableCfg`：角色、武器、装备、活动、奖励、档案和富文本等结构化表。
- `public/Json`：Buff、SkillData、SpawnerConfig、LevelScriptData、LevelData 等补充数据。
- `public/<语言>`：界面翻译、游戏文本映射、研究资料和网站公告。
- `public/images`：网站和游戏图片的本地目录；生产环境中的游戏图片由数据域提供。
- `plugin/manifest.json`：公开、隐藏和禁用模块的注册表。
- `plugin/js`：公共运行时和各模块控制器。
- `theme`：主题与模块样式。
- `version.json`：应用版本、模块脚本版本、公告配置和数据域配置。

主要公开模块包括角色、武器、敌人、装备、物品、活动、副本、商店、奖章、档案库、杂项、Baker、危机合约、战争回响、研究和资产浏览。

## 本地运行

项目没有 npm 依赖和构建步骤，但页面使用 `fetch` 加载模块和数据，必须通过 HTTP 服务运行，不能直接使用 `file://` 打开。

### VS Code Live Server

仓库已在 `.vscode/settings.json` 中将端口设为 `5501`。从仓库根目录启动 Live Server 后访问：

```text
http://localhost:5501/
```

### Python

在仓库根目录运行：

```powershell
python -m http.server 5501
```

然后访问：

```text
http://localhost:5501/
```

必须以仓库根目录作为站点根目录。项目使用 `/plugin/...`、`/theme/...` 和 `/public/...` 根绝对路径，不支持未经配置的子路径部署。

## 数据源与调试

生产数据域为 `https://data.akedata.wiki`，版本清单路径为 `/manifest.json`。TableCfg 按游戏版本和 Hotfix 保存历史版本，Json 和 images 使用共享数据版本。

开发本地数据时：

1. 将 `version.json` 中的 `debugmode` 临时设为 `true`。
2. 在网页设置中选择 `Latest`。
3. 使用本地 `/public/TableCfg`、`/public/Json` 和 `/public/images` 数据运行。
4. 发布前将 `debugmode` 恢复为 `false`。

本地没有 `manifest.json` 时，Latest 会兼容未版本化的 `/public/TableCfg`。固定选择历史版本时仍会使用生产数据域中的对应版本。

## URL 路由

通用格式：

```text
/?plugin=<模块ID>
/?plugin=<模块ID>&id=<条目ID>
```

常用示例：

| URL                                         | 用途               |
| ------------------------------------------- | ------------------ |
| `/?plugin=v3_character`                     | 打开角色模块       |
| `/?plugin=v3_character&id=chr_0002_endminm` | 打开指定角色       |
| `/?plugin=v3_enemy&id=eny_0045_agtrinit`    | 打开指定敌人       |
| `/?plugin=v3_archive`                       | 打开档案一览       |
| `/?plugin=misc&id=character_icon_generator` | 打开角色图标生成器 |

路由使用 `history.replaceState`。设置中的“保持 URL 完整”关闭后，初始深链接仍可读取，但页面会清理地址栏参数。

## 应用结构

### 启动与模块加载

`index.html` 读取 `version.json`，再按版本配置加载公共脚本。`index-app.js` 读取 `plugin/manifest.json`，过滤禁用模块并按 `priority` 生成桌面侧栏和移动端菜单。

模块 HTML 通过动态加载插入页面。公共加载器负责脚本顺序、资源缓存、请求去重、有限并发和模块状态恢复；大型 JSON 可交由 Worker 解析。

### v3 数据适配

多数 v3 模块通过 `plugin/js/v3-table-data.js` 将 TableCfg 和 Json 数据转换为既有页面控制器使用的数据结构：

1. `plugin/v3_<module>.html` 激活对应适配器。
2. 适配器读取并本地化所需数据。
3. 既有控制器负责列表、详情、筛选和深链接。

商店、档案库等独立模块直接使用 `window.AKEV3.table()` 读取数据，不经过 v2 兼容响应。

### 缓存与版本

- `appversion`：网站通用资源和 Service Worker 的版本。
- `pluginversion`：各模块 HTML 的版本。
- `jsversion`：各 JavaScript 文件的版本。
- `sharedRevision`：Json 和 images 等共享数据的版本。
- TableCfg 缓存键：数据域与当前 Hotfix。

修改模块 HTML、JavaScript 或共享运行时后，应同步检查 `version.json` 中对应的版本字段。不同数据版本可以同时保存在 IndexedDB 中，切换数据域时不会混用缓存。

## 开发模块

### 注册顶层模块

在 `plugin/manifest.json` 中加入模块：

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

`title` 和 `description` 使用 i18n key，并在各语言目录的 `i18n.json` 中维护。`hidden: true` 的模块可通过设置显示，`disabled: true` 的模块不会进入运行时模块列表。

### HTML 与控制器

模块通常由 HTML 壳、模块样式和 `/plugin/js/` 控制器组成。控制器建议使用 IIFE，并遵循以下约定：

- 数据请求使用 `window.akeFetch || fetch`，不要绕过公共缓存和数据层。
- 初始化前等待 `window.configLoaded`（如模块需要全局设置）。
- 监听 `globalConfigChanged`，响应语言、主题和显示设置变化。
- 游戏富文本使用 `window.parseText`。
- 数值调试提示使用 `window.renderRawValueTip`。
- 条目导航使用 `window.__akeRouter.updateUrl(moduleId, id)`。
- 新增脚本后登记 `version.json` 的 `jsversion`。

杂项子模块使用 `plugin/misc/manifest.json` 注册，页面放在 `plugin/misc/`，控制器放在 `plugin/js/`，并通过 `window.AKEMisc.register()` 注册生命周期。

### 界面文本与富文本

网站界面文案统一放在各语言目录的 `i18n.json`，HTML 使用 `data-i18n` 和 `data-i18n-placeholder`。游戏文本通过 `I18nTextTable_*` 加载，非中文语言缺失时回退到中文文本。

可能包含游戏标签的内容应使用：

```javascript
window.parseText(text, imageBasePath)
```

常见标签包括 `<@styleId>文本</>`、`<#termId>术语</>` 和 `<image="path" scale=1.0>`。解析器面向可信数据，不应直接处理未经清理的用户输入。

## 数据发布

生产数据由 `https://data.akedata.wiki` 提供，发布脚本为 `tools/sync-r2.ps1`。凭据只应保存在本机 rclone 配置中，不得写入仓库。

完整的数据获取、TableCfg/Json/图片解析、资产差异同步和 R2 管理说明位于 [tools/ake-data-tool/README.md](./tools/ake-data-tool/README.md)。该目录中的独立说明应与工具实现保持一致。

PowerShell 发布脚本支持交互式和参数式运行。修改 Json 或 images 时使用共享数据模式；发布前先确认 dry-run 计划，再执行正式上传。TableCfg 历史版本目录默认不允许覆盖，回滚通过重新发布版本清单完成。

## 提交前检查

仓库没有自动测试、lint、打包工具或 CI。提交前可按改动范围进行以下检查：

```powershell
python -m json.tool "plugin/manifest.json" > $null
python -m json.tool "plugin/misc/manifest.json" > $null
git diff --check
git status --short
```

功能改动至少应检查对应模块的列表、详情、搜索筛选、深链接、主题和移动端布局；涉及数据源或缓存时，还应检查 Latest、固定历史版本和本地调试模式。

## 约束与已知限制

- `public/TableCfg/**` 和 `public/Json/**` 是受保护的数据目录，开发时只读，不应由功能改动直接修改。
- 多数 v3 模块仍使用兼容适配层，尚未建立统一的类型或 schema。
- 大型 TableCfg 首次加载需要整表下载、解析和本地化，部分模块可能较慢。
- 根绝对路径使项目默认要求部署在域名根路径。
- 客户端令牌和隐藏设置只是 UI 门槛，不是安全边界。

项目代码采用 [GNU Affero General Public License v3.0](./LICENSE)。