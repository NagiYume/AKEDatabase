# AKEGF tool certification

Certification applies to tools that transfer gacha histories. A tool must support both importing and exporting v0.3 archives and identify the supported version in the application with a link to the [AKEGF home page](https://www.akedata.wiki/?plugin=akegf&id=home). See the [specification](/?plugin=akegf&id=standard) for field types, conditional requirements and merge rules.

If your project uses AKEGF, you can submit a [pull request](https://github.com/NagiYume/AKEDatabase/pulls) to list it among the partner projects.

## Checking an import and export round trip

1. Download the [multi-character example](/plugin/data/akegf/example.json), import it into the application, then export those characters’ records.
2. Check the export using the form on this page. A pass confirms the file’s structure and uniqueness constraints. Certification also requires comparing the records before and after the round trip.
3. Match character groups by `(region, server_id, uid)`. The CN character should retain three records and the global character one. The CN operator and weapon draws share a millisecond timestamp and a sequence ID but belong to different record types. Both must survive.
4. Compare each event’s kind, pool, result, rarity, millisecond timestamp and any supplied sequence ID. The gifted weapon should retain `gift_weapon`, and the long sequence ID `90071992547409931` must survive as the original string.

## Format validator

Paste a complete document and select Validate JSON, or choose a local file to check it immediately. Records are processed in this browser.

Checks cover the v0.3 schema, duplicate character groups and repeated sequence IDs within each record type. For example, the error path `/endfield/0/list/1` identifies the second record in the first group.
