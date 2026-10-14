import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto('https://polaris-local-first-two.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('.app-shell', { timeout: 60000 });
await page.waitForTimeout(1200);
await page.locator('.world-switch-veil').first().click({ force: true });
await page.waitForSelector('.chat-composer textarea', { timeout: 40000 });
await page.waitForTimeout(600);
await page.getByLabel('新对话').first().click();
await page.waitForTimeout(1200);
console.log('shell:', await page.evaluate(() => document.querySelector('.app-shell')?.className));
const read = () => page.evaluate(() => ({
  label: document.querySelector('.chat-mode-button-label')?.textContent ?? null,
  notes: Array.from(document.querySelectorAll('.system-inline-note')).map((n) => n.textContent),
  switchCount: document.querySelectorAll('.chat-mode-switch').length
}));
console.log('a) fresh conversation:', JSON.stringify(await read()));
await page.locator('.chat-mode-button').click();
await page.waitForSelector('.chat-mode-menu', { timeout: 8000 });
console.log('   options:', JSON.stringify(await page.locator('.chat-mode-option').allTextContents()));
await page.locator('.chat-mode-option', { hasText: '音声' }).first().click();
await page.waitForTimeout(1000);
console.log('b) picked 音声:', JSON.stringify(await read()));
await b.close();
