import { useState, useEffect } from 'react';
import { admin } from '../../api/client';
import { useToast } from '../../context/ToastContext';

export default function AdminReleaseYears() {
  const { toast } = useToast();
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  const load = () => {
    admin.releaseYears().then((r) => setYears(Array.isArray(r.data) ? r.data : [])).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await admin.createReleaseYear({ name: name.trim() });
      setName('');
      load();
      toast.success('Đã thêm năm.');
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
    if (selectedIds.size >= years.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(years.map((y) => y.id)));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error('Chọn ít nhất một năm để xóa.');
      return;
    }
    if (!confirm(`Xóa ${selectedIds.size} năm đã chọn?`)) return;
    try {
      await admin.deleteReleaseYearsBulk([...selectedIds]);
      setSelectedIds(new Set());
      load();
      toast.success(`Đã xóa ${selectedIds.size} năm phát hành.`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Không thể xóa');
    }
  };

  const handleDeleteAll = async () => {
    const confirmText = 'XÓA TẤT CẢ';
    const entered = prompt(`Bạn sẽ xóa toàn bộ năm phát hành (${years.length} mục). Nhập "${confirmText}" để xác nhận:`);
    if (entered !== confirmText) {
      if (entered != null) toast.error('Xác nhận không đúng. Đã hủy.');
      return;
    }
    try {
      const res = await admin.deleteReleaseYearsAll();
      setSelectedIds(new Set());
      load();
      toast.success(res?.data?.message || `Đã xóa ${res?.data?.deleted ?? 0} năm phát hành.`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Không thể xóa toàn bộ');
    }
  };

  if (loading) return <p className="loading-wrap">Đang tải...</p>;

  return (
    <div>
      <div className="admin-page-head">
        <h1>Quản lý năm phát hành</h1>
      </div>

      <form onSubmit={handleSubmit} className="admin-genre-form">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Năm (vd: 2024)"
          className="admin-genre-input"
        />
        <button type="submit" className="btn btn-primary">Thêm năm</button>
      </form>

      {(selectedIds.size > 0 || years.length > 0) && (
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
        {years.length > 0 && (
          <label className="admin-genre-chip" style={{ marginBottom: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={selectedIds.size >= years.length} onChange={toggleSelectAll} /> Chọn tất cả
          </label>
        )}
        {years.map((y) => (
          <label key={y.id} className="admin-genre-chip" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" checked={selectedIds.has(y.id)} onChange={() => toggleSelect(y.id)} />
            <span>{y.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
