import { Link } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';

export default function Dmca() {
  useSeo('Chính sách DMCA', 'Chính sách DMCA CineViet - Hướng dẫn gửi thông báo vi phạm bản quyền, quy trình gỡ nội dung và phản đối.');
  return (
    <div className="page-static page-dmca">
      <div className="container">
        <header className="page-static-header">
          <h1 className="page-static-title">Chính sách DMCA</h1>
          <p className="page-static-subtitle">
            CineViet tôn trọng quyền sở hữu trí tuệ và phản hồi các thông báo vi phạm bản quyền theo Đạo luật Bản quyền Thiên niên kỷ số (DMCA) và pháp luật Việt Nam.
          </p>
        </header>

        <div className="static-content legal-content">
          <section className="legal-section">
            <h2>1. Cam kết</h2>
            <p>
              Chúng tôi không lưu trữ file phim trên máy chủ. Nội dung được nhúng hoặc dẫn link từ nguồn bên thứ ba. Khi nhận được thông báo gỡ bỏ (takedown notice) hợp lệ từ chủ sở hữu bản quyền hoặc đại diện, chúng tôi sẽ gỡ hoặc vô hiệu hóa truy cập tới nội dung vi phạm trong thời gian sớm nhất.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Gửi thông báo vi phạm (Takedown Notice)</h2>
            <p>Để báo cáo nội dung vi phạm, vui lòng gửi email đến <strong>support@cineviet.vn</strong> với tiêu đề <strong>[DMCA]</strong> và đính kèm các thông tin sau:</p>
            <ul>
              <li>Thông tin người khiếu nại: họ tên, chức danh, đơn vị, email, số điện thoại.</li>
              <li>Mô tả tác phẩm bị vi phạm (tên phim, năm, đơn vị nắm quyền).</li>
              <li>URL chính xác của trang chứa nội dung vi phạm trên CineViet (ví dụ: https://cineviet.vn/movie/xxx hoặc https://cineviet.vn/watch/xxx).</li>
              <li>Tuyên bố rằng bạn tin rằng việc sử dụng nội dung không được chủ sở hữu bản quyền, đại diện pháp luật hoặc pháp luật cho phép.</li>
              <li>Tuyên bố rằng thông tin trong thông báo là chính xác và bạn là chủ sở hữu bản quyền hoặc được ủy quyền hành động thay mặt chủ sở hữu.</li>
              <li>Chữ ký (vật lý hoặc điện tử) của người được ủy quyền.</li>
            </ul>
            <p>
              Thông báo không đầy đủ có thể khiến chúng tôi không thể xử lý. Sau khi nhận đủ thông tin, chúng tôi sẽ xác minh và gỡ nội dung vi phạm trong thời gian hợp lý (thường trong vòng 24–72 giờ làm việc).
            </p>
          </section>

          <section className="legal-section">
            <h2>3. Phản đối (Counter-Notice)</h2>
            <p>
              Nếu bạn cho rằng nội dung bị gỡ nhầm hoặc do nhầm lẫn, bạn có quyền gửi counter-notice đến support@cineviet.vn với đầy đủ thông tin nhận dạng, mô tả nội dung đã bị gỡ, và tuyên bố dưới hình phạt khai man rằng nội dung đã bị gỡ nhầm. Chúng tôi có thể chuyển counter-notice cho bên khiếu nại ban đầu. Việc khôi phục nội dung sẽ tuân thủ quy định pháp luật hiện hành.
            </p>
          </section>

          <section className="legal-section">
            <h2>4. Lặp vi phạm</h2>
            <p>
              Chúng tôi có chính sách chấm dứt tài khoản của người dùng bị xác định là vi phạm bản quyền lặp lại (repeat infringer), phù hợp với quy định pháp luật.
            </p>
          </section>

          <section className="legal-section">
            <h2>5. Liên hệ</h2>
            <p>
              Mọi thắc mắc về DMCA hoặc bản quyền, vui lòng dùng trang <Link to="/lien-he">Liên hệ</Link> hoặc gửi email trực tiếp đến support@cineviet.vn với tiêu đề [DMCA].
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
