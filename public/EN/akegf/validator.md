# AKEGF tool certification

Certification applies to tools that transfer gacha histories. A tool must support both importing and exporting the version it declares (v1.1 or v1.2) and link to the [AKEGF home page](https://www.akedata.wiki/?plugin=akegf&id=home) from the application. See the [specification](/?plugin=akegf&id=standard) for compatibility, field requirements and merge rules.

If your project uses AKEGF, you can submit a [pull request](https://github.com/NagiYume/AKEDatabase/pulls) to list it among the partner projects.

## Checking an import and export round trip

The [v1.1 unsigned example](/plugin/data/akegf/example.json) and [v1.2 signed example](/plugin/data/akegf/example-signed.json) contain the same character groups and records. Verify the signed file with the [example public key](/plugin/data/akegf/example-key.json).

1. For v1.1, import and re-export both examples. For v1.2, reject the unsigned example and round-trip a signed archive using a registered key for testing. The site validator reports “Example signature verified” when it verifies the signed example.
2. Check the export using the form on this page. A format pass confirms the file’s structure and uniqueness constraints. Certification also requires comparing the records before and after the round trip.
3. Match character groups by `(region, server_id, uid)`. The CN character should retain three records and the global character one. The CN operator and weapon draws share a millisecond timestamp and a sequence ID but belong to different record types. Both must survive.
4. Compare each event’s kind and any supplied pool, result, rarity, millisecond timestamp and sequence ID. Keep `gift_weapon` and omit its missing rarity. Preserve the long sequence ID `90071992547409931` as the original string.

## Format validator

For production v1.2 archives, the browser sends the provider ID and public key fingerprint to the registry and checks the signature locally. Use “Check import compatibility” to check the requirements of a specific importer version. See the [specification](/?plugin=akegf&id=standard) for import rules.

Paste a complete document and select Validate JSON, or choose a local file to check it immediately. Records are processed in this browser.

Checks cover the archive's declared v1.1 or v1.2 schema, duplicate character groups and repeated sequence IDs within each record type. For example, the error path `/endfield/0/list/1` identifies the second record in the first group.

## Registering a signing key

Open a [pull request in AKEDatabase](https://github.com/NagiYume/AKEDatabase/pulls). Copy this template into the description and provide the PEM and JSON as publicly downloadable files.

~~~text
Title: [AKEGF] Register the signing key for <export_provider>

Project name:
Project website or repository URL:
Project maintainer's GitHub handle or link to their authorization:
Request type: First registration / Key rotation
Provider ID (info.export_provider):
New public key fingerprint (kid):
RSA public key PEM (file or public download link):
Signed v1.2 example JSON (file or public download link):
AKEGF import support (none / v1.1 / v1.2):
AKEGF export support and implementation or release link:
For rotation, old kid and requested action (keep / revoke):
Import and export round-trip results (if also requesting certification):
~~~

Use a `BEGIN PUBLIC KEY` PEM and derive the `kid` as specified in the standard. Sign public example records or synthetic data. The example's `info.export_provider` and the `kid` in `info.rsa_signature` must match the request. Submit the public key and example, and keep the private key with the provider. When rotating, register the new key before switching signers. Maintainers verify the applicant's identity, the supported operations and the example signature before publishing the key to the [AKEGF public key registry](https://verify.akedata.wiki/). See the [specification](/?plugin=akegf&id=standard) for signing rules.
