import { useState, useEffect } from 'react';
import { admin } from '../../api/client';
import { useToast } from '../../context/ToastContext';

const SECURITY_OPTIONS = [
  {
    key: 'require_login',
    label: 'Bật đăng nhập bắt buộc',
    desc: 'Yêu cầu đăng nhập để xem phim',
  },
  {
    key: 'rate_limit_enabled',
    label: 'Rate limiting API',
    desc: 'Giới hạn 200 request/15 phút',
  },
  {
    key: 'allow_register',
    label: 'Cho phép đăng ký mới',
    desc: 'Người dùng mới có thể tạo tài khoản',
  },
  {
    key: 'maintenance_mode',
    label: 'Chế độ bảo trì',
    desc: 'Tạm dừng website cho tất cả người dùng',
  },
];

const PROTECTION_OPTIONS = [
  {
    key: 'protection_anti_adblock_notice',
    label: 'Thông báo khi dùng trình chặn quảng cáo',
    desc: 'Hiển thị thông báo nếu phát hiện trình duyệt có chặn quảng cáo',
  },
  {
    key: 'protection_block_right_click',
    label: 'Chặn click chuột phải',
    desc: 'Vô hiệu hóa menu ngữ cảnh (chuột phải) trên web',
  },
  {
    key: 'protection_block_devtools',
    label: 'Chặn F12 và Ctrl+Shift+I',
    desc: 'Chặn mở DevTools (F12, Ctrl+Shift+I, Ctrl+Shift+J)',
  },
  {
    key: 'protection_block_view_source',
    label: 'Chặn xem mã nguồn (Ctrl+U, view-source)',
    desc: 'Chặn phím tắt Ctrl+U và mở view-source',
  },
];

export default function AdminSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [siteName, setSiteName] = useState('CineViet');
  const [siteDescription, setSiteDescription] = useState('Trang xem phim online chất lượng cao');
  const [moviesPerPage, setMoviesPerPage] = useState(20);
  const [ga4MeasurementId, setGa4MeasurementId] = useState('');
  const [gtmContainerId, setGtmContainerId] = useState('');
  const [savingGa4, setSavingGa4] = useState(false);
  const [savingGtm, setSavingGtm] = useState(false);
  const [watchNotice, setWatchNotice] = useState('');
  const [socialFacebook, setSocialFacebook] = useState('');
  const [socialTelegram, setSocialTelegram] = useState('');
  const [socialEmail, setSocialEmail] = useState('');
  const [flags, setFlags] = useState({
    require_login: false,
    rate_limit_enabled: true,
    allow_register: true,
    maintenance_mode: false,
    protection_anti_adblock_notice: false,
    protection_block_right_click: false,
    protection_block_devtools: false,
    protection_block_view_source: false,
  });

  const load = () => {
    setLoading(true);
    admin
      .getSettings()
      .then((r) => {
        const d = r.data;
        setSiteName(d.site_name || 'CineViet');
        setSiteDescription(d.site_description || '');
        setMoviesPerPage(d.movies_per_page ?? 20);
        setGa4MeasurementId(d.ga4_measurement_id || '');
        setGtmContainerId(d.gtm_container_id || '');
        setWatchNotice(d.watch_notice ?? '');
        setSocialFacebook(d.social_facebook ?? '');
        setSocialTelegram(d.social_telegram ?? '');
        setSocialEmail(d.social_email ?? '');
        setFlags({
          require_login: !!d.require_login,
          rate_limit_enabled: d.rate_limit_enabled !== false,
          allow_register: d.allow_register !== false,
          maintenance_mode: !!d.maintenance_mode,
          protection_anti_adblock_notice: !!d.protection_anti_adblock_notice,
          protection_block_right_click: !!d.protection_block_right_click,
          protection_block_devtools: !!d.protection_block_devtools,
          protection_block_view_source: !!d.protection_block_view_source,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const saveWebsiteInfo = async () => {
    setSaving(true);
    try {
      await admin.updateSettings({
        site_name: siteName,
        site_description: siteDescription,
        movies_per_page: moviesPerPage,
        ga4_measurement_id: ga4MeasurementId.trim(),
        watch_notice: watchNotice.trim(),
        social_facebook: socialFacebook.trim(),
        social_telegram: socialTelegram.trim(),
        social_email: socialEmail.trim(),
        ...flags,
      });
      load();
      toast.success('Đã lưu cài đặt.');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const saveGa4 = async () => {
    setSavingGa4(true);
    try {
      await admin.updateSettings({ ga4_measurement_id: ga4MeasurementId.trim() });
      load();
      toast.success('Đã lưu Google Analytics 4.');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Lưu thất bại');
    } finally {
      setSavingGa4(false);
    }
  };

  const saveGtm = async () => {
    setSavingGtm(true);
    try {
      await admin.updateSettings({ gtm_container_id: gtmContainerId.trim() });
      load();
      toast.success('Đã lưu Google Tag Manager.');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Lưu thất bại');
    } finally {
      setSavingGtm(false);
    }
  };

  const toggleFlag = async (key) => {
    const next = { ...flags, [key]: !flags[key] };
    setFlags(next);
    try {
      await admin.updateSettings({
        site_name: siteName,
        site_description: siteDescription,
        movies_per_page: moviesPerPage,
        watch_notice: watchNotice.trim(),
        ...next,
      });
    } catch (e) {
      setFlags(flags);
      toast.error(e.response?.data?.error || 'Cập nhật thất bại');
    }
  };

  if (loading) {
    return (
      <div className="admin-page-head">
        <p className="loading-wrap">Đang tải cài đặt...</p>
      </div>
    );
  }

  return (
    <div className="admin-settings-page">
      <div className="admin-page-head">
        <h1>Cài đặt hệ thống</h1>
      </div>

      <div className="admin-settings-grid">
        <div className="admin-settings-card admin-settings-card-website">
          <div className="admin-settings-card-head">
            <span className="admin-settings-card-icon" aria-hidden><i className="fas fa-globe" /></span>
            <h2>Thông tin website</h2>
          </div>
          <p className="admin-settings-card-desc">Tên, mô tả và thiết lập hiển thị dùng cho trang chủ và SEO.</p>
          <div className="admin-settings-fields">
            <div className="admin-settings-field-group">
              <label className="admin-settings-label" htmlFor="settings-site-name">Tên website</label>
              <input
                id="settings-site-name"
                type="text"
                className="admin-settings-input"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="Ví dụ: CineViet"
              />
              <span className="admin-settings-hint-inline">Hiển thị trên header, title trang, PWA.</span>
            </div>
            <div className="admin-settings-field-group">
              <label className="admin-settings-label" htmlFor="settings-site-desc">Mô tả ngắn</label>
              <textarea
                id="settings-site-desc"
                className="admin-settings-textarea"
                value={siteDescription}
                onChange={(e) => setSiteDescription(e.target.value)}
                placeholder="Mô tả ngắn cho SEO và chia sẻ mạng xã hội"
                rows={3}
              />
              <span className="admin-settings-hint-inline">Dùng cho meta description và Open Graph.</span>
            </div>
            <div className="admin-settings-field-group admin-settings-field-inline">
              <label className="admin-settings-label" htmlFor="settings-movies-per-page">Số phim mỗi trang</label>
              <input
                id="settings-movies-per-page"
                type="number"
                min={1}
                max={100}
                className="admin-settings-input admin-settings-input-narrow"
                value={moviesPerPage}
                onChange={(e) => setMoviesPerPage(Number(e.target.value) || 20)}
                placeholder="20"
              />
              <span className="admin-settings-hint-inline">Mặc định: 20. Áp dụng: Phim Mới, Phim Bộ, Phim Lẻ, Anime, TV Shows, Thể loại, Quốc gia, Năm, Phim Chiếu Rạp, Tìm kiếm (1–100).</span>
            </div>
            <button
              type="button"
              className="admin-settings-save-btn"
              onClick={saveWebsiteInfo}
              disabled={saving}
            >
              <i className="fas fa-save admin-settings-btn-icon" aria-hidden />
              <span>{saving ? 'Đang lưu...' : 'Lưu thông tin website'}</span>
            </button>
          </div>
        </div>

        <div className="admin-settings-card">
          <div className="admin-settings-card-head">
            <span className="admin-settings-card-icon"><i className="fas fa-film" /></span>
            <h2>Thông báo trang xem phim</h2>
          </div>
          <div className="admin-settings-fields">
            <label className="admin-settings-label">DÒNG THÔNG BÁO DƯỚI VIDEO PLAYER (CHỈ PHIM BỘ)</label>
            <textarea
              className="admin-settings-textarea"
              value={watchNotice}
              onChange={(e) => setWatchNotice(e.target.value)}
              placeholder="Ví dụ: Chỉ xem nội dung hợp pháp. Bản quyền thuộc về nhà sản xuất."
              rows={2}
            />
            <p className="admin-settings-hint">
              Chỉ hiển thị khi xem phim bộ (và anime). Nội dung nằm ngay dưới video player. Để trống sẽ không hiện.
            </p>
            <button
              type="button"
              className="admin-settings-save-btn"
              onClick={saveWebsiteInfo}
              disabled={saving}
            >
              <i className="fas fa-save admin-settings-btn-icon" />
              <span>{saving ? 'Đang lưu...' : 'Lưu'}</span>
            </button>
          </div>
        </div>

        <div className="admin-settings-card">
          <div className="admin-settings-card-head">
            <span className="admin-settings-card-icon"><i className="fas fa-tags" /></span>
            <h2>Google Tag Manager</h2>
          </div>
          <div className="admin-settings-fields">
            <label className="admin-settings-label">CONTAINER ID (GTM-XXXXXXX)</label>
            <input
              type="text"
              className="admin-settings-input"
              value={gtmContainerId}
              onChange={(e) => setGtmContainerId(e.target.value)}
              placeholder="GTM-5RB3PNC4"
            />
            <p className="admin-settings-hint">
              Điền Container ID từ Google Tag Manager. Mã GTM sẽ được chèn vào &lt;head&gt; (cao nhất) và ngay sau &lt;body&gt; (noscript). Để trống để tắt.
            </p>
            <button
              type="button"
              className="admin-settings-save-btn"
              onClick={saveGtm}
              disabled={savingGtm}
            >
              <i className="fas fa-save admin-settings-btn-icon" />
              <span>{savingGtm ? 'Đang lưu...' : 'Lưu'}</span>
            </button>
          </div>
        </div>

        <div className="admin-settings-card">
          <div className="admin-settings-card-head">
            <span className="admin-settings-card-icon"><i className="fas fa-chart-line" /></span>
            <h2>Google Analytics 4 (Measurement ID)</h2>
          </div>
          <div className="admin-settings-fields">
            <label className="admin-settings-label">MEASUREMENT ID (G-XXXXXXXXXX)</label>
            <input
              type="text"
              className="admin-settings-input"
              value={ga4MeasurementId}
              onChange={(e) => setGa4MeasurementId(e.target.value)}
              placeholder="G-XXXXXXXXXX"
            />
            <p className="admin-settings-hint">
              Tùy chọn: dùng nếu không dùng GTM hoặc cần gửi pageview trực tiếp. Để trống để tắt.
            </p>
            <button
              type="button"
              className="admin-settings-save-btn"
              onClick={saveGa4}
              disabled={savingGa4}
            >
              <i className="fas fa-save admin-settings-btn-icon" />
              <span>{savingGa4 ? 'Đang lưu...' : 'Lưu'}</span>
            </button>
          </div>
        </div>

        <div className="admin-settings-card">
          <div className="admin-settings-card-head">
            <span className="admin-settings-card-icon"><i className="fas fa-share-alt" /></span>
            <h2>Mạng xã hội</h2>
          </div>
          <div className="admin-settings-fields">
            <label className="admin-settings-label">FACEBOOK</label>
            <input
              type="text"
              className="admin-settings-input"
              value={socialFacebook}
              onChange={(e) => setSocialFacebook(e.target.value)}
              placeholder="https://facebook.com/ten-trang"
            />

            <label className="admin-settings-label">TELEGRAM</label>
            <input
              type="text"
              className="admin-settings-input"
              value={socialTelegram}
              onChange={(e) => setSocialTelegram(e.target.value)}
              placeholder="https://t.me/kenh (hoặc @kenh)"
            />

            <label className="admin-settings-label">EMAIL</label>
            <input
              type="text"
              className="admin-settings-input"
              value={socialEmail}
              onChange={(e) => setSocialEmail(e.target.value)}
              placeholder="email@domain.com (hoặc mailto:email@domain.com)"
            />

            <p className="admin-settings-hint">
              Link sẽ hiển thị ở các biểu tượng mạng xã hội trong footer. Để trống sẽ vẫn hiện icon nhưng bị vô hiệu.
            </p>
            <button
              type="button"
              className="admin-settings-save-btn"
              onClick={saveWebsiteInfo}
              disabled={saving}
            >
              <i className="fas fa-save admin-settings-btn-icon" />
              <span>{saving ? 'Đang lưu...' : 'Lưu'}</span>
            </button>
          </div>
        </div>

        <div className="admin-settings-card">
          <div className="admin-settings-card-head">
            <span className="admin-settings-card-icon" aria-hidden><i className="fas fa-lock" /></span>
            <h2>Bảo mật & Giới hạn</h2>
          </div>
          <div className="admin-settings-toggles">
            {SECURITY_OPTIONS.map((opt) => (
              <div key={opt.key} className="admin-settings-toggle-row">
                <div className="admin-settings-toggle-text">
                  <span className="admin-settings-toggle-label">{opt.label}</span>
                  <span className="admin-settings-toggle-desc">{opt.desc}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={flags[opt.key]}
                  className={`admin-settings-toggle ${flags[opt.key] ? 'on' : ''}`}
                  onClick={() => toggleFlag(opt.key)}
                >
                  <span className="admin-settings-toggle-thumb" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-settings-card">
          <div className="admin-settings-card-head">
            <span className="admin-settings-card-icon"><i className="fas fa-shield-alt" /></span>
            <h2>Bảo vệ & Chặn</h2>
          </div>
          <div className="admin-settings-toggles">
            {PROTECTION_OPTIONS.map((opt) => (
              <div key={opt.key} className="admin-settings-toggle-row">
                <div className="admin-settings-toggle-text">
                  <span className="admin-settings-toggle-label">{opt.label}</span>
                  <span className="admin-settings-toggle-desc">{opt.desc}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={flags[opt.key]}
                  className={`admin-settings-toggle ${flags[opt.key] ? 'on' : ''}`}
                  onClick={() => toggleFlag(opt.key)}
                >
                  <span className="admin-settings-toggle-thumb" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
