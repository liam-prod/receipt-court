import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const p = await b.newPage({ viewport:{width:1600,height:1050}, deviceScaleFactor:2 });
p.on('console',m=>m.type()==='error'&&console.log('ERR:',m.text().slice(0,110)));
await p.goto('http://localhost:8899/', { waitUntil:'domcontentloaded' });
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('receipt-court:ai-config', JSON.stringify({
  baseUrl:'http://localhost:8788', apiKey:'x', model:'gemini-3.7-flash',
  transport:'cursor-agent', enabled:true })); });
await p.reload({ waitUntil:'domcontentloaded' });
await p.waitForTimeout(900);
const t0=Date.now();
await p.waitForFunction(()=>document.getElementById('prosecution-src')?.textContent?.trim()==='AI PROSECUTOR',null,{timeout:170000});
console.log(`✓ AI WORKS locally in ${Math.round((Date.now()-t0)/1000)}s`);
console.log((await p.locator('#prosecution-text').textContent()).slice(0,240),'…');
await p.screenshot({path:'screenshots/07-ai-prosecutor.png'});
await b.close();
