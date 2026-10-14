const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "work/top-probe-1.png" });
  const topbar = await page.locator("header.topbar").first();
  console.log("TOPBAR COUNT:", await page.locator("header.topbar").count());
  if (await topbar.count()) {
    await topbar.screenshot({ path: "work/top-probe-bar.png" });
    console.log("MAIN HTML:", (await topbar.locator(".topbar-main").innerHTML()).slice(0, 1500));
  }
  await b.close();
})();
