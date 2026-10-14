const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ["--autoplay-policy=document-user-activation-required", "--autoplay-policy=no-user-gesture-required"] });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = [];
  const sfx = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0,180)));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0,180)); });
  page.on("request", (r) => { const u = r.url(); if (u.includes("/sfx/flesh/")) sfx.push(u.split("/sfx/flesh/")[1]); });
  await page.goto("http://localhost:5175/work/reading-snapshot.html?state=chain", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".chat-reading-stage", { timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.locator('[aria-label="\u64ad\u653e"]').first().click();
  const seen = [];
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(400);
    const snap = await page.evaluate(() => {
      const active = document.querySelector(".chat-reading-block.is-active");
      const blocks = Array.from(document.querySelectorAll(".chat-reading-block"));
      return { at: active ? blocks.indexOf(active) : -1, label: (document.querySelector(".chat-reading-control.is-primary")||{}).textContent||"", notice: (document.querySelector(".chat-reading-notice")||{}).textContent||"" };
    });
    const v = snap.at + "/" + snap.label + (snap.notice ? "/" + snap.notice : "");
    if (i === 0 || v !== seen[seen.length-1]) seen.push(v);
  }
  console.log("TIMELINE:", seen.join("  |  "));
  console.log("SFX_REQUESTS:", [...new Set(sfx)].slice(0, 8).join(", ") || "NONE");
  console.log("ERRORS:", errs.slice(0, 5));
  await b.close();
})();