const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  const nc = page.locator('[aria-label="新建对话"]').first();
  if (await nc.count()) { await nc.click().catch(e=>console.log("err",e.message)); await page.waitForTimeout(2000); }
  await page.screenshot({ path: "work/d-chat.png" });
  console.log("TOPBAR:", await page.locator("header.topbar").count());
  console.log("SHELL CLASS:", await page.locator("main.app-shell").getAttribute("class"));
  console.log("PHONE BTN:", await page.locator('[aria-label="开始通话"]').count());
  await b.close();
})();
