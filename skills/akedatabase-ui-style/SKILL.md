---
name: akedatabase-ui-style
description: 在 AKEDatabase 新建模块或调整页面布局时统一目录、详情、分节、筛选、卡片、状态与移动端的呈现，依据现有 AKEUI 组件和三主题选择结构。用于模块界面实现及风格审阅；不替代数据适配与模块注册规范。
---

# AKEDatabase 页面风格统一

开始前读 [项目开发规范](../akedatabase-development/SKILL.md)，新模块同时读 [模块创建规范](../akedatabase-module-creation/SKILL.md)。权限、CSS、版本和验证边界以项目开发规范及当前用户要求为准。本 skill 负责选择和组合已有界面结构，新功能可按项目开发规范补充样式。

## 先选页面结构

读取相近页面的 HTML、实际加载的 JS、`plugin/js/ake-ui.js` 和相关主题选择器。不要只复制类名；确认父子结构、属性、事件绑定与移动端结构。按需读 [现有实现与样式来源](references/existing-patterns.md)，其中数值是审阅快照，当前源码优先。

| 页面用途 | 优先选择 | 参考入口 |
| --- | --- | --- |
| 条目目录、搜索与详情 | `ake-ui-directory`，业务适配由 `AKECatalog.mount` 接入 | `plugin/spaceship.html`、`plugin/js/ake-catalog.js` |
| 目录包含分类选择 | 同一目录骨架，按业务增加共享筛选控件 | `plugin/tutorial.html`、`plugin/v3_item.html` |
| 搜索结果、工具或操作页 | `ake-ui-detail` 或已有 `ake-ui-tool` 结构，按需组合 toolbar、结果区、状态区 | `plugin/search.html` 及其加载的脚本 |
| 已有实体的另一种展示 | 复用该实体当前渲染器与详情头结构 | `plugin/v3_item.html` → `plugin/js/v2-item.js` |

风格统一不要求每页都有侧栏、统计、巨幅图片或筛选器。左侧优先保留搜索、必要筛选和条目；标题、计数、说明仅在有实际用途时加入，用户要求精简时不补回。不得为了套模板添加无关控件。

## 信息层次与布局

- 目录外壳使用 `ake-ui-directory`，保留 `__sidebar`、`__search`、`__list`、`__content` 的层次。列表项优先用 `AKEUI.directoryItem`，选择态用 `setDirectoryItemActive`；业务 ID 用于选择与路由，不直接作为可见标题。
- 详情优先用 `AKEUI.detailHeader` 组织名称、图标、副标题和必要元信息。普通小图标与 `showcase` 大图布局按内容选择，不照搬角色立绘比例给所有实体。
- 普通分节使用 `ake-ui-section`，其内部为 `ake-ui-section__header`（含 `h3.ake-ui-section__title`）和 `ake-ui-section__body`。在 `ake-ui-detail` 内，这一结构提供强调色竖线、分隔线和标题层级；仅加 title 类不会得到同一效果。
- 嵌套分节需要次级标题时用已有 `ake-ui-section__header--nested`。可折叠内容可参考 `AKECatalog` 的 `details.ake-ui-section > summary.ake-ui-section__title`，不要强行将普通 header 与 summary 两套结构混用。
- 使用 `ake-ui-meta-grid` 展示短属性，`ake-ui-table-shell > table.ake-ui-table` 展示行列关系，`ake-ui-card` 展示独立条目。避免给每段文字都套卡片；是否需要 surface 分节取决于信息分组。
- 详情操作放在相应标题／操作区域。展开入口复用 `AKEUI.disclosureButton`，同步 expanded 状态；只有接入既有高级链接功能时才沿用其 `v2e-toggle-btn` 等绑定约定，不把业务类名变成所有新按钮的要求。
- 先检查容器已有 padding 和滚动责任，再组合详情与目录。当前目录 content 和 detail 都有内边距，不为追求局部紧凑而随意叠加或内联抵消；参考实际相近模块的完整结构。

## 控件与内容组件

| 需求 | 复用入口 | 注意点 |
| --- | --- | --- |
| 搜索、输入、操作 | `ake-ui-input`、`ake-ui-control`、`ake-ui-button`、`ake-ui-toolbar` | 沿用所在骨架的控件类型和密度 |
| 分类按钮与折叠筛选 | `AKEUI.filterButton`、`updateFilterPanel`、`ake-ui-filter__*` | 展开状态、筛选集合和选中态同时更新 |
| 单选下拉 | `select.ake-ui-control--select`、`AKEUI.refreshSelect` | 公共增强器负责外观；动态替换选项后刷新 |
| 标签与简短属性 | `AKEUI.badge`、`metaGrid` | 技术 ID 不混进普通标签或副标题 |
| 表格与卡片 | `AKEUI.dataTable`、`card` | 读取当前签名，使用现有包装及内容槽位 |
| 物品、数量、关联跳转 | `materialItem`、`materialPopover`、`entryLink` / `entryLinkHtml` | 用真实目标 ID；复用资源处理与路由 |
| 加载、空内容、失败 | `stateView` / `setState`、`ake-ui-state` | 区分加载失败、合法空数据及筛选无匹配 |

筛选形式先服从用户要求。按钮适合需要直接比较的分类，下拉适合压缩单选空间；不要将帝江号的舱室按钮或教程的下拉写成全站唯一形式。业务脚本负责实际筛选和排序，组件只提供呈现与交互基础。

物品展示采用“图标在前、名称在后”，数量紧随物品，成本、奖励、材料与关联物品均遵循此规则。使用 `AKECatalog` 的模块启用 `itemIcons: true`，让 `c.item`、`c.items` 和 `c.reward` 复用已有物品图标与跳转；其他渲染器复用 `AKEUI.materialItem` 等公共组件。图标从实际物品字段和现有资产处理取得，缺图仍保留名称、数量与链接，不用猜测设施 ID 代替物品 ID。

名称和普通字段转义，描述富文本复用 `parseText` 或当前适配器的 rich 入口，数值提示复用 `renderRawValueTip`。界面标签与状态使用现有 i18n 键；缺名提供本地化安全回退。`AKEUI` 的 `id` 参数会直接显示内容，调用方必须在 `showHidden === true` 时才传入游戏 ID，不能假定组件自动隐藏。

## 主题、图标与密度

默认继承组件的字体、行高、间距、边框和圆角。优先使用主题已有的 `--ake-ui-space-*`、`--ake-ui-radius*`、`--ake-ui-border`、`--ake-ui-surface*`、`--text-color`、`--desc-color`、`--accent-color`，不从某个主题截图提取固定色值或另建设计 token。

图标使用真实素材关联及现有图标／材料组件。保留原有容器的缩放、缺图回退和加载处理，不强制所有图片裁成同一种比例。稀有度、类别色和详情强调色只在有明确业务语义时使用；帝江号的图标底色、滤镜和填充比例不是全站默认值。

已有组件无法表达新功能时可补充 CSS。共享结构写入 `theme/light.css`，模块特有规则限定作用域；审阅 dark/yellow 并补齐相应主题变量，按开发规范更新三份 `cssversion`。不能在模块 HTML 内放 `<style>`、加载独立 CSS，或用内联布局／颜色绕开 CSS 边界。共享组件既有的数据驱动变量接口可按其原有语义使用。

## 移动端与交互状态

- 目录页保留移动列表按钮、overlay、panel、关闭按钮与移动列表容器。使用 `AKECatalog` 时保留 `data-catalog-open/close/overlay/mobile-list` 等约定，不只做桌面侧栏。
- 桌面与移动列表共用条目、筛选和当前选择；选择后关闭移动面板。沿用组件的断点和滚动区域，不在业务 JS 中另定一套宽度断点。
- 表格由 table-shell 承担横向溢出；长标题、英文文案和富文本使用公共换行结构。不要靠固定整页宽度或隐藏正文解决溢出。
- 使用 button、input、select、summary 等正确元素；保留 label、键盘焦点样式、`aria-expanded`、`aria-hidden` 与控件实际状态的一致性。图标操作要有可读名称，不能仅依赖颜色表达选择。
- 状态放在对应区域：整页加载使用已有 page 布局，分节无内容使用 compact；失败不可伪装为空列表。动态内容和详情切换遵循公共控制器的挂载与清理生命周期。

## 静态审阅与交付

读取修改内容和 Git 差异，核对所用 API、类名、DOM 层次及主题作用域确实存在。说明选择了哪个参考模块、复用了哪些组件、哪些业务差异需要保留。不要为了统一新模块顺带重写旧页面。

默认不运行测试、构建、lint、语法检查、Node、浏览器、截图或 skill 验证脚本。列出本次相关的用户验收点：三主题、桌面／窄屏、长文本、缺图、加载／空／失败、筛选与选择、折叠／弹层、隐藏信息开关。明确这是静态审阅，不宣称已经验证视觉效果。

仅维护本 skill 及其入口不更新网站资源版本；实际页面变更遵循项目开发规范。
