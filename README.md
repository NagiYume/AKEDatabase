# AKEDatabase - 明日方舟：终末地 数据库

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
![Static Badge](https://img.shields.io/badge/Static-HTML%2FCSS%2FJS-blue)
![Last Commit](https://img.shields.io/github/last-commit/nagiyume/akedatabase)

> 《明日方舟：终末地》非官方数据查询工具，纯前端实现，动态加载，响应式设计。
> 注意：本项目大量使用了AI工具辅助编写代码。

## 项目简介

AKEData 是一个专为《明日方舟：终末地》玩家制作的数据查询网站。它采用模块化设计，无需后端，所有数据通过静态 JSON 文件提供，支持主题切换、隐藏模块显示、等级筛选、超链接浮窗、截图导出等功能。界面简洁，数据详尽，适合用于攻略查阅和游戏研究。

**项目特点：**
- **主题切换** – 亮色/暗色/护眼三种主题，保护视力
- **模块化加载** – 根据 `manifest.json` 动态加载武器、角色、敌人、装备、物品等模块
- **多维筛选** – 支持按稀有度、类型、属性、职业等筛选数据
- **超链接浮窗** – 点击游戏内标签（`<#tag>`）显示详细说明，双层浮窗支持
- **导出长图** – 一键截图当前内容，分享攻略
- **响应式布局** – 适配手机、平板、PC 端
- **全局设置** – 控制隐藏内容、默认显示等级、导出按钮等

## 在线预览

你可以通过以下方式体验：
- 本地运行（见下方快速开始）
- 或访问[在线网站](https://akedata.top)

## 项目结构

```
AKEData/
├── index.html               # 主入口
├── plugin/                  # 模块 HTML 文件
│   ├── manifest.json        # 模块清单
│   ├── weapon.html
│   ├── character.html
│   ├── enemy.html
│   ├── equip.html
│   ├── achievement.html
│   ├── dungeon.html
│   ├── item.html
│   └── about.html
│   └── ...
├── theme/                   # 主题样式
│   ├── light.css
│   ├── dark.css
│   ├── yellow.css           # 护眼模式
│   ├── hyperlink.json       # 超链接标签配置
│   ├── textstyle.json       # 样式标签配置
│   └── [module].css         # 各模块专用样式
└── public/                  # 静态资源
    ├── images/              # 通用图片（游戏内素材）
    └── CH/                  # 中文数据（游戏数据，多语言预留）
        ├── weapon/
        ├── character/
        ├── enemy/
        ├── equip/
        ├── achievement/
        ├── dungeon/
        └── item/
        └── ...
```


## 快速开始

### 本地运行
1. 克隆仓库：
   ```bash
   git clone https://github.com/nagiyume/AKEDatabase.git
   cd AKEDatabase
   ```
2. 使用任意 HTTP 服务器运行，如LiveServer（由于 fetch 本地文件，必须通过服务器）
3. 浏览器访问 `http://localhost:8080`（或对应端口）

### 数据更新

如需更新游戏数据，替换 `public/CH/` 对应目录下的 JSON 文件即可。请确保数据结构与模块解析逻辑匹配。

本项目的数据由NaGiYuMebot自动维护，确保始终与游戏最新数据保持一致

## 模块开发指南
如果你希望扩展新模块，请遵循以下规范：

1. 在 `plugin/manifest.json` 中添加模块条目，包含 `id`、`title`、`contentFile`、`priority`、`hidden`（可选） 等字段。
2. 创建模块 HTML 文件（如 `plugin/yourmodule.html`），结构参考已有模块。
3. 编写模块专用 CSS 文件（`theme/yourmodule.css`），使用 CSS 变量以保证主题适配。
4. 在模块脚本中遵循 IIFE 模式，监听 `globalConfigChanged` 事件，实现筛选、搜索、等级控制等功能。
5. 所有可能包含标签的文本必须通过 `window.parseText(text, baseImagePath)` 处理，以支持超链接浮窗。

## 开源许可证
本项目代码采用 **GNU Affero General Public License v3.0 (AGPL-3.0)** 许可证。
>AGPL 是强 copyleft 许可证，要求任何基于本项目的网络服务也必须公开其源代码。
>你可以自由使用、修改、分发本项目代码，但必须遵守 AGPL-3.0 的条款，包括保留版权声明、修改声明，并在提供网络服务时发布完整源代码。

#### 数据与图片版权声明：

项目内所有游戏数据（`public/CH/` 目录下的 JSON 文件）及游戏相关图片（`public/images/`）版权归 **鹰角网络** 所有。

本项目仅供学习交流，严禁用于商业用途。数据来源于游戏正式服客户端，未经官方授权，请勿用于非法用途。

详见 [LICENSE](./LICENSE) 文件

## 赞助支持

您的赞助将用于服务器维护，功能开发，内容创作。

| 支付宝 | 微信赞赏码 |
| --- | --- |
| ![](https://github.com/NagiYume/AKEDatabase/blob/main/public/images/about/alipay.png) | ![](https://github.com/NagiYume/AKEDatabase/blob/main/public/images/about/wechat.png) |

## 联系方式
- Bilibili：[@渚汐奏梦](https://space.bilibili.com/694452100)
- 用户反馈群：1091817282
- 项目地址：[GitHub](https://github.com/nagiyume/AKEDatabase)

## 免责声明
本网站为同好爱好者项目，与鹰角网络和 Gryphline 官方无关。所有商标权利均归属其各自所有者。数据仅供参考，如有错误欢迎反馈。 
