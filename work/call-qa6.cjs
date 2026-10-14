const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.locator('[aria-label="新建对话"]').first().click({ timeout: 5000 });
  await page.waitForTimeout(2000);
  await page.locator('[aria-label="开始通话"]').first().click({ timeout: 5000 });
  await page.waitForTimeout(1200);
  await page.locator(".voice-call-input").fill("在吗，今天有点累");
  await page.locator(".voice-call-send").click();
  await page.waitForTimeout(5000);
  await page.screenshot({ path: "work/call-7-replied.png" });
  await page.locator('[aria-label="挂断"]').click();
  await page.waitForTimeout(2500);
  const card = page.locator(".voice-call-record").first();
  console.log("CARDS:", await card.count());
  if (await card.count() > 0) {
    await card.screenshot({ path: "work/call-desk-card.png" });
    await card.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: "work/call-desk-sheet.png" });
  }
  await b.close();
})();
