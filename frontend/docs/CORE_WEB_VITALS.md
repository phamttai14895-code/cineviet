# Core Web Vitals

Dự án đã tích hợp báo cáo Core Web Vitals (CWV) qua thư viện `web-vitals`.

## Cách hoạt động

- Component **WebVitals** (`src/components/WebVitals.jsx`) được mount trong App, gọi `onCLS`, `onINP`, `onLCP`, `onFCP`, `onTTFB`.
- **Development**: metric được log ra console (`[Web Vitals] ...`).
- **Production**: khi đã cấu hình GA4 (Cài đặt Admin → Google Analytics 4), metric được gửi lên GA4 dưới dạng event (event_category: "Web Vitals").

## Chỉ số và ngưỡng tốt

| Metric | Mô tả | Tốt |
|--------|--------|-----|
| **LCP** (Largest Contentful Paint) | Thời gian hiển thị nội dung chính | < 2.5s |
| **INP** (Interaction to Next Paint) | Độ trễ phản hồi tương tác | < 200ms |
| **CLS** (Cumulative Layout Shift) | Độ ổn định bố cục | < 0.1 |
| **FCP** (First Contentful Paint) | Thời điểm nội dung đầu tiên vẽ | < 1.8s |
| **TTFB** (Time to First Byte) | Thời gian phản hồi server | < 800ms |

## Cách kiểm tra

1. **Chrome DevTools**: F12 → tab **Lighthouse** → chọn Performance (và Accessibility nếu cần) → Analyze page load. Báo cáo sẽ hiển thị CWV.
2. **PageSpeed Insights**: https://pagespeed.web.dev/ — nhập URL site (sau khi deploy).
3. **GA4**: Nếu đã bật GA4, vào Reports → Events → lọc event tên `LCP`, `INP`, `CLS`, … để xem giá trị trung bình theo trang.

## Tối ưu đã áp dụng

- Lazy load route (React.lazy) để giảm bundle ban đầu.
- Ảnh: `loading="lazy"` và `decoding="async"` trên nhiều thẻ `<img>` (MovieCard, Header suggest, Watch info, Actors grid, …).
- Có thể bổ sung: srcset cho poster/backdrop khi backend hỗ trợ nhiều kích thước; preload font/hero image nếu cần.
