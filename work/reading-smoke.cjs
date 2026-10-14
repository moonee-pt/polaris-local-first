const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0, 160)));
  await page.goto("http://localhost:5175/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.locator('[aria-label="\u65b0\u5efa\u5bf9\u8bdd"]').first().click().catch(() => {});
  await page.waitForTimeout(1500);
  const entry = page.locator('[aria-label="\u5f53\u5c0f\u8bf4\u8bfb"]').first();
  console.log("ENTRY_VISIBLE:", await entry.isVisible().catch(() => "err"));
  await entry.click().catch((e) => console.log("CLICK_ERR:", String(e).slice(0, 120)));
  await page.waitForTimeout(900);
  console.log("STAGE:", await page.locator(".chat-reading-stage").count());
  console.log("EMPTY:", await page.locator(".chat-reading-empty").textContent().catch(() => "none"));
  console.log("META:", await page.locator(".chat-reading-head-meta").textContent().catch(() => "none"));
  const dis = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    return {
      prev: q('.chat-reading-stage [aria-label="\u4e0a\u4e00\u6bb5"]')?.disabled,
      play: q('.chat-reading-stage [aria-label="\u64ad\u653e"]')?.disabled,
      next: q('.chat-reading-stage [aria-label="\u4e0b\u4e00\u6bb5"]')?.disabled,
      close: q('.chat-reading-stage [aria-label="\u5173\u95ed"]')?.disabled
    };
  });
  console.log("DISABLED:", JSON.stringify(dis));
  const r = await page.evaluate(() => ({
    sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight,
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth
  }));
  console.log("OVERFLOW:", JSON.stringify(r), (r.sh <= r.ch && r.sw <= r.cw) ? "OK" : "OVERFLOW");
  await page.screenshot({ path: "work/reading-1366.png" });
  await page.locator('.chat-reading-stage [aria-label="\u5173\u95ed"]').click().catch(() => {});
  await page.waitForTimeout(400);
  console.log("CLOSED:", (await page.locator(".chat-reading-stage").count()) === 0);
  console.log("ERRORS:", errs.slice(0, 6));
  await b.close();
})();
