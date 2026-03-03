import { useState, useEffect } from 'react';
import { admin } from '../../api/client';
import { useToast } from '../../context/ToastContext';

export default function AdminReleaseYears() {
  const { toast } = useToast();
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');

  const load = () => {
    admin.releaseYears().then((r) => setYears(r.data)).catch(console.error).finally(() => setLoading(false));
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

      <div className="admin-genres-list">
        {years.map((y) => (
          <div key={y.id} className="admin-genre-chip">
            <span>{y.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
