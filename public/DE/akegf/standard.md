# AKEGF v0.4 · Spezifikation

Entwurf v0.4. Beim Export sind alle Pflichtfelder zu schreiben. Optionale Angaben ohne verlässliche Quelle werden ausgelassen. Beim Lesen gelten die Typen des Schemas. Fehlt is_free, ist der Status unbekannt; false kennzeichnet einen nachweislich nicht kostenlosen Zug.

| Ebene | Pflichtfelder | Regel |
| --- | --- | --- |
| `JSON` | info, endfield | endfield enthält mindestens eine Charaktergruppe. |
| `info` | version | version ist v0.4; export_timestamp ist ein 13-stelliger Unix-Zeitstempel in Millisekunden. |
| `endfield[]` | uid, list | uid ist eine Zeichenkette mit mindestens einem sichtbaren Zeichen; list darf leer sein. |
| `list[]` | `kind` | `kind = "draw"` → `pool_id`, `item_name`, `rarity` (1–99), `gacha_ts` (Unix ms) |

Zulässig sind nur die im Schema definierten Felder. Sequenznummern und UIDs bleiben Zeichenketten.

| Ebene | Optionale Felder |
| --- | --- |
| `info` | export_app, export_app_version, export_timestamp, export_provider, rsa_signature |
| `endfield[]` | region, server_id, account_uid, lang |
| `list[]` | record_type, seq_id, seq_id_source, pool_name, pool_type, item_id, name_text, weapon_type, is_new, is_free, gift_reward_label |

| kind | Ereignis | Beispiel aus den Daten |
| --- | --- | --- |
| `draw` | Eine Rekrutierung oder eine zufällig erhaltene Waffe | is_free=true |
| `gift_intel_book` | Rekrutierungsdossier | anrechenbare Ziehungen · 60 |
| `gift_operator_token` | Marke des beworbenen Operators | anrechenbare Ziehungen · 240 / 480 |
| `gift_weapon_box` | Zusätzliche Waffenkiste | 篆玉 / 幽寒 · Waffenanforderungen · 10 / 26 |
| `gift_weapon` | Geschenkte Waffe | 篆玉 / 幽寒 · Waffenanforderungen · 18 / 34 |

Der Ereignistyp stammt aus dem Quelldatensatz. Die Zahlen sind Beobachtungen in einzelnen Pools. Beschleunigte Rekrutierungen zählen zur Gesamtzahl, aber nicht für Garantien oder Meilensteine der Sonderrekrutierung. Waffen nach pool_id zählen: Die ersten 18 Anforderungen im Pool 篆玉 ergaben 180 Zufallswaffen, eine Kiste und eine geschenkte Waffe. Weitere offizielle Typen beibehalten, unbekannte Ereignisse als unknown kennzeichnen.

item_name aus charName, weaponName oder bei Geschenken nameText übernehmen; die Geschenkbezeichnung gehört in gift_reward_label. Ungeklärte Seltenheit als fehlend melden. seq_id_source=batch_end erfordert seq_id. Bei char entfällt weapon_type, bei weapon entfällt is_free.

Gruppenschlüssel ist (region, server_id, uid). Ohne region gilt cn, auf dem CN-Server ohne server_id die Zeichenkette „1“. global erfordert server_id. Innerhalb einer Gruppe identifiziert (record_type, seq_id) das Ereignis. Ohne vollständigen Schlüssel jeden Eintrag einzeln behalten. IDs als Zeichenketten erhalten.

[JSON-Schema v0.4 herunterladen](/plugin/data/akegf/akegf-v0.4.schema.json) · [Beispiel mit mehreren Charakteren](/plugin/data/akegf/example.json)
