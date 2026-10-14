import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 3 });
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

async function click(name) {
  const sel = page.getByRole('button', { name }).or(page.getByText(name, { exact: true }));
  await sel.first().click({ timeout: 4000 });
  await page.waitForTimeout(700);
}

await page.locator('button.desktop-sidebar-settings').first().click();
await page.waitForTimeout(1200);
await click('语音');
await click('新增一条');
// leave the draft half-filled so the empty state is visible
await page.locator('.voice-library-row input').first().fill('新声音');
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(700);
await page.screenshot({ path: 'work/mobile-1-draft.png' });

// commit it, then add a second draft to see persisted + draft together
await page.locator('.voice-library-row input').last().fill('fish-xiaoyu');
await page.locator('.voice-library-row input').last().blur();
await page.waitForTimeout(600);
await click('新增一条');
await page.waitForTimeout(400);
await page.locator('.voice-library-row').last().locator('input').first().fill('第二条');
await page.screenshot({ path: 'work/mobile-2-persisted-plus-draft.png' });

await browser.close();
