import { useState, useEffect, useRef } from 'react';
import { admin } from '../../api/client';
import { useToast } from '../../context/ToastContext';

const AD_ZONES = [
  { id: 'popup', label: 'Quảng cáo Popup' },
  { id: 'footer_banner', label: 'Banner footer' },
  { id: 'below_featured', label: 'Banner dưới phim nổi bật' },
  { id: 'sidebar_left', label: 'Banner sidebar trái' },
  { id: 'sidebar_right', label: 'Banner sidebar phải' },
];

export default function AdminAds() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vastEnabled, setVastEnabled] = useState(true);
  const [vastSkipOffsetSeconds, setVastSkipOffsetSeconds] = useState(5);
  const [hasVastFile, setHasVastFile] = useState(false);
  const [zoneState, setZoneState] = useState({});
  const fileInputRef = useRef(null);
  const zoneFileRefs = useRef({});

  const load = () => {
    setLoading(true);
    admin
      .getSettings()
      .then((r) => {
        const d = r.data;
        setVastEnabled(d.vast_enabled !== false && d.vast_enabled !== '0');
        setVastSkipOffsetSeconds(Math.max(0, parseInt(d.vast_skip_offset_seconds, 10) || 0));
        setHasVastFile(!!(d.vast_preroll_url && d.vast_preroll_url.trim()));
        const z = {};
        AD_ZONES.forEach(({ id }) => {
          z[id] = {
            enabled: d[`ad_${id}_enabled`] === true || d[`ad_${id}_enabled`] === '1',
            hasFile: !!(d[`ad_${id}_file`] && String(d[`ad_${id}_file`]).trim()),
            link: (d[`ad_${id}_link`] && String(d[`ad_${id}_link`]).trim()) || '',
          };
        });
        setZoneState(z);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('vast_enabled', vastEnabled ? '1' : '0');
      formData.append('vast_skip_offset_seconds', String(Math.max(0, parseInt(String(vastSkipOffsetSeconds), 10) || 0)));
      const file = fileInputRef.current?.files?.[0];
      if (file) formData.append('vast', file);
      await admin.uploadVast(formData);
      if (file) setHasVastFile(true);
      load();
      toast.success('Đã lưu VAST.');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Lưu thất bại');
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const saveZone = async (zoneId) => {
    const enabled = zoneState[zoneId]?.enabled ?? false;
    const link = (zoneState[zoneId]?.link && String(zoneState[zoneId].link).trim()) || '';
    const file = zoneFileRefs.current[zoneId]?.files?.[0];
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('zone', zoneId);
      formData.append('type', zoneId);
      formData.append('enabled', enabled ? '1' : '0');
      formData.append('link', link);
      if (file) formData.append('file', file);
      await admin.uploadAdZone(formData);
      if (file) setZoneState((s) => ({ ...s, [zoneId]: { ...s[zoneId], hasFile: true } }));
      load();
      toast.success('Đã lưu.');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Lưu thất bại');
    } finally {
      setSaving(false);
      if (zoneFileRefs.current[zoneId]) zoneFileRefs.current[zoneId].value = '';
    }
  };

  const setZoneEnabled = (zoneId, enabled) => {
    setZoneState((s) => ({ ...s, [zoneId]: { ...s[zoneId], enabled } }));
  };

  const setZoneLink = (zoneId, link) => {
    setZoneState((s) => ({ ...s, [zoneId]: { ...s[zoneId], link: link ?? '' } }));
  };

  if (loading) {
    return (
      <div className="admin-page-head">
        <p className="loading-wrap">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="admin-ads-page">
      <div className="admin-page-head">
        <h1>Quản lý quảng cáo</h1>
        <p className="admin-page-desc">Tải lên file VAST (vast.xml) và cấu hình thời gian cho phép bỏ qua quảng cáo pre-roll.</p>
      </div>

      <div className="admin-settings-grid">
        <div className="admin-settings-card">
          <div className="admin-settings-card-head">
            <span className="admin-settings-card-icon"><i className="fas fa-ad" /></span>
            <h2>VAST Pre-roll</h2>
          </div>
          <div className="admin-settings-fields">
            <label className="admin-settings-label">BẬT / TẮT QUẢNG CÁO</label>
            <div className="admin-settings-toggle-row">
              <span className="admin-settings-toggle-label">{vastEnabled ? 'Đang bật' : 'Đang tắt'}</span>
              <button
                type="button"
                role="switch"
                aria-checked={vastEnabled}
                className={`admin-settings-toggle ${vastEnabled ? 'on' : ''}`}
                onClick={() => setVastEnabled((v) => !v)}
              >
                <span className="admin-settings-toggle-thumb" />
              </button>
            </div>
            <p className="admin-settings-hint">
              Tắt quảng cáo thì pre-roll VAST sẽ không phát trước khi xem phim. File VAST và cấu hình vẫn được giữ.
            </p>

            <label className="admin-settings-label">FILE VAST (vast.xml)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,application/xml,text/xml"
              className="admin-settings-input"
            />
            <p className="admin-settings-hint">
              Chọn file XML VAST (2/3/4). File được lưu trên server tại <code>/uploads/ads/vast.xml</code> và phát trước nội dung chính. {hasVastFile && <strong> Đã có file VAST.</strong>}
            </p>

            <label className="admin-settings-label">BỎ QUA QUẢNG CÁO SAU (giây)</label>
            <input
              type="number"
              min={0}
              max={120}
              className="admin-settings-input"
              value={vastSkipOffsetSeconds}
              onChange={(e) => setVastSkipOffsetSeconds(Number(e.target.value) || 0)}
            />
            <p className="admin-settings-hint">
              Số giây sau khi phát quảng cáo thì nút &quot;Bỏ qua&quot; được bật. Ví dụ: 5 = có thể bỏ qua sau 5 giây. Đặt 0 = không cho bỏ qua (xem hết quảng cáo).
            </p>

            <button
              type="button"
              className="admin-settings-save-btn"
              onClick={save}
              disabled={saving}
            >
              <i className="fas fa-save admin-settings-btn-icon" />
              <span>{saving ? 'Đang lưu...' : 'Lưu & tải lên VAST'}</span>
            </button>
          </div>
        </div>

        {AD_ZONES.map(({ id, label }) => (
          <div key={id} className="admin-settings-card">
            <div className="admin-settings-card-head">
              <span className="admin-settings-card-icon"><i className="fas fa-image" /></span>
              <h2>{label}</h2>
            </div>
            <div className="admin-settings-fields">
              <label className="admin-settings-label">BẬT / TẮT</label>
              <div className="admin-settings-toggle-row">
                <span className="admin-settings-toggle-label">{zoneState[id]?.enabled ? 'Đang bật' : 'Đang tắt'}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={zoneState[id]?.enabled}
                  className={`admin-settings-toggle ${zoneState[id]?.enabled ? 'on' : ''}`}
                  onClick={() => setZoneEnabled(id, !zoneState[id]?.enabled)}
                >
                  <span className="admin-settings-toggle-thumb" />
                </button>
              </div>
              <label className="admin-settings-label">LINK QUẢNG CÁO</label>
              <input
                type="url"
                className="admin-settings-input"
                value={zoneState[id]?.link ?? ''}
                onChange={(e) => setZoneLink(id, e.target.value)}
                placeholder="https://..."
              />
              <p className="admin-settings-hint">
                Khi người dùng click vào banner sẽ mở link này (tab mới). Để trống thì click không chuyển trang.
              </p>
              <label className="admin-settings-label">TẢI FILE ẢNH (JPG, PNG, GIF, WEBP)</label>
              <input
                ref={(el) => { zoneFileRefs.current[id] = el; }}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="admin-settings-input"
              />
              <p className="admin-settings-hint">
                File lưu tại <code>uploads/ads/{id}.xxx</code>. {zoneState[id]?.hasFile && <strong> Đã có file.</strong>}
                Bật và bấm &quot;Lưu&quot;; nếu chưa chọn ảnh, hệ thống sẽ dùng file mẫu (popup.png, …) nếu có trong thư mục. Sau khi lưu, hãy tải lại trang chủ (F5) để xem quảng cáo.
              </p>
              <button
                type="button"
                className="admin-settings-save-btn"
                onClick={() => saveZone(id)}
                disabled={saving}
              >
                <i className="fas fa-save admin-settings-btn-icon" />
                <span>{saving ? 'Đang lưu...' : 'Lưu'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
