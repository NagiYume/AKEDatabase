---
name: akegf
description: 维护终末地抽卡交换格式说明与下载模块。
---

# AKEGF

公开路由 `/?plugin=akegf&id=<page>` 的 page 与 Markdown 文件基名一致，可取 home、standard、validator、partners。省略 id 时选择 home。目录通过公共路由同步地址，缓存视图使用 data-ake-current-page 保留当前页。[模块片段](../../../plugin/akegf.html) 和 [模块脚本](../../../plugin/js/akegf.js) 维护桌面侧栏、移动目录、下载和校验操作。

首页、标准化文档、格式校验工具、合作项目按站点 14 种语言维护。模块通过 akeI18n.getLanguageInfo().directory 选择 public/<语言>/akegf，例如[简中](../../../public/CH/akegf)、[英文](../../../public/EN/akegf)、[日文](../../../public/JP/akegf)。每个目录包含 home.md、standard.md、validator.md、partners.md。按钮和反馈文案使用 modules.akegf 翻译键。正文使用研究模块共用的 [Markdown 解析器](../../../plugin/js/article-markdown.js)，通过 marked.js 解析文章，highlight.js 负责围栏代码块。校验表单的用户 JSON 始终作为文本处理。

[下载目录](../../../plugin/data/akegf) 的 v0.4 JSON Schema 用于浏览器校验和下载，v0.3 Schema 供旧档案使用。站内随包提供 Ajv 2020，解析用户文件时仅在本地处理。Schema 校验通过后再按缺省国服规则核对角色分组及组内流水唯一性。更新标准时同步独立 AKEGF-SchemaVerify 的规则、示例和各语言文档（含首页 Schema 代码块）。正文和下载资源使用 AKEGF 模块版本作为缓存参数。

v0.4 的流水始终需要 kind，只有 draw 额外要求 pool_id、item_name、rarity 和 gacha_ts。赠礼及 unknown 等其他事件保留已有值并省略缺项。示例赠送武器刻意缺少 rarity，用于核对导入导出是否保留缺失状态。

validator.md 同页提供文件校验与工具认证说明，使用多角色示例说明往返认证，partners.md 分别维护支持版本和导入、导出能力。主题中 AKEGF 文章表格允许长字段换行，页目录链接沿用选中态和焦点样式。

合作页页尾读取 verify.akedata.wiki 的 `/v1/providers.json`，沿用文章标题、代码块和 AKEUI 状态组件，展示所有已登记提供方、指纹、状态及有效公钥 PEM。切换子页会取消目录加载。验签仍读取单键接口判定状态。

多角色示例提供 `example.json` 与 `example-signed.json`。两份数据除签名元信息外相同。签名版使用 `akegf-example` 专用公钥，验签通过时显示测试示例状态。更新时同步验证页的公钥链接和独立 AKEGF-SchemaVerify 对应示例。

签名字段位于 info。export_provider 和 rsa_signature 成对出现。格式通过后按 RFC 8785 规范化原始档案，忽略 rsa_signature 本身，并对带协议前缀的 UTF-8 字节执行 RSA-PSS SHA-256 验签。处理非法 UTF-8、重复 JSON 成员名和孤立代理项时保留独立错误反馈。角色缺省值只参与角色唯一性检查。公钥只从固定的 verify.akedata.wiki 读取，并核对公钥指纹、提供方和撤销状态。中英标准分别记录协议和认证流程，其他语言的 Schema 与字段表保持同步。公钥目录的发布、撤销和续期见[公钥目录维护](../../akegf-verify/SKILL.md)。

校验结果分别显示格式和信任状态。仅使用目录中的有效公钥通过验签的档案可信。未验证档案限当前会话查看和统计，导入工具不得持久保存、同步或用于排行。Starward 当前输出未签名档案。

本模块无 TableCfg 运行时依赖或条目级搜索路由。
