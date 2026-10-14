import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 200)));
await page.goto('https://polaris-local-first-two.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('.app-shell', { timeout: 60000 });
await page.waitForTimeout(1500);
console.log('shell:', await page.evaluate(() => document.querySelector('.app-shell')?.className));
const veil = page.locator('.world-switch-veil');
console.log('veil count:', await veil.count(), 'labels:', JSON.stringify(await veil.evaluateAll((n) => n.map((x) => x.getAttribute('aria-label')))));
const veilBox = await veil.first().boundingBox().catch(() => null);
console.log('veil box:', veilBox);
await veil.first().click({ force: true, timeout: 15000 }).catch((e) => console.log('veil click fail:', String(e).slice(0, 120)));
await page.waitForTimeout(1500);
console.log('after veil:', await page.evaluate(() => document.querySelector('.app-shell')?.className));
console.log('switch count:', await page.locator('.chat-mode-switch').count());
const btn = page.locator('.chat-mode-button');
if (await btn.count()) {
  console.log('btn visible:', await btn.first().isVisible(), 'box:', await btn.first().boundingBox());
  await btn.first().click({ timeout: 10000 }).catch((e) => console.log('btn click fail:', String(e).slice(0, 150)));
  await page.waitForTimeout(600);
  console.log('menu open:', await page.locator('.chat-mode-menu').count());
}
console.log('errors:', JSON.stringify(errs.slice(0, 6)));
await page.screenshot({ path: 'work/mode-shot/live-diag.png' });
await b.close();
