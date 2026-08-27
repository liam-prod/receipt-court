import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const p = await b.newPage({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 2 });
p.on('pageerror', e => console.error('PAGEERROR:', e.message));
p.on('console', m => m.type()==='error' && console.error('CONSOLE:', m.text()));
await p.goto('http://localhost:8899/?demo=1', { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(1000);

await p.click('#btn-defender');
await p.waitForTimeout(900);
console.log('credit:', await p.locator('#counsel-credit').textContent());
await p.waitForTimeout(3500);
console.log('plea typed:', JSON.stringify(await p.locator('#plea-input').inputValue()));
await p.waitForTimeout(1500);
console.log('objections:', await p.locator('.objection').count());
console.log('verdict:', await p.locator('#verdict-stamp').textContent());
await p.locator('#phase-defence').scrollIntoViewIfNeeded();
await p.waitForTimeout(600);
await p.screenshot({ path: 'screenshots/03-public-defender.png' });

// sample a few generated pleas across categories
const samples = await p.evaluate(async () => {
  const out = [];
  for (const id of ['#btn-next']) {}
  return out;
});
await b.close();
console.log('ok');
