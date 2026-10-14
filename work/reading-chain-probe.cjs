const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ["--autoplay-policy=no-user-gesture-required"] });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = [];
  page.on("console", (m) => { const t = m.text(); if (/error/i.test(t)) errs.push(t.slice(0,180)); });
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0,180)));
  await page.goto("http://localhost:5175/work/reading-snapshot.html?state=chain", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".chat-reading-stage", { timeout: 20000 });
  await page.waitForTimeout(1200);
  console.log("BLOCKS:", await page.locator(".chat-reading-block").count());
  await page.locator('[aria-label="\u64ad\u653e"]').first().click();
  const timeline = [];
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(400);
    const snap = await page.evaluate(() => {
      const active = document.querySelector(".chat-reading-block.is-active");
      const blocks = Array.from(document.querySelectorAll(".chat-reading-block"));
      return {
        meta: (document.querySelector(".chat-reading-head-meta")||{}).textContent || "",
        activeIdx: active ? blocks.indexOf(active) : -1,
        activeText: active ? active.textContent.slice(0, 10) : "",
        notice: (document.querySelector(".chat-reading-notice")||{}).textContent || "",
        playLabel: (document.querySelector(".chat-reading-control.is-primary")||{}).textContent || ""
      };
    });
    timeline.push(i * 0.4 + "s " + JSON.stringify(snap));
  }
  console.log(timeline.join("\n"));
  console.log("ERRORS:", errs.slice(0, 6));
  await b.close();
})();