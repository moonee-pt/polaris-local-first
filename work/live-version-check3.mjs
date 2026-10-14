import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const page = await b.newPage({ viewport: { width: 1366, height: 900 } });
await page.goto('https://polaris-local-first-two.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('.app-shell', { timeout: 60000 });
await page.waitForTimeout(1200);
await page.locator('text=全部角色').first().click().catch(() => {});
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll('[class*="collaborator-scope"]'));
  return {
    count: nodes.length,
    items: nodes.map((n) => ({ tag: n.tagName, cls: n.className, text: (n.textContent || '').slice(0, 120) })),
    versionLike: Array.from(document.querySelectorAll('p,span,div'))
      .filter((n) => n.children.length === 0 && /v?1\.\d+\.\d+/.test((n.textContent || '').trim()))
      .map((n) => (n.textContent || '').trim()).slice(0, 5)
  };
});
console.log(JSON.stringify(info, null, 1).slice(0, 2000));
await b.close();
