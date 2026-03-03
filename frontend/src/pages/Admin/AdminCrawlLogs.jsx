import { useState, useEffect, useRef } from 'react';
import { admin } from '../../api/client';

function formatLine(entry) {
  const { time, level, message, slug } = entry;
  let text = `[${time}] [${level}] ${message}`;
  if (slug) text += ` (slug: ${slug})`;
  return text;
}

export default function AdminCrawlLogs() {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const boxRef = useRef(null);

  const fetchLogs = () => {
    admin
      .crawlLogs({ limit: 200 })
      .then((r) => setLines(r.data?.logs || []))
      .catch(() => setLines([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
    const t = setInterval(fetchLogs, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!boxRef.current) return;
    boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [lines]);

  return (
    <div className="admin-logs-page">
      <div className="admin-page-head">
        <h1 className="admin-logs-title">| Crawl Logs</h1>
      </div>
      <div className="admin-logs-box" ref={boxRef}>
        {loading && lines.length === 0 ? (
          <div className="admin-logs-line">Đang tải...</div>
        ) : lines.length === 0 ? (
          <div className="admin-logs-line">Chưa có log crawl. Chạy crawl thủ công hoặc bật auto-crawl để xem log.</div>
        ) : (
          lines.map((entry, i) => (
            <div key={i} className={`admin-logs-line crawl-log-${(entry.level || 'INFO').toLowerCase()}`}>
              {formatLine(entry)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
