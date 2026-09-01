# AKEDatabase

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
![Static](https://img.shields.io/badge/Static-HTML%2FCSS%2FJS-blue)
[![Last Commit](https://img.shields.io/github/last-commit/nagiyume/akedatabase)](https://github.com/nagiyume/AKEDatabase)

> 《明日方舟：终末地》非官方数据查询与研究站。

AKEData 为玩家提供角色、武器、敌人、装备、物品、活动、副本、商店、档案等资料查询，也收录游戏机制研究和一些实用的小工具。项目采用静态 HTML、CSS 和 JavaScript 构建，游戏数据与网站代码分离，并由独立数据域提供。

在线使用：[akedata.wiki](https://www.akedata.wiki)

开发与本地运行说明请参阅 [DEVELOPMENT.md](./DEVELOPMENT.md)。

## 最新版本

当前版本：**1.2.18**

本版本重点更新：

#### 地区建设

- 新增“地区建设”模块，汇总各地区等级所需成长值、矿物产量、等级说明与奖励，以及据点管理和地区设施升级信息。
- 矿点明细按地区展示矿物数量、纯度和计算后的每分钟产量，并提供新增矿点标记与“在 OEM 查看”定位链接。
- 地区等级产量、矿点明细、据点管理和地区设施等级均可独立展开，默认保持收起。

#### 角色与特殊语音

- 角色语音记录新增编队切换、切换干员等特殊情境语音，整合 `ResponsiveDialog` 与 `AIBarkText` 文本，过滤与常规档案语音重复的记录；没有对照文本时显示统一提示。
- 角色起始页恢复后勤技能房间筛选；筛选激活时显示两个后勤技能图标和悬停说明，未筛选时显示角色主、副能力图标。

#### 寻访记录

- 活动模块新增角色寻访与武库寻访历史表格和时间轴，覆盖最早至最新寻访池；时间轴按周分度，每周宽度为 20 像素。

#### 武器与装备

- 武器支持按能力值、属性和系列技能三类词条筛选，并依据 `GemTable` 修正词条映射；三星武器不参与词条筛选。
- 装备支持按三个词条维度筛选金色品质单件装备；筛选结果以单件卡片展示，并修正属性类型与名称映射。
- 新增“精锻推荐”，按同部位、同副属性的初始值推荐更高成功率的强化素材，并优化筛选区和推荐弹窗布局。

#### 界面修复

- 补齐标准目录模块的侧栏拖拽注册，修复资产、地区建设等模块无法调整左栏宽度的问题。


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
- 项目地址：[nagiyume/AKEDatabase](https://github.com/nagiyume/AKEDatabase)

项目开发中使用了 AI 工具辅助编程，数据和实现可能存在错误，请以游戏内实际表现为准。

项目代码采用 [GNU Affero General Public License v3.0](./LICENSE)。
