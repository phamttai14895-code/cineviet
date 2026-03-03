import { useState, useEffect } from 'react';
import { admin } from '../../api/client';
import { useToast } from '../../context/ToastContext';

export default function AdminCountries() {
  const { toast } = useToast();
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');

  const load = () => {
    admin.countries().then((r) => setCountries(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await admin.createCountry({ name: name.trim() });
      setName('');
      load();
      toast.success('Đã thêm quốc gia.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Có lỗi');
    }
  };

  if (loading) return <p className="loading-wrap">Đang tải...</p>;

  return (
    <div>
      <div className="admin-page-head">
        <h1>Quản lý quốc gia</h1>
      </div>

      <form onSubmit={handleSubmit} className="admin-genre-form">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên quốc gia"
          className="admin-genre-input"
        />
        <button type="submit" className="btn btn-primary">Thêm quốc gia</button>
      </form>

      <div className="admin-genres-list">
        {countries.map((c) => (
          <div key={c.id} className="admin-genre-chip">
            <span>{c.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
