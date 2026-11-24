# AKEGF v0.3 · 标准化文档

v0.3 草案。将干员寻访、武器申领及赠礼保存为一份 UTF-8 JSON 文件，供不同工具交换同一角色或多个区服的历史记录。

## 文件结构与必填字段

导出方必须写入下表中的必填字段。可选字段有可靠来源时可以填写，缺失时应省略。导入方可以按功能选择读取可选字段；读取时须遵循 Schema 定义的类型。例如，`is_free: false` 表示明确非免费，省略 `is_free` 表示来源未说明。下文列出的条件必填规则同样适用。

| 层级 | 必填字段 | 规则 |
| --- | --- | --- |
| 文件 | info, endfield | endfield 数组至少包含一个角色分组。 |
| info | version | version 固定为 v0.3。可选字段 export_app、export_app_version 为字符串，export_timestamp 为 13 位 Unix 毫秒整数。 |
| endfield[] | uid, list | uid 为游戏角色 UID 字符串。list 可为空。可选 account_uid 表示绑定账号，lang 表示显示名称的语言。 |
| list[] | kind, pool_id, item_name, rarity, gacha_ts | 抽取与赠礼均需提供事件类型、原始卡池 ID、获得物名称、1–99 的整数星级和 13 位 Unix 毫秒时间。前三项为非空白字符串。 |

各层对象只接受 Schema 列出的字段。UID、服务器 ID 和流水号使用非空白字符串，以保留前导零和长整数精度。

## 记录类型与抽数

| kind | 事件含义 | 已观察样例 |
| --- | --- | --- |
| `draw` | 一次干员抽取，或一件随机申领的武器。 | 加急招募也产生抽取流水，标记为 `is_free=true`。 |
| `gift_intel_book` | 赠送寻访情报书。 | 同一特许池累计 60 次有效抽取后，出现独立的赠礼流水。 |
| `gift_operator_token` | 赠送概率提升干员的信物。 | 同池第 240、480 次有效抽取后，各出现一条赠礼流水。 |
| `gift_weapon_box` | 赠送补充武库箱。 | 篆玉、幽寒两池均在第 10、26 次申领时出现。 |
| `gift_weapon` | 赠送武器。 | 篆玉、幽寒两池均在第 18、34 次申领时出现。 |

导入时以来源记录的事件类型为准。表中次数描述特定卡池的观察结果，仅凭申领或抽取次数无法判定 `kind`。加急招募计入总抽数，计算特许寻访保底和奖励门槛时排除；免费标记缺失时，有效抽数仍有不确定性。

武器按 pool_id 分池统计。篆玉申领前 18 次共有 180 件随机武器、1 个武库箱和 1 件赠送武器，合计 182 条流水。统计抽数只计 draw；部分历史只能报告已知条数。

其他官方事件保留原始 kind。来源无法确认事件性质时使用 unknown，并填写记录的其他必填字段。

## 字段映射与缺失值

干员和武器的 item_name 分别来自 charName 和 weaponName，赠礼取 nameText。武器名“玉中身”写入 item_name，“篆玉赠礼”写入 gift_reward_label。若来源缺少 rarity，应核实奖励对应物品的星级，无法确认时报告缺项。

可选字段包括 record_type（char 或 weapon）、seq_id、seq_id_source、pool_name、pool_type、item_id、name_text、weapon_type、is_new、is_free 和 gift_reward_label。seq_id_source 为 batch_end 时须同时提供 seq_id。char 不填 weapon_type，weapon 不填 is_free。缺失值省略，false 表示明确为否。

## 角色分组与合并

角色键为 (region, server_id, uid)。同一 UID 在不同服务器分别保存。导出时写明区服；导入缺少 region 时默认 cn，国服缺少 server_id 时默认字符串“1”。明确为 global 时须填写实际服务器 ID。

同一分组内按 (record_type, seq_id) 标识事件。缺少来源类别或流水号时保留独立记录。同一毫秒内可能有多次抽取和赠礼，同名同时间也应保留重数。