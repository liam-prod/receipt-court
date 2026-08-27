import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const p = await b.newPage({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 2 });
p.on('pageerror', e => console.error('PAGEERROR:', e.message));
await p.goto('http://localhost:8899/?demo=1', { waitUntil: 'networkidle' });
await p.evaluate(() => {
  localStorage.setItem('receipt-court:ai-config', JSON.stringify({
    baseUrl: 'http://localhost:8788', apiKey: 'proxy-injects-real-key',
    model: 'claude-sonnet-5', transport: 'cursor-agent', enabled: true,
  }));
});
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(800);
console.log('opened:', await p.locator('#case-title').textContent());
console.log('procedural shown immediately:', (await p.locator('#prosecution-text').textContent()).slice(0,60), '…');

const t0 = Date.now();
await p.waitForFunction(
  () => document.getElementById('prosecution-src')?.textContent?.trim() === 'AI PROSECUTOR',
  null, { timeout: 150000 }
);
console.log(`AI indictment landed in ${Math.round((Date.now()-t0)/1000)}s`);
console.log('---\n' + await p.locator('#prosecution-text').textContent() + '\n---');
await p.screenshot({ path: 'screenshots/07-ai-prosecutor.png' });
await b.close();
