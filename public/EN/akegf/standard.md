# AKEGF v0.3 · Specification

Draft v0.3. Store headhunting, Arsenal Issues and gifts in a UTF-8 JSON file to exchange records across tools, characters and servers.

## File structure and required fields

Exporters must write every required field below. Optional fields may be included when the source supplies a reliable value and should be omitted when unavailable. Importers may choose which optional fields to read, using the types defined by the schema. For example, `is_free: false` records a known non-free draw, while an absent flag leaves that status unknown. The conditional requirements below also apply.

| Level | Required fields | Rules |
| --- | --- | --- |
| File | info, endfield | The endfield array contains at least one character group. |
| info | version | Set version to v0.3. Optional export_app and export_app_version are strings. Optional export_timestamp is a 13-digit Unix timestamp in milliseconds. |
| endfield[] | uid, list | uid is the in-game character UID as a string. list may be empty. Optional account_uid identifies the bound account and lang identifies the language of display names. |
| list[] | kind, pool_id, item_name, rarity, gacha_ts | Draws and gifts both require an event kind, original pool ID, result name, integer rarity from 1 to 99 and 13-digit Unix time in milliseconds. The first three fields are nonblank strings. |

Each object accepts only the properties listed in the schema. UIDs, server IDs and sequence IDs use nonblank strings to preserve leading zeros and large integer identifiers.

## Event kinds and draw counts

| kind | Meaning | Observed example |
| --- | --- | --- |
| `draw` | One operator draw or one randomly issued weapon. | Expedited draws carry the flag `is_free=true`. |
| `gift_intel_book` | A gifted headhunting dossier. | A separate gift record appeared after 60 eligible draws in one chartered pool. |
| `gift_operator_token` | A gifted token for the featured operator. | Gift records appeared after 240 and 480 eligible draws in the same pool. |
| `gift_weapon_box` | A supplementary weapon crate. | A crate appeared on issues 10 and 26 in both the Zhuanyu and Youhan pools. |
| `gift_weapon` | A gifted weapon. | A weapon appeared on issues 18 and 34 in both pools. |

Read the event kind from the source record. The observed counts describe particular pools and cannot establish the kind of another event. Expedited draws count toward total draws but are excluded from Chartered Headhunting guarantees and reward milestones. A missing flag leaves the eligible count uncertain.

Count weapons per pool_id. The first 18 issues in the Zhuanyu pool produced 180 random weapons, one crate and one gifted weapon, for 182 events. Only draw events count toward draws. Partial history supports only the observed count.

Keep the original kind for other official events. Use unknown for unidentified events and supply the other required fields.

## Field mapping and missing values

Map charName or weaponName to item_name for draws and nameText for gifts. For example, 玉中身 is the result name and 篆玉赠礼 is its gift_reward_label. If rarity is missing, verify it against the awarded item and report an unresolved value.

Optional fields are record_type (char or weapon), seq_id, seq_id_source, pool_name, pool_type, item_id, name_text, weapon_type, is_new, is_free and gift_reward_label. batch_end requires seq_id. Omit weapon_type for char and is_free for weapon. Omit missing values and use false for a known negative.

## Character groups and merging

Group by (region, server_id, uid), keeping the same UID on different servers separate. Write the region and server on export. A missing region defaults to cn, and a missing CN server_id defaults to the string "1". An explicit global region requires a server ID.

Identify events within a group by (record_type, seq_id). Keep separate entries when either field is missing. Multiple draws and gifts can occur in one millisecond, including repeated results with identical names.

## Feasibility and evidence

The CN /api/record/char and /api/record/weapon endpoints expose individual events with seqId and gachaTs. The query context also identifies the operator pool category or weapon pool ID. Convert seconds to milliseconds and preserve existing millisecond timestamps.

In AKEData snapshot 2f74a1123f, all 382 entries across 18 operator pools matched CharacterTable by charId, and all 836 entries across 22 weapon pools matched WeaponBasicTable by itemId. Counts include items repeated across pools. Configuration describes pool contents and rarity; personal results come from record history.

Source references are EndfieldGachaService.cs, EndfieldGachaModels.cs and DatabaseService.cs in Starward 386f9031, and the GachaCharPoolTable, GachaWeaponPoolTable and corresponding pool content tables in AKEData. Cross-pool ID uniqueness and international cross-tool round trips still need wider verification.

[UIGF v4.2](https://uigf.org/zh/standards/uigf.html) · [UIGF-org](https://github.com/UIGF-org)
