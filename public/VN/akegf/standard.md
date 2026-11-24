# AKEGF v0.4 · Đặc tả

Bản dự thảo v0.4. Khi xuất, phải ghi đủ các trường bắt buộc. Bỏ qua trường tùy chọn nếu không có nguồn đáng tin cậy. Khi đọc, tuân theo kiểu dữ liệu trong Schema. Thiếu is_free nghĩa là chưa rõ; false xác nhận lượt đó không miễn phí.

| Cấp | Trường bắt buộc | Quy tắc |
| --- | --- | --- |
| `JSON` | info, endfield | endfield chứa ít nhất một nhóm nhân vật. |
| `info` | version | version là v0.4; export_timestamp là thời gian Unix 13 chữ số tính bằng mili giây. |
| `endfield[]` | uid, list | uid là chuỗi có ít nhất một ký tự không phải khoảng trắng; list có thể rỗng. |
| `list[]` | `kind` | `kind = "draw"` → `pool_id`, `item_name`, `rarity` (1–99), `gacha_ts` (Unix ms) |

Chỉ dùng những trường có trong Schema. Giữ số thứ tự và UID dưới dạng chuỗi.

| Cấp | Trường tùy chọn |
| --- | --- |
| `info` | export_app, export_app_version, export_timestamp, export_provider, rsa_signature |
| `endfield[]` | region, server_id, account_uid, lang |
| `list[]` | record_type, seq_id, seq_id_source, pool_name, pool_type, item_id, name_text, weapon_type, is_new, is_free, gift_reward_label |

| kind | Sự kiện | Ví dụ đã ghi nhận |
| --- | --- | --- |
| `draw` | Một lượt tuyển dụng hoặc một vũ khí ngẫu nhiên | is_free=true |
| `gift_intel_book` | Hồ sơ tuyển dụng | lượt tuyển dụng hợp lệ · 60 |
| `gift_operator_token` | Tín vật của nhân vật được tăng tỷ lệ | lượt tuyển dụng hợp lệ · 240 / 480 |
| `gift_weapon_box` | Hòm vũ khí bổ sung | 篆玉 / 幽寒 · lần đặt vũ khí · 10 / 26 |
| `gift_weapon` | Vũ khí được tặng | 篆玉 / 幽寒 · lần đặt vũ khí · 18 / 34 |

Lấy kind từ bản ghi gốc. Các mốc trong bảng chỉ được ghi nhận ở một số banner. Tuyển dụng cấp tốc tính vào tổng lượt nhưng không tính vào bảo đảm và mốc thưởng của tuyển dụng đặc biệt. Thống kê vũ khí theo pool_id: 18 lần đầu ở 篆玉 cho 180 vũ khí ngẫu nhiên, một hòm và một vũ khí tặng. Giữ nguyên các loại chính thức khác; dùng unknown nếu chưa rõ loại.

Lấy item_name từ charName, weaponName hoặc nameText của quà; lưu tên phần thưởng vào gift_reward_label. Báo thiếu nếu chưa xác minh được độ hiếm. seq_id_source=batch_end yêu cầu seq_id. Bỏ weapon_type đối với char và is_free đối với weapon.

Khóa nhóm là (region, server_id, uid). Nếu thiếu region, dùng cn; tại máy chủ Trung Quốc, server_id mặc định là chuỗi “1”. global bắt buộc có server_id. Trong nhóm, dùng (record_type, seq_id) để nhận diện sự kiện; giữ riêng từng dòng khi thiếu khóa. Lưu mã định danh dưới dạng chuỗi.

[Tải JSON Schema v0.4](/plugin/data/akegf/akegf-v0.4.schema.json) · [Ví dụ nhiều nhân vật](/plugin/data/akegf/example.json)
