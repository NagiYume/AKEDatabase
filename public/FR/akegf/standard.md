# AKEGF v1.2 · Spécification

À l’exportation, renseigner tous les champs obligatoires ; omettre les champs facultatifs sans source fiable. À l’importation, respecter les types du schéma. L’absence de is_free indique un statut inconnu ; false signifie que le tirage est effectivement payant.

Pour une même version majeure, x.1 importe les fichiers x.1 sans signature et les fichiers x.2 sans vérifier leur signature. x.2 importe uniquement les fichiers x.2 dont la signature est valide.

| Niveau | Champs obligatoires | Règle |
| --- | --- | --- |
| `JSON` | info, endfield | endfield contient au moins un groupe de personnages. |
| `info` | version, export_provider, rsa_signature | version vaut v1.2 ; export_timestamp est un horodatage Unix en millisecondes à 13 chiffres. |
| `endfield[]` | uid, list | uid est une chaîne contenant au moins un caractère autre qu’un espace ; list peut être vide. |
| `list[]` | `kind` | `kind = "draw"` → `pool_id`, `item_name`, `rarity` (1–99), `gacha_ts` (Unix ms) |

Seuls les champs définis dans le schéma sont admis. Conserver les numéros de séquence et les UID sous forme de chaînes.

| Niveau | Champs facultatifs |
| --- | --- |
| `info` | export_app, export_app_version, export_timestamp |
| `endfield[]` | region, server_id, account_uid, lang |
| `list[]` | record_type, seq_id, seq_id_source, pool_name, pool_type, item_id, name_text, weapon_type, is_new, is_free, gift_reward_label |

| kind | Événement | Exemple observé |
| --- | --- | --- |
| `draw` | Un recrutement ou une arme aléatoire | is_free=true |
| `gift_intel_book` | Dossier de recrutement | tirages admissibles · 60 |
| `gift_operator_token` | Jeton de l’opérateur en vedette | tirages admissibles · 240 / 480 |
| `gift_weapon_box` | Caisse d’armes supplémentaire | 篆玉 / 幽寒 · commandes · 10 / 26 |
| `gift_weapon` | Arme offerte | 篆玉 / 幽寒 · commandes · 18 / 34 |

Lire kind dans les données sources. Les seuils observés concernent des bannières précises. Un recrutement accéléré compte dans le total, mais pas pour les garanties ou paliers du recrutement spécial. Compter les armes par pool_id : les 18 premières commandes de 篆玉 ont donné 180 armes aléatoires, une caisse et une arme offerte. Conserver les autres types officiels ; utiliser unknown si le type est indéterminé.

item_name provient de charName, weaponName ou du nameText du cadeau. Conserver le libellé du cadeau dans gift_reward_label. Signaler toute rareté impossible à confirmer. seq_id_source=batch_end exige seq_id. Omettre weapon_type pour char et is_free pour weapon.

Le groupe est identifié par (region, server_id, uid). Par défaut, region vaut cn et server_id vaut « 1 » pour la Chine. global exige un server_id explicite. Dans un groupe, utiliser (record_type, seq_id) ; conserver séparément les lignes dont la clé est incomplète. Garder les identifiants sous forme de chaînes.

[Télécharger le schéma JSON v1.2](/plugin/data/akegf/akegf-v1.2.schema.json)

[v1.1 JSON Schema](/plugin/data/akegf/akegf-v1.1.schema.json) · [v1.1 JSON](/plugin/data/akegf/example.json) · [v1.2 JSON](/plugin/data/akegf/example-signed.json)
