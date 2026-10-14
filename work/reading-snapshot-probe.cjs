const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
const base = "http://localhost:5175/work/reading-snapshot.html";
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  for (const state of ["full", "empty", "entry"]) {
    const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
    const errs = [];
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0,160)); });
    page.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0,160)));
    await page.goto(base + "?state=" + state, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => ({
      sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight,
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth
    }));
    const info = await page.evaluate(() => {
      const stage = document.querySelector(".chat-reading-stage");
      const scroll = document.querySelector(".chat-reading-scroll");
      return {
        stage: !!stage,
        blocks: document.querySelectorAll(".chat-reading-block").length,
        segments: document.querySelectorAll(".chat-reading-seg").length,
        empty: (document.querySelector(".chat-reading-empty")||{}).textContent || null,
        meta: (document.querySelector(".chat-reading-head-meta")||{}).textContent || null,
        entry: !!document.querySelector(".chat-reading-entry"),
        controls: Array.from(document.querySelectorAll(".chat-reading-control")).map((b) => (b.getAttribute("aria-label")||"") + (b.disabled ? ":off" : ":on")),
        scrollOverflow: scroll ? scroll.scrollHeight > scroll.clientHeight : null
      };
    });
    console.log(state, "OVERFLOW:", (r.sh <= r.ch && r.sw <= r.cw) ? "OK" : "BAD " + JSON.stringify(r));
    console.log(state, "INFO:", JSON.stringify(info));
    console.log(state, "ERRORS:", errs.slice(0,4));
    await page.screenshot({ path: "work/reading-snapshot-" + state + ".png" });
    await page.close();
  }
  await b.close();
})();