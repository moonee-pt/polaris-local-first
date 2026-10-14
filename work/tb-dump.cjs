const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2200);
  await page.locator('[aria-label="新建对话"]').first().click().catch(()=>{});
  await page.waitForTimeout(1800);
  const html = await page.locator("header.topbar").first().innerHTML();
  console.log(html.replace(/<svg[\s\S]*?<\/svg>/g,"[svg]"));
  console.log("---actions box---");
  console.log(JSON.stringify(await page.locator("header.topbar .topbar-actions").first().boundingBox()));
  console.log("---brand box---");
  console.log(JSON.stringify(await page.locator("header.topbar .world-anchor").first().boundingBox()));
  await b.close();
})();
