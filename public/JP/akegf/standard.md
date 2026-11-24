# AKEGF v0.4 · 仕様書

v0.4 草案。エクスポート時は必須項目をすべて記録し、任意項目は値が判明している場合に記録します。読み込み時は Schema の型に従ってください。is_free の省略は不明、false は無料ではないことを表します。

| 階層 | 必須フィールド | 制約 |
| --- | --- | --- |
| `JSON` | info, endfield | endfield は一つ以上のキャラクターグループを含みます。 |
| `info` | version | version は v0.4 固定。export_timestamp はミリ秒単位の13桁の Unix 時刻です。 |
| `endfield[]` | uid, list | uid は空白以外を含む文字列。list は空配列でも構いません。 |
| `list[]` | `kind` | `kind = "draw"` → `pool_id`, `item_name`, `rarity` (1–99), `gacha_ts` (Unix ms) |

スキーマに定義された項目のみ使用できます。連番と UID は文字列で保持してください。

| 階層 | 任意項目 |
| --- | --- |
| `info` | export_app, export_app_version, export_timestamp, export_provider, rsa_signature |
| `endfield[]` | region, server_id, account_uid, lang |
| `list[]` | record_type, seq_id, seq_id_source, pool_name, pool_type, item_id, name_text, weapon_type, is_new, is_free, gift_reward_label |

| kind | イベントの意味 | 観測例 |
| --- | --- | --- |
| `draw` | スカウト1回またはランダム武器1個 | is_free=true |
| `gift_intel_book` | スカウト情報書 | 有効な抽選回数 · 60 |
| `gift_operator_token` | ピックアップオペレーターの印 | 有効な抽選回数 · 240 / 480 |
| `gift_weapon_box` | 補給武器箱 | 篆玉 / 幽寒 · 調達回数 · 10 / 26 |
| `gift_weapon` | 贈呈武器 | 篆玉 / 幽寒 · 調達回数 · 18 / 34 |

kind は元の履歴から読み取ります。表の回数は特定のプールの観測例です。加急募集は総回数に含めますが、特許スカウトの保証・報酬の判定からは除きます。武器は pool_id ごとに集計します。篆玉の最初の18回はランダム武器180個、箱1個、贈呈武器1個でした。その他の公式種別は保持し、判別不能なら unknown とします。

item_name は charName、weaponName、贈呈の nameText から取得し、贈呈名は gift_reward_label に保存します。レア度を確認できない場合は欠落を報告します。seq_id_source=batch_end には seq_id が必要です。char には weapon_type、weapon には is_free を含めません。

キャラクターのキーは (region, server_id, uid) です。region 省略時は cn、中国版の server_id 省略時は文字列「1」。global では server_id が必須です。同一グループでは (record_type, seq_id) が一致する履歴を識別できます。キーが欠ける場合は各履歴を保持します。ID は文字列として桁を保ちます。

[v0.4 JSON Schema をダウンロード](/plugin/data/akegf/akegf-v0.4.schema.json) · [複数キャラクターのサンプル](/plugin/data/akegf/example.json)
