// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Đa ngôn ngữ (i18n)', () => {
  test('chuyển sang tiếng Anh và kiểm tra footer', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CineViet/i);

    const langBtn = page.locator('.header-lang-toggle').first();
    await expect(langBtn).toBeVisible({ timeout: 5000 });
    await langBtn.click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByText(/Movies|Explore|Contact/i).first()).toBeVisible({ timeout: 3000 });
  });

  test('chuyển về tiếng Việt', async ({ page }) => {
    await page.goto('/');
    const langBtn = page.locator('.header-lang-toggle').first();
    await langBtn.click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await langBtn.click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
    await expect(page.getByText(/Phim|Khám phá|Liên hệ/i).first()).toBeVisible({ timeout: 3000 });
  });
});
