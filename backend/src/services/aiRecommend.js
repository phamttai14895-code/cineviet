import db from '../config/db.js';

let _openaiClient = null;
async function getOpenAIClient() {
  if (_openaiClient !== null) return _openaiClient;
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const { default: OpenAI } = await import('openai');
    _openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return _openaiClient;
  } catch {
    return null;
  }
}

const MOVIE_CATALOG_LIMIT = 250;

function getMovieCatalog() {
  const rows = db.prepare(`
    SELECT m.id, m.title, m.country, m.type, m.release_year,
           GROUP_CONCAT(g.name) as genres
    FROM movies m
    LEFT JOIN movie_genres mg ON m.id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.id
    WHERE (m.status IS NULL OR m.status = 'published')
    GROUP BY m.id
    ORDER BY m.rating DESC, m.view_count DESC
    LIMIT ?
  `).all(MOVIE_CATALOG_LIMIT);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    country: r.country || '',
    type: r.type || 'movie',
    release_year: r.release_year || 0,
    genres: (r.genres || '').split(',').filter(Boolean),
  }));
}

const MOOD_TO_GENRES = {
  'vui-ve': ['Hài hước', 'Gia đình', 'Âm nhạc'],
  'xuc-dong': ['Tâm lý', 'Tình cảm', 'Gia đình'],
  'hoi-hop': ['Kinh dị', 'Hồi hộp', 'Hành động', 'Bí ẩn'],
  'suy-ngam': ['Tâm lý', 'Chính kịch', 'Tài liệu'],
  'chill': ['Hài hước', 'Tình cảm', 'Âm nhạc', 'Phiêu lưu'],
  'hanh-dong': ['Hành động', 'Phiêu lưu', 'Võ thuật', 'Khoa học viễn tưởng'],
  'lang-man': ['Tình cảm', 'Lãng mạn', 'Gia đình'],
};

const MOOD_LABELS = {
  'vui-ve': 'Vui vẻ',
  'xuc-dong': 'Xúc động',
  'hoi-hop': 'Hồi hộp',
  'suy-ngam': 'Suy ngẫm',
  'chill': 'Chill',
  'hanh-dong': 'Hành động',
  'lang-man': 'Lãng mạn',
};

function fallbackSuggest(catalog, { mood, genreId, country, type, era }) {
  let list = [...catalog];
  if (genreId) {
    const genreIds = [parseInt(genreId)];
    list = list.filter((m) => {
      const g = db.prepare('SELECT genre_id FROM movie_genres WHERE movie_id = ?').all(m.id);
      return g.some((r) => genreIds.includes(r.genre_id));
    });
  }
  if (country) list = list.filter((m) => m.country === country);
  if (type) list = list.filter((m) => (m.type || 'movie') === type);
  if (era) {
    const [minY, maxY] = era === 'old' ? [0, 1999] : era === '2000s' ? [2000, 2009] : era === '2010s' ? [2010, 2019] : [2020, 2030];
    list = list.filter((m) => m.release_year >= minY && m.release_year <= maxY);
  }
  if (mood && MOOD_TO_GENRES[mood]) {
    const preferred = MOOD_TO_GENRES[mood];
    list = list.filter((m) => m.genres.some((g) => preferred.some((p) => g.includes(p))));
  }
  return list.slice(0, 24).map((m) => m.id);
}

function buildSuggestPrompt(catalog, opts) {
  const parts = [];
  if (opts.mood) parts.push(`Tâm trạng: ${MOOD_LABELS[opts.mood] || opts.mood}`);
  if (opts.genreName) parts.push(`Thể loại ưu tiên: ${opts.genreName}`);
  if (opts.country) parts.push(`Quốc gia: ${opts.country}`);
  if (opts.type) parts.push(`Loại: ${opts.type === 'series' ? 'Phim bộ' : opts.type === 'movie' ? 'Phim lẻ' : opts.type}`);
  if (opts.era) parts.push(`Thời kỳ: ${opts.era}`);
  const prefs = parts.length ? `Sở thích người dùng: ${parts.join('. ')}.` : 'Không có lọc cụ thể.';
  const catalogText = catalog.map((m) => `id:${m.id} | ${m.title} | ${m.genres.join(', ')} | ${m.country} | ${m.type} | ${m.release_year}`).join('\n');
  return `Bạn là trợ lý gợi ý phim. Chỉ được gợi ý từ danh sách phim dưới đây (phải dùng đúng id).

Danh sách phim (id | tên | thể loại | quốc gia | type | năm):
${catalogText}

${prefs}

Trả lời ĐÚNG theo format JSON sau, không thêm text khác: {"ids": [id1, id2, id3, ...]}
Gợi ý tối đa 12 phim, ưu tiên phù hợp sở thích.`;
}

function buildAskPrompt(catalog, question) {
  const catalogText = catalog.slice(0, 150).map((m) => `id:${m.id} | ${m.title} | ${m.genres.join(', ')} | ${m.country}`).join('\n');
  return `Bạn là trợ lý tư vấn phim. Người dùng hỏi bằng tiếng Việt. Chỉ gợi ý phim có trong danh sách dưới đây.

Danh sách phim (id | tên | thể loại | quốc gia):
${catalogText}

Câu hỏi: ${question}

Trả lời ngắn gọn, thân thiện bằng tiếng Việt. Nếu có gợi ý phim, cuối câu trả lời thêm một dòng JSON: {"ids": [id1, id2, ...]}. Nếu không gợi ý phim cụ thể thì không cần dòng JSON.`;
}

function parseIdsFromResponse(text) {
  const match = text.match(/\{\s*"ids"\s*:\s*\[([^\]]*)\]\s*\}/);
  if (!match) return [];
  const ids = match[1].replace(/\s/g, '').split(',').map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n));
  return ids;
}

export async function getAiSuggestions(opts) {
  const catalog = getMovieCatalog();
  if (catalog.length === 0) return [];

  const openai = await getOpenAIClient();
  if (!openai) {
    return fallbackSuggest(catalog, opts);
  }

  const genreName = opts.genreId && opts.genres?.find((g) => String(g.id) === String(opts.genreId))?.name;
  const prompt = buildSuggestPrompt(catalog, { ...opts, genreName });
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
    });
    const text = completion.choices[0]?.message?.content?.trim() || '';
    const ids = parseIdsFromResponse(text);
    const validIds = catalog.map((m) => m.id);
    return ids.filter((id) => validIds.includes(id)).slice(0, 24);
  } catch (err) {
    console.error('AI suggest error:', err.message);
    return fallbackSuggest(catalog, opts);
  }
}

/**
 * Viết lại/dịch nội dung phim sang tiếng Việt (dùng khi crawl phim).
 * - Nếu nội dung chủ yếu tiếng Anh → dịch sang tiếng Việt.
 * - Viết lại đoạn văn 150–300 từ, rõ ràng, hấp dẫn.
 * Dùng chung OpenAI với AI gợi ý (getOpenAIClient).
 */
export async function rewriteMovieDescription(description, title) {
  const raw = (description || '').trim();
  if (!raw) return '';

  const openai = await getOpenAIClient();
  if (!openai) return raw;

  const titlePart = title ? `Tên phim: ${title}.` : '';
  const prompt = `Bạn là trợ lý biên tập nội dung phim. Nhiệm vụ:
1. Nếu nội dung dưới đây chủ yếu bằng tiếng Anh (hoặc ngôn ngữ khác), hãy dịch sang tiếng Việt.
2. Nếu đã là tiếng Việt thì viết lại cho rõ ràng, hấp dẫn.
3. Kết quả phải là đoạn văn tiếng Việt từ 150 đến 300 TỪ (words), phù hợp làm mô tả phim trên trang web. Không thêm giải thích hay tiêu đề.

${titlePart}

Nội dung hiện tại:
---
${raw.slice(0, 3000)}
---

Chỉ trả lời bằng đoạn văn tiếng Việt (150–300 từ), không thêm gì khác.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    });
    const text = completion.choices[0]?.message?.content?.trim() || '';
    return text || raw;
  } catch (err) {
    console.error('rewriteMovieDescription error:', err.message);
    return raw;
  }
}

export async function askAi(question, genres) {
  const catalog = getMovieCatalog();
  if (!question || !question.trim()) return { answer: 'Bạn hãy nhập câu hỏi về phim.', movieIds: [] };

  const openai = await getOpenAIClient();
  if (!openai) {
    const ids = fallbackSuggest(catalog, {});
    return {
      answer: 'Tính năng AI đang tạm thời. Dưới đây là một số phim gợi ý từ kho của chúng tôi. Để dùng gợi ý bằng ChatGPT, cài package openai (npm install openai) và cấu hình OPENAI_API_KEY ở server.',
      movieIds: ids.slice(0, 8),
    };
  }

  const prompt = buildAskPrompt(catalog, question.trim());
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
    });
    const text = completion.choices[0]?.message?.content?.trim() || '';
    const movieIds = parseIdsFromResponse(text);
    const validIds = new Set(catalog.map((m) => m.id));
    const ids = movieIds.filter((id) => validIds.has(id)).slice(0, 12);
    const answer = text.replace(/\{\s*"ids"\s*:\s*\[[^\]]*\]\s*\}/, '').trim();
    return { answer: answer || 'Đã xử lý câu hỏi của bạn.', movieIds: ids };
  } catch (err) {
    console.error('AI ask error:', err.message);
    return { answer: 'Không thể xử lý câu hỏi lúc này. Bạn thử lại sau nhé.', movieIds: [] };
  }
}
