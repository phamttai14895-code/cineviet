import { Link } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';

export default function Privacy() {
  useSeo('Chính sách bảo mật', 'Chính sách bảo mật CineViet - Cách chúng tôi thu thập, sử dụng và bảo vệ thông tin cá nhân khi bạn sử dụng dịch vụ.');
  return (
    <div className="page-static page-privacy">
      <div className="container">
        <header className="page-static-header">
          <h1 className="page-static-title">Chính sách bảo mật</h1>
          <p className="page-static-subtitle">
            Cập nhật lần cuối: 2025. Chúng tôi mô tả cách thu thập, sử dụng và bảo vệ thông tin của bạn khi sử dụng CineViet.
          </p>
        </header>

        <div className="static-content legal-content">
          <section className="legal-section">
            <h2>1. Thông tin chúng tôi thu thập</h2>
            <ul>
              <li><strong>Thông tin bạn cung cấp:</strong> email, tên hiển thị, mật khẩu (đã mã hóa) khi đăng ký hoặc đăng nhập qua mạng xã hội.</li>
              <li><strong>Dữ liệu sử dụng:</strong> lịch sử xem phim, tiến độ xem (để tiếp tục xem sau), bình luận bạn đăng.</li>
              <li><strong>Dữ liệu kỹ thuật:</strong> địa chỉ IP, loại trình duyệt, thiết bị (để bảo mật và chống lạm dụng).</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>2. Mục đích sử dụng</h2>
            <p>Chúng tôi sử dụng thông tin để:</p>
            <ul>
              <li>Cung cấp và duy trì dịch vụ (phát video, lưu tiến độ, hiển thị gợi ý).</li>
              <li>Xác thực tài khoản và bảo vệ chống gian lận.</li>
              <li>Gửi thông báo quan trọng (thay đổi điều khoản, bảo mật tài khoản) khi cần.</li>
              <li>Cải thiện trải nghiệm và phân tích sử dụng (dạng tổng hợp, không nhận dạng cá nhân).</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>3. Chia sẻ thông tin</h2>
            <p>
              Chúng tôi không bán dữ liệu cá nhân. Thông tin có thể được chia sẻ với nhà cung cấp dịch vụ (hosting, đăng nhập Google) theo hợp đồng bảo mật, hoặc khi pháp luật yêu cầu.
            </p>
          </section>

          <section className="legal-section">
            <h2>4. Bảo mật</h2>
            <p>
              Mật khẩu được lưu dưới dạng mã hóa. Chúng tôi áp dụng biện pháp kỹ thuật và tổ chức phù hợp để bảo vệ dữ liệu khỏi truy cập trái phép, mất mát hoặc lạm dụng.
            </p>
          </section>

          <section className="legal-section">
            <h2>5. Quyền của bạn</h2>
            <p>Bạn có quyền:</p>
            <ul>
              <li>Truy cập, chỉnh sửa thông tin cá nhân trong phần Tài khoản.</li>
              <li>Yêu cầu xóa tài khoản và dữ liệu liên quan (gửi email đến support@cineviet.vn).</li>
              <li>Từ chối cookie không bắt buộc (cấu hình trong trình duyệt).</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>6. Cookie & Công nghệ tương tự</h2>
            <p>
              Trang web sử dụng cookie và bộ nhớ cục bộ để đăng nhập, lưu tiến độ xem và tùy chọn giao diện. Bạn có thể xóa cookie trong trình duyệt, nhưng một số chức năng có thể bị ảnh hưởng.
            </p>
          </section>

          <section className="legal-section">
            <h2>7. Liên hệ</h2>
            <p>
              Mọi câu hỏi về chính sách bảo mật, vui lòng xem trang <Link to="/lien-he">Liên hệ</Link> hoặc gửi email support@cineviet.vn.
            </p>
          </section>
        </div>

        <p className="page-static-back">
          <Link to="/"><i className="fas fa-arrow-left" /> Về trang chủ</Link>
        </p>
      </div>
    </div>
  );
}
