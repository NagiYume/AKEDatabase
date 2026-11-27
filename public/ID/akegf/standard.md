# AKEGF v1.2 · Spesifikasi

Saat mengekspor, sertakan semua kolom wajib. Abaikan kolom opsional jika sumbernya tidak dapat dipastikan. Saat mengimpor, ikuti tipe dalam skema. Jika is_free tidak ada, statusnya belum diketahui; false berarti tarikan itu diketahui tidak gratis.

Dalam versi mayor yang sama, x.1 mengimpor berkas x.1 tanpa tanda tangan dan berkas x.2 tanpa memeriksa tanda tangan. x.2 hanya mengimpor berkas x.2 dengan tanda tangan yang valid.

| Tingkat | Kolom wajib | Aturan |
| --- | --- | --- |
| `JSON` | info, endfield | endfield harus berisi setidaknya satu grup karakter. |
| `info` | version, export_provider, rsa_signature | version harus bernilai v1.2; export_timestamp adalah waktu Unix 13 digit dalam milidetik. |
| `endfield[]` | uid, list | uid berupa string dengan sedikitnya satu karakter selain spasi; list boleh kosong. |
| `list[]` | `kind` | `kind = "draw"` → `pool_id`, `item_name`, `rarity` (1–99), `gacha_ts` (Unix ms) |

Hanya kolom yang ditentukan skema yang diterima. Simpan nomor urut dan UID sebagai string.

| Tingkat | Kolom opsional |
| --- | --- |
| `info` | export_app, export_app_version, export_timestamp |
| `endfield[]` | region, server_id, account_uid, lang |
| `list[]` | record_type, seq_id, seq_id_source, pool_name, pool_type, item_id, name_text, weapon_type, is_new, is_free, gift_reward_label |

| kind | Peristiwa | Contoh yang diamati |
| --- | --- | --- |
| `draw` | Satu perekrutan atau satu senjata acak | is_free=true |
| `gift_intel_book` | Berkas informasi perekrutan | tarikan yang diperhitungkan · 60 |
| `gift_operator_token` | Token operator unggulan | tarikan yang diperhitungkan · 240 / 480 |
| `gift_weapon_box` | Peti senjata tambahan | 篆玉 / 幽寒 · pesanan senjata · 10 / 26 |
| `gift_weapon` | Senjata hadiah | 篆玉 / 幽寒 · pesanan senjata · 18 / 34 |

Baca kind dari catatan sumber. Angka pada tabel merupakan pengamatan pada banner tertentu. Perekrutan cepat menambah total tarikan, tetapi tidak menambah hitungan jaminan atau ambang hadiah perekrutan khusus. Hitung senjata per pool_id: 18 pesanan pertama pada 篆玉 menghasilkan 180 senjata acak, satu peti, dan satu senjata hadiah. Pertahankan jenis resmi lainnya; gunakan unknown jika jenisnya tidak diketahui.

Ambil item_name dari charName, weaponName, atau nameText untuk hadiah. Simpan label hadiah dalam gift_reward_label. Laporkan kelangkaan yang tidak dapat diverifikasi. seq_id_source=batch_end memerlukan seq_id. Abaikan weapon_type untuk char dan is_free untuk weapon.

Kunci grup adalah (region, server_id, uid). Jika region tidak ada, gunakan cn; pada server Tiongkok, nilai bawaan server_id adalah string “1”. global wajib menyertakan server_id. Dalam satu grup, gunakan (record_type, seq_id) untuk mengenali peristiwa. Jika kunci tidak lengkap, simpan setiap catatan secara terpisah. Pertahankan ID sebagai string.

[Unduh JSON Schema v1.2](/plugin/data/akegf/akegf-v1.2.schema.json)

[v1.1 JSON Schema](/plugin/data/akegf/akegf-v1.1.schema.json) · [v1.1 JSON](/plugin/data/akegf/example.json) · [v1.2 JSON](/plugin/data/akegf/example-signed.json)
