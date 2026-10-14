const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.goto("http://localhost:5175/", { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(3500);
  const btns = page.locator("header.topbar .topbar-actions .action-btn");
  const n = await btns.count();
  console.log("BTN COUNT:", n);
  for (let i = 0; i < n; i++) {
    const info = await btns.nth(i).evaluate((el) => {
      const r = el.getBoundingClientRect();
      const svg = el.querySelector("svg");
      const sr = svg ? svg.getBoundingClientRect() : null;
      return { cls: el.getAttribute("class"), box: [r.x.toFixed(1), r.y.toFixed(1), r.width.toFixed(1), r.height.toFixed(1)], svgBox: sr ? [sr.x.toFixed(1), sr.y.toFixed(1), sr.width.toFixed(1), sr.height.toFixed(1)] : null };
    });
    console.log(i, JSON.stringify(info));
  }
  const bar = page.locator("header.topbar .topbar-actions").first();
  if (await bar.count()) { await bar.screenshot({ path: "work/top3-bar.png" }); console.log("bar shot ok"); }
  await page.screenshot({ path: "work/top3-full.png" });
  await b.close();
})();
