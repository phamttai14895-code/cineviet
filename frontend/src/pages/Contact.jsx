import { Link } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';

export default function Contact() {
  useSeo('Liên hệ', 'Liên hệ CineViet - Góp ý, báo lỗi, khiếu nại bản quyền. Email support, mạng xã hội và hướng dẫn gửi thông tin.');
  return (
    <div className="page-static page-contact">
      <div className="container">
        <header className="page-static-header">
          <h1 className="page-static-title">Liên hệ</h1>
          <p className="page-static-subtitle">
            Bạn có góp ý, báo lỗi hoặc yêu cầu gỡ nội dung? Vui lòng gửi thông tin qua các kênh dưới đây.
          </p>
        </header>

        <div className="static-content">
          <section className="legal-section">
            <h2>Thông tin liên hệ</h2>
            <p>
              <strong>Email:</strong>{' '}
              <a href="mailto:support@cineviet.vn">support@cineviet.vn</a>
            </p>
            <p>
              Chúng tôi phản hồi trong vòng 24–48 giờ (ngày làm việc). Với khiếu nại bản quyền (DMCA), vui lòng gửi theo đúng quy trình tại trang{' '}
              <Link to="/dmca">DMCA</Link>.
            </p>
          </section>

          <section className="legal-section">
            <h2>Mạng xã hội</h2>
            <p>Theo dõi CineViet để cập nhật phim mới và thông báo:</p>
            <ul>
              <li>Facebook: <a href="#" target="_blank" rel="noopener noreferrer">CineViet</a></li>
              <li>YouTube: <a href="#" target="_blank" rel="noopener noreferrer">CineViet Channel</a></li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>Góp ý & Báo lỗi</h2>
            <p>
              Nếu phát hiện link phim lỗi, sai thông tin hoặc nội dung không phù hợp, vui lòng gửi email kèm URL trang và mô tả ngắn. Chúng tôi sẽ xử lý sớm nhất có thể.
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
