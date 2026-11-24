# AKEDatabase

- 新会话先判断用户的问题。仓库审阅或开发按[项目开发 skill](skills/akedatabase-development/SKILL.md)的短索引选读相关规则；无关问题无需加载仓库 skill。总览、记忆和模块目录按需检索，避免整库通读。以当前仓库为维护源，用户当前任务的明确要求优先。
- `public/TableCfg/**`、`public/Json/**`、`public/Dump/**` 是只读输入，不编辑、格式化、生成、覆盖、移动或删除其中的文件。
- 游戏数据优先通过 TableCfg 的真实关联读取。新增同结构记录应自动收录；未知类型保留可识别内容并报告，不以固定 ID 或类型白名单静默排除。
- 遵守用户指定分支和分析/实施模式。只读任务不修改文件或版本；不自动提交、打标签或发布。
- 默认不运行测试、构建、lint、格式或语法检查、Node、服务器、浏览器或截图，也不通过子代理执行；仅在用户授权范围内验证。允许为任务读取代码、数据和 Git 差异。
- 新功能可在保持页面整体风格的前提下编写 CSS；未获当前任务授权不修改 README、公告；优先复用已有 `ake-ui-*` 与公共 JS。开发说明和规则变更也应属于任务范围。
- 修改 `tools/ake-data-tool` 时还需读取该目录的 `AGENTS.md`；配方查看器遵循 `skills/akedatabase-development/references/recipe-flow.md`。
