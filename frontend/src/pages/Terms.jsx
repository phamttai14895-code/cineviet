import { Link } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';

export default function Terms() {
  useSeo('Điều khoản sử dụng', 'Điều khoản sử dụng CineViet - Quy định sử dụng nền tảng xem phim trực tuyến, bản quyền và trách nhiệm người dùng.');
  return (
    <div className="page-static page-terms">
      <div className="container">
        <header className="page-static-header">
          <h1 className="page-static-title">Điều khoản sử dụng</h1>
          <p className="page-static-subtitle">
            Cập nhật lần cuối: 2025. Sử dụng trang web CineViet đồng nghĩa với việc bạn đồng ý các điều khoản dưới đây.
          </p>
        </header>

        <div className="static-content legal-content">
          <section className="legal-section">
            <h2>1. Giới thiệu</h2>
            <p>
              CineViet là nền tảng xem phim trực tuyến, cung cấp nội dung giải trí dưới hình thức tổng hợp và dẫn nguồn. Chúng tôi không lưu trữ file phim trên máy chủ của mình. Nội dung được nhúng hoặc dẫn link từ các nguồn bên thứ ba.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Điều kiện sử dụng</h2>
            <ul>
              <li>Bạn cam kết sử dụng dịch vụ đúng mục đích cá nhân, không thương mại hóa nội dung.</li>
              <li>Không được tải về, phân phối lại hoặc sao chép nội dung phim trái phép.</li>
              <li>Không sử dụng bot, crawler hoặc công cụ tự động để thu thập dữ liệu trái phép.</li>
              <li>Tuân thủ pháp luật Việt Nam và quốc tế về bản quyền khi truy cập nội dung.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>3. Tài khoản người dùng</h2>
            <p>
              Khi đăng ký tài khoản, bạn cung cấp thông tin chính xác và chịu trách nhiệm bảo mật mật khẩu. Chúng tôi có quyền vô hiệu hóa tài khoản nếu phát hiện vi phạm điều khoản hoặc hành vi lạm dụng.
            </p>
          </section>

          <section className="legal-section">
            <h2>4. Bản quyền & DMCA</h2>
            <p>
              Chúng tôi tôn trọng quyền sở hữu trí tuệ. Nếu bạn là chủ sở hữu bản quyền và cho rằng nội dung trên CineViet vi phạm, vui lòng gửi thông báo theo quy trình tại trang{' '}
              <Link to="/dmca">DMCA</Link>. Chúng tôi sẽ xử lý và gỡ nội dung vi phạm trong thời gian sớm nhất.
            </p>
          </section>

          <section className="legal-section">
            <h2>5. Miễn trừ trách nhiệm</h2>
            <p>
              CineViet không chịu trách nhiệm về nội dung từ nguồn bên thứ ba (chất lượng, tính hợp pháp, virus). Người dùng tự chịu rủi ro khi truy cập link ngoài. Chúng tôi có quyền thay đổi, ngừng dịch vụ hoặc cập nhật điều khoản mà không cần báo trước.
            </p>
          </section>

          <section className="legal-section">
            <h2>6. Liên hệ</h2>
            <p>
              Mọi thắc mắc về điều khoản, vui lòng xem trang <Link to="/lien-he">Liên hệ</Link> hoặc gửi email đến support@cineviet.vn.
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
