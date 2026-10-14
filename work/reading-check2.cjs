const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0,160)));
  await page.goto("http://localhost:5175/work/reading-snapshot.html", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const text = document.querySelector(".chat-reading-text");
    const cs = getComputedStyle(text);
    return {
      font: cs.fontSize, ws: cs.whiteSpace, lh: cs.lineHeight,
      hasNewline: text.textContent.includes("\n"),
      stageSize: getComputedStyle(document.querySelector(".chat-reading-seg.is-stage")).fontSize,
      segs: Array.from(document.querySelectorAll(".chat-reading-seg")).map((n) => n.className + "|" + n.textContent.slice(0,14))
    };
  });
  console.log(JSON.stringify(info, null, 0).slice(0, 1400));
  const r = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  console.log("OVERFLOW:", (r.sh <= r.ch && r.sw <= r.cw) ? "OK" : "BAD " + JSON.stringify(r));
  console.log("ERRORS:", errs.slice(0,4));
  await page.screenshot({ path: "work/reading-snapshot-full.png" });
  await b.close();
})();