const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 300)));
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);

  await page.locator('[aria-label="新建对话"]').first().click({ timeout: 5000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "work/call-1-chat.png" });
  console.log("CALLBUTTON:", await page.locator('[aria-label="开始通话"]').count());
  if (await page.locator('[aria-label="开始通话"]').count() === 0) {
    console.log("NAV BODY:\n" + (await page.evaluate(() => document.body.innerText)).slice(0, 800));
    await b.close();
    return;
  }

  await page.locator('[aria-label="开始通话"]').first().click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  const stageBox = await page.evaluate(() => {
    const el = document.querySelector(".voice-call-stage");
    if (!el) return null;
    return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
  });
  console.log("STAGE BOX:", JSON.stringify(stageBox));
  await page.waitForTimeout(3500);
  await page.screenshot({ path: "work/call-2-stage.png" });
  console.log("STAGE TEXT:\n" + (await page.evaluate(() => (document.querySelector(".voice-call-stage")?.innerText || "")).slice(0, 500)));

  await page.locator(".voice-call-input").fill("在吗");
  await page.waitForTimeout(300);
  await page.screenshot({ path: "work/call-3-typed.png" });
  await page.locator(".voice-call-send").click();
  await page.waitForTimeout(5000);
  await page.screenshot({ path: "work/call-4-sent.png" });
  console.log("AFTER SEND:\n" + (await page.evaluate(() => (document.querySelector(".voice-call-stage")?.innerText || "")).slice(0, 600)));

  await page.locator('[aria-label="挂断"]').click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "work/call-5-after-hangup.png" });
  console.log("CHAT TEXT:\n" + (await page.evaluate(() => document.body.innerText)).slice(0, 1500));
  const cardCount = await page.locator(".voice-call-record").count();
  console.log("CALL RECORD CARDS:", cardCount);
  if (cardCount > 0) {
    await page.locator(".voice-call-record").first().click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: "work/call-6-sheet.png" });
    console.log("SHEET TEXT:\n" + (await page.evaluate(() => (document.querySelector(".voice-call-record-sheet")?.innerText || "")).slice(0, 600)));
  }
  await b.close();
})();
