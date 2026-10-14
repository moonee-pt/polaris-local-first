import { chromium } from 'playwright-core';

const APP_URL = 'http://localhost:5211/';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await context.newPage();
await page.goto(APP_URL, { waitUntil: 'load' });
await page.waitForTimeout(9000);

const dump = await page.evaluate(async () => {
  const result = [];
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('polaris-db');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  for (const storeName of Array.from(db.objectStoreNames)) {
    const rows = await new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve([]);
    });
    const keys = await new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAllKeys(50);
      req.onsuccess = () => resolve(req.result.map(String));
      req.onerror = () => resolve([]);
    });
    result.push({
      storeName,
      count: rows.length,
      keys,
      sample: JSON.stringify(rows[0] ?? null).slice(0, 400)
    });
  }
  db.close();
  return result;
});

console.log(JSON.stringify(dump, null, 2).slice(0, 6000));
await browser.close();
