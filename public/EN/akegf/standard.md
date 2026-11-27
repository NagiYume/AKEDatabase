# AKEGF v0.4 · Specification

Draft v0.4. Store headhunting, Arsenal Issues and gifts in a UTF-8 JSON file to exchange records across tools, characters and servers. v0.4 adds optional signatures. The site validator still checks older files against the v0.3 schema.

## File structure and required fields

Exporters must write every required field below. Optional fields may be included when the source supplies a reliable value and should be omitted when unavailable. Importers may choose which optional fields to read, using the types defined by the schema. For example, `is_free: false` records a known non-free draw, while an absent flag leaves that status unknown. The conditional requirements below also apply.

| Level | Required fields | Rules |
| --- | --- | --- |
| File | info, endfield | The endfield array contains at least one character group. |
| info | version | Set version to v0.4. Optional export_app and export_app_version are strings. Optional export_timestamp is a 13-digit Unix timestamp in milliseconds. Signed archives require both export_provider and rsa_signature. |
| endfield[] | uid, list | uid is the in-game character UID as a string. list may be empty. Optional account_uid identifies the bound account and lang identifies the language of display names. |
| list[] | kind | Use a nonblank event kind. For `kind = "draw"`, also provide `pool_id`, `item_name`, `rarity` and `gacha_ts`. |

Each object accepts only the properties listed in the schema. UIDs, server IDs and sequence IDs use nonblank strings to preserve leading zeros and large integer identifiers.

Gifts and other non-draw events can omit the pool, item name, rarity and timestamp. Export any known values. When present, `pool_id` and `item_name` are nonblank strings, `rarity` is an integer from 1 to 99, and `gacha_ts` is a 13-digit Unix timestamp in milliseconds.

## Export providers and RSA signatures

| Field | Rule |
| --- | --- |
| `info.export_provider` | Provider ID assigned by the AKEGF public key registry. Use 1–64 lowercase ASCII letters, digits and hyphens, beginning and ending with a letter or digit. Use `export_app` for the display name. |
| `info.rsa_signature` | `kid.signature`, with both components encoded as unpadded base64url. The 43-character `kid` is the SHA-256 fingerprint of the RSA public key's DER SubjectPublicKeyInfo. The second component encodes the raw RSA signature. |

Include both fields for a signed export and omit both for an unsigned export. The signature attests to the contents signed by the registered provider and detects subsequent changes. Whether the records originated in the game depends on the provider's data source.

1. Populate `info.export_provider` and remove `info.rsa_signature` from the complete archive. Keep every other field and the original array order. Reject duplicate JSON member names and unpaired surrogate code units.
2. Canonicalize the remaining archive with JCS ([RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html)). Prepend the ASCII string `AKEGF-RSA-PSS-v1` and one LF byte (`0x0A`) to the canonical UTF-8 bytes. Sign the resulting byte sequence. Verify before applying defaults, rewriting fields or reordering arrays.
3. Use a generic 2048-, 3072- or 4096-bit RSA key with RSA-PSS, SHA-256, MGF1-SHA-256 and a 32-byte salt, as specified by [PS256](https://www.rfc-editor.org/rfc/rfc7518.html#section-3.5). Store the result in `info.rsa_signature`.

To verify the signature, request `GET https://verify.akedata.wiki/v1/providers/{export_provider}/keys/{kid}.json` from the fixed registry host. The response contains `provider`, `kid`, `alg` and `status`. Require the requested provider and key ID, `alg: "PS256"` and `status: "active"`. Decode `public_key` as unpadded base64url DER SubjectPublicKeyInfo, check its fingerprint and verify the signature locally. Revoked keys return `status: "revoked"` and omit `public_key`. Unknown keys return HTTP 404. Responses allow cross-origin reads and prohibit caching. Report revoked, unknown, unavailable and invalid signatures separately from verified ones. The lookup path contains only the provider ID and public key fingerprint.

When editing, merging or re-exporting a file, remove both original signature fields or sign again with the exporting provider's registered key. See [tool certification](/?plugin=akegf&id=validator) for registration.

## Trust status on import

| Status | Condition | Import behavior |
| --- | --- | --- |
| Trusted | A production archive passes format checks and its RSA signature verifies with the registered provider's active key. | The tool may save records to its history and use them for leaderboards and other features that require trusted data. |
| Unverified | The archive is unsigned, the signature fails, the key is unknown or revoked, or the registry is unavailable. | A well-formed archive can be viewed, filtered and counted within the current session. Label it unverified. Do not persist it in the tool's history, sync it to an account or use it for leaderboards or other features requiring trusted data. |

Importers determine trust from the verification result. Format validity, signature fields and the application name alone cannot establish trust. Keep unverified records unverified through merges and re-exports. The same rule applies to older unsigned archives.

The provider ID `akegf-example` is reserved for examples. Verification with its key confirms example integrity. Importers must restrict its archives to test sessions and exclude them from live history, account sync and leaderboards.

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

Keep the original kind for other official events. Use unknown for unidentified events.

## Field mapping and missing values

Map charName or weaponName to item_name for draws, and use nameText for gifts when available. For example, 玉中身 is the result name and 篆玉赠礼 is its gift_reward_label. Omit rarity for gifts whose rarity is unknown.

Optional fields are record_type (char or weapon), seq_id, seq_id_source, pool_name, pool_type, item_id, name_text, weapon_type, is_new, is_free and gift_reward_label. batch_end requires seq_id. Omit weapon_type for char and is_free for weapon. Omit missing values and use false for a known negative.

## Character groups and merging

Group by (region, server_id, uid), keeping the same UID on different servers separate. Write the region and server on export. A missing region defaults to cn, and a missing CN server_id defaults to the string "1". An explicit global region requires a server ID.

Identify events within a group by (record_type, seq_id). Keep separate entries when either field is missing. Multiple draws and gifts can occur in one millisecond, including repeated results with identical names.

## Feasibility and evidence

The CN /api/record/char and /api/record/weapon endpoints expose individual events with seqId and gachaTs. The query context also identifies the operator pool category or weapon pool ID. Convert seconds to milliseconds and preserve existing millisecond timestamps.

In AKEData snapshot 2f74a1123f, all 382 entries across 18 operator pools matched CharacterTable by charId, and all 836 entries across 22 weapon pools matched WeaponBasicTable by itemId. Counts include items repeated across pools. Configuration describes pool contents and rarity; personal results come from record history.

Source references are EndfieldGachaService.cs, EndfieldGachaModels.cs and DatabaseService.cs in Starward 386f9031, and the GachaCharPoolTable, GachaWeaponPoolTable and corresponding pool content tables in AKEData. Cross-pool ID uniqueness and international cross-tool round trips still need wider verification.

[UIGF v4.2](https://uigf.org/zh/standards/uigf.html) · [UIGF-org](https://github.com/UIGF-org)
