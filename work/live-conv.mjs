import { chromium } from 'playwright';

async function run(label, ctxOpts) {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 200)));
  await page.goto('https://polaris-local-first-two.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('.app-shell', { timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.locator('.world-switch-veil').first().click({ force: true });
  await page.waitForSelector('.chat-composer textarea', { timeout: 40000 });
  await page.waitForTimeout(500);
  const newChat = page.getByLabel('新对话');
  if (await newChat.count()) { await newChat.first().click({ force: true }); await page.waitForTimeout(900); }
  const read = () => page.evaluate(() => ({
    label: document.querySelector('.chat-mode-button-label')?.textContent ?? null,
    notes: Array.from(document.querySelectorAll('.system-inline-note')).map((n) => n.textContent)
  }));
  console.log(label, 'before:', JSON.stringify(await read()));
  await page.locator('.chat-mode-button').click();
  await page.waitForTimeout(400);
  const menuBox = await page.locator('.chat-mode-menu').boundingBox().catch(() => null);
  console.log(label, 'menuBox:', JSON.stringify(menuBox), 'inViewport:', menuBox ? (menuBox.y >= 0 && menuBox.y + menuBox.height <= (ctxOpts.viewport.height + 1)) : 'n/a');
  await page.locator('.chat-mode-option', { hasText: '小说' }).first().click();
  await page.waitForTimeout(900);
  console.log(label, 'after:', JSON.stringify(await read()));
  console.log(label, 'errors:', JSON.stringify(errs.slice(0, 3)));
  await page.screenshot({ path: 'work/mode-shot/' + label + '.png' });
  await b.close();
}

await run('live-desktop-conv', { viewport: { width: 1366, height: 768 } });
await run('live-phone-conv', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
