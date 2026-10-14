const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(3000);
  console.log("BODY:\n" + (await page.evaluate(() => document.body.innerText)).slice(0, 1200));
  console.log("CALLBUTTON:", await page.locator('[aria-label="开始通话"]').count());
  await page.screenshot({ path: "work/call-base.png" });
  await b.close();
})();
