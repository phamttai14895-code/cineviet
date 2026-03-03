import { useState, useEffect } from 'react';
import { admin } from '../../api/client';
import { useToast } from '../../context/ToastContext';

export default function AdminActors() {
  const { toast } = useToast();
  const [actors, setActors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');

  const load = () => {
    admin.actors().then((r) => setActors(r.data)).catch(console.error).finally(() => setLoading(false));
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

      <div className="admin-genres-list">
        {actors.map((a) => (
          <div key={a.id} className="admin-genre-chip">
            <span>{a.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
