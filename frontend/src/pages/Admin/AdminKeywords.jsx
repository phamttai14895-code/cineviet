import { useState, useEffect } from 'react';
import { admin } from '../../api/client';
import { useToast } from '../../context/ToastContext';

export default function AdminKeywords() {
  const { toast } = useToast();
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');

  const load = () => {
    admin.keywords().then((r) => setKeywords(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await admin.createKeyword({ name: name.trim() });
      setName('');
      load();
      toast.success('Đã thêm từ khóa.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Có lỗi');
    }
  };

  if (loading) return <p className="loading-wrap">Đang tải...</p>;

  return (
    <div>
      <div className="admin-page-head">
        <h1>Quản lý từ khóa</h1>
      </div>

      <form onSubmit={handleSubmit} className="admin-genre-form">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Từ khóa"
          className="admin-genre-input"
        />
        <button type="submit" className="btn btn-primary">Thêm từ khóa</button>
      </form>

      <div className="admin-genres-list">
        {keywords.map((k) => (
          <div key={k.id} className="admin-genre-chip">
            <span>{k.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
