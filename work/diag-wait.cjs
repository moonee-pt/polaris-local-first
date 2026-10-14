const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  page.on("pageerror", (e) => console.log("PERR:", e.message.slice(0,160)));
  await page.goto("http://localhost:5175/", { waitUntil: "networkidle", timeout: 60000 });
  for (const t of [3000, 3000, 4000, 5000]) {
    await page.waitForTimeout(t);
    const st = await page.evaluate(() => {
      const fab = document.querySelector('[aria-label="\u65b0\u5efa\u5bf9\u8bdd"]');
      return { dis: fab ? fab.disabled : "none", txt: document.body.innerText.replace(/\s+/g," ").slice(0,160) };
    });
    console.log(JSON.stringify(st));
  }
  await b.close();
})();