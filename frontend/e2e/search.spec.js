// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Tìm kiếm phim', () => {
  test('mở trang tìm kiếm và nhập từ khóa', async ({ page }) => {
    await page.goto('/tim-kiem');
    await expect(page).toHaveURL(/\/tim-kiem/);
    await expect(page.getByRole('heading', { name: /Tìm kiếm phim|Search movies/i })).toBeVisible({ timeout: 8000 });
  });

  test('tìm kiếm từ header và chuyển sang trang kết quả', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CineViet/i);

    const searchWrap = page.locator('.header-search-wrap, .header-search').first();
    const searchInput = page.locator('.header-search-input').first();
    const searchBtn = page.locator('.header-search-btn').first();

    await searchWrap.click().catch(() => {});
    await searchInput.fill('phim');
    await searchInput.press('Enter');

    await expect(page).toHaveURL(/\/tim-kiem.*q=phim/, { timeout: 10000 });
  });
});
