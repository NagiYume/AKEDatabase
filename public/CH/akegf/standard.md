# AKEGF v1.2 · 标准化文档

AKEGF 将干员寻访、武器申领及赠礼保存为一份 UTF-8 JSON 文件，供不同工具交换同一角色或多个区服的历史记录。

## 版本与导入兼容性

每个主版本使用 `vx.1` 表示无签名档案，使用 `vx.2` 表示必须验签的档案。同一主版本的两种档案共享角色和流水结构。

| 导入方 | 同主版本 `vx.1` 档案 | 同主版本 `vx.2` 档案 |
| --- | --- | --- |
| `vx.1` | 格式合法时接受 | 格式合法时接受，读取流水时忽略签名元数据 |
| `vx.2` | 拒绝 | 格式合法并通过 RSA 验签后接受 |

当前配对为 [v1.1 Schema](/plugin/data/akegf/akegf-v1.1.schema.json) 和 [v1.2 Schema](/plugin/data/akegf/akegf-v1.2.schema.json)。导入方按文件声明的版本检查结构，并应用上表。

## 文件结构与必填字段

导出方必须写入下表中的必填字段。可选字段有可靠来源时可以填写，缺失时应省略。导入方可以按功能选择读取可选字段；读取时须遵循 Schema 定义的类型。例如，`is_free: false` 表示明确非免费，省略 `is_free` 表示来源未说明。下文列出的条件必填规则同样适用。

| 层级 | 必填字段 | 规则 |
| --- | --- | --- |
| 文件 | info, endfield | endfield 数组至少包含一个角色分组。 |
| info | version | 写入导出版本 v1.1 或 v1.2。可选字段 export_app、export_app_version 为字符串，export_timestamp 为 13 位 Unix 毫秒整数。v1.2 必填 export_provider 和 rsa_signature。v1.1 须省略两项。 |
| endfield[] | uid, list | uid 为游戏角色 UID 字符串。list 可为空。可选 account_uid 表示绑定账号，lang 表示显示名称的语言。 |
| list[] | kind | 事件类型为非空白字符串。`kind = "draw"` 时，还须填写 `pool_id`、`item_name`、`rarity` 和 `gacha_ts`。 |

各层对象只接受 Schema 列出的字段。UID、服务器 ID 和流水号使用非空白字符串，以保留前导零和长整数精度。

赠礼和其他非抽取事件允许缺少卡池、获得物名称、星级和时间。导出时保留已知字段，省略缺失项。填写这些字段时，`pool_id` 和 `item_name` 为非空白字符串，`rarity` 为 1–99 的整数，`gacha_ts` 为 13 位 Unix 毫秒整数。

## 导出提供方与 RSA 签名

| 字段 | 规则 |
| --- | --- |
| `info.export_provider` | AKEGF 公钥目录分配的提供方 ID。长度为 1–64，只使用小写 ASCII 字母、数字和连字符，首尾必须为字母或数字。`export_app` 仍用于显示应用名称。 |
| `info.rsa_signature` | 格式为 `kid.signature`。两段均使用无填充 Base64url。`kid` 是 RSA 公钥的 DER SubjectPublicKeyInfo 的 SHA-256 指纹，编码后为 43 字符。第二段是原始 RSA 签名字节。 |

v1.2 的签名证明已登记的提供方签署了这些内容且内容自签署后保持完整，抽卡记录是否来自游戏官方仍取决于提供方的数据来源。

1. 在完整档案中填入 `info.export_provider`，移除 `info.rsa_signature`。保留其他全部字段及数组顺序。拒绝 JSON 对象中的重复成员名和字符串中的孤立代理项。
2. 按 [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html) 对整个剩余档案执行 JCS。在规范化后的 UTF-8 字节前拼接 ASCII 字符串 `AKEGF-RSA-PSS-v1` 和单字节换行（`0x0A`）。对拼接后的字节签名。校验前勿填充默认值、改写字段或重排数组。
3. 使用 2048、3072 或 4096 位通用 RSA 密钥，采用 RSA-PSS、SHA-256、MGF1-SHA-256、32 字节盐值，即 [PS256](https://www.rfc-editor.org/rfc/rfc7518.html#section-3.5)。将结果填入 `info.rsa_signature`。

验签时，从固定域名请求 `GET https://verify.akedata.wiki/v1/providers/{export_provider}/keys/{kid}.json`。响应包含 `provider`、`kid`、`alg` 和 `status`。仅在提供方 ID 及指纹与请求一致、`alg` 为 `PS256` 且 `status` 为 `active` 时，解码 `public_key`（无填充 Base64url 的 DER SubjectPublicKeyInfo），重新计算指纹并在本地验签。已撤销的公钥返回 `status: "revoked"`，省略 `public_key`。未知公钥返回 HTTP 404。响应允许跨域读取并禁止缓存。遇到撤销、未知、服务不可用或签名不匹配时，分别报告结果，均不得标记为已验证。查询路径只包含提供方 ID 和公钥指纹。

修改、合并或重新导出档案时，v1.1 导出须移除原签名和提供方字段。v1.2 导出须使用当前提供方的已登记密钥签署最终内容。提供方申请登记流程见[工具认证](/?plugin=akegf&id=validator)。

## 导入档案的信任状态

| 状态 | 判定 | 导入工具的处理 |
| --- | --- | --- |
| 可信 | 正式档案通过格式检查，并使用目录中对应提供方的有效公钥通过 RSA 验签。 | 可以保存到工具的历史记录，并用于排行等要求可信数据的功能。 |
| 未验证 | 档案未签名、未执行验签、签名不匹配、公钥未登记或已撤销，或公钥目录暂不可用。 | v1.2 导入方一律拒绝。v1.1 导入方可在当前会话临时查看、筛选和统计兼容档案，须标记为「未验证」。不得写入工具的持久历史、同步至账户或参与排行等要求可信数据的功能。 |

导入工具须根据实际验签结果判定状态。格式通过、填写了签名字段或应用名称都不足以取得可信状态。未验证的记录在合并和重新导出后仍应保留未验证状态。

`akegf-example` 是示例专用提供方 ID。站内工具使用随 v1.2 示例提供的[示例公钥](/plugin/data/akegf/example-key.json)验证示例完整性。导入工具须将该提供方的档案限于测试会话，禁止写入正式历史、同步至账户或参与排行。

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

其他官方事件保留原始 kind。来源无法确认事件性质时使用 unknown。

## 字段映射与缺失值

干员和武器的 item_name 分别来自 charName 和 weaponName，赠礼有 nameText 时可用作 item_name。武器名“玉中身”写入 item_name，“篆玉赠礼”写入 gift_reward_label。若无法确认赠礼星级，省略 rarity。

可选字段包括 record_type（char 或 weapon）、seq_id、seq_id_source、pool_name、pool_type、item_id、name_text、weapon_type、is_new、is_free 和 gift_reward_label。seq_id_source 为 batch_end 时须同时提供 seq_id。char 不填 weapon_type，weapon 不填 is_free。缺失值省略，false 表示明确为否。

## 角色分组与合并

角色键为 (region, server_id, uid)。同一 UID 在不同服务器分别保存。导出时写明区服；导入缺少 region 时默认 cn，国服缺少 server_id 时默认字符串“1”。明确为 global 时须填写实际服务器 ID。

同一分组内按 (record_type, seq_id) 标识事件。缺少来源类别或流水号时保留独立记录。同一毫秒内可能有多次抽取和赠礼，同名同时间也应保留重数。
