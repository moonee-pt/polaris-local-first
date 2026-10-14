const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto("http://localhost:5175/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  const labels = await page.evaluate(() => Array.from(document.querySelectorAll("[aria-label]")).map((n) => n.getAttribute("aria-label")).filter(Boolean));
  console.log("LABELS:", JSON.stringify([...new Set(labels)]));
  await page.screenshot({ path: "work/diag-home.png" });
  await b.close();
})();