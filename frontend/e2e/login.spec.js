// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Đăng nhập', () => {
  test('mở modal đăng nhập từ header', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CineViet/i);

    const loginBtn = page.getByRole('button', { name: /Đăng nhập|Log in/i }).or(
      page.locator('.header-member-btn').filter({ hasText: /Đăng nhập|Log in/i })
    ).first();
    await expect(loginBtn).toBeVisible({ timeout: 8000 });
    await loginBtn.click();

    await expect(page.locator('.login-modal-backdrop, [class*="login-modal"]')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/Email|Mật khẩu|Password/i).first()).toBeVisible({ timeout: 2000 });
  });

  test('đóng modal đăng nhập bằng nút Đóng', async ({ page }) => {
    await page.goto('/');
    const loginBtn = page.getByRole('button', { name: /Đăng nhập|Log in/i }).or(
      page.locator('button').filter({ hasText: /Đăng nhập|Log in/i })
    ).first();
    await loginBtn.click();
    await expect(page.locator('.login-modal-backdrop')).toBeVisible({ timeout: 3000 });

    const closeBtn = page.getByRole('button', { name: /Đóng|Close/i }).first();
    await closeBtn.click();
    await expect(page.locator('.login-modal-backdrop')).not.toBeVisible({ timeout: 2000 });
  });
});
