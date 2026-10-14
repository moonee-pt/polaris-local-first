const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "work/m-landing.png" });
  const room = page.getByText("群聊", { exact: true }).first();
  if (await room.count()) { await room.click({ timeout: 5000 }).catch(()=>{}); await page.waitForTimeout(2000); }
  await page.screenshot({ path: "work/m-chat.png" });
  console.log("TOPBAR:", await page.locator("header.topbar").count());
  console.log("MAIN:", (await page.locator(".topbar-main").first().innerHTML().catch(()=> "none")).slice(0,1200));
  await b.close();
})();
