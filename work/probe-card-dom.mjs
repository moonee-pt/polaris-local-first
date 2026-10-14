import { chromium } from 'playwright-core';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
await page.goto('http://localhost:5211/work/persona-card-preview.html', { waitUntil: 'load' });
await page.waitForTimeout(1500);

const rafTicks = await page.evaluate(() => new Promise((resolve) => {
  let n = 0;
  const tick = () => { n += 1; if (n < 5) window.requestAnimationFrame(tick); else resolve(n); };
  window.requestAnimationFrame(tick);
  setTimeout(() => resolve(`stalled at ${n}`), 2000);
}));

const cls = await page.evaluate(() => document.querySelector('.tool-event')?.className ?? 'missing');
console.log(JSON.stringify({ rafTicks, cls }));
await browser.close();
