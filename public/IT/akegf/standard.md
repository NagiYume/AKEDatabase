# AKEGF v0.4 · Specifica

Bozza v0.4. In esportazione scrivi tutti i campi obbligatori; ometti quelli facoltativi senza una fonte attendibile. In lettura rispetta i tipi dello schema. Se manca is_free, la gratuità è ignota; false indica che l’estrazione non era gratuita.

| Livello | Campi obbligatori | Regola |
| --- | --- | --- |
| `JSON` | info, endfield | endfield deve contenere almeno un gruppo di personaggio. |
| `info` | version | version deve valere v0.4; export_timestamp è un tempo Unix di 13 cifre in millisecondi. |
| `endfield[]` | uid, list | uid è una stringa con almeno un carattere diverso da uno spazio; list può essere vuoto. |
| `list[]` | `kind` | `kind = "draw"` → `pool_id`, `item_name`, `rarity` (1–99), `gacha_ts` (Unix ms) |

Sono ammessi solo i campi definiti nello schema. Conserva numeri di sequenza e UID come stringhe.

| Livello | Campi facoltativi |
| --- | --- |
| `info` | export_app, export_app_version, export_timestamp, export_provider, rsa_signature |
| `endfield[]` | region, server_id, account_uid, lang |
| `list[]` | record_type, seq_id, seq_id_source, pool_name, pool_type, item_id, name_text, weapon_type, is_new, is_free, gift_reward_label |

| kind | Evento | Esempio osservato |
| --- | --- | --- |
| `draw` | Un reclutamento o un’arma casuale | is_free=true |
| `gift_intel_book` | Dossier di reclutamento | estrazioni valide · 60 |
| `gift_operator_token` | Gettone dell’operatore in evidenza | estrazioni valide · 240 / 480 |
| `gift_weapon_box` | Cassa armi supplementare | 篆玉 / 幽寒 · richieste di armi · 10 / 26 |
| `gift_weapon` | Arma in regalo | 篆玉 / 幽寒 · richieste di armi · 18 / 34 |

Leggi kind dal record originale. I conteggi osservati riguardano banner specifici. Il reclutamento accelerato conta nel totale ma non per le garanzie o i traguardi del reclutamento speciale. Conta le armi per pool_id: le prime 18 richieste in 篆玉 hanno dato 180 armi casuali, una cassa e un’arma in regalo. Conserva gli altri tipi ufficiali; usa unknown se non puoi identificare l’evento.

Ricava item_name da charName, weaponName o dal nameText del regalo; salva l’etichetta del regalo in gift_reward_label. Segnala le rarità non verificabili. seq_id_source=batch_end richiede seq_id. Ometti weapon_type per char e is_free per weapon.

La chiave del gruppo è (region, server_id, uid). Senza region usa cn; in Cina il valore predefinito di server_id è la stringa “1”. global richiede server_id. Identifica ogni evento con (record_type, seq_id) nel gruppo; conserva separatamente le righe con chiave incompleta. Gli identificatori restano stringhe.

[Scarica lo schema JSON v0.4](/plugin/data/akegf/akegf-v0.4.schema.json) · [Esempio con più personaggi](/plugin/data/akegf/example.json)
