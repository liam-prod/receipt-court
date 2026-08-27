import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const p = await b.newPage({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 2 });
p.on('pageerror', e => console.error('PAGEERROR:', e.message));
await p.goto('http://localhost:8899/?demo=1', { waitUntil: 'domcontentloaded' });
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:8899/?demo=1', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(900);
await p.fill('#plea-input', "It was on sale and I deserved it, everyone else was ordering too.");
await p.click('#btn-plead');
await p.waitForTimeout(330);                       // mid-OBJECTION slam
await p.screenshot({ path: 'screenshots/08-objection.png' });
console.log('objection splash captured');
await p.waitForTimeout(2200);
await p.screenshot({ path: 'screenshots/09-guilty-splash.png' });
console.log('verdict splash captured');
await p.waitForTimeout(2500);
console.log('verdict:', await p.locator('#verdict-stamp').textContent());
await b.close();
