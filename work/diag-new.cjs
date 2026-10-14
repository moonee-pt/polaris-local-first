const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  page.on("pageerror", (e) => console.log("PERR:", e.message.slice(0,140)));
  await page.goto("http://localhost:5175/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  const n = await page.locator('[aria-label="\u65b0\u5efa\u5bf9\u8bdd"]').count();
  console.log("NEW_CONV_BTNS:", n);
  for (let i = 0; i < n; i++) {
    const el = page.locator('[aria-label="\u65b0\u5efa\u5bf9\u8bdd"]').nth(i);
    console.log("  btn", i, "visible:", await el.isVisible(), "box:", JSON.stringify(await el.boundingBox()));
  }
  await page.locator('[aria-label="\u65b0\u5efa\u5bf9\u8bdd"]').first().click().catch((e)=>console.log("E1",String(e).slice(0,80)));
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "work/diag-after-new.png" });
  console.log("DOCK:", await page.locator(".chat-dock").count(), "READING_ENTRY:", await page.locator(".chat-reading-entry").count());
  console.log("LOOK:", await page.evaluate(() => (document.body.innerText || "").replace(/\s+/g," ").slice(0, 400)));
  await b.close();
})();