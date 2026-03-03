import { useSeo } from '../hooks/useSeo';

export default function PwaGuide() {
  useSeo('Hướng dẫn dùng CineViet như ứng dụng (PWA)', 'Cách cài CineViet lên màn hình điện thoại, máy tính; dùng khi offline; cập nhật phiên bản mới.');

  return (
    <div className="page-static page-pwa-guide">
      <div className="container">
        <header className="page-static-header">
          <h1 className="page-static-title">Hướng dẫn dùng CineViet như ứng dụng (PWA)</h1>
          <p className="page-static-subtitle">
            CineViet có thể cài lên điện thoại hoặc máy tính để mở nhanh như một ứng dụng, không cần vào trình duyệt mỗi lần.
          </p>
        </header>

        <div className="static-content legal-content">
          <section className="legal-section">
            <h2>1. Cài đặt CineViet lên màn hình</h2>

            <h3>Trên điện thoại Android (Chrome, Edge, Samsung Internet)</h3>
            <ol>
              <li>Mở <strong>CineViet</strong> trong trình duyệt (đường dẫn trang web của bạn, ví dụ: <code>https://cineviet.vn</code>).</li>
              <li>Chạm vào <strong>Menu</strong> (ba chấm dọc ⋮) ở góc trên bên phải.</li>
              <li>Chọn <strong>&quot;Thêm vào màn hình&quot;</strong> hoặc <strong>&quot;Cài đặt ứng dụng&quot;</strong> / &quot;Install app&quot;.</li>
              <li>Xác nhận <strong>&quot;Cài đặt&quot;</strong> hoặc <strong>&quot;Thêm&quot;</strong>.</li>
              <li>Icon <strong>CineViet</strong> sẽ xuất hiện trên màn hình chính. Lần sau chỉ cần chạm vào icon để mở, giao diện giống app (không hiện thanh địa chỉ trình duyệt).</li>
            </ol>

            <h3>Trên iPhone / iPad (Safari)</h3>
            <ol>
              <li>Mở <strong>CineViet</strong> trong <strong>Safari</strong>.</li>
              <li>Chạm nút <strong>Chia sẻ</strong> (hình vuông có mũi tên đi lên) ở dưới hoặc trên màn hình.</li>
              <li>Kéo xuống và chọn <strong>&quot;Thêm vào Màn hình chính&quot;</strong>.</li>
              <li>Chỉnh tên nếu muốn rồi chạm <strong>&quot;Thêm&quot;</strong>.</li>
              <li>Icon CineViet sẽ xuất hiện trên màn hình chính. Mở bằng icon để dùng như app.</li>
            </ol>

            <h3>Trên máy tính (Chrome, Edge)</h3>
            <ol>
              <li>Mở <strong>CineViet</strong> trong trình duyệt.</li>
              <li>Trên <strong>thanh địa chỉ</strong>, bên phải sẽ có biểu tượng <strong>Cài đặt</strong> (dấu cộng trong khung) hoặc vào <strong>Menu (⋮)</strong> → &quot;Cài đặt CineViet...&quot; / &quot;Install CineViet...&quot;.</li>
              <li>Trong hộp thoại, bấm <strong>&quot;Cài đặt&quot;</strong>.</li>
              <li>Ứng dụng CineViet sẽ mở trong cửa sổ riêng (không có thanh tab trình duyệt), có thể ghim lên thanh taskbar hoặc Start menu.</li>
            </ol>
          </section>

          <section className="legal-section">
            <h2>2. Khi không có mạng (Offline)</h2>
            <ul>
              <li>Nếu bạn <strong>đã mở CineViet</strong> trước đó khi có mạng, một số trang (ví dụ trang chủ) có thể vẫn xem được nhờ bộ nhớ tạm.</li>
              <li>Nếu bạn mở <strong>một trang chưa từng xem</strong> khi <strong>mất mạng</strong>, CineViet sẽ hiển thị trang <strong>&quot;Bạn đang offline&quot;</strong> với nút <strong>&quot;Thử lại&quot;</strong>.</li>
              <li>Bạn chỉ cần <strong>bật lại WiFi hoặc dữ liệu di động</strong>, rồi bấm <strong>&quot;Thử lại&quot;</strong> để tải lại trang.</li>
            </ul>
            <p><strong>Lưu ý:</strong> Xem phim cần có kết nối mạng; khi offline chỉ có thể xem lại phần nội dung đã được lưu tạm (nếu có).</p>
          </section>

          <section className="legal-section">
            <h2>3. Khi có bản cập nhật mới</h2>
            <ul>
              <li>Khi CineViet phát hành <strong>phiên bản mới</strong>, nếu bạn đang mở trang, có thể thấy <strong>dòng thông báo phía dưới màn hình</strong>: <em>&quot;Đã có phiên bản mới. Tải lại để cập nhật.&quot;</em></li>
              <li>Bấm <strong>&quot;Tải lại&quot;</strong> để dùng ngay bản mới (trang sẽ tự tải lại).</li>
              <li>Nếu chưa muốn cập nhật, bấm <strong>&quot;Để sau&quot;</strong>; thông báo có thể hiện lại khi bạn mở CineViet lần sau.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>4. Tóm tắt</h2>
            <div className="pwa-guide-table-wrap">
              <table className="pwa-guide-table">
                <thead>
                  <tr>
                    <th>Việc cần làm</th>
                    <th>Cách làm</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Cài lên điện thoại/máy tính</strong></td>
                    <td>Dùng &quot;Thêm vào màn hình&quot; / &quot;Cài đặt ứng dụng&quot; trong menu trình duyệt (xem chi tiết theo từng thiết bị ở trên).</td>
                  </tr>
                  <tr>
                    <td><strong>Mở CineViet nhanh</strong></td>
                    <td>Mở bằng icon CineViet trên màn hình chính hoặc taskbar thay vì vào trình duyệt rồi gõ địa chỉ.</td>
                  </tr>
                  <tr>
                    <td><strong>Khi mất mạng</strong></td>
                    <td>Trang &quot;Bạn đang offline&quot; sẽ hiện; bật lại mạng rồi bấm &quot;Thử lại&quot;.</td>
                  </tr>
                  <tr>
                    <td><strong>Khi có bản mới</strong></td>
                    <td>Bấm &quot;Tải lại&quot; trong thông báo &quot;Đã có phiên bản mới&quot; để cập nhật.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
