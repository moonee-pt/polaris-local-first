const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  const nc = page.locator('[aria-label="新建对话"]').first();
  console.log("NEWCHAT:", await nc.count());
  if (await nc.count()) { await nc.click().catch(e=>console.log("click err", e.message)); await page.waitForTimeout(2000); }
  await page.screenshot({ path: "work/m-chat2.png" });
  console.log("TOPBAR HTML:", (await page.locator("header.topbar .topbar-main").first().innerHTML().catch(()=>"none")).replace(/<svg[\s\S]*?<\/svg>/g,"[svg]").slice(0,2000));
  console.log("ACTIONS:", await page.locator("header.topbar .topbar-actions button").count());
  await b.close();
})();
