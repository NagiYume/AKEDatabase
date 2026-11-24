# AKEGF · Chứng nhận công cụ

Để được chứng nhận, ứng dụng phải hỗ trợ cả nhập lẫn xuất v0.3, ghi rõ phiên bản hỗ trợ và dẫn liên kết đến [AKEGF](https://www.akedata.wiki/?plugin=akegf&id=home).

Dự án hỗ trợ AKEGF có thể gửi [Pull Request](https://github.com/NagiYume/AKEDatabase/pulls) để được thêm vào [Dự án đối tác](/?plugin=akegf&id=partners).

Nhập [Ví dụ nhiều nhân vật](/plugin/data/akegf/example.json) rồi xuất lại. Nhân vật máy chủ Trung Quốc phải giữ ba bản ghi, nhân vật máy chủ quốc tế giữ một. Đối chiếu loại sự kiện, banner, vật phẩm, độ hiếm, thời gian mili giây và số thứ tự. Giữ cả hai bản ghi nhân vật và vũ khí trùng số, cùng loại gift_weapon của quà tặng.

## Trình kiểm tra AKEGF

Dán JSON hoặc chọn tệp cục bộ. Trình duyệt kiểm tra Schema, nhóm trùng và số thứ tự lặp trong cùng loại. /endfield/0/list/1 chỉ bản ghi thứ hai của nhân vật đầu tiên.
