import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

let csrfToken = null;

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (csrfToken && !['get', 'head', 'options'].includes((config.method || 'get').toLowerCase())) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

client.interceptors.response.use(
  (r) => {
    if (r.data && r.data.csrfToken) csrfToken = r.data.csrfToken;
    return r;
  },
  (err) => {
    if (import.meta.env.DEV && err?.message) {
      console.warn('[API]', err.response?.status, err.response?.data?.error || err.message, err.config?.url);
    }
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.dispatchEvent(new Event('auth-logout'));
    }
    if (err.response?.status === 403 && err.response?.data?.error?.includes?.('CSRF')) {
      csrfToken = null;
    }
    return Promise.reject(err);
  }
);

export const auth = {
  register: (data) => client.post('/auth/register', data),
  login: (data) => client.post('/auth/login', data),
  me: () => client.get('/auth/me'),
  verifyEmail: (code) => client.post('/auth/verify-email', { code }),
  resendVerification: () => client.post('/auth/resend-verification'),
};
export const movies = {
  list: (params) => client.get('/movies', { params }),
  suggest: (q, limit = 10) => client.get('/movies/suggest', { params: { q: (q || '').trim(), limit } }),
  get: (id) => client.get(`/movies/${id}`),
  watch: (id, body) => client.post(`/movies/${id}/watch`, body),
  favorite: (id) => client.post(`/movies/${id}/favorite`),
  rate: (id, rating) => client.post(`/movies/${id}/rate`, { rating }),
  ratingStats: (id) => client.get(`/movies/${id}/rating-stats`),
  genres: () => client.get('/movies/meta/genres'),
  countries: () => client.get('/movies/meta/countries'),
  random: (params) => client.get('/movies/random', { params }),
  comments: (movieId) => client.get(`/movies/${movieId}/comments`),
  createComment: (movieId, data) => client.post(`/movies/${movieId}/comments`, typeof data === 'string' ? { content: data } : data),
  likeComment: (movieId, commentId) => client.post(`/movies/${movieId}/comments/${commentId}/like`),
  updateComment: (movieId, commentId, content) => client.patch(`/movies/${movieId}/comments/${commentId}`, { content }),
  deleteComment: (movieId, commentId) => client.delete(`/movies/${movieId}/comments/${commentId}`),
};
export const home = {
  trendingBlock: () => client.get('/home/trending-block'),
};
export const actors = {
  list: (params) => client.get('/actors', { params }),
  get: (slug) => client.get(`/actors/${slug}`),
};
export const user = {
  stats: () => client.get('/user/stats'),
  favorites: () => client.get('/user/favorites'),
  favoriteIds: () => client.get('/user/favorite-ids'),
  history: () => client.get('/user/history'),
  progress: (movieId) => client.get(`/user/progress/${movieId}`),
  removeHistory: (movieId) => client.delete(`/user/history/${movieId}`),
  reportComment: (commentId) => client.post('/user/report-comment', { comment_id: commentId }),
  reportedCommentIds: () => client.get('/user/reported-comment-ids'),
  reportWatch: (data) => client.post('/user/report-watch', data),
  updateProfile: (data) => client.patch('/user/profile', data),
  uploadAvatar: (formData) => client.post('/user/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  changePassword: (data) => client.post('/user/change-password', data),
  notificationSettings: () => client.get('/user/notification-settings'),
  updateNotificationSettings: (data) => client.patch('/user/notification-settings', data),
  notifications: (limit = 15) => client.get('/user/notifications', { params: { limit } }),
  markNotificationsRead: () => client.post('/user/notifications/read'),
};
export const admin = {
  stats: () => client.get('/admin/stats'),
  vpsStats: () => client.get('/admin/stats/vps'),
  viewsByDay: (period) => client.get('/admin/dashboard/views-by-day', { params: { period } }),
  topMovies: (limit = 5) => client.get('/admin/dashboard/top-movies', { params: { limit } }),
  recentUsers: (limit = 5) => client.get('/admin/dashboard/recent-users', { params: { limit } }),
  activity: (limit = 10) => client.get('/admin/dashboard/activity', { params: { limit } }),
  users: (params) => client.get('/admin/users', { params }),
  updateUserStatus: (id, status) => client.patch(`/admin/users/${id}/status`, { status }),
  comments: (params) => client.get('/admin/comments', { params }),
  commentsReportedCount: () => client.get('/admin/comments/reported-count'),
  updateCommentStatus: (id, status) => client.patch(`/admin/comments/${id}/status`, { status }),
  deleteComment: (id) => client.delete(`/admin/comments/${id}`),
  reports: (params) => client.get('/admin/reports', { params }),
  reportsCount: () => client.get('/admin/reports/count'),
  updateReportStatus: (id, status) => client.patch(`/admin/reports/${id}`, { status }),
  deleteReport: (id) => client.delete(`/admin/reports/${id}`),
  movies: (params) => client.get('/admin/movies', { params }),
  getMovie: (id) => client.get(`/admin/movies/${id}`),
  genres: () => client.get('/admin/genres'),
  createMovie: (formData) => client.post('/admin/movies', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateMovie: (id, formData) => client.put(`/admin/movies/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateMovieStatus: (id, status) => client.patch(`/admin/movies/${id}/status`, { status }),
  deleteMovie: (id) => client.delete(`/admin/movies/${id}`),
  deleteMoviesBulk: (ids) => client.post('/admin/movies/bulk-delete', { ids }),
  deleteAllMovies: () => client.post('/admin/movies/delete-all', { confirm: true }),
  getMovieEpisodes: (id) => client.get(`/admin/movies/${id}/episodes`),
  updateMovieEpisodes: (id, data) => client.put(`/admin/movies/${id}/episodes`, data),
  addMovieEpisodeServer: (id, serverName) => client.post(`/admin/movies/${id}/episodes`, { server_name: serverName }),
  addMovieEpisode: (id, serverIndex, episode) => client.post(`/admin/movies/${id}/episodes`, { server_index: serverIndex, episode }),
  updateMovieEpisode: (id, serverIndex, episodeIndex, episode) => client.patch(`/admin/movies/${id}/episodes`, { server_index: serverIndex, episode_index: episodeIndex, episode }),
  deleteMovieEpisodes: (id, serverIndex, episodeIndex) => client.delete(`/admin/movies/${id}/episodes`, { data: { server_index: serverIndex, episode_index: episodeIndex } }),
  deleteMovieEpisodeServer: (id, serverIndex) => client.delete(`/admin/movies/${id}/episodes`, { data: { server_index: serverIndex } }),
  createGenre: (data) => client.post('/admin/genres', data),
  deleteGenresBulk: (ids) => client.post('/admin/genres/bulk-delete', { ids }),
  deleteGenresAll: () => client.post('/admin/genres/delete-all', { confirm: true }),
  countries: () => client.get('/admin/countries'),
  createCountry: (data) => client.post('/admin/countries', data),
  deleteCountriesBulk: (ids) => client.post('/admin/countries/bulk-delete', { ids }),
  deleteCountriesAll: () => client.post('/admin/countries/delete-all', { confirm: true }),
  directors: () => client.get('/admin/directors'),
  createDirector: (data) => client.post('/admin/directors', data),
  deleteDirectorsBulk: (ids) => client.post('/admin/directors/bulk-delete', { ids }),
  deleteDirectorsAll: () => client.post('/admin/directors/delete-all', { confirm: true }),
  actors: () => client.get('/admin/actors'),
  createActor: (data) => client.post('/admin/actors', data),
  deleteActorsBulk: (ids) => client.post('/admin/actors/bulk-delete', { ids }),
  deleteActorsAll: () => client.post('/admin/actors/delete-all', { confirm: true }),
  syncActorsTmdb: (limit = 500) => client.post('/admin/actors/sync-tmdb', {}, { params: { limit } }),
  actorsTmdbStats: () => client.get('/admin/actors/tmdb-stats'),
  releaseYears: () => client.get('/admin/release-years'),
  createReleaseYear: (data) => client.post('/admin/release-years', data),
  deleteReleaseYearsBulk: (ids) => client.post('/admin/release-years/bulk-delete', { ids }),
  deleteReleaseYearsAll: () => client.post('/admin/release-years/delete-all', { confirm: true }),
  getSettings: () => client.get('/admin/settings'),
  updateSettings: (data) => client.put('/admin/settings', data),
  uploadVast: (formData) => client.post('/admin/ads/vast', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadAdZone: (formData) => client.post('/admin/ads/zone', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  logs: (params) => client.get('/admin/logs', { params }),
  crawlLogs: (params) => client.get('/admin/crawl/logs', { params }),
  realtime: () => client.get('/admin/realtime'),
  crawlRun: (body) => client.post('/admin/crawl/run', body, { timeout: 600000 }),
  crawlAutoSettings: () => client.get('/admin/crawl/auto-settings'),
  crawlAutoSettingsUpdate: (body) => client.put('/admin/crawl/auto-settings', body),
};
export const settings = {
  getPublic: () => client.get('/settings'),
};
export const watchParty = {
  publicRooms: () => client.get('/watch-party/rooms'),
};
export const crawl = {
  genres: () => client.get('/crawl/genres'),
  countries: () => client.get('/crawl/countries'),
};

export default client;
