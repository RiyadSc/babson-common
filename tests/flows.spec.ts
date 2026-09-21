import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('discovery, details, save, join, cancellation and persistence', async ({ page }) => {
  await page.goto('/preview');
  await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('heading', { name: 'This week, within reach.' })).toBeVisible();
  await page.screenshot({ path: 'docs/redesign-dashboard.png', fullPage: true });
  await page.getByRole('button', { name: 'Join Sunset on the lawn', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('My plans');
  await page.getByRole('button', { name: 'View Sunset on the lawn' }).click();
  await expect(page).toHaveURL(/\/preview\?event=sample-1$/);
  await page.screenshot({ path: 'docs/redesign-detail.png' });
  await expect(page.getByRole('button', { name: 'Leave activity' })).toBeVisible();
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'My plans', exact: true }).click();
  await page.screenshot({ path: 'docs/redesign-schedule.png', fullPage: true });
  await expect(page.getByRole('button', { name: 'View Sunset on the lawn' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'My plans', exact: true }).click();
  await page.getByRole('button', { name: 'View Sunset on the lawn' }).click();
  await page.getByRole('button', { name: 'Leave activity' }).click();
  await expect(page.getByRole('button', { name: 'Join activity', exact: true })).toBeVisible();
});
test('search, creation, profile and accessibility', async ({ page }) => {
  await page.goto('/preview');
  await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
  await page.getByPlaceholder('Find your next plan').fill('zzznomatch');
  await expect(page.getByText('A little quiet here.')).toBeVisible();
  await page.getByPlaceholder('Find your next plan').fill('');
  await page.locator('#main').getByRole('button', { name: 'Host a hangout', exact: true }).click();
  await page.screenshot({ path: 'docs/redesign-create.png' });
  await page.getByLabel('Activity name').fill('Board game afternoon');
  await page.getByLabel('Location', { exact: true }).fill('Reynolds lounge');
  await page.getByLabel('Starts').fill('2099-09-10T17:00');
  await page.getByLabel('Ends').fill('2099-09-10T19:00');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('What’s the plan?').fill('Bring a favorite game and meet someone new.');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('What should people know?').fill('Beginners welcome; games provided.');
  await page.getByRole('button', { name: 'Publish hangout' }).click();
  await expect(page.getByRole('status')).toContainText('published');
  await expect(page.getByRole('button', { name: 'Hosting' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'View Board game afternoon' })).toBeVisible();
  await page.getByRole('button', { name: 'View Board game afternoon' }).click();
  await page.getByRole('button', { name: 'Post an update' }).click();
  await page.getByLabel('Update for your attendees').fill('We will meet by the lounge entrance.');
  await page.getByRole('button', { name: 'Post update', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('posted');
  await page.getByRole('button', { name: 'View Board game afternoon' }).click();
  await page.getByRole('button', { name: 'Cancel activity', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm cancellation' }).click();
  await expect(page.getByRole('status')).toContainText('cancelled');
  await page.getByRole('button', { name: 'Y You Local preview', exact: true }).click();
  await page.getByLabel('Your name', { exact: true }).fill('Jamie Sample');
  await page.getByLabel('Social', { exact: true }).check();
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByRole('status')).toContainText('profile is updated');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});
test('mobile has no horizontal overflow and dialog supports Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/preview');
  await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    await page
      .locator('.event-card')
      .first()
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top < innerHeight;
      }),
  ).toBe(true);
  for (const selector of [
    '.topbar .icon-button',
    '.date-tabs button',
    '.category-tabs button',
    '.save-button',
    '.mobile-nav button',
  ]) {
    const sizes = await page.locator(selector).evaluateAll((elements) =>
      elements
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }),
    );
    expect(sizes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
  }
  await page.screenshot({ path: 'docs/redesign-dashboard-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'View Sunset on the lawn' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/preview?event=sample-1');
  await expect(page.getByRole('dialog')).toContainText('Sunset on the lawn');
});
test('waitlist, reporting, blocking and calendar export', async ({ page }) => {
  await page.goto('/preview');
  await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'View Pick-up, no pressure' }).click();
  await page.getByRole('button', { name: 'Join waitlist', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Leave waitlist' })).toBeVisible();
  await page.getByRole('button', { name: 'Leave waitlist' }).click();
  await page.getByRole('button', { name: 'Report a concern' }).click();
  await page.getByLabel('What’s the concern?').selectOption('safety');
  await page
    .getByLabel('Tell us a little more')
    .fill('This is a sample safety concern for the review flow.');
  await page.getByRole('button', { name: 'Submit report' }).click();
  await expect(page.getByRole('button', { name: 'View Pick-up, no pressure' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save Sunset on the lawn', exact: true }).click();
  await page.getByRole('button', { name: 'My plans', exact: true }).click();
  await page.getByRole('button', { name: 'Saved', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export calendar' }).click();
  expect((await download).suggestedFilename()).toBe('common-my-week.ics');
  await page.getByRole('button', { name: 'View Sunset on the lawn' }).click();
  await page.getByRole('button', { name: 'Block this host' }).click();
  await expect(page.getByRole('button', { name: 'View Sunset on the lawn' })).toHaveCount(0);
});
test('discovery and modal accessibility with keyboard focus', async ({ page }) => {
  await page.goto('/preview');
  await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const results = await new AxeBuilder({ page }).analyze();
    if (results.violations.length)
      console.log(
        JSON.stringify(
          results.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
          })),
          null,
          2,
        ),
      );
    expect(results.violations.map((v) => v.id)).toEqual([]);
  }
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('button', { name: 'Host a hangout' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeFocused();
});
test('unauthenticated API requests fail closed and PWA metadata loads', async ({ request }) => {
  expect((await request.get('/api/calendar')).status()).toBe(401);
  expect((await request.get('/api/jobs')).status()).toBe(401);
  expect((await request.get('/api/ingest')).status()).toBe(401);
  const manifest = await request.get('/manifest.webmanifest');
  expect((await manifest.json()).display).toBe('standalone');
  expect((await request.get('/sw.js')).status()).toBe(200);
});
