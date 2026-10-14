const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.goto("http://localhost:5175/", { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(3000);
  const all = await page.locator("button").evaluateAll((els) => els.map((e) => ({ c: e.getAttribute("class"), t: (e.textContent||"").trim().slice(0,10) , box: (()=>{const r=e.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)];})() })).filter(x => x.t !== null));
  console.log(JSON.stringify(all.slice(-14), null, 0));
  await b.close();
})();
