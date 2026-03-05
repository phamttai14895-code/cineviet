import { useState, useEffect } from 'react';
import { admin } from '../../api/client';
import { useToast } from '../../context/ToastContext';

export default function AdminActors() {
  const { toast } = useToast();
  const [actors, setActors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  const load = () => {
    admin.actors().then((r) => setActors(Array.isArray(r.data) ? r.data : [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await admin.createActor({ name: name.trim() });
      setName('');
      load();
      toast.success('Đã thêm diễn viên.');
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
    if (selectedIds.size >= actors.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(actors.map((a) => a.id)));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error('Chọn ít nhất một diễn viên để xóa.');
      return;
    }
    if (!confirm(`Xóa ${selectedIds.size} diễn viên đã chọn?`)) return;
    try {
      await admin.deleteActorsBulk([...selectedIds]);
      setSelectedIds(new Set());
      load();
      toast.success(`Đã xóa ${selectedIds.size} diễn viên.`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Không thể xóa');
    }
  };

  const handleDeleteAll = async () => {
    const confirmText = 'XÓA TẤT CẢ';
    const entered = prompt(`Bạn sẽ xóa toàn bộ diễn viên (${actors.length} mục). Nhập "${confirmText}" để xác nhận:`);
    if (entered !== confirmText) {
      if (entered != null) toast.error('Xác nhận không đúng. Đã hủy.');
      return;
    }
    try {
      const res = await admin.deleteActorsAll();
      setSelectedIds(new Set());
      load();
      toast.success(res?.data?.message || `Đã xóa ${res?.data?.deleted ?? 0} diễn viên.`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Không thể xóa toàn bộ');
    }
  };

  if (loading) return <p className="loading-wrap">Đang tải...</p>;

  return (
    <div>
      <div className="admin-page-head">
        <h1>Quản lý diễn viên</h1>
      </div>

      <form onSubmit={handleSubmit} className="admin-genre-form">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên diễn viên"
          className="admin-genre-input"
        />
        <button type="submit" className="btn btn-primary">Thêm diễn viên</button>
      </form>

      {(selectedIds.size > 0 || actors.length > 0) && (
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
        {actors.length > 0 && (
          <label className="admin-genre-chip" style={{ marginBottom: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={selectedIds.size >= actors.length} onChange={toggleSelectAll} /> Chọn tất cả
          </label>
        )}
        {actors.map((a) => (
          <label key={a.id} className="admin-genre-chip" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)} />
            <span>{a.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
