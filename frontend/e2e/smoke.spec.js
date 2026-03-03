// @ts-check
import { test, expect } from '@playwright/test';

/** Luồng chính: trang chủ → tìm kiếm → chi tiết phim → xem phim → mở modal đăng nhập */
test.describe('Smoke — luồng chính', () => {
  test('trang chủ → tìm kiếm → kết quả', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CineViet/i);
    const searchInput = page.getByPlaceholder(/tìm phim|search movies/i);
    await searchInput.fill('phim');
    await searchInput.press('Enter');
    await expect(page).toHaveURL(/\/tim-kiem/);
  });

  test('trang chủ → chi tiết phim → có nút xem', async ({ page }) => {
    await page.goto('/');
    const firstMovie = page.locator('a[href^="/movie/"]').first();
    await expect(firstMovie).toBeVisible({ timeout: 15000 });
    await firstMovie.click();
    await expect(page).toHaveURL(/\/movie\//);
    await expect(page.locator('a[href^="/watch/"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('trang chủ → chi tiết → xem phim (player)', async ({ page }) => {
    await page.goto('/');
    const firstMovie = page.locator('a[href^="/movie/"]').first();
    await firstMovie.click();
    await expect(page).toHaveURL(/\/movie\//);
    const watchBtn = page.locator('a[href^="/watch/"]').first();
    await watchBtn.click();
    await expect(page).toHaveURL(/\/watch\//);
    await expect(page.locator('video, .watch-player, [class*="player"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('mở modal đăng nhập từ header', async ({ page }) => {
    await page.goto('/');
    const loginBtn = page.getByRole('button', { name: /đăng nhập|log in/i }).first();
    await loginBtn.click();
    await expect(page.locator('.login-modal-backdrop, [class*="login-modal"]')).toBeVisible({ timeout: 3000 });
  });
});
