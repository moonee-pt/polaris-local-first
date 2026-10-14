import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await page.goto('https://polaris-local-first-two.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('.app-shell', { timeout: 60000 });
await page.waitForTimeout(1200);
await page.locator('.world-switch-veil').first().click({ force: true });
await page.waitForSelector('.chat-composer textarea', { timeout: 40000 });
await page.waitForTimeout(600);
const state = () => page.evaluate(() => ({
  label: document.querySelector('.chat-mode-button-label')?.textContent ?? null,
  notes: Array.from(document.querySelectorAll('.system-inline-note')).map((n) => n.textContent),
  sidebarChats: Array.from(document.querySelectorAll('[class*="conversation"]')).length
}));
console.log('before:', JSON.stringify(await state()));
await page.locator('.chat-mode-button').click();
await page.waitForSelector('.chat-mode-menu', { timeout: 8000 });
console.log('menu opened: true');
await page.locator('.chat-mode-option', { hasText: '小说' }).first().click();
await page.waitForTimeout(1200);
console.log('after pick novel:', JSON.stringify(await state()));
console.log('errors:', JSON.stringify(errs.slice(0, 5)));
await page.screenshot({ path: 'work/mode-shot/live-no-conv.png' });
await b.close();
