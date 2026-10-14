const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  page.on("pageerror", (e) => console.log("PERR:", e.message.slice(0,160)));
  await page.goto("http://localhost:5175/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  console.log("FAB_DISABLED:", await page.evaluate(() => {
    const el = document.querySelector('[aria-label="\u65b0\u5efa\u5bf9\u8bdd"]');
    return el ? { disabled: el.disabled, aria: el.getAttribute("aria-expanded"), cls: el.className } : "none";
  }));
  console.log("PERSONAS:", await page.evaluate(() => {
    const t = document.body.innerText;
    return t.replace(/\s+/g," ").slice(0,200);
  }));
  await b.close();
})();