import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { admin } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatDateTimeGMT7 } from '../../utils/dateGMT7.js';

const REPORT_TYPE_LABELS = {
  video_error: 'Lỗi phát video',
  subtitle: 'Lỗi phụ đề',
  wrong_episode: 'Sai tập / nhầm nội dung',
  other: 'Khác',
};

export default function AdminReports() {
  const { toast } = useToast();
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(''); // '' | 'pending' | 'resolved'
  const [page, setPage] = useState(1);
  const limit = 20;

  const load = () => {
    setLoading(true);
    const params = { page, limit };
    if (statusFilter) params.status = statusFilter;
    Promise.all([
      admin.reports(params),
      admin.reportsCount().catch(() => ({ data: { count: 0, pending: 0 } })),
    ])
      .then(([reportsRes, countRes]) => {
        setReports(reportsRes.data?.reports ?? []);
        setTotal(reportsRes.data?.total ?? 0);
        setPendingCount(countRes.data?.pending ?? 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [statusFilter, page]);

  const handleUpdateStatus = async (id, status) => {
    try {
      await admin.updateReportStatus(id, status);
      load();
      window.dispatchEvent(new Event('admin-reports-updated'));
      toast.success('Đã cập nhật trạng thái.');
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Không thể cập nhật trạng thái');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa báo cáo này?')) return;
    try {
      await admin.deleteReport(id);
      load();
      window.dispatchEvent(new Event('admin-reports-updated'));
      toast.success('Đã xóa báo cáo.');
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Không thể xóa báo cáo');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="admin-reports-page">
      <div className="admin-page-head admin-reports-head">
        <h1>Báo cáo lỗi</h1>
        {pendingCount > 0 && (
          <span className="admin-badge-count">{pendingCount}</span>
        )}
      </div>

      <div className="admin-reports-filters">
        <button
          type="button"
          className={`admin-reports-filter-btn ${statusFilter === '' ? 'active' : ''}`}
          onClick={() => { setStatusFilter(''); setPage(1); }}
        >
          Tất cả
        </button>
        <button
          type="button"
          className={`admin-reports-filter-btn pending ${statusFilter === 'pending' ? 'active' : ''}`}
          onClick={() => { setStatusFilter('pending'); setPage(1); }}
        >
          <i className="fas fa-clock" /> Chờ xử lý ({pendingCount})
        </button>
        <button
          type="button"
          className={`admin-reports-filter-btn ${statusFilter === 'resolved' ? 'active' : ''}`}
          onClick={() => { setStatusFilter('resolved'); setPage(1); }}
        >
          Đã xử lý
        </button>
      </div>

      <div className="admin-reports-table-wrap">
        {loading ? (
          <p className="loading-wrap">Đang tải...</p>
        ) : (
          <>
            <table className="admin-table admin-reports-table">
              <thead>
                <tr>
                  <th>PHIM</th>
                  <th>TẬP</th>
                  <th>LOẠI LỖI</th>
                  <th>NỘI DUNG</th>
                  <th>NGƯỜI BÁO CÁO</th>
                  <th>NGÀY BÁO CÁO</th>
                  <th>TRẠNG THÁI</th>
                  <th>HÀNH ĐỘNG</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="admin-reports-empty">
                      {statusFilter === 'pending' && 'Không có báo cáo chờ xử lý.'}
                      {statusFilter === 'resolved' && 'Chưa có báo cáo nào đã xử lý.'}
                      {!statusFilter && 'Chưa có báo cáo lỗi nào từ người xem.'}
                    </td>
                  </tr>
                ) : (
                  reports.map((r) => (
                    <tr key={r.id}>
                      <td className="admin-reports-cell-movie">
                        {r.movie_id ? (
                          <Link to={`/admin/movies/${r.movie_id}/edit`} className="admin-reports-movie-link">
                            {r.movie_title || `#${r.movie_id}`}
                          </Link>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                      <td className="admin-reports-cell-episode">Tập {r.episode || 1}</td>
                      <td className="admin-reports-cell-type">
                        {REPORT_TYPE_LABELS[r.report_type] || r.report_type || '—'}
                      </td>
                      <td className="admin-reports-cell-message">
                        {r.message ? (
                          <span title={r.message}>{r.message.length > 80 ? `${r.message.slice(0, 80)}…` : r.message}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="admin-reports-cell-user">
                        {r.user_name || r.user_email || `#${r.user_id}`}
                      </td>
                      <td className="admin-reports-cell-date">{formatDateTimeGMT7(r.created_at) || '—'}</td>
                      <td>
                        <span className={`admin-reports-status admin-reports-status-${r.status || 'pending'}`}>
                          {(r.status || 'pending') === 'pending' ? 'Chờ xử lý' : 'Đã xử lý'}
                        </span>
                      </td>
                      <td className="admin-reports-cell-actions">
                        <div className="admin-reports-actions">
                          {(r.status || 'pending') === 'pending' ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => handleUpdateStatus(r.id, 'resolved')}
                            >
                              Đánh dấu đã xử lý
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => handleUpdateStatus(r.id, 'pending')}
                            >
                              Chờ xử lý
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(r.id)}
                            title="Xóa báo cáo"
                          >
                            <i className="fas fa-trash-alt" /> Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="admin-reports-pagination">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Trước
                </button>
                <span className="admin-reports-page-info">
                  Trang {page} / {totalPages} ({total} báo cáo)
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Sau
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
