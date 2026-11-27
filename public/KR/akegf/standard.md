# AKEGF v0.4 · 표준 문서

v0.4 초안입니다. 내보낼 때 필수 필드를 모두 기록하고, 선택 필드는 신뢰할 수 있는 값이 있을 때 기록합니다. 읽을 때는 Schema의 자료형을 따릅니다. is_free 생략은 알 수 없음, false는 무료가 아님을 뜻합니다.

| 계층 | 필수 필드 | 규칙 |
| --- | --- | --- |
| `JSON` | info, endfield | endfield에 캐릭터 그룹이 하나 이상 필요합니다. |
| `info` | version | version은 v0.4입니다. export_timestamp는 13자리 밀리초 Unix 시각입니다. |
| `endfield[]` | uid, list | uid는 공백 이외의 문자를 포함한 문자열이며 list는 빈 배열일 수 있습니다. |
| `list[]` | `kind` | `kind = "draw"` → `pool_id`, `item_name`, `rarity` (1–99), `gacha_ts` (Unix ms) |

스키마에 정의된 필드만 사용합니다. 일련번호와 UID는 문자열로 보존하세요.

| 계층 | 선택 필드 |
| --- | --- |
| `info` | export_app, export_app_version, export_timestamp, export_provider, rsa_signature |
| `endfield[]` | region, server_id, account_uid, lang |
| `list[]` | record_type, seq_id, seq_id_source, pool_name, pool_type, item_id, name_text, weapon_type, is_new, is_free, gift_reward_label |

| kind | 이벤트 의미 | 관측 사례 |
| --- | --- | --- |
| `draw` | 오퍼레이터 한 번 모집 또는 무작위 무기 한 개 | is_free=true |
| `gift_intel_book` | 모집 정보서 | 유효 모집 횟수 · 60 |
| `gift_operator_token` | 픽업 오퍼레이터의 증표 | 유효 모집 횟수 · 240 / 480 |
| `gift_weapon_box` | 보급 무기 상자 | 篆玉 / 幽寒 · 조달 횟수 · 10 / 26 |
| `gift_weapon` | 증정 무기 | 篆玉 / 幽寒 · 조달 횟수 · 18 / 34 |

kind는 원본 기록에서 읽습니다. 표의 횟수는 특정 모집에서 관측한 사례입니다. 긴급 모집은 총횟수에 포함되지만 한정 모집의 보장 및 보상 기준에서는 제외됩니다. 무기는 pool_id별로 집계합니다. 篆玉의 첫 18회 조달에서는 무작위 무기 180개, 상자 1개, 증정 무기 1개가 기록됐습니다. 다른 공식 유형은 그대로 보존하고 모르면 unknown을 사용합니다.

item_name은 charName, weaponName 또는 증정 기록의 nameText에서 가져오며 증정 명칭은 gift_reward_label에 저장합니다. 희귀도를 확인할 수 없으면 누락을 보고합니다. seq_id_source=batch_end에는 seq_id가 필요합니다. char에는 weapon_type을, weapon에는 is_free를 쓰지 않습니다.

캐릭터 키는 (region, server_id, uid)입니다. region 생략 시 cn, 중국 서버에서 server_id 생략 시 문자열 “1”을 사용하며 global에는 server_id가 필요합니다. 그룹 안에서는 (record_type, seq_id)로 식별합니다. 키가 불완전하면 개별 기록을 보존하며 ID는 문자열로 유지합니다.

[v0.4 JSON Schema 다운로드](/plugin/data/akegf/akegf-v0.4.schema.json) · [다중 캐릭터 예제](/plugin/data/akegf/example.json)
