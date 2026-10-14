import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto('https://polaris-local-first-two.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('.app-shell', { timeout: 60000 });
await page.waitForTimeout(1200);
await page.locator('.world-switch-veil').first().tap();
await page.waitForSelector('.chat-composer textarea', { timeout: 40000 });
await page.waitForTimeout(500);
const newChat = page.getByLabel('新对话');
console.log('newChat count:', await newChat.count());
await newChat.first().tap();
await page.waitForTimeout(1000);
const read = () => page.evaluate(() => ({
  label: document.querySelector('.chat-mode-button-label')?.textContent ?? null,
  notes: Array.from(document.querySelectorAll('.system-inline-note')).map((n) => n.textContent)
}));
console.log('before:', JSON.stringify(await read()));
await page.locator('.chat-mode-button').tap();
await page.waitForTimeout(400);
console.log('menu open after tap:', await page.locator('.chat-mode-menu').count());
const opt = page.locator('.chat-mode-option', { hasText: '小说' }).first();
console.log('option count:', await opt.count());
await opt.tap();
await page.waitForTimeout(1000);
console.log('after tap novel:', JSON.stringify(await read()));
console.log('menu still open:', await page.locator('.chat-mode-menu').count());
console.log('errs:', JSON.stringify(errs.slice(0, 3)));
await b.close();
