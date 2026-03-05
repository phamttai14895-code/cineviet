/**
 * Cấu hình URL API cho 3 nguồn phim: Ophim, KKPhim (phimapi), Nguonc
 * Dùng cho crawl và merge dữ liệu.
 */

const OPROM_BASE = 'https://ophim1.com/v1/api';
const PHIMAPI_BASE = 'https://phimapi.com';
const NGUONC_BASE = 'https://phim.nguonc.com/api';

export const ophim = {
  home: () => `${OPROM_BASE}/home`,
  search: (keyword) => `${OPROM_BASE}/tim-kiem?keyword=${encodeURIComponent(keyword)}`,
  theLoai: () => `${OPROM_BASE}/the-loai`,
  quocGia: () => `${OPROM_BASE}/quoc-gia`,
  namPhatHanh: () => `${OPROM_BASE}/nam-phat-hanh`,
  phim: (slug) => `${OPROM_BASE}/phim/${encodeURIComponent(slug)}`,
  phimImages: (slug) => `${OPROM_BASE}/phim/${encodeURIComponent(slug)}/images`,
  phimPeoples: (slug) => `${OPROM_BASE}/phim/${encodeURIComponent(slug)}/peoples`,
  cdnImage: 'https://img.ophim.live',
};

export const phimapi = {
  phimMoiCapNhat: (page = 1) => `${PHIMAPI_BASE}/danh-sach/phim-moi-cap-nhat?page=${page}`,
  phim: (slug) => `${PHIMAPI_BASE}/phim/${encodeURIComponent(slug)}`,
  tmdb: (type, id) => `${PHIMAPI_BASE}/tmdb/${type}/${id}`,
  danhSach: (typeList, params = {}) => {
    const q = new URLSearchParams({ page: params.page ?? 1, ...params });
    return `${PHIMAPI_BASE}/v1/api/danh-sach/${encodeURIComponent(typeList)}?${q}`;
  },
  timKiem: (keyword, params = {}) => {
    const q = new URLSearchParams({ keyword, page: params.page ?? 1, ...params });
    return `${PHIMAPI_BASE}/v1/api/tim-kiem?${q}`;
  },
  theLoai: () => `${PHIMAPI_BASE}/the-loai`,
  theLoaiDetail: (slug, params = {}) => {
    const q = new URLSearchParams({ page: params.page ?? 1, ...params });
    return `${PHIMAPI_BASE}/v1/api/the-loai/${encodeURIComponent(slug)}?${q}`;
  },
  quocGia: () => `${PHIMAPI_BASE}/quoc-gia`,
  quocGiaDetail: (slug, params = {}) => {
    const q = new URLSearchParams({ page: params.page ?? 1, ...params });
    return `${PHIMAPI_BASE}/v1/api/quoc-gia/${encodeURIComponent(slug)}?${q}`;
  },
  nam: (year, params = {}) => {
    const q = new URLSearchParams({ page: params.page ?? 1, ...params });
    return `${PHIMAPI_BASE}/v1/api/nam/${year}?${q}`;
  },
  imageWebp: (imageUrl) => `${PHIMAPI_BASE}/image.php?url=${encodeURIComponent(imageUrl)}`,
};

export const nguonc = {
  phimMoiCapNhat: (page = 1) => `${NGUONC_BASE}/films/phim-moi-cap-nhat?page=${page}`,
  danhSach: (slug, page = 1) => `${NGUONC_BASE}/films/danh-sach/${encodeURIComponent(slug)}?page=${page}`,
  film: (slug) => `${NGUONC_BASE}/film/${encodeURIComponent(slug)}`,
  theLoai: (slug, page = 1) => `${NGUONC_BASE}/films/the-loai/${encodeURIComponent(slug)}?page=${page}`,
  quocGia: (slug, page = 1) => `${NGUONC_BASE}/films/quoc-gia/${encodeURIComponent(slug)}?page=${page}`,
  namPhatHanh: (year, page = 1) => `${NGUONC_BASE}/films/nam-phat-hanh/${encodeURIComponent(year)}?page=${page}`,
  search: (keyword) => `${NGUONC_BASE}/films/search?keyword=${encodeURIComponent(keyword)}`,
};
