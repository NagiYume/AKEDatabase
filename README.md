# AKEDatabase

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
![Static](https://img.shields.io/badge/Static-HTML%2FCSS%2FJS-blue)
[![Last Commit](https://img.shields.io/github/last-commit/nagiyume/akedatabase)](https://github.com/nagiyume/AKEDatabase)

> 《明日方舟：终末地》非官方数据查询与研究站。

AKEData 为玩家提供角色、武器、敌人、装备、物品、活动、副本、商店、档案等资料查询，也收录游戏机制研究和一些实用的小工具。项目采用静态 HTML、CSS 和 JavaScript 构建，游戏数据与网站代码分离，并由独立数据域提供。

在线使用：[akedata.wiki](https://www.akedata.wiki)

开发与本地运行说明请参阅 [DEVELOPMENT.md](./DEVELOPMENT.md)。

## 最新版本

当前版本：**1.2.17**

本版本重点更新：

#### 杂项模块

- 新增“配方流程查看器”，支持按物品名称或 ID 搜索，查看上游生产配方和下游即时用途。
- 配方流程整合制造机、手工、枢纽、装备、飞船舱室、燃料、电力、采集和流体等生产关系，并支持展开替代配方与重复配方。
- 流程图支持缩放、拖拽、全屏查看和 PNG 导出，点击物品可以继续追踪新的配方链。

#### 富文本与技能弹窗

- RichTextStyleTable 现在按照网站主题选择颜色：亮色和护眼模式使用第一组，暗色模式使用第二组。
- 角色技能弹窗生成器固定使用第二组样式，保持游戏深色弹窗中的富文本颜色、图标和缩放比例一致。

#### 启动与路由

- 修复新用户首次加载接近完成时因 Service Worker 首次接管而自动刷新页面的问题。
- 刷新和启动恢复时保留 `plugin/id` 深链接；兼容旧版 `v2_*` 模块链接，并避免加载失败被误显示为 404。
- 404 页面保留原始地址，便于在数据恢复或修正链接后重新打开。

#### 其他

- 图片水印中的站点域名更新为 `AKEData.wiki`。

#### 档案库

- 新增“地图文本”和“任务文本”分类，分别收录关卡环境调查文本、地图交互对话和 `PrtsReading` 中的任务文本；每段对话按独立条目展示，并使用首句作为条目名称。
- 档案库起始页和目录支持按地区、档案类型筛选，筛选栏可以折叠或展开；目录和卡片副标题统一显示“地区 · 内容类型”。
- 档案库左侧目录改为扁平条目布局，点击条目后返回起始页会保留进入前的搜索、筛选和滚动位置，不再强制刷新页面。
- 隐藏模式关闭时不显示档案组 ID、条目 ID、内容 ID、目录项 ID 和关卡脚本路径等游戏内标识。

#### 版本差异与文本解析

- 档案库 Latest 数据继续与上一个游戏大版本的最终 Hotfix 比较；地图文本使用 `DialogTextTable`，任务文本使用 `PrtsReading` 进行差异识别。
- 修正任务文本标题从空引用补全时被误标为“修改”的问题；仅本地化标题或副标题补全不再作为内容修改。
- 修正 `text_` 内容 ID 与对应 `radio_` 文本未关联的问题，补齐“关于远眺点α的侦察报告”等任务文本的正文和字幕显示。


项目数据由 [data.akedata.wiki](https://data.akedata.wiki) 提供。数据版本会随游戏更新维护。

## 数据合作

AKEData 同时为以下工具和网站提供数据支持：

- [Perlica Bot](https://bot.perlica.tech/)：QQ 机器人与《终末地》游戏助手
- [终末地地图集](https://opendfieldmap.cn/)：地图工具
- [CEP 终末地基质规划器](https://end.canmoe.com/)：基质、精锻和养成规划工具
- [排轴终端 - Endaxis](https://www.end-axis.com/)：排轴模拟器
- [终末地战斗日志](https://zmdlogs.com/)：战斗数据记录和竞速排行
- [终末地一图流](https://ef.yituliu.cn/)：材料价值、性价比、攒抽计算等实用工具

## 赞助支持

赞助将用于服务器维护、功能开发和内容创作。支付宝渠道无法稳定获取赞助者信息，如需署名或添加备注，请通过任意联系方式补充赞助截图。

| 支付宝                                                                    | 微信赞赏码                                                              |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| ![支付宝赞赏码](https://data.akedata.wiki/public/images/about/alipay.png) | ![微信赞赏码](https://data.akedata.wiki/public/images/about/wechat.png) |

赞助名单会在网站“关于”页面中手动更新。

## 联系方式

- Bilibili：[@渚汐奏梦](https://space.bilibili.com/694452100)
- 用户反馈群：1091817282
- 项目地址：[nagiyume/AKEDatabase](https://github.com/nagiyume/AKEDatabase)

## 免责声明

本项目是玩家同好项目，与鹰角网络、Gryphline 官方无关。所有商标归各自权利方所有。

项目中的游戏配置、运行数据和相关图片版权归鹰角网络及相关权利方所有。本项目仅供学习、交流和研究，不得用于侵犯权利方权益或其他非法用途。

项目开发中使用了 AI 工具辅助编程，数据和实现可能存在错误，请以游戏内实际表现为准。

项目代码采用 [GNU Affero General Public License v3.0](./LICENSE)。
