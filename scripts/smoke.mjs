import { chromium } from 'playwright-core';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const b = await chromium.launch({ executablePath: CHROME });
const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => m.type() === 'error' && !m.text().includes('Failed to load resource') && errs.push('CONSOLE ' + m.text()));

// Live deployed build, not local
await p.goto('https://liam-prod.github.io/receipt-court/?demo=1', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
console.log('cases rendered:', await p.locator('.docket-item').count());
console.log('exhibits rendered:', await p.locator('.exhibit').count());

// AI modal opens (this is the click that the hidden-attr bug used to eat)
await p.click('#btn-ai');
await p.waitForTimeout(300);
console.log('modal visible:', await p.locator('#ai-modal .modal').isVisible());

// Error path: bad credentials must fail loudly but not break the court
await p.fill('#cfg-base', 'https://api.cursor.com/v0');
await p.fill('#cfg-key', 'sk-invalid-test-key');
await p.click('#cfg-test');
await p.waitForTimeout(6000);
console.log('status text:', (await p.locator('#cfg-status').textContent()).slice(0, 70));
await p.click('#cfg-close');

// Court still works after a failed AI attempt
await p.fill('#plea-input', 'It broke and I needed it for work.');
await p.click('#btn-plead');
await p.waitForTimeout(1800);
console.log('verdict:', await p.locator('#verdict-stamp').textContent());
console.log('objections:', await p.locator('.objection').count());

// Mobile layout
await p.setViewportSize({ width: 420, height: 900 });
await p.waitForTimeout(600);
await p.screenshot({ path: 'screenshots/06-mobile.png' });
console.log('mobile shot ok');

console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
await b.close();
