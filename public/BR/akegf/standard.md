# AKEGF v0.4 · Especificação

Rascunho v0.4. Na exportação, preencha todos os campos obrigatórios; omita os opcionais sem fonte confiável. Na importação, respeite os tipos do esquema. A ausência de is_free indica situação desconhecida; false indica que a tentativa não foi gratuita.

| Nível | Campos obrigatórios | Regra |
| --- | --- | --- |
| `JSON` | info, endfield | endfield precisa ter pelo menos um grupo de personagem. |
| `info` | version | version deve ser v0.4; export_timestamp é um horário Unix de 13 dígitos em milissegundos. |
| `endfield[]` | uid, list | uid é uma string com ao menos um caractere diferente de espaço; list pode estar vazio. |
| `list[]` | `kind` | `kind = "draw"` → `pool_id`, `item_name`, `rarity` (1–99), `gacha_ts` (Unix ms) |

Só são aceitos os campos definidos no esquema. Mantenha números de sequência e UIDs como strings.

| Nível | Campos opcionais |
| --- | --- |
| `info` | export_app, export_app_version, export_timestamp, export_provider, rsa_signature |
| `endfield[]` | region, server_id, account_uid, lang |
| `list[]` | record_type, seq_id, seq_id_source, pool_name, pool_type, item_id, name_text, weapon_type, is_new, is_free, gift_reward_label |

| kind | Evento | Exemplo observado |
| --- | --- | --- |
| `draw` | Um recrutamento ou uma arma aleatória | is_free=true |
| `gift_intel_book` | Dossiê de recrutamento | tentativas válidas · 60 |
| `gift_operator_token` | Ficha do operador em destaque | tentativas válidas · 240 / 480 |
| `gift_weapon_box` | Caixa de armas adicional | 篆玉 / 幽寒 · pedidos · 10 / 26 |
| `gift_weapon` | Arma de presente | 篆玉 / 幽寒 · pedidos · 18 / 34 |

Leia kind do registro de origem. Os números observados se referem a banners específicos. O recrutamento acelerado conta para o total, mas não para garantias ou marcos do recrutamento especial. Conte armas por pool_id: os primeiros 18 pedidos de 篆玉 renderam 180 armas aleatórias, uma caixa e uma arma de presente. Preserve os demais tipos oficiais; use unknown para eventos não identificados.

Copie item_name de charName, weaponName ou do nameText do presente; salve o rótulo do presente em gift_reward_label. Se a raridade não puder ser confirmada, informe a ausência. seq_id_source=batch_end exige seq_id. Omita weapon_type em char e is_free em weapon.

A chave do grupo é (region, server_id, uid). Sem region, use cn; na China, o padrão de server_id é a string “1”. global exige server_id. Em cada grupo, identifique eventos por (record_type, seq_id); mantenha as linhas separadas se faltar parte da chave. Preserve os identificadores como strings.

[Baixar o esquema JSON v0.4](/plugin/data/akegf/akegf-v0.4.schema.json) · [Exemplo com vários personagens](/plugin/data/akegf/example.json)
