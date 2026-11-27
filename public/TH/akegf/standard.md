# AKEGF v0.4 · ข้อกำหนดรูปแบบ

ฉบับร่าง v0.4 เมื่อส่งออกให้ระบุฟิลด์บังคับทั้งหมด ส่วนฟิลด์เสริมให้ละไว้หากไม่มีข้อมูลที่เชื่อถือได้ เมื่ออ่านให้ใช้ชนิดข้อมูลตาม Schema หากไม่มี is_free แสดงว่าไม่ทราบ แต่ false ระบุว่าไม่ใช่การสุ่มฟรี

| ระดับ | ฟิลด์บังคับ | ข้อกำหนด |
| --- | --- | --- |
| `JSON` | info, endfield | endfield ต้องมีอย่างน้อยหนึ่งกลุ่มตัวละคร |
| `info` | version | version ต้องเป็น v0.4 ส่วน export_timestamp เป็นเวลา Unix หน่วยมิลลิวินาที 13 หลัก |
| `endfield[]` | uid, list | uid เป็นสตริงที่มีอักขระอื่นนอกเหนือจากช่องว่าง ส่วน list เป็นอาร์เรย์ว่างได้ |
| `list[]` | `kind` | `kind = "draw"` → `pool_id`, `item_name`, `rarity` (1–99), `gacha_ts` (Unix ms) |

ใช้เฉพาะฟิลด์ที่กำหนดใน Schema และเก็บเลขลำดับกับ UID เป็นสตริง

| ระดับ | ฟิลด์เสริม |
| --- | --- |
| `info` | export_app, export_app_version, export_timestamp, export_provider, rsa_signature |
| `endfield[]` | region, server_id, account_uid, lang |
| `list[]` | record_type, seq_id, seq_id_source, pool_name, pool_type, item_id, name_text, weapon_type, is_new, is_free, gift_reward_label |

| kind | เหตุการณ์ | ตัวอย่างที่พบ |
| --- | --- | --- |
| `draw` | รับสมัครหนึ่งครั้งหรือได้รับอาวุธสุ่มหนึ่งชิ้น | is_free=true |
| `gift_intel_book` | เอกสารข้อมูลการรับสมัคร | จำนวนครั้งรับสมัครที่เข้าเกณฑ์ · 60 |
| `gift_operator_token` | เหรียญของโอเปอเรเตอร์ที่เพิ่มอัตราออก | จำนวนครั้งรับสมัครที่เข้าเกณฑ์ · 240 / 480 |
| `gift_weapon_box` | กล่องอาวุธเพิ่มเติม | 篆玉 / 幽寒 · จำนวนครั้งที่เบิกอาวุธ · 10 / 26 |
| `gift_weapon` | อาวุธที่ได้รับเป็นของขวัญ | 篆玉 / 幽寒 · จำนวนครั้งที่เบิกอาวุธ · 18 / 34 |

อ่าน kind จากประวัติต้นทาง ตัวเลขในตารางมาจากตู้ที่สังเกตเท่านั้น การรับสมัครเร่งด่วนนับในยอดรวมแต่ไม่นับในยอดการันตีหรือขั้นรางวัลของตู้พิเศษ ให้นับอาวุธแยกตาม pool_id การเบิก 18 ครั้งแรกในตู้ 篆玉 ได้อาวุธสุ่ม 180 ชิ้น กล่องหนึ่งใบ และอาวุธของขวัญหนึ่งชิ้น เก็บประเภททางการอื่นตามเดิม หากระบุไม่ได้ให้ใช้ unknown

ดึง item_name จาก charName, weaponName หรือ nameText ของของขวัญ และเก็บชื่อรางวัลใน gift_reward_label หากตรวจสอบความหายากไม่ได้ให้รายงานว่าขาดข้อมูล เมื่อ seq_id_source=batch_end ต้องมี seq_id สำหรับ char ให้ละ weapon_type และสำหรับ weapon ให้ละ is_free

ใช้ (region, server_id, uid) แยกกลุ่ม หากไม่มี region ให้ใช้ cn และใช้สตริง “1” เมื่อไม่มี server_id ในเซิร์ฟเวอร์จีน สำหรับ global ต้องระบุ server_id ในกลุ่มเดียวกันให้ใช้ (record_type, seq_id) ระบุเหตุการณ์ หากคีย์ไม่ครบให้เก็บแต่ละรายการแยกกัน และเก็บรหัสเป็นสตริง

[ดาวน์โหลด JSON Schema v0.4](/plugin/data/akegf/akegf-v0.4.schema.json) · [ตัวอย่างหลายตัวละคร](/plugin/data/akegf/example.json)
