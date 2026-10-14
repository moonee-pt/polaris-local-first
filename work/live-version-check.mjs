import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
await page.goto('https://polaris-local-first-two.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('.app-shell', { timeout: 60000 });
await page.waitForTimeout(1500);
const versions = await page.evaluate(() => (document.body.innerText.match(/1\.\d+\.\d+/g) || []));
console.log('version strings in DOM:', JSON.stringify([...new Set(versions)]));
const sw = page.getByLabel('切换到对话');
if (await sw.count()) { await sw.first().click(); await sw.first().click(); }
await page.waitForSelector('.chat-composer textarea', { timeout: 40000 });
await page.waitForTimeout(500);
console.log('chat-mode-switch count:', await page.locator('.chat-mode-switch').count());
console.log('button label:', await page.locator('.chat-mode-button-label').first().textContent());
await page.screenshot({ path: 'work/mode-shot/live-chat.png' });
await b.close();
