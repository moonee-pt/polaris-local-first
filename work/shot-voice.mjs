import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE-ERR:', m.text().slice(0, 200)); });
page.on('pageerror', (e) => console.log('PAGE-THROW:', String(e).slice(0, 200)));
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

async function click(name) {
  const sel = page.getByRole('button', { name }).or(page.getByText(name, { exact: true }));
  if (await sel.count() === 0) { console.log('MISSING:', name); return false; }
  await sel.first().click({ timeout: 4000 });
  await page.waitForTimeout(700);
  return true;
}

await page.locator('button.desktop-sidebar-settings').first().click();
await page.waitForTimeout(1200);
await click('语音');
await page.screenshot({ path: 'work/live-1-voice-page.png' });
console.log('TEXT:', await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 500)));

const rowsBefore = await page.locator('.voice-library-row').count();
await click('新增一条');
const rowsAfter = await page.locator('.voice-library-row').count();
const inputs = await page.locator('.voice-library-row input').count();
await page.screenshot({ path: 'work/live-2-after-add.png' });
console.log('ROWS before/after:', rowsBefore, rowsAfter, '| inputs:', inputs);

const idInput = page.locator('.voice-library-row input').last();
const nameInput = page.locator('.voice-library-row input').nth(await page.locator('.voice-library-row input').count() - 2);
try {
  await nameInput.fill('测试音色');
  await idInput.fill('test-voice-123');
  await idInput.blur();
} catch (e) { console.log('fill err', String(e).slice(0, 100)); }
await page.waitForTimeout(700);
console.log('after commit rows:', await page.locator('.voice-library-row').count());
await page.screenshot({ path: 'work/live-3-after-commit.png' });

// leave and come back: a committed row survives, a draft would not
await click('返回');
await click('语音');
console.log('rows after re-entering:', await page.locator('.voice-library-row').count());
await page.screenshot({ path: 'work/live-4-reentered.png' });

// reload the whole app: checks it actually hit persisted settings
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.locator('button.desktop-sidebar-settings').first().click();
await page.waitForTimeout(1200);
await click('语音');
console.log('rows after full reload:', await page.locator('.voice-library-row').count());
await page.screenshot({ path: 'work/live-5-reloaded.png' });

await browser.close();
