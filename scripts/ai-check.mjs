import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const p = await b.newPage({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 2 });
p.on('pageerror', e => console.error('PAGEERROR:', e.message));
await p.goto('http://localhost:8899/?demo=1', { waitUntil: 'domcontentloaded' });
await p.evaluate(() => {
  localStorage.setItem('receipt-court:ai-config', JSON.stringify({
    baseUrl: 'http://localhost:8788', apiKey: 'x', model: 'gemini-3.7-flash',
    transport: 'cursor-agent', enabled: true }));
  // reuse the agent already provisioned during testing
  localStorage.setItem('receipt-court:agent-id', 'bc-4839cbb9-c086-4775-a6ad-de5788e299ea');
});
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(700);
const waitAI = async () => {
  const t0 = Date.now();
  await p.waitForFunction(() => document.getElementById('prosecution-src')?.textContent?.trim() === 'AI PROSECUTOR', null, { timeout: 200000 });
  return Math.round((Date.now() - t0) / 1000);
};
console.log('CASE 1:', await waitAI(), 's');
console.log((await p.locator('#prosecution-text').textContent()).slice(0, 260), '…\n');
await p.screenshot({ path: 'screenshots/07-ai-prosecutor.png' });
await p.click('#btn-fifth'); await p.waitForTimeout(2200);
await p.click('#btn-next'); await p.waitForTimeout(400);
console.log('CASE 2:', await waitAI(), 's');
console.log((await p.locator('#prosecution-text').textContent()).slice(0, 260), '…');
await b.close();
