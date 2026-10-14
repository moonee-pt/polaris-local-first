const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
const URL = "https://polaris-local-first-two.vercel.app/";
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const log = [];
  page.on("console", m => { if (/sync|pull|push/i.test(m.text())) log.push("CONSOLE " + m.text()); });
  page.on("response", r => { if (r.url().includes("/api/sync")) log.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().replace(URL,'')}`); });
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(12000);
  const state = await page.evaluate(async () => {
    const cache = window.localStorage.getItem("polaris-cloud-sync-hashes-v1");
    const last = window.localStorage.getItem("polaris-cloud-last-sync-at-v1");
    let parsed = null; try { parsed = cache ? JSON.parse(cache) : null; } catch {}
    const counts = parsed ? Object.fromEntries(Object.entries(parsed).map(([k,v]) => [k, Object.keys(v).length])) : null;
    const idb = await new Promise((resolve) => {
      const req = indexedDB.open("polaris-db");
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("kv", "readonly");
        const store = tx.objectStore("kv");
        const keys = store.getAllKeys();
        keys.onsuccess = () => resolve(keys.result);
        keys.onerror = () => resolve("err");
      };
      req.onerror = () => resolve("open-err");
    });
    return { counts, lastSyncAt: last, kvKeys: idb };
  });
  console.log("SYNC-CACHE", JSON.stringify(state.counts));
  console.log("LAST-SYNC", state.lastSyncAt ? new Date(Number(state.lastSyncAt)).toISOString() : null);
  console.log("KV-KEYS", JSON.stringify(state.kvKeys));
  console.log("LOG", JSON.stringify(log, null, 1));
  await page.screenshot({ path: "work/fresh-device-restore.png" });
  await b.close();
})();
