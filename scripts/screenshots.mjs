/**
 * Drives a real Chrome through a full trial and captures the five submission
 * screenshots. Uses the installed Chrome (channel) so no browser download.
 */
import { chromium } from 'playwright-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://localhost:8899';
const OUT = 'screenshots';

const shot = (page, name) =>
  page.screenshot({ path: `${OUT}/${name}.png` }).then(() => console.log('✓', name));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 2 });
page.on('dialog', (d) => d.accept());
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('CONSOLE:', m.text()));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.goto(BASE + '/?demo=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// 1 — the courtroom mid-trial: exhibits + indictment on screen
await shot(page, '01-courtroom');

// 2 — the exhibits panel close up
await page.locator('#phase-exhibits').scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.locator('#court-case').screenshot({ path: `${OUT}/02-exhibits.png` });
console.log('✓ 02-exhibits');

// 3 — a bad plea getting demolished, and the verdict stamp
await page.fill('#plea-input', "It was on sale and honestly I'd had a long day, I deserved it. Everyone else was ordering too.");
await page.click('#btn-plead');
await page.waitForTimeout(1600);
await page.locator('#phase-cross').scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await shot(page, '03-cross-examination');

await page.locator('#phase-verdict').scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
await shot(page, '04-verdict');

// 5 — mass sentencing, then the criminal record
await page.click('#btn-tryall');
await page.waitForTimeout(4500);
await page.locator('#record-section').scrollIntoViewIfNeeded();
await page.waitForTimeout(1200);
await shot(page, '05-criminal-record');

await browser.close();
console.log('done');
