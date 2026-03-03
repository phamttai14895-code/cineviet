import { useState, useEffect } from 'react';
import { admin } from '../../api/client';
import { useToast } from '../../context/ToastContext';

export default function AdminDirectors() {
  const { toast } = useToast();
  const [directors, setDirectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');

  const load = () => {
    admin.directors().then((r) => setDirectors(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await admin.createDirector({ name: name.trim() });
      setName('');
      load();
      toast.success('Đã thêm đạo diễn.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Có lỗi');
    }
  };

  if (loading) return <p className="loading-wrap">Đang tải...</p>;

  return (
    <div>
      <div className="admin-page-head">
        <h1>Quản lý đạo diễn</h1>
      </div>

      <form onSubmit={handleSubmit} className="admin-genre-form">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên đạo diễn"
          className="admin-genre-input"
        />
        <button type="submit" className="btn btn-primary">Thêm đạo diễn</button>
      </form>

      <div className="admin-genres-list">
        {directors.map((d) => (
          <div key={d.id} className="admin-genre-chip">
            <span>{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
