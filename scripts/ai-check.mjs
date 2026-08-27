import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const p = await b.newPage({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 2 });
p.on('pageerror', e => console.error('PAGEERROR:', e.message));
await p.goto('http://localhost:8899/?demo=1', { waitUntil: 'domcontentloaded' });
await p.evaluate(() => localStorage.setItem('receipt-court:ai-config', JSON.stringify({
  baseUrl: 'http://localhost:8788', apiKey: 'x', model: 'gemini-3.7-flash',
  transport: 'cursor-agent', enabled: true })));
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(800);

const waitAI = async () => {
  const t0 = Date.now();
  await p.waitForFunction(() => document.getElementById('prosecution-src')?.textContent?.trim() === 'AI PROSECUTOR', null, { timeout: 180000 });
  return Math.round((Date.now() - t0) / 1000);
};
console.log('CASE 1 (cold):', await waitAI(), 's');
console.log(((await p.locator('#prosecution-text').textContent()) || '').slice(0, 220), '…\n');
await p.screenshot({ path: 'screenshots/07-ai-prosecutor.png' });

// second case should be warm from the prefetch
await p.click('#btn-fifth');
await p.waitForTimeout(2500);
await p.click('#btn-next');
await p.waitForTimeout(500);
console.log('CASE 2 (prefetched):', await waitAI(), 's');
console.log(((await p.locator('#prosecution-text').textContent()) || '').slice(0, 220), '…');
await b.close();
