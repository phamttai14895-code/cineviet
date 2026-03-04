import { useState, useEffect } from 'react';
import { movies as moviesApi, recommendations as recApi } from '../api/client';
import HomeMovieCard from '../components/HomeMovieCard';
import { useToast } from '../context/ToastContext';

const MOODS = [
  { id: 'vui-ve', label: 'Vui vẻ', emoji: '😊' },
  { id: 'xuc-dong', label: 'Xúc động', emoji: '🥹' },
  { id: 'hoi-hop', label: 'Hồi hộp', emoji: '😰' },
  { id: 'suy-ngam', label: 'Suy ngẫm', emoji: '🤔' },
  { id: 'chill', label: 'Chill', emoji: '😎' },
  { id: 'hanh-dong', label: 'Hành động', emoji: '🔥' },
  { id: 'lang-man', label: 'Lãng mạn', emoji: '💕' },
];

const ERA_OPTIONS = [
  { value: '', label: 'Mọi năm' },
  { value: 'old', label: 'Trước 2000' },
  { value: '2000s', label: '2000 - 2009' },
  { value: '2010s', label: '2010 - 2019' },
  { value: 'new', label: '2020 trở đi' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'movie', label: 'Phim lẻ' },
  { value: 'series', label: 'Phim bộ' },
  { value: 'anime', label: 'Anime' },
];

const SUGGESTED_PROMPTS = [
  'Phim như Inception?',
  'Anime hay nhất 2024',
  'Phim xem với gia đình',
  'Phim Hàn tình cảm hay',
  'Phim kinh dị không quá sợ',
  'Series ngắn dưới 10 tập',
];

function toList(data) {
  if (Array.isArray(data)) return data;
  if (data?.items && Array.isArray(data.items)) return data.items;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return [];
}

export default function AiRecommend() {
  const { toast } = useToast();
  const [genres, setGenres] = useState([]);
  const [countries, setCountries] = useState([]);
  const [genreId, setGenreId] = useState('');
  const [era, setEra] = useState('');
  const [country, setCountry] = useState('');
  const [type, setType] = useState('');
  const [mood, setMood] = useState('');
  const [question, setQuestion] = useState('');
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [askLoading, setAskLoading] = useState(false);
  const [suggestedMovies, setSuggestedMovies] = useState([]);
  const [askResult, setAskResult] = useState(null);

  useEffect(() => {
    moviesApi.genres().then((r) => setGenres(toList(r?.data ?? r))).catch(() => setGenres([]));
    moviesApi.countries().then((r) => setCountries(toList(r?.data ?? r))).catch(() => setCountries([]));
  }, []);

  const handleGetSuggestions = () => {
    setAskResult(null);
    setSuggestLoading(true);
    setSuggestedMovies([]);
    recApi
      .aiSuggest({
        mood: mood || undefined,
        genreId: genreId || undefined,
        country: country || undefined,
        type: type || undefined,
        era: era || undefined,
      })
      .then((r) => setSuggestedMovies(Array.isArray(r?.data?.movies) ? r.data.movies : []))
      .catch((e) => {
        setSuggestedMovies([]);
        const msg = e?.response?.data?.error || e?.message || 'Không thể lấy gợi ý. Thử lại sau.';
        toast.error(msg);
        console.error('AI suggest:', e);
      })
      .finally(() => setSuggestLoading(false));
  };

  const handleAsk = (q) => {
    const text = (typeof q === 'string' ? q : question)?.trim();
    if (!text) return;
    setSuggestedMovies([]);
    setAskLoading(true);
    setAskResult(null);
    recApi
      .aiAsk({ question: text })
      .then((r) => setAskResult({
        answer: r?.data?.answer ?? 'Đã xử lý câu hỏi của bạn.',
        movies: Array.isArray(r?.data?.movies) ? r.data.movies : [],
      }))
      .catch((e) => {
        const msg = e?.response?.data?.error || e?.message || 'Không thể kết nối AI. Bạn thử lại sau.';
        setAskResult({ answer: msg, movies: [] });
        toast.error(msg);
        console.error('AI ask:', e);
      })
      .finally(() => setAskLoading(false));
  };

  const displayMovies = askResult?.movies?.length ? askResult.movies : suggestedMovies;
  const displayMoviesLimit = displayMovies.slice(0, 12);
  const hasResults = displayMovies.length > 0 || (askResult && askResult.answer);

  return (
    <div className="page-ai-recommend">
      <div className="container">
        {/* Hero / Tiêu đề trang — đồng bộ với section title (bar + icon) */}
        <section className="section ai-hero">
          <h1 className="home-section-title ai-page-title">
            <span className="bar" aria-hidden />
            <i className="fas fa-wand-magic-sparkles ai-title-icon" aria-hidden />
            AI GỢI Ý PHIM
          </h1>
          <p className="ai-subtitle">
            Chọn thể loại, tâm trạng hoặc hỏi trực tiếp — AI sẽ gợi ý phim phù hợp với bạn.
          </p>
        </section>

        {/* Bộ lọc */}
        <section className="section ai-section">
          <h2 className="home-section-title ai-section-heading">
            <span className="bar" aria-hidden />
            <i className="fas fa-sliders" aria-hidden />
            Bộ lọc
          </h2>
          <div className="ai-filters">
            <div className="ai-filters-row">
              <div className="ai-filter-group">
                <label className="ai-filter-label">Thể loại</label>
                <select
                  className="ai-select"
                  value={genreId}
                  onChange={(e) => setGenreId(e.target.value)}
                >
                  <option value="">Tất cả thể loại</option>
                  {genres.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div className="ai-filter-group">
                <label className="ai-filter-label">Năm</label>
                <select className="ai-select" value={era} onChange={(e) => setEra(e.target.value)}>
                  {ERA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="ai-filters-row">
              <div className="ai-filter-group">
                <label className="ai-filter-label">Quốc gia</label>
                <select
                  className="ai-select"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="">Tất cả quốc gia</option>
                  {countries.map((c) => (
                    <option key={typeof c === 'object' ? c.id : c} value={typeof c === 'object' ? c.name : c}>{typeof c === 'object' ? c.name : c}</option>
                  ))}
                </select>
              </div>
              <div className="ai-filter-group">
                <label className="ai-filter-label">Loại phim</label>
                <select className="ai-select" value={type} onChange={(e) => setType(e.target.value)}>
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="ai-moods">
            <span className="ai-moods-label">Tâm trạng:</span>
            <div className="ai-moods-list">
              {MOODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`ai-mood-chip ${mood === m.id ? 'active' : ''}`}
                  onClick={() => setMood(mood === m.id ? '' : m.id)}
                >
                  <span className="ai-mood-emoji">{m.emoji}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ai-suggest-cta">
            <button
              type="button"
              className="btn-ai-suggest"
              onClick={handleGetSuggestions}
              disabled={suggestLoading}
            >
              {suggestLoading ? (
                <span className="ai-spinner" aria-hidden />
              ) : (
                <i className="fas fa-sparkles" aria-hidden />
              )}
              {suggestLoading ? 'Đang gợi ý...' : 'Nhận gợi ý từ AI'}
            </button>
            <p className="ai-rate-hint">Gợi ý cùng bộ lọc được lưu tạm vài phút để tiết kiệm lượt gọi (free tier).</p>
          </div>
        </section>

        {/* Hỏi AI */}
        <section className="section ai-section">
          <h2 className="home-section-title ai-section-heading">
            <span className="bar" aria-hidden />
            <i className="fas fa-comment-dots" aria-hidden />
            Hỏi AI về phim
          </h2>
          <div className="ai-ask-input-wrap">
            <input
              type="text"
              className="ai-ask-input"
              placeholder="VD: Phim nào hay như Dune? Phim Hàn hay nhất 2024?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk(question)}
            />
            <button
              type="button"
              className="ai-ask-submit"
              onClick={() => handleAsk(question)}
              disabled={askLoading || !question.trim()}
              title="Gửi câu hỏi"
            >
              {askLoading ? <span className="ai-spinner small" /> : <i className="fas fa-paper-plane" />}
            </button>
          </div>
          <div className="ai-suggested-prompts">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="ai-prompt-chip"
                onClick={() => handleAsk(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
          <p className="ai-rate-hint">Câu hỏi giống nhau được lưu tạm để tiết kiệm lượt gọi (free tier). Khi hết quota, hệ thống vẫn gợi ý phim theo kho.</p>
        </section>

        {askResult?.answer && (
          <section className="section ai-section">
            <div className="ai-answer-block">
              <p className="ai-answer-text">{askResult.answer}</p>
            </div>
          </section>
        )}

        {hasResults && (
          <section className="section home-section-with-grid ai-section ai-results-section">
            <div className="container">
              <h2 className="home-section-title ai-section-heading">
                <span className="bar" aria-hidden />
                <i className="fas fa-film" aria-hidden />
                {askResult?.movies?.length ? 'Phim AI gợi ý' : 'Gợi ý theo lựa chọn của bạn'}
              </h2>
            </div>
            {displayMoviesLimit.length > 0 ? (
              <div className="home-section-grid-wrap">
                <div className="home-section-grid-7x2">
                  {displayMoviesLimit.map((m) => (
                    <HomeMovieCard key={m.id} movie={m} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="container">
                <p className="ai-no-movies">Chưa có phim nào phù hợp. Thử đổi bộ lọc hoặc hỏi AI cụ thể hơn.</p>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
