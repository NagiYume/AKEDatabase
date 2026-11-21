# 模块维护索引

按站内名称或模块 ID 查找。覆盖 `plugin/manifest.json` 和 `plugin/misc/manifest.json` 中仍启用的入口，包括隐藏与需要访问权限的页面。各目录的 `SKILL.md` 提供数据流、修改位置和容易影响其他入口的行为。代码链接按仓库布局解析。

网站共用的缓存、生命周期、搜索及版本规则见[项目开发 skill](../akedatabase-development/SKILL.md)，跨模块数据流见[总览](../overview.md)。工具另有 [AKE Data Tool](../ake-data-tool/SKILL.md) 与 [Linux TableCfg 服务](../ake-server-tool/SKILL.md)。

## 从故障定位到维护入口

| 现象 | 第一处核对 | 下一步 |
| --- | --- | --- |
| 多个 v3 页面能进目录，但详情数据异常 | 在页面 HTML 找 `AKEV3.activate` 的参数，追到 [v3-table-data.js](../../plugin/js/v3-table-data.js) 的 `adapters`、`v3Fetch` | 适配器分别生成目录和详情，控制器消费虚拟响应。先区分主表遗漏、关联缺失、展示过滤。独立控制器如商店和档案则从自身取数入口排查。 |
| 搜索有命中但进错模块或条目 | [搜索](search/SKILL.md)的 `targetsFor` 与业务模块的条目身份 | 单有表名只能定位候选。取得源键与外键后，再检查顶层路由或杂项的子路由。 |
| 开启「新增」后全部消失或整批误标 | [ake-data-source.js](../../plugin/js/ake-data-source.js) 选中的版本、调试模式、比较范围与可用基线 | 比较游戏大版本时按前两段分组；Hotfix 范围另选基线。进入业务适配器核对实际比较的条目身份，档案和资产各有自己的比较逻辑。 |
| 相同怪物在不同玩法显示的结果不一致 | [敌人](v3-enemy/SKILL.md)的模板、变种和等级；关卡的场景与出生 Buff | 查 [ake-stats.js](../../plugin/js/ake-stats.js) 的两个计算阶段，再跟随具体玩法注入的条件与黑板。[项目记忆](../memory.md)记录了可重复核对的算例。 |
| 通过页面能读到表，却找不到某个补充 Json 或图片 | 先区分表关系与[资产索引](../../plugin/js/ake-asset-index.js)列出的路径及其大小写 | 追 [AKE Data Tool](../ake-data-tool/SKILL.md) 的导出、发布和索引计划；仅凭工作目录已有文件不足以确认网站已经收录。 |

## 角色、养成与物资

| 入口 | 模块 ID | 导航 |
| --- | --- | --- |
| [干员](v3-character/SKILL.md) | `v3_character` | 普通入口 |
| [武器](v3-weapon/SKILL.md) | `v3_weapon` | 普通入口 |
| [敌人](v3-enemy/SKILL.md) | `v3_enemy` | 普通入口 |
| [装备](v3-equip/SKILL.md) | `v3_equip` | 普通入口 |
| [物品](v3-item/SKILL.md) | `v3_item` | 普通入口 |
| [商店](v3-shop/SKILL.md) | `v3_shop` | 普通入口 |
| [奖章](v3-achievement/SKILL.md) | `v3_achievement` | 普通入口 |

## 战斗与关卡

| 入口 | 模块 ID | 导航 |
| --- | --- | --- |
| [战斗](v3-skill/SKILL.md) | `v3_skill` | 普通入口 |
| [Buff](v3-buff/SKILL.md) | `v3_buff` | 普通入口 |
| [副本](v3-dungeon/SKILL.md) | `v3_dungeon` | 普通入口 |
| [危机合约](v3-cc/SKILL.md) | `v3_cc` | 普通入口 |
| [战争回响](season-tower/SKILL.md) | `season_tower` | 普通入口 |
| [影拓丰碑](monument/SKILL.md) | `monument` | 普通入口 |

## 活动、叙事与世界

| 入口 | 模块 ID | 导航 |
| --- | --- | --- |
| [活动](v3-activity/SKILL.md) | `v3_activity` | 普通入口 |
| [档案库](v3-archive/SKILL.md) | `v3_archive` | 普通入口 |
| [任务](v3-mission/SKILL.md) | `v3_mission` | 隐藏 |
| [Baker 通讯](baker/SKILL.md) | `baker` | 普通入口 |
| [地区建设](region/SKILL.md) | `region` | 普通入口 |
| [探索手册](adventure/SKILL.md) | `adventure` | 隐藏 |
| [教学百科](tutorial/SKILL.md) | `tutorial` | 隐藏 |

## 经营与工业

| 入口 | 模块 ID | 导航 |
| --- | --- | --- |
| [帝江号](spaceship/SKILL.md) | `spaceship` | 普通入口 |
| [缘缘庄](inn/SKILL.md) | `inn` | 普通入口 |
| [工业科技树](tech-tree/SKILL.md) | `tech_tree` | 普通入口 |
| [工业设施图鉴](factory/SKILL.md) | `factory` | 隐藏 |

## 站点与资源

| 入口 | 模块 ID | 导航 |
| --- | --- | --- |
| [全站搜索](search/SKILL.md) | `search` | 置顶搜索 |
| [全局设置](settings/SKILL.md) | `settings` | 底部设置 |
| [资产](asset/SKILL.md) | `asset` | 普通入口 |
| [研究](research/SKILL.md) | `research` | 普通入口 |
| [关于](about/SKILL.md) | `about` | 普通入口 |
| [模型查看器](model-viewer/SKILL.md) | `model-viewer` | 隐藏 |
| [隐藏模块示例](hidden-example/SKILL.md) | `hidden-example` | 隐藏 |
| [杂项](misc/SKILL.md) | `misc` | 普通入口 |

## 杂项子模块

| 入口 | 模块 ID | 导航 |
| --- | --- | --- |
| [百趣演武](misc/gamble/SKILL.md) | `gamble` | 杂项内 |
| [更新文案生成](misc/update-copy/SKILL.md) | `update_copy` | 需要访问权限 |
| [每周任务](misc/weekly-tasks/SKILL.md) | `weekly_tasks` | 杂项内 |
| [协议通行证任务](misc/protocol-pass-tasks/SKILL.md) | `protocol_pass_tasks` | 杂项内 |
| [演武集算任务](misc/simulation-training-tasks/SKILL.md) | `simulation_training_tasks` | 杂项内 |
| [提弗洛斯的靶场](misc/typhoea-archery/SKILL.md) | `typhoea_archery` | 杂项内 |
| [合约任务](misc/contingency-contract-tasks/SKILL.md) | `contingency_contract_tasks` | 杂项内 |
| [奇境任务](misc/racing-dungeon-tasks/SKILL.md) | `racing_dungeon_tasks` | 杂项内 |
| [竞技大会完成度任务](misc/takestwo-completion-tasks/SKILL.md) | `takestwo_completion_tasks` | 杂项内 |
| [角色图标生成器](misc/character-icon-generator/SKILL.md) | `character_icon_generator` | 杂项内 |
| [角色技能弹窗生成器](misc/character-skill-popup-generator/SKILL.md) | `character_skill_popup_generator` | 杂项内 |
| [兔头攻略图生成器](misc/guide-image-generator/SKILL.md) | `guide_image_generator` | 需要访问权限 |
| [图片水印解析器](misc/watermark-decoder/SKILL.md) | `watermark_decoder` | 需要访问权限 |
| [配方流程查看器](misc/recipe-flow-viewer/SKILL.md) | `recipe_flow_viewer` | 杂项内 |
