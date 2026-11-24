---
name: akegf
description: 维护终末地抽卡交换格式说明与下载模块。
---

# AKEGF

公开路由 `/?plugin=akegf&id=<page>` 的 page 与 Markdown 文件基名一致，可取 home、standard、validator、partners。省略 id 时选择 home。目录通过公共路由同步地址，缓存视图使用 data-ake-current-page 保留当前页。[模块片段](../../../plugin/akegf.html) 和 [模块脚本](../../../plugin/js/akegf.js) 维护桌面侧栏、移动目录、下载和校验操作。

首页、标准化文档、格式校验工具、合作项目按站点 14 种语言维护。模块通过 akeI18n.getLanguageInfo().directory 选择 public/<语言>/akegf，例如[简中](../../../public/CH/akegf)、[英文](../../../public/EN/akegf)、[日文](../../../public/JP/akegf)。每个目录包含 home.md、standard.md、validator.md、partners.md。按钮和反馈文案使用 modules.akegf 翻译键。正文使用研究模块共用的 [Markdown 解析器](../../../plugin/js/article-markdown.js)，通过 marked.js 解析文章，highlight.js 负责围栏代码块。校验表单的用户 JSON 始终作为文本处理。

[下载目录](../../../plugin/data/akegf) 的 v0.3 JSON Schema 同时用于浏览器校验和下载。站内随包提供 Ajv 2020，解析用户文件时仅在本地处理。Schema 校验通过后再按缺省国服规则核对角色分组及组内流水唯一性。更新标准时同步独立 AKEGF-SchemaVerify 的规则、示例和各语言文档（含首页 Schema 代码块）。正文和下载资源使用 AKEGF 模块版本作为缓存参数。

validator.md 同页提供文件校验与工具认证说明，使用多角色示例说明往返认证，partners.md 分别维护支持版本和导入、导出能力。主题中 AKEGF 文章表格允许长字段换行，页目录链接沿用选中态和焦点样式。

本模块无 TableCfg 运行时依赖或条目级搜索路由。
