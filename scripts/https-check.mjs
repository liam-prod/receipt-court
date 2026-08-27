import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const p = await b.newPage({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 2 });
const errs=[]; p.on('console',m=>m.type()==='error'&&errs.push(m.text().slice(0,120)));
await p.goto('https://liam-prod.github.io/receipt-court/', { waitUntil:'domcontentloaded' });
await p.evaluate(() => localStorage.setItem('receipt-court:ai-config', JSON.stringify({
  baseUrl:'http://localhost:8788', apiKey:'x', model:'gemini-3.7-flash',
  transport:'cursor-agent', enabled:true })));
await p.reload({ waitUntil:'domcontentloaded' });
await p.waitForTimeout(800);
const t0=Date.now();
try{
  await p.waitForFunction(()=>document.getElementById('prosecution-src')?.textContent?.trim()==='AI PROSECUTOR',null,{timeout:150000});
  console.log(`AI WORKS from HTTPS in ${Math.round((Date.now()-t0)/1000)}s`);
  console.log((await p.locator('#prosecution-text').textContent()).slice(0,200),'…');
  await p.screenshot({path:'screenshots/07-ai-prosecutor.png'});
}catch{ console.log('STILL BLOCKED:', await p.locator('#prosecution-src').textContent()); console.log(errs.slice(0,3).join('\n')); }
await b.close();
