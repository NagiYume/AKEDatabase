---
name: spaceship
description: 维护 AKEDatabase 的帝江号模块（spaceship）。舱室按配置关联等级、升级材料、配方、产物与信用兑换。
---

# 帝江号

舱室按配置关联等级、升级材料、配方、产物与信用兑换。后勤筛选从 SpaceshipCharSkillTable.skillList 到 SpaceshipSkillTable，按角色合并、按栏位和等级筛选。

## 从哪里开始

- 注册入口 `/?plugin=spaceship`，普通入口。页面在[spaceship.html](../../../plugin/spaceship.html)。
- 相关脚本包括 [v3-table-data.js](../../../plugin/js/v3-table-data.js)、[ake-catalog.js](../../../plugin/js/ake-catalog.js)、[spaceship-skills.js](../../../plugin/js/spaceship-skills.js)、[spaceship.js](../../../plugin/js/spaceship.js)。

## 源码定位

| 修改点 | 文件与搜索词 |
| --- | --- |
| 舱室目录 | [spaceship.js](../../../plugin/js/spaceship.js) · `build` |
| 交互挂载 | [spaceship.js](../../../plugin/js/spaceship.js) · `mountDetail` |
| 后勤数据 | [spaceship-skills.js](../../../plugin/js/spaceship-skills.js) · `SpaceshipCharSkillTable` |

## 修改与排查

舱室详情查 spaceship.js 的 AKECatalog.mount。效果筛选和强度排序查 spaceship-skills.js；按参数容器、作用对象与单位比较，线索概率提升档位不能直接当最终概率。

舱室目录有明确业务范围，后勤技能仍需保留未分配或未知舱室的数据。扩展某类后勤时参照 TableCfg skill 的 spaceship-skills.md。

专项依据见[后勤技能案例](../../tablecfg-analysis/references/spaceship-skills.md)。

[模块索引](../index.md) · [项目记忆](../../memory.md)
