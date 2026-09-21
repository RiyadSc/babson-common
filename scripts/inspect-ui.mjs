import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE', m.text());
});
page.on('requestfailed', (r) => console.log('REQUEST FAILED', r.url(), r.failure()?.errorText));
await page.goto('http://localhost:3000');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: 'docs/preview-desktop.png', fullPage: true });
console.log(
  'Ready',
  await page.getByRole('heading', { name: 'Good plans. Better company.' }).isVisible(),
);
await page.getByRole('button', { name: 'View Sunset on the lawn' }).click();
console.log('Dialogs', await page.getByRole('dialog').count());
await page.screenshot({ path: 'docs/preview-detail.png' });
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://localhost:3000');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: 'docs/preview-mobile.png', fullPage: true });
await browser.close();
