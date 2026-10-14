import { chromium } from 'playwright-core';

const APP_URL = 'http://localhost:5211/';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await context.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    console.log(`[console.${msg.type()}] ${msg.text().slice(0, 200)}`);
  }
});
page.on('pageerror', (err) => console.log(`[pageerror] ${String(err).slice(0, 300)}`));

await page.goto(APP_URL, { waitUntil: 'load' });
await page.waitForTimeout(9000);

const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1200));
console.log('--- body text ---');
console.log(bodyText);

const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => `${d.name}@${d.version}`));
console.log('--- databases ---', JSON.stringify(dbs));

await page.screenshot({ path: 'work/ui-shot-landing.png', fullPage: false });
console.log('--- saved work/ui-shot-landing.png ---');

await browser.close();
