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
const read = () => page.evaluate(() => ({
  label: document.querySelector('.chat-mode-button-label')?.textContent ?? null,
  notes: Array.from(document.querySelectorAll('.system-inline-note')).map((n) => n.textContent)
}));
console.log('live 1) no conversation:', JSON.stringify(await read()));
await page.locator('.chat-mode-button').click();
await page.waitForSelector('.chat-mode-menu', { timeout: 8000 });
await page.locator('.chat-mode-option', { hasText: '小说' }).first().click();
await page.waitForTimeout(700);
console.log('live 2) after pick 小说 (no conversation):', JSON.stringify(await read()));
await page.getByLabel('新对话').first().click({ force: true });
await page.waitForTimeout(900);
console.log('live 3) after 新对话:', JSON.stringify(await read()));
await page.locator('.chat-mode-button').click();
await page.waitForTimeout(300);
await page.locator('.chat-mode-option', { hasText: '音声' }).first().click();
await page.waitForTimeout(800);
console.log('live 4) in conversation -> 音声:', JSON.stringify(await read()));
console.log('errors:', JSON.stringify(errs.slice(0, 4)));
await page.screenshot({ path: 'work/mode-shot/live-fixed.png' });
await b.close();
