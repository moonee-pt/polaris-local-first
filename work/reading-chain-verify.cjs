const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
async function run(query, label) {
  const b = await chromium.launch({ executablePath: EXE, args: ["--autoplay-policy=document-user-activation-required"] });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0,180)));
  await page.goto("http://localhost:5175/work/reading-snapshot.html?state=chain" + query, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".chat-reading-stage", { timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.locator('[aria-label="\u64ad\u653e"]').first().click();
  const seen = [];
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(400);
    const snap = await page.evaluate(() => {
      const active = document.querySelector(".chat-reading-block.is-active");
      const blocks = Array.from(document.querySelectorAll(".chat-reading-block"));
      return { meta: (document.querySelector(".chat-reading-head-meta")||{}).textContent||"", at: active ? blocks.indexOf(active) : -1, notice: (document.querySelector(".chat-reading-notice")||{}).textContent||"", label: (document.querySelector(".chat-reading-control.is-primary")||{}).textContent||"" };
    });
    seen.push(snap.at + "/" + snap.meta.replace(/\s+/g,"") + "/" + snap.label + (snap.notice ? "/" + snap.notice : ""));
  }
  const packed = seen.filter((v, i) => i === 0 || v !== seen[i-1]);
  console.log(label, "=>", packed.join("  |  "));
  console.log(label, "ERR:", errs.slice(0,3));
  await page.screenshot({ path: "work/reading-chain-" + label + ".png" });
  await b.close();
}
(async () => {
  await run("", "good");
  await run("&bad=1", "broken2nd");
})();