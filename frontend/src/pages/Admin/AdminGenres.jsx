import { useState, useEffect } from 'react';
import { admin } from '../../api/client';
import { useToast } from '../../context/ToastContext';

export default function AdminGenres() {
  const { toast } = useToast();
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');

  const load = () => {
    admin.genres().then((r) => setGenres(r.data)).catch(console.error).finally(() => setLoading(false));
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

      <div className="admin-genres-list">
        {genres.map((g) => (
          <div key={g.id} className="admin-genre-chip">
            <span>{g.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
