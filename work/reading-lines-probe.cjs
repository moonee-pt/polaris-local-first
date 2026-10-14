const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ["--autoplay-policy=no-user-gesture-required"] });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0,200)));
  await page.goto("http://localhost:5175/work/reading-snapshot.html?state=chain", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".chat-reading-stage", { timeout: 20000 });
  await page.waitForTimeout(1200);
  const lines = await page.evaluate(() => Array.from(document.querySelectorAll(".chat-reading-block")).map((bl) => Array.from(bl.querySelectorAll(".chat-reading-line")).map((l) => l.className.replace("chat-reading-line", "").trim() + ":" + l.textContent)));
  console.log("LINES:", JSON.stringify(lines, null, 0));
  await page.locator('[aria-label="\u64ad\u653e"]').first().click();
  const seen = [];
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(250);
    const snap = await page.evaluate(() => {
      const active = document.querySelector(".chat-reading-block.is-active");
      if (!active) return "none";
      const ls = Array.from(active.querySelectorAll(".chat-reading-line"));
      const idx = ls.findIndex((l) => l.className.includes("is-active"));
      return idx + ":" + (idx >= 0 ? ls[idx].textContent : "");
    });
    if (i === 0 || snap !== seen[seen.length-1]) seen.push(snap);
  }
  console.log("ACTIVE_LINE_TIMELINE:", seen.join("  |  "));
  console.log("ERRORS:", errs.slice(0,4));
  await page.screenshot({ path: "work/reading-lines.png" });
  await b.close();
})();