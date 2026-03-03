File VAST và quảng cáo zone (cùng thư mục ads)
===============================================

VAST (pre-roll)
---------------
- vast.xml        : File đang được phục vụ tại GET /api/ads/vast (nếu đã tải lên qua Admin)
- vast-example.xml: Bản mẫu tham khảo (VAST 2.0, video test từ Google)

Để bật quảng cáo pre-roll:
1. Vào Admin → Quản lý quảng cáo
2. Chọn file vast.xml hoặc vast-example.xml trong thư mục này
3. Nhập "Bỏ qua quảng cáo sau" (ví dụ 5 giây)
4. Bấm "Lưu & tải lên VAST"

Quảng cáo zone (ảnh: popup, banner footer, dưới phim nổi bật, sidebar trái/phải)
---------------------------------------------------------------------------------
Mỗi vị trí: bật/tắt trong Admin → Quản lý quảng cáo; tải file ảnh lên (không nhập URL).
File lưu tại: uploads/ads/{zone}.{ext} (svg/png/jpeg/gif/webp).

- popup          : Popup giữa màn hình (1 lần/session), gợi ý 600×500 px
- footer_banner  : Banner trên footer, full width, gợi ý 1200×120 px
- below_featured : Banner dưới carousel "Phim nổi bật", gợi ý 1200×200 px
- sidebar_left   : Banner cố định bên trái (chỉ desktop), gợi ý 160×600 px
- sidebar_right  : Banner cố định bên phải (chỉ desktop), gợi ý 160×600 px

File ví dụ (SVG có chữ): popup.svg, footer_banner.svg, below_featured.svg, sidebar_left.svg, sidebar_right.svg
Khi có file trong thư mục, lần đầu gọi GET /api/settings sẽ tự ghi vào DB và bật zone. Thay bằng ảnh thật qua Admin nếu cần.
