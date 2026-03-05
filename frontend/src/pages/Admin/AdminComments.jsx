import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { admin } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatRelativeTimeGMT7 } from '../../utils/dateGMT7.js';

const HIDDEN_PLACEHOLDER = '[Nội dung vi phạm đã bị ẩn]';

export default function AdminComments() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterFromUrl = searchParams.get('filter') === 'reported' ? 'reported' : 'all';
  const [comments, setComments] = useState([]);
  const [reportedCount, setReportedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(filterFromUrl);

  const load = () => {
    setLoading(true);
    Promise.all([
      admin.comments({ filter }),
      admin.commentsReportedCount().catch(() => ({ data: { count: 0 } })),
    ])
      .then(([commentsRes, countRes]) => {
        setComments(commentsRes.data);
        setReportedCount(countRes.data?.count ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setFilter(filterFromUrl);
  }, [filterFromUrl]);
  useEffect(() => {
    load();
  }, [filter]);

  const handleToggleStatus = async (c) => {
    const nextStatus = (c.status || 'visible') === 'visible' ? 'hidden' : 'visible';
    try {
      await admin.updateCommentStatus(c.id, nextStatus);
      load();
      window.dispatchEvent(new Event('admin-comments-updated'));
      toast.success(nextStatus === 'hidden' ? 'Đã ẩn bình luận.' : 'Đã hiện bình luận.');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Không thể đổi trạng thái');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Xóa bình luận này?')) return;
    try {
      await admin.deleteComment(id);
      load();
      window.dispatchEvent(new Event('admin-comments-updated'));
      toast.success('Đã xóa bình luận.');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Không thể xóa');
    }
  };

  return (
    <div className="admin-comments-page">
      <div className="admin-comments-header">
        <h1 className="admin-comments-title with-bar">Quản lý bình luận</h1>
        <div className="admin-comments-filters">
          <button
            type="button"
            className={`admin-comments-filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => { setFilter('all'); setSearchParams({}); }}
          >
            Tất cả
          </button>
          <button
            type="button"
            className={`admin-comments-filter-btn reported ${filter === 'reported' ? 'active' : ''}`}
            onClick={() => { setFilter('reported'); setSearchParams({ filter: 'reported' }); }}
          >
            <i className="fas fa-flag" />
            Bị báo cáo ({reportedCount})
          </button>
        </div>
      </div>

      <div className="admin-comments-table-wrap">
        {loading ? (
          <p className="loading-wrap">Đang tải...</p>
        ) : (
          <table className="admin-comments-table">
            <thead>
              <tr>
                <th>NGƯỜI DÙNG</th>
                <th>PHIM</th>
                <th>NỘI DUNG</th>
                <th>TRẠNG THÁI</th>
                <th>THỜI GIAN</th>
                <th>HÀNH ĐỘNG</th>
              </tr>
            </thead>
            <tbody>
              {comments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-comments-empty">
                    {filter === 'reported' ? 'Không có bình luận bị báo cáo.' : 'Chưa có bình luận nào.'}
                  </td>
                </tr>
              ) : (
                comments.map((c) => (
                  <tr key={c.id}>
                    <td className="admin-comments-cell-user">{c.user_name || '—'}</td>
                    <td className="admin-comments-cell-movie">{c.movie_title || '—'}</td>
                    <td className="admin-comments-cell-content">
                      {(c.status || 'visible') === 'hidden' ? HIDDEN_PLACEHOLDER : (c.content || '—')}
                    </td>
                    <td>
                      <span className={`admin-comments-status admin-comments-status-${c.status || 'visible'}`}>
                        {(c.status || 'visible') === 'hidden' ? 'Đã ẩn' : 'Hiển thị'}
                      </span>
                    </td>
                    <td>{formatRelativeTimeGMT7(c.created_at)}</td>
                    <td>
                      <div className="admin-comments-actions-cell">
                        <button
                          type="button"
                          className="admin-comments-action-btn"
                          title={(c.status || 'visible') === 'visible' ? 'Ẩn bình luận' : 'Hiện bình luận'}
                          onClick={() => handleToggleStatus(c)}
                        >
                          <i className={`fas fa-${(c.status || 'visible') === 'visible' ? 'eye-slash' : 'eye'}`} />
                        </button>
                        <button
                          type="button"
                          className="admin-comments-action-btn btn-danger"
                          title="Xóa"
                          onClick={() => handleDelete(c.id)}
                        >
                          <i className="fas fa-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
