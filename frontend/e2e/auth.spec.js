// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Đăng nhập', () => {
  test('mở modal đăng nhập từ header', async ({ page }) => {
    await page.goto('/');
    const loginBtn = page.getByRole('button', { name: /đăng nhập|log in/i }).first();
    await loginBtn.click();

    await expect(page.locator('.login-modal-backdrop, [class*="login-modal"]')).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('textbox', { name: /email/i }).or(page.locator('input[type="email"]'))).toBeVisible({ timeout: 3000 });
  });

  test('modal có nút đăng nhập Google', async ({ page }) => {
    await page.goto('/');
    const loginBtn = page.getByRole('button', { name: /đăng nhập|log in/i }).first();
    await loginBtn.click();

    await expect(page.locator('button:has-text("Google"), button:has-text("google")').first()).toBeVisible({ timeout: 3000 });
  });

  test('modal có ô email và mật khẩu', async ({ page }) => {
    await page.goto('/');
    const loginBtn = page.getByRole('button', { name: /đăng nhập|log in/i }).first();
    await loginBtn.click();

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    await expect(emailInput).toBeVisible({ timeout: 3000 });
    await expect(passwordInput).toBeVisible({ timeout: 3000 });
    await emailInput.fill('test@example.com');
    await passwordInput.fill('testpass');
    await expect(emailInput).toHaveValue('test@example.com');
  });
});
