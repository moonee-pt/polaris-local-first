import { chromium } from 'playwright-core';

const URL = 'http://localhost:5211/work/persona-card-preview.html';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
await page.goto(URL, { waitUntil: 'load' });

const settle = async (label) => {
  await page.waitForSelector(`.tool-event:not(.appearing)`, { timeout: 5000 });
  await page.waitForTimeout(700);
  await page.locator('.tool-event').first().screenshot({ path: `work/ui-shot-card-${label}.png` });
};

await settle('1-preview');
await page.getByRole('button', { name: '应用' }).click();
await settle('2-applied');
await page.locator('.tool-event-toggle').first().click();
await settle('2b-applied-expanded');
await page.getByRole('button', { name: '已取消' }).click();
await settle('3-rollback');
await page.locator('.tool-event-toggle').first().click();
await settle('3b-rollback-expanded');

await browser.close();
console.log('done');
