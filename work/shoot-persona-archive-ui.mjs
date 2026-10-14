import { chromium } from 'playwright-core';

const URL = 'http://localhost:5211/work/persona-archive-preview.html';

const browser = await chromium.launch({ headless: true });

async function shoot(width, height, name) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('pageerror', (err) => console.log(`[pageerror ${name}] ${String(err).slice(0, 200)}`));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: `work/ui-shot-${name}-1-collapsed.png` });

  await page.getByRole('button', { name: '查看原版' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `work/ui-shot-${name}-2-expanded.png` });

  await page.getByRole('button', { name: '还原原版' }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `work/ui-shot-${name}-3-armed.png` });

  await page.getByRole('button', { name: '确认还原' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `work/ui-shot-${name}-4-restored.png`, fullPage: true });

  const patch = await page.evaluate(() => document.querySelector('pre')?.textContent ?? '');
  console.log(`--- ${name} 还原后的改动 ---\n${patch}`);
  await context.close();
}

await shoot(420, 900, 'phone');
await shoot(1280, 900, 'desktop');
await browser.close();
