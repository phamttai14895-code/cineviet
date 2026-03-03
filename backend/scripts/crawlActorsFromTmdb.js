/**
 * Crawl toàn bộ diễn viên từ TMDB: GET /person/{id} + GET /person/{id}/images.
 * Thu thập tmdb_id từ: (1) bảng actors, (2) movies.cast[].id.
 * Chạy: node scripts/crawlActorsFromTmdb.js (từ thư mục backend). Cần TMDB_API_KEY trong .env.
 */
import 'dotenv/config';
import { collectTmdbPersonIds, upsertActorFromTmdb } from '../src/services/syncActorsFromTmdb.js';
import { fetchTmdbPersonWithAvatar } from '../src/services/tmdbCredits.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!process.env.TMDB_API_KEY) {
    console.error('Thiếu TMDB_API_KEY trong .env');
    process.exit(1);
  }
  const ids = collectTmdbPersonIds();
  console.log(`Tìm thấy ${ids.length} TMDB person ID để đồng bộ.`);
  let ok = 0;
  let err = 0;
  for (let i = 0; i < ids.length; i++) {
    const tmdbId = ids[i];
    try {
      const person = await fetchTmdbPersonWithAvatar(tmdbId);
      if (person) {
        person.tmdb_id = tmdbId;
        upsertActorFromTmdb(person);
        ok++;
      }
      await delay(260);
    } catch (e) {
      err++;
      console.warn(`Lỗi person ${tmdbId}:`, e.message);
    }
    if ((i + 1) % 50 === 0) console.log(`Đã xử lý ${i + 1}/${ids.length}...`);
  }
  console.log(`Xong. Thành công: ${ok}, lỗi: ${err}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
