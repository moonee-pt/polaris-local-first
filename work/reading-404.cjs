const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  page.on("response", (r) => { if (r.status() >= 400) console.log("HTTP", r.status(), r.url()); });
  await page.goto("http://localhost:5175/work/reading-snapshot.html", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await b.close();
})();