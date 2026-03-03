// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Xem phim', () => {
  test('từ trang chủ vào chi tiết phim và có nút xem', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CineViet/i);

    const firstCard = page.locator('.movie-card, .home-movie-card-wrap').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });
    await firstCard.click();

    await expect(page).toHaveURL(/\/movie\//, { timeout: 8000 });
    const watchBtn = page.getByRole('link', { name: /Xem phim|Watch|Xem ngay/i }).first();
    await expect(watchBtn).toBeVisible({ timeout: 5000 });
  });

  test('vào trang xem phim (watch) khi có slug', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('a[href*="/movie/"]').first();
    await expect(card).toBeVisible({ timeout: 10000 });
    const href = await card.getAttribute('href');
    const match = href?.match(/\/movie\/([^/?]+)/);
    if (!match) return;
    const slugOrId = match[1];
    await page.goto(`/movie/${slugOrId}`);
    await expect(page).toHaveURL(new RegExp(`/movie/${slugOrId}`), { timeout: 8000 });
    const watchLink = page.locator('a[href*="/watch/"]').first();
    await expect(watchLink).toBeVisible({ timeout: 5000 });
    const watchHref = await watchLink.getAttribute('href');
    if (watchHref) {
      await page.goto(watchHref.startsWith('http') ? watchHref : new URL(watchHref, page.url()).href);
      await expect(page).toHaveURL(/\/watch\//, { timeout: 8000 });
      await expect(page.locator('video, .watch-player, .watch-below')).toBeVisible({ timeout: 10000 });
    }
  });
});
