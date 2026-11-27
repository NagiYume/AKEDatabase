# AKEGF v1.2 · Especificación

Al exportar, incluye todos los campos obligatorios y omite los opcionales sin una fuente fiable. Al importar, respeta los tipos del esquema. Si falta is_free, se desconoce si la tirada fue gratis; false indica que no lo fue.

Dentro de la misma versión principal, x.1 importa archivos x.1 sin firma y archivos x.2 sin verificar su firma. x.2 solo importa archivos x.2 con una firma válida.

| Nivel | Campos obligatorios | Regla |
| --- | --- | --- |
| `JSON` | info, endfield | endfield debe contener al menos un grupo de personaje. |
| `info` | version, export_provider, rsa_signature | version vale v1.2; export_timestamp es una marca Unix de 13 dígitos en milisegundos. |
| `endfield[]` | uid, list | uid debe contener algún carácter que no sea un espacio; list puede estar vacío. |
| `list[]` | `kind` | `kind = "draw"` → `pool_id`, `item_name`, `rarity` (1–99), `gacha_ts` (Unix ms) |

Solo se admiten los campos definidos en el esquema. Conserva los números de secuencia y los UID como cadenas.

| Nivel | Campos opcionales |
| --- | --- |
| `info` | export_app, export_app_version, export_timestamp |
| `endfield[]` | region, server_id, account_uid, lang |
| `list[]` | record_type, seq_id, seq_id_source, pool_name, pool_type, item_id, name_text, weapon_type, is_new, is_free, gift_reward_label |

| kind | Evento | Ejemplo observado |
| --- | --- | --- |
| `draw` | Una tirada de operador o un arma aleatoria | is_free=true |
| `gift_intel_book` | Expediente de reclutamiento | tiradas válidas · 60 |
| `gift_operator_token` | Ficha del operador destacado | tiradas válidas · 240 / 480 |
| `gift_weapon_box` | Caja de armas adicional | 篆玉 / 幽寒 · pedidos · 10 / 26 |
| `gift_weapon` | Arma de regalo | 篆玉 / 幽寒 · pedidos · 18 / 34 |

Lee kind del registro de origen. Los conteos observados corresponden a banners concretos. El reclutamiento acelerado cuenta para el total, pero no para las garantías o hitos del reclutamiento especial. Cuenta las armas por pool_id: los primeros 18 pedidos de 篆玉 dieron 180 armas aleatorias, una caja y un arma de regalo. Conserva otros tipos oficiales y usa unknown si se desconoce el evento.

Toma item_name de charName, weaponName o del nameText del regalo; guarda su etiqueta en gift_reward_label. Si no puedes verificar la rareza, informa del dato faltante. seq_id_source=batch_end requiere seq_id. Omite weapon_type en char e is_free en weapon.

La clave del grupo es (region, server_id, uid). Si falta region, usa cn; en China, server_id toma por defecto la cadena «1». global exige server_id. En cada grupo identifica con (record_type, seq_id); conserva las filas separadas cuando falte parte de la clave. Los identificadores se guardan como cadenas.

[Descargar el esquema JSON v1.2](/plugin/data/akegf/akegf-v1.2.schema.json)

[v1.1 JSON Schema](/plugin/data/akegf/akegf-v1.1.schema.json) · [v1.1 JSON](/plugin/data/akegf/example.json) · [v1.2 JSON](/plugin/data/akegf/example-signed.json)
