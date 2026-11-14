# Đi hẹn hò nhé? 💌

Trang web nhỏ để mời ai đó đi hẹn hò:

1. Hỏi "Đi hẹn hò với anh nhé?". Nút **Không** né mỗi khi bị rê chuột, bấm hoặc chạm vào. Nút **Có** to dần lên.
2. Bấm Có thì tim bay đầy màn hình.
3. Chọn ngày và giờ rảnh.
4. Chọn món ăn.
5. Ra một tấm vé hẹn hò, có nút sao chép để gửi lại qua Zalo hoặc Messenger.

Cả trang nằm gọn trong một file `index.html`, không cần cài đặt hay build gì.

## Chạy thử

Mở `index.html` bằng trình duyệt.

## Đổi cách xưng hô

Mặc định trang xưng "anh – em". Thêm vào cuối đường link để đổi:

| Thêm vào link | Xưng hô |
| --- | --- |
| (không thêm) | anh mời em |
| `#em-anh` | em mời anh |
| `#to-cau` | tớ mời cậu |

Ví dụ: `https://henho.tenmien.com/#to-cau`

## Đưa lên tên miền riêng

Đây là trang tĩnh, nên host được ở GitHub Pages, Vercel, Netlify hoặc Cloudflare Pages. Trỏ thư mục gốc của repo là xong.

Với GitHub Pages:

1. Vào **Settings → Pages**, chọn **Deploy from a branch**, nhánh `main`, thư mục `/ (root)`.
2. Điền tên miền vào ô **Custom domain** rồi bật **Enforce HTTPS**.
3. Thêm bản ghi DNS ở nơi quản lý tên miền:
   - Tên miền phụ (ví dụ `henho.tenmien.com`): bản ghi `CNAME` trỏ về `<tên-tài-khoản>.github.io`.
   - Tên miền chính (ví dụ `tenmien.com`): 4 bản ghi `A` trỏ về `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
