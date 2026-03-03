// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Luồng E2E đầy đủ: xem phim, tìm kiếm, đăng nhập.
 * Chạy: npm run test:e2e (cần dev server chạy hoặc cấu hình webServer trong playwright.config.js).
 */
test.describe('Luồng chính E2E', () => {
  test('xem phim: trang chủ → chi tiết phim → trang xem (player)', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CineViet/i);
    const card = page.locator('a[href^="/movie/"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.click();
    await expect(page).toHaveURL(/\/movie\//, { timeout: 8000 });
    const watchLink = page.locator('a[href^="/watch/"]').first();
    await expect(watchLink).toBeVisible({ timeout: 5000 });
    await watchLink.click();
    await expect(page).toHaveURL(/\/watch\//, { timeout: 8000 });
    await expect(page.locator('video, .watch-player, .watch-below, [class*="player"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('tìm kiếm: header → nhập từ khóa → trang kết quả', async ({ page }) => {
    await page.goto('/');
    const searchInput = page.locator('.header-search-input').first();
    const searchWrap = page.locator('.header-search-wrap, .header-search').first();
    await searchWrap.click().catch(() => {});
    await searchInput.fill('phim');
    await searchInput.press('Enter');
    await expect(page).toHaveURL(/\/tim-kiem/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Tìm kiếm|Search/i })).toBeVisible({ timeout: 5000 });
  });

  test('đăng nhập: mở modal từ header, có form email/password và Google', async ({ page }) => {
    await page.goto('/');
    const loginBtn = page.getByRole('button', { name: /đăng nhập|log in/i }).first();
    await expect(loginBtn).toBeVisible({ timeout: 8000 });
    await loginBtn.click();
    await expect(page.locator('.login-modal-backdrop, [class*="login-modal"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible({ timeout: 2000 });
    await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 2000 });
    await expect(page.locator('button:has-text("Google"), button:has-text("google")').first()).toBeVisible({ timeout: 2000 });
  });

  test('i18n: chuyển sang tiếng Anh rồi tìm kiếm', async ({ page }) => {
    await page.goto('/');
    const langBtn = page.locator('.header-lang-toggle').first();
    await expect(langBtn).toBeVisible({ timeout: 5000 });
    await langBtn.click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en', { timeout: 2000 });
    const searchInput = page.getByPlaceholder(/search movies/i).first();
    await searchInput.fill('test');
    await searchInput.press('Enter');
    await expect(page).toHaveURL(/\/tim-kiem/, { timeout: 10000 });
  });
});
