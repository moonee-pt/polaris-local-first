import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const page = await b.newPage({ viewport: { width: 1366, height: 900 } });
await page.goto('https://polaris-local-first-two.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('.app-shell', { timeout: 60000 });
await page.locator('text=全部角色').first().click().catch(() => {});
await page.waitForTimeout(2000);
const info = await page.evaluate(() => {
  const el = document.querySelector('.collaborator-scope-drawer-version');
  const matches = Array.from(document.querySelectorAll('*'))
    .filter((n) => n.children.length === 0 && /^v?1\.\d+\.\d+$/.test((n.textContent || '').trim()))
    .map((n) => ({ tag: n.tagName, cls: n.className, text: (n.textContent || '').trim() }));
  return { versionEl: el ? el.textContent : null, matches };
});
console.log('versionEl:', info.versionEl);
console.log('matches:', JSON.stringify(info.matches));
await page.screenshot({ path: 'work/mode-shot/live-drawer.png', fullPage: true });
await b.close();
