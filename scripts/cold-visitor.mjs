// Simulates exactly what the AI evaluator sees: bare URL, fresh browser,
// no proxy, no API key, no query params.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const ctx = await b.newContext({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => m.type()==='error' && errs.push('CONSOLE ' + m.text().slice(0,110)));
p.on('dialog', d => d.accept());

const t0 = Date.now();
await p.goto('https://liam-prod.github.io/receipt-court/', { waitUntil: 'load' });
await p.waitForTimeout(1500);
console.log(`load: ${Date.now()-t0}ms`);
console.log('docket seeded:', await p.locator('.docket-item').count(), 'cases');
console.log('case open:', (await p.locator('#case-title').textContent() || '').trim());
console.log('exhibits:', await p.locator('.exhibit').count());
console.log('indictment len:', (await p.locator('#prosecution-text').textContent() || '').length);
console.log('src label:', (await p.locator('#prosecution-src').textContent() || '').trim());

// full loop, no AI configured
await p.fill('#plea-input', 'It was on sale and I deserved it, everyone else was ordering too.');
await p.click('#btn-plead');
await p.waitForTimeout(3200);
console.log('objections:', await p.locator('.objection').count(), '| verdict:', await p.locator('#verdict-stamp').textContent());

// public defender on the next case
await p.click('#btn-next'); await p.waitForTimeout(600);
await p.click('#btn-defender'); await p.waitForTimeout(5200);
console.log('defender verdict:', await p.locator('#verdict-stamp').textContent());

// mass sentencing -> charts
await p.click('#btn-tryall'); await p.waitForTimeout(6000);
console.log('record visible:', await p.locator('#record-section').isVisible());
console.log('convictions:', await p.locator('#stat-convictions').textContent());
await p.screenshot({ path: 'screenshots/10-cold-visitor.png' });
console.log(errs.length ? 'ERRORS:\n' + errs.slice(0,5).join('\n') : '✓ no errors on the cold path');
await b.close();
