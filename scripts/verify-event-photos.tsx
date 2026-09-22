import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import EventArtwork from '../src/components/event-artwork';
import { sampleEvents } from '../src/lib/seed';

const css = await readFile('src/app/event-artwork.css', 'utf8');
const markup = renderToStaticMarkup(<main className="app-shell"><div className="grid">{sampleEvents().map(event => <article className="event-card" key={event.id}><div className="event-image"><EventArtwork event={event}/></div><div className="event-body"><small>{event.category}</small><h3>{event.title}</h3><p>{event.location}</p></div></article>)}</div></main>);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.route('http://photos.local/images/**', async route => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({ body: await readFile(`public${path}`), contentType: 'image/webp' });
  });
  await page.setContent(`<base href="http://photos.local"><style>body{margin:0;padding:40px;background:#fafbf8;font-family:Arial;color:#182a22}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.event-card{overflow:hidden;background:white;border:1px solid #d9e1da;border-radius:5px}.event-image{position:relative}h3{margin:10px 0}small{color:#667363}p{font-size:14px;color:#667363}@media(max-width:600px){body{padding:16px}.grid{grid-template-columns:1fr}}</style><style>${css}</style>${markup}`);
  await page.evaluate(async () => { for (const image of document.images) { image.loading = 'eager'; await image.decode(); } });
  await page.screenshot({ path: 'docs/event-photos-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/event-photos-mobile.png', fullPage: true });
  console.log('Photos loaded:', await page.locator('img').count());
  console.log('Mobile overflow:', await page.evaluate(() => document.documentElement.scrollWidth > innerWidth));
} finally { await browser.close(); }
