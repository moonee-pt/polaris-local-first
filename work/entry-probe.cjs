const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  for (const vp of [{w:390,h:844,name:"m"},{w:1366,h:768,name:"d"}]) {
    const page = await b.newPage({ viewport: { width: vp.w, height: vp.h } });
    await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2200);
    await page.locator('[aria-label="新建对话"]').first().click().catch(()=>{});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `work/entry-${vp.name}.png` });
    const topBtn = await page.locator('header.topbar [aria-label="开始通话"]').count();
    const composerBtn = await page.locator('.composer-slot-btn-call').count();
    const composerVisible = composerBtn ? await page.locator('.composer-slot-btn-call').first().isVisible() : false;
    console.log(vp.name, "topbarCall:", topBtn, "composerCall:", composerBtn, "composerVisible:", composerVisible);
    // click topbar call if present
    if (topBtn) {
      await page.locator('header.topbar [aria-label="开始通话"]').first().click();
      await page.waitForTimeout(900);
      console.log(vp.name, "stageOpen:", await page.locator('.voice-call-stage').count());
      await page.screenshot({ path: `work/entry-${vp.name}-call.png` });
      await page.locator('[aria-label="挂断"]').first().click().catch(()=>{});
      await page.waitForTimeout(800);
    }
    await page.close();
  }
  await b.close();
})();
