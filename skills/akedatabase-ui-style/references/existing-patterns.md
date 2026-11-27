# 现有实现与样式来源

以下为 2026-10-17 对 beta 分支的源码审阅，未运行浏览器或截图验证。路径相对仓库根目录；按当前代码重新定位，不把行号或数值快照当成新模块应复制的 CSS。

## 参考模块的适用范围

| 入口 | 已确认结构 | 借鉴范围与边界 |
| --- | --- | --- |
| `plugin/spaceship.html` | 搜索＋列表、详情、移动列表完整结构，加载 `ake-catalog.js` 和业务脚本 | 精简目录起点；房间图标和业务颜色不外推 |
| `plugin/tutorial.html`、`plugin/js/tutorial.js` | 目录标题、分组 select、计数；详情通过 `c.section` 生成折叠分节 | 分类及多页内容；标题／计数为可选需求 |
| `plugin/v3_item.html`、`plugin/js/v2-item.js` | `ake-ui-filter` 折叠筛选，稀有度／分类按钮容器，复用 v2 渲染器 | 复杂筛选及实体详情；v3 文件名不意味着业务脚本也叫 v3 |
| `plugin/search.html` | `ake-ui-detail` 下的表单 toolbar、status、结果区与分页 | 无侧栏结果页；`ake-ui-tabs` 的 sticky 用法不是所有表单必需 |
| `plugin/js/ake-catalog.js` | `directoryItem`、`detailHeader`、详情 article、空状态、移动列表与销毁 | 目录的统一呈现与生命周期；读当前 mount 签名后接入 |

## 结构与 API 的维护源

- `plugin/js/ake-ui.js`：末尾 `Object.freeze` 为公开 API；查看相应函数而非猜参数。`card`、`detailHeader`、`directoryItem` 会显示传入的 ID；公共组件不代替业务可见性判断。
- `plugin/js/ake-catalog.js`：普通详情为 `article.ake-ui-detail` 加 `AKEUI.detailHeader` 与业务 render 内容；`c.section` 使用 details/summary，常开普通分节可参考 `plugin/js/spaceship.js` 的 header/body 组合。
- `plugin/js/index-app.js`：加载模块时检查 `link[rel="stylesheet"], style` 并拒绝这些模板；仓库仍存在旧独立样式文件，不表示新模块可以加载。
- `theme/light.css`：共享 token、组件结构、响应式与局部模块规则；同名类可能还有模块作用域覆盖，不能仅看首次匹配。
- `theme/dark.css`、`theme/yellow.css`：主题 token 及模块作用域外观变量，文件头说明结构位于 light.css。

## 用来识别风格的当前值

| 内容 | 共享实现快照 | 实施方式 |
| --- | --- | --- |
| 间距与圆角 | space 1–5 为 4/8/12/16/20px；radius sm/默认/lg 为 3/6/8px | 继承组件，不写一份相同 CSS |
| 目录结构 | `minmax(255px, 282px) minmax(0, 1fr)`；侧栏有右边界，content 自身纵向滚动 | 保留 directory 层级，不把整个页面包成大卡片 |
| 移动目录 | 999px 以下隐藏桌面侧栏；1000px 起隐藏移动按钮和 overlay | 复用主题及移动列表结构 |
| 内容留白 | directory content 与 detail 各有 20px；窄屏 content 为 14px 10px 76px | 留意嵌套的累积留白及底部按钮占位 |
| 主标题 | detail-title 为 1.5rem、650 字重、1.25 行高；窄屏有缩小规则 | 用 detailHeader，不自行拼另一套字号 |
| 详情分节 | header 左侧 3px 强调线、底部分隔；nested 为更细线与次级文字色 | 必须匹配 detail + section header 层级 |
| 表面与边框 | surface 来自 module-bg，muted 来自 sidebar-bg；1px 主题边框 | 不固定白底黑字；保留主题继承 |

这些数值只解释现有外观，样式扩展遵循项目开发规范，并尊重用户提供的精确设计要求。页面中特定宽度、图标比例、分类颜色以及角色／武器等 scoped 规则不自动成为通用规范。
