const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 300)));
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);

  await page.getByText("新建对话", { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "work/call-1-chat.png" });
  console.log("CALLBUTTON:", await page.locator('[aria-label="开始通话"]').count());

  await page.locator('[aria-label="开始通话"]').first().click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  const stageBox = await page.evaluate(() => {
    const el = document.querySelector(".voice-call-stage");
    if (!el) return null;
    return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, top: el.getBoundingClientRect().top };
  });
  console.log("STAGE:", JSON.stringify(stageBox));
  await page.waitForTimeout(3500);
  await page.screenshot({ path: "work/call-2-stage.png" });
  console.log("STAGE TEXT:\n" + (await page.evaluate(() => (document.querySelector(".voice-call-stage")?.innerText || "")).slice(0, 500)));

  await page.locator(".voice-call-input").fill("在吗");
  await page.waitForTimeout(300);
  await page.screenshot({ path: "work/call-3-typed.png" });
  await page.locator(".voice-call-send").click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "work/call-4-sent.png" });
  console.log("AFTER SEND:\n" + (await page.evaluate(() => (document.querySelector(".voice-call-stage")?.innerText || "")).slice(0, 600)));

  await page.locator('[aria-label="挂断"]').click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "work/call-5-after-hangup.png" });
  console.log("CHAT TEXT:\n" + (await page.evaluate(() => document.body.innerText)).slice(0, 1200));
  await b.close();
})();
