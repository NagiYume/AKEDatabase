# AKEGF tool certification

Certification applies to tools that transfer gacha histories. A tool must support both importing and exporting v0.4 archives and identify the supported version in the application with a link to the [AKEGF home page](https://www.akedata.wiki/?plugin=akegf&id=home). See the [specification](/?plugin=akegf&id=standard) for field types, conditional requirements and merge rules.

If your project uses AKEGF, you can submit a [pull request](https://github.com/NagiYume/AKEDatabase/pulls) to list it among the partner projects.

## Checking an import and export round trip

The [unsigned multi-character example](/plugin/data/akegf/example.json) and [signed multi-character example](/plugin/data/akegf/example-signed.json) contain the same character groups and records. Verify the signed file with the [example public key](https://verify.akedata.wiki/v1/providers/akegf-example/keys/8cOMDGbXz6FFT7xjWXaCU2vGAT9LoIM8LQjxWGlYh_o.json).

1. Load the unsigned example into a test session and export those characters’ records from that session. Use the signed example to check verification. The expected result is “Example signature verified.”
2. Check the export using the form on this page. A format pass confirms the file’s structure and uniqueness constraints. Certification also requires comparing the records before and after the round trip.
3. Match character groups by `(region, server_id, uid)`. The CN character should retain three records and the global character one. The CN operator and weapon draws share a millisecond timestamp and a sequence ID but belong to different record types. Both must survive.
4. Compare each event’s kind and any supplied pool, result, rarity, millisecond timestamp and sequence ID. Keep `gift_weapon` and omit its missing rarity. Preserve the long sequence ID `90071992547409931` as the original string.

## Format validator

For signed archives, the browser sends the provider ID and public key fingerprint to the registry and checks the signature locally. The result reports format validity and trust status independently. Unverified archives are for use within the current session. See the [specification](/?plugin=akegf&id=standard) for import rules.

Paste a complete document and select Validate JSON, or choose a local file to check it immediately. Records are processed in this browser.

Checks cover the v0.4 schema, duplicate character groups and repeated sequence IDs within each record type. For example, the error path `/endfield/0/list/1` identifies the second record in the first group.

## Registering a signing key

Submit a pull request with the project link, proposed provider ID, RSA public key in PEM format and a signed archive derived from the public example. Maintainers check the project identity, its import and export capabilities, and the signature before publishing the key to the [AKEGF public key registry](https://verify.akedata.wiki/). Tools that support both import and export can submit their round-trip results for certification. Keep the private key with the provider. Register the new key before rotating. If a private key is compromised, request revocation. See the [specification](/?plugin=akegf&id=standard) for the signing rules.
