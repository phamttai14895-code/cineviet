import db from './db.js';

const KEYS = [
  'site_name',
  'site_description',
  'movies_per_page',
  'require_login',
  'rate_limit_enabled',
  'allow_register',
  'maintenance_mode',
  'ga4_measurement_id',
  'gtm_container_id',
  'social_facebook',
  'social_telegram',
  'social_email',
  'vast_preroll_url',
  'vast_skip_offset_seconds',
  'vast_enabled',
  'ad_popup_enabled',
  'ad_popup_file',
  'ad_popup_link',
  'ad_footer_banner_enabled',
  'ad_footer_banner_file',
  'ad_footer_banner_link',
  'ad_below_featured_enabled',
  'ad_below_featured_file',
  'ad_below_featured_link',
  'ad_sidebar_left_enabled',
  'ad_sidebar_left_file',
  'ad_sidebar_left_link',
  'ad_sidebar_right_enabled',
  'ad_sidebar_right_file',
  'ad_sidebar_right_link',
  'watch_notice',
  'home_notice',
  'protection_anti_adblock_notice',
  'protection_block_right_click',
  'protection_block_devtools',
  'protection_block_view_source',
];

let cache = null;
let cacheTs = 0;
const CACHE_TTL_MS = 5000;

function getAll() {
  const now = Date.now();
  if (cache && now - cacheTs < CACHE_TTL_MS) return cache;
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  KEYS.forEach((k) => {
    const r = rows.find((x) => x.key === k);
    obj[k] = r ? r.value : getDefault(k);
  });
  cache = obj;
  cacheTs = now;
  return obj;
}

function get(key) {
  return getAll()[key];
}

function getDefault(k) {
  const d = {
    site_name: 'CineViet',
    site_description: 'Trang xem phim online chất lượng cao',
    movies_per_page: '20',
    require_login: '0',
    rate_limit_enabled: '1',
    allow_register: '1',
    maintenance_mode: '0',
    ga4_measurement_id: '',
    gtm_container_id: '',
    social_facebook: '',
    social_telegram: '',
    social_email: '',
    vast_preroll_url: '',
    vast_skip_offset_seconds: '5',
    vast_enabled: '1',
    ad_popup_enabled: '0',
    ad_popup_file: '',
    ad_popup_link: '',
    ad_footer_banner_enabled: '0',
    ad_footer_banner_file: '',
    ad_footer_banner_link: '',
    ad_below_featured_enabled: '0',
    ad_below_featured_file: '',
    ad_below_featured_link: '',
    ad_sidebar_left_enabled: '0',
    ad_sidebar_left_file: '',
    ad_sidebar_left_link: '',
    ad_sidebar_right_enabled: '0',
    ad_sidebar_right_file: '',
    ad_sidebar_right_link: '',
    watch_notice: '',
    home_notice: 'Chào mừng bạn đến với CineViet. Chúc bạn xem phim vui vẻ!',
    protection_anti_adblock_notice: '0',
    protection_block_right_click: '0',
    protection_block_devtools: '0',
    protection_block_view_source: '0',
  };
  return d[k] ?? '';
}

function set(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
  cache = null;
}

function setAll(obj) {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  KEYS.forEach((k) => {
    if (obj[k] !== undefined) stmt.run(k, String(obj[k]));
  });
  cache = null;
}

function getPublic() {
  const all = getAll();
  return {
    site_name: all.site_name,
    site_description: all.site_description,
    movies_per_page: parseInt(all.movies_per_page, 10) || 20,
    require_login: all.require_login === '1',
    allow_register: all.allow_register === '1',
    maintenance_mode: all.maintenance_mode === '1',
    rate_limit_enabled: all.rate_limit_enabled === '1',
    ga4_measurement_id: (all.ga4_measurement_id || '').trim(),
    gtm_container_id: (all.gtm_container_id || '').trim(),
    social_facebook: (all.social_facebook || '').trim(),
    social_telegram: (all.social_telegram || '').trim(),
    social_email: (all.social_email || '').trim(),
    vast_preroll_url: (all.vast_preroll_url || '').trim(),
    vast_skip_offset_seconds: Math.max(0, parseInt(all.vast_skip_offset_seconds, 10) || 0),
    vast_enabled: all.vast_enabled === '1',
    ad_popup_enabled: all.ad_popup_enabled === '1',
    ad_popup_file: (all.ad_popup_file || '').trim(),
    ad_popup_link: (all.ad_popup_link || '').trim(),
    ad_footer_banner_enabled: all.ad_footer_banner_enabled === '1',
    ad_footer_banner_file: (all.ad_footer_banner_file || '').trim(),
    ad_footer_banner_link: (all.ad_footer_banner_link || '').trim(),
    ad_below_featured_enabled: all.ad_below_featured_enabled === '1',
    ad_below_featured_file: (all.ad_below_featured_file || '').trim(),
    ad_below_featured_link: (all.ad_below_featured_link || '').trim(),
    ad_sidebar_left_enabled: all.ad_sidebar_left_enabled === '1',
    ad_sidebar_left_file: (all.ad_sidebar_left_file || '').trim(),
    ad_sidebar_left_link: (all.ad_sidebar_left_link || '').trim(),
    ad_sidebar_right_enabled: all.ad_sidebar_right_enabled === '1',
    ad_sidebar_right_file: (all.ad_sidebar_right_file || '').trim(),
    ad_sidebar_right_link: (all.ad_sidebar_right_link || '').trim(),
    watch_notice: (all.watch_notice || '').trim(),
    home_notice: (all.home_notice || '').trim(),
    protection_anti_adblock_notice: all.protection_anti_adblock_notice === '1',
    protection_block_right_click: all.protection_block_right_click === '1',
    protection_block_devtools: all.protection_block_devtools === '1',
    protection_block_view_source: all.protection_block_view_source === '1',
  };
}

function getForAdmin() {
  const all = getAll();
  return {
    site_name: all.site_name,
    site_description: all.site_description,
    movies_per_page: parseInt(all.movies_per_page, 10) || 20,
    require_login: all.require_login === '1',
    rate_limit_enabled: all.rate_limit_enabled === '1',
    allow_register: all.allow_register === '1',
    maintenance_mode: all.maintenance_mode === '1',
    ga4_measurement_id: (all.ga4_measurement_id || '').trim(),
    gtm_container_id: (all.gtm_container_id || '').trim(),
    social_facebook: (all.social_facebook || '').trim(),
    social_telegram: (all.social_telegram || '').trim(),
    social_email: (all.social_email || '').trim(),
    vast_preroll_url: (all.vast_preroll_url || '').trim(),
    vast_skip_offset_seconds: Math.max(0, parseInt(all.vast_skip_offset_seconds, 10) || 0),
    vast_enabled: all.vast_enabled === '1',
    ad_popup_enabled: all.ad_popup_enabled === '1',
    ad_popup_file: (all.ad_popup_file || '').trim(),
    ad_popup_link: (all.ad_popup_link || '').trim(),
    ad_footer_banner_enabled: all.ad_footer_banner_enabled === '1',
    ad_footer_banner_file: (all.ad_footer_banner_file || '').trim(),
    ad_footer_banner_link: (all.ad_footer_banner_link || '').trim(),
    ad_below_featured_enabled: all.ad_below_featured_enabled === '1',
    ad_below_featured_file: (all.ad_below_featured_file || '').trim(),
    ad_below_featured_link: (all.ad_below_featured_link || '').trim(),
    ad_sidebar_left_enabled: all.ad_sidebar_left_enabled === '1',
    ad_sidebar_left_file: (all.ad_sidebar_left_file || '').trim(),
    ad_sidebar_left_link: (all.ad_sidebar_left_link || '').trim(),
    ad_sidebar_right_enabled: all.ad_sidebar_right_enabled === '1',
    ad_sidebar_right_file: (all.ad_sidebar_right_file || '').trim(),
    ad_sidebar_right_link: (all.ad_sidebar_right_link || '').trim(),
    watch_notice: (all.watch_notice || '').trim(),
    home_notice: (all.home_notice || '').trim(),
    protection_anti_adblock_notice: all.protection_anti_adblock_notice === '1',
    protection_block_right_click: all.protection_block_right_click === '1',
    protection_block_devtools: all.protection_block_devtools === '1',
    protection_block_view_source: all.protection_block_view_source === '1',
  };
}

export default { getAll, get, getDefault, set, setAll, getPublic, getForAdmin, KEYS };
