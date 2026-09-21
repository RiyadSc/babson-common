import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('public landing and auth routes never show application navigation', async ({ page }) => {
  for (const route of ['/', '/login', '/signup']) {
    await page.goto(route);
    await expect(page.locator('.sidebar')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Account' })).toBeVisible();
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.screenshot({
        path: `docs/redesign-${route === '/' ? 'landing' : route.slice(1)}-${viewport.width}.png`,
        fullPage: true,
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const result = await new AxeBuilder({ page }).analyze();
      expect(
        result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      ).toEqual([]);
    }
  }
});
test('landing links lead to distinct auth flows and app is protected', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Find your people' }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  await expect(page.getByRole('checkbox')).toBeVisible();
  await page.locator('.auth-switch').getByRole('link', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send login link' })).toBeVisible();
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/login?auth_error=1');
  await expect(page.locator('.form-error[role="alert"]')).toContainText('could not be verified');
});
