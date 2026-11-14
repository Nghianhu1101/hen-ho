# Đi hẹn hò nhé? 💌

Trang web nhỏ để mời ai đó đi hẹn hò:

1. Hỏi "Đi hẹn hò với anh nhé?". Nút **Không** né mỗi khi bị rê chuột, bấm hoặc chạm vào. Nút **Có** to dần lên.
2. Bấm Có thì tim bay đầy màn hình.
3. Chọn ngày và giờ rảnh.
4. Chọn món ăn.
5. Ra một tấm vé hẹn hò và gửi thông báo Telegram cho người mời. Vẫn có nút sao chép để gửi lại qua Zalo hoặc Messenger.

Giao diện dùng HTML/CSS/JS, không có thư viện chạy kèm. Thông báo đi qua Cloudflare Pages Functions để giữ kín token bot.

## Chạy thử

Cần Node.js 22 trở lên và tài khoản Cloudflare đã đăng nhập Wrangler.

```sh
npm run build
npm run dev
```

Mở địa chỉ local do Wrangler hiển thị. Nếu chưa có token/chat ID, trang vẫn tạo và sao chép vé; phần thông báo sẽ hiển thị gửi chưa thành công.

```sh
npm test
```

## Đổi cách xưng hô

Mặc định trang xưng "anh – em". Thêm vào cuối đường link để đổi:

| Thêm vào link | Xưng hô |
| --- | --- |
| (không thêm) | anh mời em |
| `#em-anh` | em mời anh |
| `#to-cau` | tớ mời cậu |

Ví dụ: `https://henho.tenmien.com/#to-cau`

## Cấu hình Telegram trên Cloudflare

Trong dự án Pages **hen-ho → Settings → Variables and secrets**, thêm hai biến loại **Secret** cho môi trường **Production**:

| Tên | Giá trị |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Token của bot từ BotFather |
| `TELEGRAM_CHAT_ID` | Chat ID tài khoản hoặc nhóm nhận thông báo |

Người nhận tin riêng phải mở bot và nhấn **Start** trước. Đừng đưa token vào mã nguồn, trình duyệt của khách hay Git. Nếu chạy local, đặt secrets trong `.dev.vars` (đã được Git bỏ qua).

`wrangler.jsonc` khai báo binding KV `NOTIFICATION_STATE` cho việc tránh gửi lại yêu cầu đã thành công và giới hạn gửi ở mức vừa phải. Nếu dùng tài khoản Cloudflare khác, tạo namespace KV riêng và thay ID trong cấu hình.

Thông báo chỉ gửi khi bấm **Đi thôi!** sau khi chọn lịch và món ăn. Các lần tải trang, đổi cách xưng hô hay sao chép vé không gửi tin. Nếu mạng lỗi, có nút thử lại. Không tự động gửi lại khi chưa biết kết quả. KV cung cấp chống lặp/giới hạn theo khả năng nhất quán của KV, không bảo đảm gửi đúng một lần trong mọi tình huống.

### Thông tin người chốt lịch

Thông báo Telegram gửi kèm IP kết nối do Cloudflare cung cấp, khu vực gần đúng (thành phố/tỉnh/quốc gia nếu có), loại trình duyệt/hệ điều hành và thời điểm chốt theo giờ Việt Nam. Khách không cần nhập tên. Các thông tin này không xác nhận danh tính thật; IP có thể dùng chung hoặc đi qua VPN và vị trí có thể không chính xác.

Trước nút chốt có thông báo rõ dữ liệu được gửi cho người mời. Chỉ thu thập ở lượt chốt lịch; không gửi khi vừa mở trang. Không xin GPS, thêm cookie hay dịch vụ định vị bên ngoài. Không lưu IP gốc/thiết bị/vị trí vào KV hoặc log của ứng dụng; dữ liệu được đưa vào tin riêng Telegram. Bộ đếm chống gửi quá nhiều vẫn dùng IP đã băm như trước.

## Triển khai

### Link riêng theo nhãn

Các link dạng `/A-<mã ngẫu nhiên>` đến `/E-<mã ngẫu nhiên>` dùng chung giao diện. Khi chốt lịch, máy chủ tra mã đầy đủ trong KV `NOTIFICATION_STATE` (`invite:<mã>` → nhãn) rồi thêm dòng **Link được gán cho: A** vào Telegram. Nhãn từ trình duyệt hay chữ cái đầu đường dẫn không đủ để xác nhận; chỉ mã đã cấu hình mới được gán nhãn.

Trang gốc vẫn hoạt động như trước và gửi vé không có nhãn. Mã hợp lệ về cấu trúc nhưng không được cấu hình sẽ bị từ chối gửi thông báo. Link bị chuyển tiếp vẫn giữ nhãn ban đầu; đây là nhận diện đường link, không phải xác minh danh tính.

Các mã đang dùng được giữ trong KV và file chủ sở hữu nằm ngoài Git; không đưa danh sách mã thật vào tài nguyên tĩnh hoặc repo công khai. Module dùng đường dẫn tuyệt đối và bản build tạo `_redirects` để các link có hoặc không có dấu `/` cuối đều mở được giao diện.

```sh
npm run deploy
```

Lệnh tạo `dist/` chỉ chứa tài nguyên tĩnh cần thiết rồi triển khai kèm `functions/`. Token được lấy từ secrets trên Cloudflare. Với môi trường Preview, cần cấu hình secrets Preview riêng nếu muốn thử gửi tin thật.

Website: https://henho.nghiacloud.cloud/ (dự án `hen-ho`, production branch `main`).

Trang hiện dùng **Direct Upload**; đẩy GitHub chưa tự triển khai. Để cập nhật bản đã chạy, dùng lệnh triển khai ở trên sau khi kiểm thử.
