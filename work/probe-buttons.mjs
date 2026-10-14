import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE-ERR:', m.text().slice(0, 200)); });
page.on('pageerror', (e) => console.log('PAGE-THROW:', String(e).slice(0, 200)));
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

await page.locator('button.desktop-sidebar-settings').first().click();
await page.waitForTimeout(2500);
console.log('sheets:', await page.locator('.settings-sheet, .menu-sheet').count());
await page.screenshot({ path: 'work/probe-settings.png' });
console.log('TEXT:', await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 400)));

await browser.close();
