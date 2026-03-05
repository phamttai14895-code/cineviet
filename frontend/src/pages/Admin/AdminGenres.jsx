import { useState, useEffect } from 'react';
import { admin } from '../../api/client';
import { useToast } from '../../context/ToastContext';

export default function AdminGenres() {
  const { toast } = useToast();
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  const load = () => {
    admin.genres().then((r) => setGenres(Array.isArray(r.data) ? r.data : [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await admin.createGenre({ name: name.trim() });
      setName('');
      load();
      toast.success('Đã thêm thể loại.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Có lỗi');
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size >= genres.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(genres.map((g) => g.id)));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error('Chọn ít nhất một thể loại để xóa.');
      return;
    }
    if (!confirm(`Xóa ${selectedIds.size} thể loại đã chọn?`)) return;
    try {
      await admin.deleteGenresBulk([...selectedIds]);
      setSelectedIds(new Set());
      load();
      toast.success(`Đã xóa ${selectedIds.size} thể loại.`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Không thể xóa');
    }
  };

  const handleDeleteAll = async () => {
    const confirmText = 'XÓA TẤT CẢ';
    const entered = prompt(`Bạn sẽ xóa toàn bộ thể loại (${genres.length} mục). Nhập "${confirmText}" để xác nhận:`);
    if (entered !== confirmText) {
      if (entered != null) toast.error('Xác nhận không đúng. Đã hủy.');
      return;
    }
    try {
      const res = await admin.deleteGenresAll();
      setSelectedIds(new Set());
      load();
      toast.success(res?.data?.message || `Đã xóa ${res?.data?.deleted ?? 0} thể loại.`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Không thể xóa toàn bộ');
    }
  };

  if (loading) return <p className="loading-wrap">Đang tải...</p>;

  return (
    <div>
      <div className="admin-page-head">
        <h1>Quản lý thể loại</h1>
      </div>

      <form onSubmit={handleSubmit} className="admin-genre-form">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên thể loại"
          className="admin-genre-input"
        />
        <button type="submit" className="btn btn-primary">Thêm thể loại</button>
      </form>

      {(selectedIds.size > 0 || genres.length > 0) && (
        <div className="admin-genres-actions" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {selectedIds.size > 0 && (
            <button type="button" className="btn btn-danger" onClick={handleBulkDelete}>
              <i className="fas fa-trash" /> Xóa đã chọn ({selectedIds.size})
            </button>
          )}
          <button type="button" className="btn btn-danger" onClick={handleDeleteAll}>
            <i className="fas fa-trash-alt" /> Xóa toàn bộ
          </button>
        </div>
      )}

      <div className="admin-genres-list">
        {genres.length > 0 && (
          <label className="admin-genre-chip" style={{ marginBottom: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={selectedIds.size >= genres.length} onChange={toggleSelectAll} /> Chọn tất cả
          </label>
        )}
        {genres.map((g) => (
          <label key={g.id} className="admin-genre-chip" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" checked={selectedIds.has(g.id)} onChange={() => toggleSelect(g.id)} />
            <span>{g.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
