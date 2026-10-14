const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  for (const vp of [{w:1366,h:768},{w:390,h:844}]) {
    const page = await b.newPage({ viewport: { width: vp.w, height: vp.h } });
    await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.locator('[aria-label="新建对话"]').first().click().catch(()=>{});
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    console.log(vp.w+"x"+vp.h, JSON.stringify(r), r.sh<=r.ch && r.sw<=r.cw ? "OK" : "OVERFLOW");
    await page.close();
  }
  await b.close();
})();
