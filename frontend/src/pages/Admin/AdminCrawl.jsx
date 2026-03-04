import { useState, useEffect, useRef } from 'react';
import { admin, crawl } from '../../api/client';
import { useToast } from '../../context/ToastContext';

const SOURCES = [{ id: 'phimapi', label: 'KKPhim' }];

const INTERVAL_OPTIONS = [
  { value: 15, label: '15 phút' },
  { value: 30, label: '30 phút' },
  { value: 60, label: '1 giờ' },
  { value: 120, label: '2 giờ' },
];

const INTERVAL_OPTIONS_ACTORS = [
  { value: 60, label: '1 giờ' },
  { value: 360, label: '6 giờ' },
  { value: 720, label: '12 giờ' },
  { value: 1440, label: '24 giờ' },
];

export default function AdminCrawl() {
  const { toast } = useToast();
  const [sources, setSources] = useState(['phimapi']);
  const [pageFrom, setPageFrom] = useState(1);
  const [pageTo, setPageTo] = useState(3);
  const [crawlToEnd, setCrawlToEnd] = useState(false);
  const [excludeGenres, setExcludeGenres] = useState([]);
  const [excludeCountries, setExcludeCountries] = useState([]);
  const [genres, setGenres] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [autoSettings, setAutoSettings] = useState({
    enabled: false,
    interval_minutes: 30,
    sources: ['phimapi'],
    page_from: 1,
    page_to: 2,
    crawl_to_end: false,
    exclude_genres: [],
    exclude_countries: [],
    actors_sync_enabled: false,
    actors_sync_interval_minutes: 360,
  });
  const [savingAuto, setSavingAuto] = useState(false);
  const [autoSettingsLoading, setAutoSettingsLoading] = useState(true);
  const [crawlLogs, setCrawlLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const logsBoxRef = useRef(null);
  const [syncActorsLoading, setSyncActorsLoading] = useState(false);
  const [syncActorsMessage, setSyncActorsMessage] = useState('');
  const [tmdbTotalIds, setTmdbTotalIds] = useState(null);
  const syncActorsTimerRef = useRef(null);

  const fetchAutoSettings = () => {
    setAutoSettingsLoading(true);
    admin
      .crawlAutoSettings()
      .then((r) => {
        if (r?.data && typeof r.data === 'object') setAutoSettings(r.data);
      })
      .catch(console.error)
      .finally(() => setAutoSettingsLoading(false));
  };

  useEffect(() => {
    Promise.all([crawl.genres(), crawl.countries()])
      .then(([g, c]) => {
        setGenres(g.data?.items || []);
        setCountries(c.data?.items || []);
      })
      .catch(console.error)
      .finally(() => setLoadingMeta(false));
  }, []);

  useEffect(() => {
    fetchAutoSettings();
  }, []);

  useEffect(() => {
    const onFocus = () => fetchAutoSettings();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const fetchTmdbStats = () => {
    admin.actorsTmdbStats().then((r) => setTmdbTotalIds(r.data?.total_ids ?? null)).catch(() => setTmdbTotalIds(null));
  };
  useEffect(() => { fetchTmdbStats(); }, []);

  const fetchCrawlLogs = () => {
    admin
      .crawlLogs({ limit: 200 })
      .then((r) => setCrawlLogs(r.data?.logs || []))
      .catch(() => setCrawlLogs([]))
      .finally(() => setLogsLoading(false));
  };

  useEffect(() => {
    fetchCrawlLogs();
    const t = setInterval(fetchCrawlLogs, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!logsBoxRef.current) return;
    logsBoxRef.current.scrollTop = logsBoxRef.current.scrollHeight;
  }, [crawlLogs]);

  function formatLogLine(entry) {
    const { time, level, message, slug } = entry;
    let text = `[${time}] [${level}] ${message}`;
    if (slug) text += ` (slug: ${slug})`;
    return text;
  }

  const toggleSource = (id) => {
    setSources((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleRun = async () => {
    if (sources.length === 0) {
      toast.error('Chọn ít nhất một nguồn.');
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const res = await admin.crawlRun({
        sources,
        page_from: pageFrom,
        page_to: crawlToEnd ? 0 : pageTo,
        crawl_to_end: crawlToEnd,
        exclude_genres: excludeGenres,
        exclude_countries: excludeCountries,
      });
      setResult(res.data);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setResult({ error: msg });
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  const handleSyncActorsTmdb = () => {
    if (syncActorsLoading) return;
    setSyncActorsMessage('');
    setSyncActorsLoading(true);
    admin
      .syncActorsTmdb(500)
      .then((r) => {
        const d = r.data || {};
        const total = d.total ?? 0;
        const updated = d.updated ?? 0;
        const errors = d.errors ?? 0;
        const done = total > 0 && updated + errors >= total;
        let msg = d.error;
        if (!msg) {
          if (total === 0) {
            msg = 'Chưa có ID TMDB nào trong hệ thống. Cần crawl/import phim có cast từ TMDB (cấu hình TMDB_API_KEY và crawl nguồn có cast) thì mới có ID để đồng bộ.';
          } else if (done) {
            msg = `Đã lấy đủ: ${updated} cập nhật, ${errors} lỗi — tổng ${total} ID TMDB đã xử lý hết.`;
          } else {
            msg = `Đã đồng bộ: ${updated} diễn viên${errors ? `, ${errors} lỗi` : ''}. Tổng ${total} ID TMDB. Chạy thêm lần nữa để xử lý nốt (tối đa 500/lần).`;
          }
        }
        setSyncActorsMessage(msg);
        fetchTmdbStats();
        if (syncActorsTimerRef.current) clearTimeout(syncActorsTimerRef.current);
        syncActorsTimerRef.current = setTimeout(() => setSyncActorsMessage(''), 10000);
      })
      .catch((err) => {
        setSyncActorsMessage(err.response?.data?.error || err.message || 'Lỗi đồng bộ');
        if (syncActorsTimerRef.current) clearTimeout(syncActorsTimerRef.current);
        syncActorsTimerRef.current = setTimeout(() => setSyncActorsMessage(''), 6000);
      })
      .finally(() => setSyncActorsLoading(false));
  };

  const handleSaveAuto = async () => {
    setSavingAuto(true);
    try {
      const res = await admin.crawlAutoSettingsUpdate({
        enabled: autoSettings.enabled,
        interval_minutes: autoSettings.interval_minutes,
        sources: autoSettings.sources,
        page_from: autoSettings.page_from,
        page_to: autoSettings.page_to,
        crawl_to_end: autoSettings.crawl_to_end,
        exclude_genres: autoSettings.exclude_genres || [],
        exclude_countries: autoSettings.exclude_countries || [],
        actors_sync_enabled: autoSettings.actors_sync_enabled,
        actors_sync_interval_minutes: autoSettings.actors_sync_interval_minutes ?? 360,
      });
      setAutoSettings(res.data);
      toast.success('Đã lưu cấu hình auto.');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setSavingAuto(false);
    }
  };

  return (
    <div className="admin-crawl-page">
      <div className="admin-page-head">
        <h1 className="admin-movies-title with-bar">Crawl phim</h1>
        <p className="admin-crawl-desc">Lấy phim từ Ophim, KKPhim và Nguonc về web. Chọn trang, lọc thể loại/quốc gia, chạy thủ công hoặc bật auto crawl.</p>
      </div>

      <div className="admin-crawl-cards">
        <section className="admin-crawl-card">
          <h2 className="admin-crawl-card-title">
            <i className="fas fa-cloud-download-alt" /> Crawl thủ công
          </h2>
          <div className="admin-crawl-form">
            <div className="admin-crawl-field">
              <label>Nguồn (chọn ít nhất 1)</label>
              <div className="admin-crawl-checkboxes">
                {SOURCES.map((s) => (
                  <label key={s.id} className="admin-crawl-check">
                    <input
                      type="checkbox"
                      checked={sources.includes(s.id)}
                      onChange={() => toggleSource(s.id)}
                    />
                    <span>{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="admin-crawl-row">
              <div className="admin-crawl-field">
                <label>Trang từ</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={pageFrom}
                  onChange={(e) => setPageFrom(Number(e.target.value) || 1)}
                  className="admin-crawl-input"
                  disabled={crawlToEnd}
                />
              </div>
              <div className="admin-crawl-field">
                <label>đến trang</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={pageTo}
                  onChange={(e) => setPageTo(Number(e.target.value) || 1)}
                  className="admin-crawl-input"
                  disabled={crawlToEnd}
                />
              </div>
            </div>
            <div className="admin-crawl-field admin-crawl-toggle-row">
              <label className="admin-crawl-check">
                <input
                  type="checkbox"
                  checked={crawlToEnd}
                  onChange={(e) => setCrawlToEnd(e.target.checked)}
                />
                <span>Crawl đến hết trang (toàn bộ phim KKPhim, tự dừng khi hết dữ liệu)</span>
              </label>
            </div>
            <div className="admin-crawl-field">
              <label>Bỏ qua thể loại (không crawl phim thuộc các thể loại đã chọn)</label>
              <div className="admin-crawl-checkboxes admin-crawl-checkboxes-wrap">
                {(genres || []).map((g) => {
                  const slug = g.slug || g._id || '';
                  const checked = excludeGenres.includes(slug);
                  return (
                    <label key={slug || g.name} className="admin-crawl-check">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setExcludeGenres((prev) => (checked ? prev.filter((s) => s !== slug) : [...prev, slug]))}
                      />
                      <span>{g.name}</span>
                    </label>
                  );
                })}
              </div>
              {excludeGenres.length > 0 && <p className="admin-crawl-muted">Đã chọn {excludeGenres.length} thể loại bỏ qua.</p>}
            </div>
            <div className="admin-crawl-field">
              <label>Bỏ qua quốc gia (không crawl phim thuộc các quốc gia đã chọn)</label>
              <div className="admin-crawl-checkboxes admin-crawl-checkboxes-wrap">
                {(countries || []).map((c) => {
                  const slug = c.slug || c._id || '';
                  const checked = excludeCountries.includes(slug);
                  return (
                    <label key={slug || c.name} className="admin-crawl-check">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setExcludeCountries((prev) => (checked ? prev.filter((s) => s !== slug) : [...prev, slug]))}
                      />
                      <span>{c.name}</span>
                    </label>
                  );
                })}
              </div>
              {excludeCountries.length > 0 && <p className="admin-crawl-muted">Đã chọn {excludeCountries.length} quốc gia bỏ qua.</p>}
            </div>
            {loadingMeta && <p className="admin-crawl-muted">Đang tải thể loại, quốc gia...</p>}
            <button
              type="button"
              className="btn btn-primary admin-crawl-run-btn"
              onClick={handleRun}
              disabled={running || sources.length === 0}
            >
              {running ? (
                <>
                  <i className="fas fa-spinner fa-spin" /> Đang crawl...
                </>
              ) : (
                <>
                  <i className="fas fa-play" /> Bắt đầu crawl
                </>
              )}
            </button>
          </div>
          {result && (
            <div className={`admin-crawl-result ${result.error ? 'error' : ''}`}>
              {result.error ? (
                <p>{result.error}</p>
              ) : (
                <>
                  <p><strong>Tổng slug:</strong> {result.total}</p>
                  <p><strong>Thêm mới:</strong> {result.created}</p>
                  <p><strong>Cập nhật:</strong> {result.updated}</p>
                  {(result.skipped ?? 0) > 0 && <p><strong>Bỏ qua (lọc thể loại/quốc gia):</strong> {result.skipped}</p>}
                  <p><strong>Lỗi:</strong> {result.failed}</p>
                  {result.failed_list?.length > 0 && (
                    <details className="admin-crawl-failed-list">
                      <summary>Chi tiết lỗi (tối đa 20)</summary>
                      <ul>
                        {result.failed_list.map((f, i) => (
                          <li key={i}>{f.slug}: {f.error}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}
            </div>
          )}
        </section>

        <section className="admin-crawl-card">
          <h2 className="admin-crawl-card-title">
            <i className="fas fa-user-friends" /> Đồng bộ diễn viên từ TMDB
          </h2>
          <p className="admin-crawl-muted">Lấy thông tin và ảnh diễn viên từ TMDB (GET /person/&#123;id&#125;, /person/&#123;id&#125;/images). Cần TMDB_API_KEY. Mỗi lần tối đa 500 người (đủ để đồng bộ hết nếu tổng ID &lt; 500).</p>
          {tmdbTotalIds !== null && (
            <p className="admin-crawl-muted" style={{ marginBottom: '0.5rem' }}>
              Hiện có <strong>{tmdbTotalIds}</strong> ID TMDB trong hệ thống (từ bảng diễn viên có tmdb_id + cast của từng phim). Đã lấy đủ khi: số cập nhật + lỗi = tổng ID sau mỗi lần chạy.
              {tmdbTotalIds === 0 && ' Để có ID: cấu hình TMDB_API_KEY và crawl/import phim từ nguồn có dữ liệu cast TMDB.'}
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary admin-crawl-run-btn"
            onClick={handleSyncActorsTmdb}
            disabled={syncActorsLoading}
          >
            {syncActorsLoading ? (
              <><i className="fas fa-spinner fa-spin" /> Đang đồng bộ...</>
            ) : (
              <><i className="fas fa-sync-alt" /> Crawl đạo diễn & diễn viên</>
            )}
          </button>
          {syncActorsMessage && (
            <div className={`admin-crawl-result ${syncActorsMessage.startsWith('Lỗi') || syncActorsMessage.includes('Thiếu') ? 'error' : ''}`} role="status">
              {syncActorsMessage}
            </div>
          )}
        </section>

        <section className="admin-crawl-card">
          <h2 className="admin-crawl-card-title">
            <i className="fas fa-clock" /> Auto crawl
          </h2>
          <p className="admin-crawl-muted">Tự động chạy crawl theo thời gian đặt. Lưu cấu hình để áp dụng.</p>
          {autoSettingsLoading && (
            <p className="admin-crawl-muted" style={{ marginBottom: '0.5rem' }}>
              <i className="fas fa-spinner fa-spin" aria-hidden /> Đang tải cấu hình…
            </p>
          )}
          <div className="admin-crawl-form">
            <div className="admin-crawl-field admin-crawl-toggle-row">
              <label className="admin-crawl-switch">
                <input
                  type="checkbox"
                  checked={autoSettings.enabled}
                  onChange={(e) => setAutoSettings((a) => ({ ...a, enabled: e.target.checked }))}
                  disabled={autoSettingsLoading}
                />
                <span className="admin-crawl-slider" />
              </label>
              <span>Bật auto crawl</span>
            </div>
            <div className="admin-crawl-field">
              <label>Chạy mỗi</label>
              <select
                value={autoSettings.interval_minutes}
                onChange={(e) => setAutoSettings((a) => ({ ...a, interval_minutes: Number(e.target.value) }))}
                className="admin-crawl-select"
              >
                {INTERVAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="admin-crawl-row">
              <div className="admin-crawl-field">
                <label>Trang từ</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={autoSettings.page_from}
                  onChange={(e) => setAutoSettings((a) => ({ ...a, page_from: Number(e.target.value) || 1 }))}
                  className="admin-crawl-input"
                  disabled={autoSettings.crawl_to_end}
                />
              </div>
              <div className="admin-crawl-field">
                <label>đến trang</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={autoSettings.page_to}
                  onChange={(e) => setAutoSettings((a) => ({ ...a, page_to: Number(e.target.value) || 1 }))}
                  className="admin-crawl-input"
                  disabled={autoSettings.crawl_to_end}
                />
              </div>
            </div>
            <div className="admin-crawl-field admin-crawl-toggle-row">
              <label className="admin-crawl-check">
                <input
                  type="checkbox"
                  checked={autoSettings.crawl_to_end === true}
                  onChange={(e) => setAutoSettings((a) => ({ ...a, crawl_to_end: e.target.checked }))}
                />
                <span>Crawl đến hết trang (auto chạy toàn bộ mỗi lần)</span>
              </label>
            </div>
            <div className="admin-crawl-field">
              <label>Nguồn auto</label>
              <div className="admin-crawl-checkboxes">
                {SOURCES.map((s) => (
                  <label key={s.id} className="admin-crawl-check">
                    <input
                      type="checkbox"
                      checked={(autoSettings.sources || []).includes(s.id)}
                      onChange={() => {
                        const next = (autoSettings.sources || []).includes(s.id)
                          ? (autoSettings.sources || []).filter((x) => x !== s.id)
                          : [...(autoSettings.sources || []), s.id];
                        setAutoSettings((a) => ({ ...a, sources: next }));
                      }}
                    />
                    <span>{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="admin-crawl-field">
              <label>Bỏ qua thể loại (auto crawl không lấy phim thuộc các thể loại đã chọn)</label>
              <div className="admin-crawl-checkboxes admin-crawl-checkboxes-wrap">
                {(genres || []).map((g) => {
                  const slug = g.slug || g._id || '';
                  const checked = (autoSettings.exclude_genres || []).includes(slug);
                  return (
                    <label key={slug || g.name} className="admin-crawl-check">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const prev = autoSettings.exclude_genres || [];
                          const next = checked ? prev.filter((s) => s !== slug) : [...prev, slug];
                          setAutoSettings((a) => ({ ...a, exclude_genres: next }));
                        }}
                      />
                      <span>{g.name}</span>
                    </label>
                  );
                })}
              </div>
              {(autoSettings.exclude_genres || []).length > 0 && <p className="admin-crawl-muted">Đã chọn {(autoSettings.exclude_genres || []).length} thể loại bỏ qua.</p>}
            </div>
            <div className="admin-crawl-field">
              <label>Bỏ qua quốc gia (auto crawl không lấy phim thuộc các quốc gia đã chọn)</label>
              <div className="admin-crawl-checkboxes admin-crawl-checkboxes-wrap">
                {(countries || []).map((c) => {
                  const slug = c.slug || c._id || '';
                  const checked = (autoSettings.exclude_countries || []).includes(slug);
                  return (
                    <label key={slug || c.name} className="admin-crawl-check">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const prev = autoSettings.exclude_countries || [];
                          const next = checked ? prev.filter((s) => s !== slug) : [...prev, slug];
                          setAutoSettings((a) => ({ ...a, exclude_countries: next }));
                        }}
                      />
                      <span>{c.name}</span>
                    </label>
                  );
                })}
              </div>
              {(autoSettings.exclude_countries || []).length > 0 && <p className="admin-crawl-muted">Đã chọn {(autoSettings.exclude_countries || []).length} quốc gia bỏ qua.</p>}
            </div>
            <hr className="admin-crawl-divider" />
            <h3 className="admin-crawl-subtitle">Auto đồng bộ diễn viên TMDB</h3>
            <p className="admin-crawl-muted">Tự động gọi đồng bộ diễn viên từ TMDB theo chu kỳ (tối đa 500/lần). Cần TMDB_API_KEY.</p>
            <div className="admin-crawl-field admin-crawl-toggle-row">
              <label className="admin-crawl-switch">
                <input
                  type="checkbox"
                  checked={autoSettings.actors_sync_enabled === true}
                  onChange={(e) => setAutoSettings((a) => ({ ...a, actors_sync_enabled: e.target.checked }))}
                  disabled={autoSettingsLoading}
                />
                <span className="admin-crawl-slider" />
              </label>
              <span>Bật auto đồng bộ diễn viên</span>
            </div>
            <div className="admin-crawl-field">
              <label>Chạy mỗi</label>
              <select
                value={autoSettings.actors_sync_interval_minutes ?? 360}
                onChange={(e) => setAutoSettings((a) => ({ ...a, actors_sync_interval_minutes: Number(e.target.value) }))}
                className="admin-crawl-select"
              >
                {INTERVAL_OPTIONS_ACTORS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-primary admin-crawl-save-auto-btn"
              onClick={handleSaveAuto}
              disabled={savingAuto}
            >
              {savingAuto ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-save" />} Lưu cấu hình auto
            </button>
          </div>
          {autoSettings.enabled && (
            <p className="admin-crawl-auto-status">
              <i className="fas fa-check-circle" /> Auto crawl đang bật — chạy mỗi {autoSettings.interval_minutes} phút
            </p>
          )}
          {autoSettings.actors_sync_enabled && (
            <p className="admin-crawl-auto-status">
              <i className="fas fa-check-circle" /> Auto đồng bộ diễn viên đang bật — chạy mỗi {autoSettings.actors_sync_interval_minutes ?? 360} phút
            </p>
          )}
        </section>

        <section className="admin-crawl-card">
          <h2 className="admin-crawl-card-title">
            <i className="fas fa-list-alt" /> Crawl Logs
          </h2>
          <div className="admin-logs-box admin-crawl-logs-box" ref={logsBoxRef}>
            {logsLoading && crawlLogs.length === 0 ? (
              <div className="admin-logs-line">Đang tải...</div>
            ) : crawlLogs.length === 0 ? (
              <div className="admin-logs-line">Chưa có log crawl. Chạy crawl thủ công hoặc bật auto-crawl để xem log.</div>
            ) : (
              crawlLogs.map((entry, i) => (
                <div key={i} className={`admin-logs-line crawl-log-${(entry.level || 'INFO').toLowerCase()}`}>
                  {formatLogLine(entry)}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
