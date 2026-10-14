const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 420, height: 620 }, deviceScaleFactor: 3 });
  await page.goto("http://localhost:5175/work/top3-compare.html", { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(1500);
  const err = await page.locator("body").innerText();
  console.log("TEXT:", err.slice(0, 300));
  await page.screenshot({ path: "work/top3-compare.png", fullPage: true });
  await b.close();
})();
