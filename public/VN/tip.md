AKEData đã chuyển sang tên miền www.akedata.wiki. Tên miền cũ akedata.top hiện chuyển hướng đến đây.

# Nhật ký cập nhật phiên bản AKEData

### v1.3.9

Bổ sung dự thảo [AKEGF](https://www.akedata.wiki/?plugin=akegf&id=home) v0.3, ví dụ nhiều nhân vật và [Trình kiểm tra AKEGF](/?plugin=akegf&id=validator). Bài nghiên cứu, tài liệu AKEGF và thông báo dùng chung trình hiển thị Markdown và tô màu cú pháp.

### v1.2.11

#### Điều hướng cấp hai và giao diện dùng chung

- Điều hướng cấp hai của các mô-đun tra cứu chính đã được xây dựng lại, thống nhất cấu trúc mục, trạng thái đang chọn, số lượng, dấu thay đổi phiên bản, tìm kiếm, bộ lọc và thao tác trên máy tính lẫn thiết bị di động.
- Bổ sung lớp giao diện dùng chung cho nút, ô nhập, danh sách chọn, công tắc, bộ lọc, thẻ, trạng thái và bảng, giúp giảm khác biệt về hiển thị và thao tác giữa các mô-đun.

#### Cài đặt và hiển thị

- Thiết kế lại cửa sổ cài đặt chung và thông báo trang web, sắp xếp thông tin rõ ràng hơn và thống nhất giao diện sáng, tối cùng chế độ dịu mắt.
- Thống nhất trạng thái đang tải, không có nội dung và lỗi. Tiêu đề cùng nội dung của bảng dùng chung nay được căn giữa theo mặc định.

### v1.2.10-1

#### So sánh phiên bản Kho lưu trữ

- Khi sử dụng dữ liệu Latest, Kho lưu trữ được so sánh với bản Hotfix cuối cùng của phiên bản trò chơi trước. Hồ sơ mới trong phiên bản này được ghim lên đầu và đánh dấu trên toàn bộ trang tổng quan ban đầu, đồng thời được ghim và đánh dấu trong từng danh mục của thư mục; các mục mới trong mỗi nhóm cũng được ưu tiên hiển thị trước. Phiên bản lịch sử cố định không hiển thị dấu mới.

### v1.2.10

#### Kho lưu trữ

- Thêm mô-đun Kho lưu trữ công khai mới. Trang bắt đầu tổng hợp toàn bộ hồ sơ lưu trữ, hỗ trợ danh mục theo loại phương tiện và phân loại, tìm kiếm toàn văn và liên kết sâu đến từng nhóm hồ sơ.
- Trang chi tiết hiển thị tiêu đề và nội dung văn bản có định dạng, ảnh lưu trữ gốc trong trò chơi, đồng thời cho phép chuyển đổi các ảnh khác nhau theo giới tính của nhân vật chính.
- Hồ sơ nghe nhìn chỉ cung cấp bản chép lời theo từng câu và không hỗ trợ phát âm thanh.

#### Trải nghiệm và độ ổn định

- Hỗ trợ danh mục trên máy tính và thiết bị di động, khôi phục trạng thái duyệt và xuất thành ảnh dài.
- Cải thiện cách hiển thị dấu che nội dung trong văn bản có định dạng và xử lý khi thiếu ảnh.

### v1.2.9

#### Tiện ích và trung tâm nhiệm vụ

- Thêm mô-đun Tiện ích có thể mở rộng bằng các công cụ hoạt động độc lập. Phiên bản đầu gồm nhiệm vụ hằng tuần, Protocol Pass và nhiệm vụ hoạt động Luyện tập, Hợp đồng, Racing Dungeon và Giải đấu.
- Nhiệm vụ Protocol Pass có thể lọc theo tuần và hiện hiển thị đầy đủ mọi cấp ở cả ba nhánh phần thưởng.

#### Biểu tượng và nguồn nhận

- Thêm trình tạo biểu tượng nhân vật, cho phép chọn nhân vật và kỹ năng, xem trước ảnh ghép rồi tải xuống dưới dạng PNG.
- Cửa hàng giờ hiển thị điều kiện mở khóa và cấp Material Dispatch; chi tiết trang bị bổ sung nguồn từ cửa hàng, nhiệm vụ và hộp mẫu trên bản đồ. Liên kết bản đồ OEM chỉ được tính động từ LevelData sau khi người dùng nhấp vào.

#### Trải nghiệm và độ ổn định

- Đồng nhất ảnh thay thế khi tải thất bại, đồng thời sửa cuộn độc lập trong mô-đun Tiện ích, điều khiển trên di động và một số bố cục phần thưởng nhiệm vụ.
- Mô-đun dữ liệu chiến đấu mới `v3_skill` và mô-đun dữ liệu Buff `v3_buff` vẫn đang được kiểm tra và chưa được mở trong phiên bản này.

### v1.2.8

#### Thanh bên và bố cục

- Thanh bên chính và thanh bên phụ của từng mô-đun giờ có thể được thay đổi độ rộng bằng cách kéo, đồng thời độ rộng đã điều chỉnh được lưu riêng. Khi thanh bên hẹp, mục có biểu tượng chỉ hiển thị biểu tượng, còn mục không có biểu tượng vẫn giữ tên để dễ nhận biết.
- Các nút Cài đặt chung và xuất ảnh dài ở góc dưới bên trái giờ có khu vực phía dưới riêng và không còn che danh sách mô-đun.

#### Trạng thái duyệt

- Trong cùng một phiên truy cập, khi quay lại mô-đun, trang, mục và vị trí cuộn đã mở trước đó sẽ được khôi phục.
- Vị trí cuộn phần chi tiết được ghi nhớ riêng cho từng mục trong cùng một mô-đun. Khi tải lại trang, các trạng thái tạm thời này sẽ bị xóa và trang bắt đầu sẽ được hiển thị lại.

### v1.2.7

#### Phó bản và hoạt động

- Chi tiết phó bản giờ hiển thị riêng phần thưởng cố định và ngẫu nhiên có thể nhận lặp lại bằng cách tiêu hao Lý trí, bên cạnh phần thưởng vượt lần đầu.
- Các khối trên dòng thời gian hoạt động giờ được đặt theo thời điểm bắt đầu và kết thúc chính xác thay vì căn theo cả ngày.

#### Tổng quan và hình ảnh

- Thẻ nhân vật và thanh bên giờ hiển thị biểu tượng thuộc tính và nghề nghiệp, với màu thuộc tính được hiệu chỉnh lại và biểu tượng được chọn theo ID nghề nghiệp.
- Đã bỏ sao độ hiếm khỏi tổng quan Nhân vật và Vũ khí, đồng thời bỏ cấp nguy hiểm khỏi tổng quan Kẻ địch. Bộ lọc, sắp xếp và dữ liệu chi tiết không thay đổi.
- Biểu tượng nội tuyến Rich Text, liên kết thuật ngữ và tooltip giờ được phân giải qua miền dữ liệu hiện tại, sửa lỗi thiếu `data.akedata.wiki` và đường dẫn `//public/...` không hợp lệ.

### v1.2.6

#### Mô-đun liên lạc Baker

- Thêm mô-đun Baker để xem đầy đủ hội thoại của Operator, liên hệ và nhóm, kèm bộ lọc loại, tìm kiếm toàn văn và liên kết sâu URL.
- Nhiều cuộc hội thoại với cùng một liên hệ nay được hiển thị thành các mục riêng trong thanh bên; lựa chọn hội thoại có thể đổi nhánh tiếp theo.
- Hỗ trợ văn bản, hình ảnh, tệp đính kèm vật phẩm và nhiệm vụ, tin nhắn hệ thống, phản ứng và hình ảnh cho lựa chọn `sns_emoji`; đồng thời cải thiện ảnh đại diện, cuộn trang và bố cục máy tính/di động.

### v1.2.5

#### Hình ảnh và tải tài sản lên

- Hình ảnh giờ giữ nguyên cấu trúc thư mục gốc dưới `assets/beyond/dynamicassets/gameplay`, và mọi mô-đun đã chuyển sang đường dẫn mới.
- Đã sửa tài sản bị thiếu do đối sánh thư mục và ánh xạ nội bộ chưa đầy đủ của beyond-sdk, bao gồm việc phân biệt chính xác `charremoteicon` với `charremoteicon700`.
- AKE Data Tool cho phép tải hình ảnh, dữ liệu Json hoặc cả hai lên và kiểm tra dung lượng hiện tại cùng mức đỉnh dự kiến của toàn bộ R2 bucket; quá trình tải bị chặn khi đạt 10 GB.
- HTML mô-đun và JavaScript được cập nhật riêng bằng `pluginversion` và `jsversion`, nên tài nguyên không đổi tiếp tục dùng bộ nhớ đệm cục bộ.
- Mô-đun Baker không nằm trong phiên bản này và được hoãn sang `1.2.6`.

### v1.2.3

#### Mô-đun và khả năng hiển thị

- Mô-đun Nhiệm vụ tạm thời bị ẩn và được đánh dấu “Đang phát triển”. Các mô-đun gỡ lỗi BuffData, SkillData và SpawnerConfig đã bị vô hiệu hóa; mô tả của Echoes of War cũng được cập nhật.
- Khi tắt “Hiển thị mô-đun ẩn”, ID nội bộ của nhân vật, trang bị, hoạt động, Buff và dữ liệu khác sẽ không xuất hiện. Giá trị gốc và công thức tính giờ luôn có thể xem.
- Các hiệu chỉnh thuộc tính được gộp theo nguồn như khi xuất hiện, Buff hoặc màn chơi. Buff thuộc tính trong mô-đun Kẻ địch tham gia phép tính; khi tắt chế độ ẩn, ID Buff và Buff không ảnh hưởng thuộc tính sẽ không hiển thị.

#### Kẻ địch và chế độ chơi

- Phó bản, Contingency Contract và Echoes of War dùng chung bộ hiển thị kẻ địch cho thuộc tính cấp độ, Buff khi xuất hiện và kết quả sau hiệu chỉnh. Dữ liệu kháng nguyên tố mới (94–99) được dùng thống nhất, còn hệ số cũ (80–85) không còn hiển thị.
- Có thể mở hoặc thu gọn các vòng xoay Echoes of War; màu viền phân biệt đang diễn ra, sắp bắt đầu và đã kết thúc. Mặc định chỉ vòng đang diễn ra được mở, và mỗi vòng chỉ mở cấu hình kẻ địch ở độ khó cao nhất.
- Nếu mô tả đặc tính và phần tăng cường giống nhau ở cả ba độ khó, chúng chỉ xuất hiện một lần trước danh sách. Nội dung khác nhau vẫn hiển thị riêng theo từng độ khó.
- Đã sửa cách hiển thị `v2cc-term-param` trong Contingency Contract. Cấu hình hoạt động mặc định được thu gọn và điều kiện mở khóa nhiệm vụ bị ẩn.

#### Hoạt động và giao diện

- Trang đầu Hoạt động có thêm dòng thời gian lịch, hiển thị ngày bắt đầu, kết thúc và trạng thái. Dòng thời gian có chú thích ngày, giữ tiêu đề ngoài màn hình ở cạnh trái và đặt biểu tượng lấp đầy chiều cao ở cạnh phải. Nút Trang chủ giờ cũng kết xuất lại đúng.
- Đã sửa ký tự xuống dòng đã thoát trong mô tả kỹ năng nhân vật và vũ khí. Biểu tượng linh kiện mặc định xuất hiện cạnh nút chi phí chế tạo trang bị.
- Xuất ảnh dài đã rời trạng thái thử nghiệm và được bật mặc định. Thanh bên bị loại khỏi ảnh và tên tệp khớp với mô-đun hoặc trang hiện tại.

#### Tải dữ liệu và thông báo

- Bộ nhớ đệm TableCfg lâu dài chỉ thay đổi khi Hotfix thay đổi. Json và hình ảnh dùng bản sửa đổi dữ liệu dùng chung độc lập, không tải lại chỉ vì phiên bản trang web hoặc Hotfix thay đổi.
- Thông báo giờ hiển thị đúng tiêu đề, danh sách và mã nội tuyến Markdown. Trang Giới thiệu và README cũng thêm liên kết đối tác dữ liệu “终末地一图流”.

### v1.2.2

Giá trị gốc và công thức giờ mở trong cửa sổ nổi duy trì khi nhấp vào một số, thay cho chú thích xuất hiện chậm khi rê chuột. Nhấp giá trị khác sẽ đổi nội dung; nhấp vùng trống của trang hoặc nhấn Esc sẽ đóng. Cửa sổ tự định vị lại khi cuộn hay đổi kích thước, hỗ trợ thiết bị di động và bàn phím, đồng thời không thay đổi kiểu hiển thị của các số.

Đã sửa lỗi bộ xử lý nhấp của phần tử cha trong một số mô-đun khiến nhấp chuột thật không mở được cửa sổ. Đồng thời sửa giá trị kỹ năng của `chr_0032_lizhiyan` hiển thị thành `[object Object]`.

### v1.2.1

Đã sửa lỗi khiến một số hình ảnh trò chơi có thể bị yêu cầu nhầm từ `www.akedata.wiki` sau khi chuyển mô-đun hoặc khởi động lại Service Worker. Đường dẫn hình ảnh giờ được viết lại đồng bộ sang `data.akedata.wiki` khi được chèn vào trang.

Service Worker giờ khôi phục nguồn dữ liệu và phiên bản dữ liệu dùng chung từ URL đăng ký. Vì vậy trạng thái định tuyến hình ảnh vẫn được giữ khi trình duyệt dừng rồi khởi động lại Worker. Biểu tượng trang web cũng được tải trực tiếp từ nguồn dữ liệu.

Đã bổ sung phân tích dữ liệu kẻ địch từ `LevelScriptData` vào phép tính thuộc tính của Phó bản, Contingency Contract và Echoes of War. Hệ thống giờ đọc kẻ địch, cấp độ và Buff khi xuất hiện được định nghĩa trực tiếp trong script, cùng các Buff có điều kiện áp dụng qua bộ sinh. Nhờ đó các màn không có SpawnerConfig vẫn được tính chính xác. Việc tải trước Buff điều kiện và tính lại sau khi đổi điều kiện cũng đã được sửa.

Cải thiện chú thích giá trị gốc. Giá trị không bị thay đổi bởi phép tính vẫn hiển thị giá trị gốc; giá trị bị thay đổi bởi thuộc tính, Buff, điều kiện hợp đồng hoặc biểu thức giờ hiển thị giá trị gốc, tham số thay thế, công thức đầy đủ và kết quả cuối. Theo dõi công thức áp dụng cho Phó bản, Contingency Contract, Echoes of War, kẻ địch và biểu thức của nhân vật, vũ khí, trang bị cùng vật phẩm.

### v1.2.0

Đã bổ sung tính năng so sánh dữ liệu giữa các phiên bản trò chơi. Khi chọn `Latest`, trang web tự động so sánh với Hotfix cuối cùng của phiên bản trước. Dữ liệu mới luôn được đưa lên đầu và gắn nhãn; nhãn dữ liệu sửa đổi cùng Diff chi tiết có thể bật bằng tùy chọn thử nghiệm trong cài đặt toàn cục, mặc định tắt.

Diff chi tiết chỉ so sánh thông tin thực sự hiển thị trên trang, tô đỏ nội dung bị xóa, tô xanh nội dung được thêm và bỏ qua trường ẩn. Hoạt động không tham gia phát hiện dữ liệu mới. Trang bị và huy chương được so sánh theo từng ID, đồng thời gắn nhãn cho bộ hoặc danh mục tương ứng. Viền thẻ vẫn dùng màu độ hiếm.

### v1.2.0-pre2

Đã cập nhật toàn bộ ánh xạ Attribute, bổ sung ID 93–100 và đồng bộ `maps.json` cho cả 14 ngôn ngữ.

Module quái và phụ bản giờ sử dụng các tham số kháng nguyên tố mới (ID 94–99). Các ID hệ số kháng cũ 80–85 không còn xuất hiện trong thẻ thuộc tính, phần tóm tắt modifier hay tooltip Buff liên quan.

### v1.1.9

Thêm module chuyên đề cho thử thách thường trực “Tiếng vọng chiến tranh”, cho phép xem màn chơi, độ khó, danh hiệu xếp hạng, phần thưởng công trạng và hướng dẫn chính thức theo mùa và chu kỳ luân phiên. Module cũng hiển thị đợt quái, bản đồ vị trí xuất hiện, Buff khi sinh và thuộc tính đã điều chỉnh theo cấp, kèm chuyển đợt và tô sáng liên kết trên bản đồ.

### v1.1.8

Thêm chế độ debug và chức năng buộc làm mới cache web; sửa node thuộc tính nhân vật và cách phân tích chi phí phát triển dựa trên mô tả vật phẩm; chuyển loại hoạt động sang ActivityTagTable; đọc trực tiếp style và thuật ngữ rich text từ TableCfg; đồng thời thêm nút trang chủ ở thanh bên cho các module có trang khởi đầu.

### v1.1.6

Thêm thông báo trong trang và đếm ngược cập nhật, hỗ trợ nhóm skill hai hình thái của Jue, tối ưu thông báo tải và loại bỏ nhiều module v2 đã ngừng sử dụng.

### v1.1.5

Ra mắt framework đa ngôn ngữ, hỗ trợ chuyển đổi ngôn ngữ cho giao diện, module, bộ lọc và ánh xạ dữ liệu, đồng thời bổ sung đợt tài nguyên đa ngôn ngữ đầu tiên.

### v1.1.4

Sửa tham số phiên bản của yêu cầu dữ liệu, tách phiên bản làm mới tài nguyên ứng dụng và dữ liệu công khai, đồng thời thống nhất cách xác định phiên bản của cache trang và Service Worker.

### v1.1.3

Thêm hiệu ứng sử dụng vật phẩm tiêu hao và công thức chế tạo vào module vật phẩm, bổ sung quan hệ nguyên liệu với sản phẩm, kiểu hiển thị chi tiết và bộ chuyển đổi dữ liệu v3 tương ứng.

### v1.1.2

Thêm lối vào tổng quan dạng thẻ theo nhóm cho các module nhân vật, vũ khí, kẻ địch, trang bị, hoạt động, vật phẩm, phó bản, huy chương, nghiên cứu và các module khác.

### v1.1.1

Thiết kế lại bộ lọc phân loại vật phẩm, hỗ trợ thu gọn và đếm kết quả lọc; đồng thời tăng cường chống trùng yêu cầu, cache IndexedDB và hiển thị tiến trình tải dữ liệu.

### v1.1.0

Ra mắt lớp chuyển đổi dữ liệu v3 dựa trên TableCfg và Json, bao phủ các module tra cứu chính, đồng thời thêm cơ chế vô hiệu hóa module và cache tệp dữ liệu lớn.

### v1.0.31

Từng thêm chuyển đổi giao diện Trung-Anh, thư mục dữ liệu và cấu hình quốc tế hóa liên quan, nhưng tính năng này sau đó được rollback hoàn toàn và không tiếp tục cung cấp ở giai đoạn này.

### v1.0.30

Thêm wrapper cache yêu cầu thống nhất, chuyển các trang sang dùng akeFetch để tải dữ liệu, qua đó giảm yêu cầu lặp lại và tối ưu logic tải khi chuyển module.

### v1.0.29

Tách script nhúng của trang chủ và các module sang thư mục plugin/js, tập trung quản lý routing, thiết lập, tính toán thuộc tính và controller module.

### v1.0.28

Thêm gợi ý giá trị gốc cho tham số của phần lớn module, đồng thời sửa phép tính HP quái vật và lỗi hiển thị "giảm toàn bộ damage".

### v1.0.27

Thêm trực quan hóa wave quái vật cho Contingency Contract, hỗ trợ tọa độ spawn, chuyển wave và highlight liên kết, đồng thời sửa thống kê gộp các wave lặp lại.

### v1.0.26

Thêm xem thuộc tính kẻ địch cho Contingency Contract, cho phép tính và hiển thị thuộc tính thực tế theo level, Buff khi spawn và tag hợp đồng đã chọn.

### v1.0.25

Tải trước và mở module Contingency Contract bị giới hạn bởi Token, hỗ trợ tìm season, điều kiện và xung đột tag, tính điểm, reward, nhiệm vụ và hiển thị shop.

### v1.0.24

Cập nhật hiển thị skill nhân vật v2, sửa thứ tự Combo Skill và Ultimate Skill, đồng thời giữ lại các tham số quan trọng như cooldown và tiêu hao năng lượng.

### v1.0.23

Chính thức mở module nghiên cứu, tăng cường Markdown, syntax highlighting, mục lục, chuyển anchor và xem trước hình ảnh, đồng thời thêm các bài nghiên cứu cơ chế.

### v1.0.22

Thêm giới hạn truy cập module và nội dung dựa trên Token, hỗ trợ lưu bền Token, thêm hàng loạt và xóa, đồng thời tải trước nội dung được bảo vệ.

### v1.0.21

Thêm hệ số physical abnormal damage và arts abnormal damage vào bảng tăng trưởng thuộc tính nhân vật v2, đồng thời cung cấp độ chính xác khác nhau theo chế độ hiển thị.

### v1.0.20

Điều chỉnh thứ tự và một số tên thuộc tính chi tiết của kẻ địch, đưa mục interrupt resistance và execution lên trước, đồng thời thống nhất cách gọi các tag bonus damage.

### v1.0.19

Thêm hiển thị equipment ID trong module trang bị, sắp xếp lại style v2 của nhân vật, vũ khí và trang bị, đồng thời sửa màu thuộc tính và cách chọn giá trị tăng trưởng.

### v1.0.18

Thêm deep link cho module và mục dữ liệu, đồng bộ address bar khi điều hướng và xử lý nội dung bị ẩn hoặc không tồn tại, đồng thời hoàn thiện hiển thị loại hiệu chỉnh thuộc tính nhân vật.

### v1.0.17

Chính thức ra mắt vũ khí v2, cung cấp tìm kiếm vũ khí và hiển thị chi tiết thuộc tính theo level, nguyên liệu breakthrough, potential cùng skill.

### v1.0.16

Chính thức ra mắt trang bị v2, hiển thị bộ phận theo set, thuộc tính chính và phụ, set skill, công thức chế tạo, bảo đảm precision forging và thông tin enhancement.

### v1.0.15

Chính thức ra mắt phó bản v2, hỗ trợ chi tiết chuỗi phó bản, reward và kẻ địch, đồng thời phân tích cấu hình spawn cùng Buff để hiển thị wave và thuộc tính sau hiệu chỉnh.

### v1.0.14

Chính thức ra mắt kẻ địch v2, bổ sung tìm kiếm, danh sách mobile, thuộc tính theo level, biến thể kẻ địch, hiệu chỉnh thuộc tính, resistance và thông tin stagger.

### v1.0.13

Chính thức ra mắt nhân vật v2, tái cấu trúc thuộc tính, skill, talent, potential và thông tin tăng trưởng, đồng thời sửa hiển thị trait, hình ảnh và node.

### v1.0.12

Nâng cấp timeline SkillData v2, thêm lọc action, flowchart nhánh điều kiện, ẩn hiện node và gợi ý thời lượng frame, đồng thời sửa một số giá trị quái vật.

### v1.0.11

Thêm chế độ debug SkillData v2 bị ẩn, trình bày logic skill bằng timeline và action node, đồng thời hỗ trợ tìm kiếm và xem dữ liệu gốc.

### v1.0.10

Tiếp tục tái cấu trúc nhân vật v2, xây dựng trang chi tiết nhân vật mới và kết nối dữ liệu nhân vật đầy đủ, đồng thời hoàn thiện ánh xạ field và cấu trúc hiển thị.

### v1.0.9

Thêm module tra cứu SpawnerConfig, cho phép duyệt dữ liệu spawner theo scene và cấu hình, đồng thời điều chỉnh lối vào tra cứu BuffData và SkillData.

### v1.0.8

Thêm module tra cứu BuffData và SkillData, hỗ trợ duyệt manifest, tìm kiếm và xem chi tiết, tạo lối vào để nghiên cứu dữ liệu chiến đấu tầng thấp.

### v1.0.7

Thêm tra cứu thông tin hoạt động, điều chỉnh hiển thị mặc định tag nhân vật và hỗ trợ tag đặc biệt của Rossi, đồng thời bổ sung thống kê lượt truy cập trang web.

### v1.0.6

Thêm danh sách nhà tài trợ và style tương ứng vào trang Giới thiệu, hoàn thiện phần hiển thị lời cảm ơn của dự án.

### v1.0.5

Hoàn thành thích ứng mobile cho các module chính như nhân vật, vũ khí, kẻ địch, trang bị, vật phẩm, phó bản và achievement, cùng cả ba theme.

### v1.0.4

Thêm bộ lọc cho các module nhân vật, vũ khí và vật phẩm, tái cấu trúc khu vực lọc danh sách để tăng hiệu quả tìm kiếm khi có nhiều mục.

### v1.0.3

Thêm giao diện tra cứu vật phẩm và đăng ký module vật phẩm, hỗ trợ danh sách, chi tiết vật phẩm cùng phần hiển thị thông tin cơ bản liên quan.

### v1.0.2

Thêm icon skill và hiển thị base skill trên trang nhân vật, gồm loại facility, level skill, mô tả và điều kiện unlock, đồng thời sửa dữ liệu liên quan.

### v1.0.1

Sửa lỗi hiển thị bất thường của dữ liệu thuộc tính cố định kẻ địch, đồng thời hoàn thiện thông tin kẻ địch trên trang phó bản.

### v1.0.0

AKEData 1.0 chính thức ra mắt, tập trung hoàn thiện nội dung tra cứu phó bản và nâng phiên bản dự án từ 0.99 lên 1.0.
