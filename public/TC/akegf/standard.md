# AKEGF v0.4 · 標準化文件

v0.4 草案。匯出時須寫入必填欄位，可選欄位依可靠來源填寫。匯入時按 Schema 的型別讀取；省略 is_free 代表未知，false 表示明確非免費。

| 層級 | 必填欄位 | 規則 |
| --- | --- | --- |
| `JSON` | info, endfield | endfield 至少包含一個角色分組。 |
| `info` | version | version 固定為 v0.4；export_timestamp 為 13 位 Unix 毫秒整數。 |
| `endfield[]` | uid, list | uid 為非空白字串，list 可為空陣列。 |
| `list[]` | `kind` | `kind = "draw"` → `pool_id`, `item_name`, `rarity` (1–99), `gacha_ts` (Unix ms) |

僅接受 Schema 定義的欄位。流水號與 UID 應保留為字串。

| 層級 | 可選欄位 |
| --- | --- |
| `info` | export_app, export_app_version, export_timestamp, export_provider, rsa_signature |
| `endfield[]` | region, server_id, account_uid, lang |
| `list[]` | record_type, seq_id, seq_id_source, pool_name, pool_type, item_id, name_text, weapon_type, is_new, is_free, gift_reward_label |

| kind | 事件含義 | 觀察樣例 |
| --- | --- | --- |
| `draw` | 單次幹員抽取或一件隨機武器 | is_free=true |
| `gift_intel_book` | 尋訪情報書 | 有效抽取 · 60 |
| `gift_operator_token` | 機率提升幹員的信物 | 有效抽取 · 240 / 480 |
| `gift_weapon_box` | 補充武庫箱 | 篆玉 / 幽寒 · 次申領 · 10 / 26 |
| `gift_weapon` | 贈送的武器 | 篆玉 / 幽寒 · 次申領 · 18 / 34 |

以來源決定 kind；表中次數只是實測。加急招募計入總抽數，但不計入特許尋訪保底或獎勵門檻。武器依 pool_id 分池；篆玉池前 18 次申領共 180 件隨機武器、1 箱、1 件贈送武器。其他官方事件保留原始類型，無法辨識時用 unknown。

item_name 依來源取 charName、weaponName 或贈禮的 nameText；gift_reward_label 保存贈禮名稱。無法核實星級時應回報缺項。seq_id_source=batch_end 須提供 seq_id。char 省略 weapon_type，weapon 省略 is_free。

角色鍵為 (region, server_id, uid)。缺少 region 預設 cn，國服缺少 server_id 預設字串「1」；global 必須提供 server_id。分組內用 (record_type, seq_id) 識別流水；缺少合併鍵時保留每筆紀錄。識別碼使用字串，以保留精度與前導零。

[下載 v0.4 JSON Schema](/plugin/data/akegf/akegf-v0.4.schema.json) · [多角色範例](/plugin/data/akegf/example.json)
