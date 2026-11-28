---
name: akedatabase-development
description: 按任务定位 AKEDatabase 审阅、开发和发版所需的项目规则。
---

# AKEDatabase 开发

遵循根 [AGENTS.md](../../AGENTS.md)。根据用户的问题、模块名或文件路径选读下表；任务涉及多个领域时补读对应项。新会话本身不触发批量读取。同一会话复用已读内容，任务范围或规则变化时再补读。

| 任务线索 | 读取入口 |
| --- | --- |
| 已知页面或模块 | 直接读目标模块的 `skills/modules/<模块名>/SKILL.md`（杂项在 `misc/` 下，目录名以连字符代替下划线）。只知道中文名或路由时，用 `rg -n -F '关键词' skills/modules/index.md` 定位。 |
| 新建模块、调整页面 | 新建读[模块创建规范](../akedatabase-module-creation/SKILL.md)。前端代码、文案或样式读[公共能力与界面](references/frontend.md)；新模块界面或布局调整再读[页面风格](../akedatabase-ui-style/SKILL.md)。 |
| 取数、计算或收录 | 读[数据与扩展性](references/table-data.md)。追踪表关系读 [TableCfg 分析](../tablecfg-analysis/SKILL.md)，来源例外或诊断读[数据契约](references/data-contracts.md)，配方画布读[配方约定](references/recipe-flow.md)。 |
| 搜索，或新增模块、调整用表、关联、收录、路由 | 读[搜索索引维护](references/search.md)。 |
| 修改仓库文件或发版 | 读[版本与发版规则](references/versions.md)，更新 `version.json` 的最后改动时间，并按实际影响判断是否递增网站版本。 |
| 桌面数据工具、Linux 服务 | 按目标读 [AKE Data Tool](../ake-data-tool/SKILL.md) 和该目录的[工具规则](../../tools/ake-data-tool/AGENTS.md)，或 [TableCfg 服务](../ake-server-tool/SKILL.md)。 |
| 入口不明、跨模块数据流、接续历史决定 | 按关键词定位[总览](../overview.md)或[项目记忆](../memory.md)的相关段落，例如 `rg -n -F -C 2 '模块名' skills/memory.md`。先核对当前分支源码与差异。 |

## 接续项目工作

修改前查看当前分支及已有改动。每轮实际修改后更新 [项目记忆](../memory.md)，合并同一事项，记录原因、证据、实际验证、遗留事项及未提交工作所在分支和文件。交付说明改动范围、适用版本、例外和实际验证情况。

新建模块时同步创建其 skill 并登记[模块索引](../modules/index.md)。修改模块或工具时更新维护方式受影响的 skill，写清路由、源码、数据关联、修改落点和限制。迁移、更名或停用模块时更新索引，跨模块结构或入口变化时更新总览。可复用的数据契约和流程归入对应专项 skill，由记忆链接。集中整理旧会话时使用[历史回填说明](history-backfill.md)。
