const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on("console", m => { if (m.type()==="error") errs.push(m.text()); });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 }).catch(e=>errs.push("goto:"+e.message));
  await page.waitForTimeout(3500);
  await page.screenshot({ path: "work/shot-landing.png" });
  console.log("URL:", page.url());
  console.log("TITLE:", await page.title());
  console.log("TEXT:\n", (await page.evaluate(()=>document.body.innerText)).slice(0,700));
  console.log("ERRS:", errs.slice(0,5));
  await browser.close();
})();
