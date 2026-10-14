const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ["--autoplay-policy=document-user-activation-required"] });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0,180)));
  await page.goto("http://localhost:5175/work/reading-snapshot.html?state=chain", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".chat-reading-stage", { timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.locator('[aria-label="\u64ad\u653e"]').first().click();
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(400);
    const snap = await page.evaluate(() => {
      const active = document.querySelector(".chat-reading-block.is-active");
      const blocks = Array.from(document.querySelectorAll(".chat-reading-block"));
      return { meta: (document.querySelector(".chat-reading-head-meta")||{}).textContent||"", activeIdx: active ? blocks.indexOf(active) : -1, notice: (document.querySelector(".chat-reading-notice")||{}).textContent||"", label: (document.querySelector(".chat-reading-control.is-primary")||{}).textContent||"" };
    });
    console.log((i*0.4).toFixed(1)+"s", JSON.stringify(snap));
  }
  console.log("ERR:", errs.slice(0,4));
  await b.close();
})();