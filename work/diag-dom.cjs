const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  page.on("pageerror", (e) => console.log("PERR:", e.message.slice(0,140)));
  await page.goto("http://localhost:5175/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { document.querySelector('[aria-label="\u65b0\u5efa\u5bf9\u8bdd"]')?.click(); });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "work/diag-after-dom.png" });
  console.log("DOCK:", await page.locator(".chat-dock").count(), "ENTRY:", await page.locator(".chat-reading-entry").count());
  console.log("LOOK:", await page.evaluate(() => (document.body.innerText || "").replace(/\s+/g," ").slice(0, 300)));
  await b.close();
})();