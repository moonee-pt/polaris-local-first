const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text().slice(0, 200)); });
  await page.goto("http://127.0.0.1:5174/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(4000);
  console.log("TITLE:", await page.title());
  const labels = await page.evaluate(() => Array.from(document.querySelectorAll("[aria-label]")).map((el) => el.getAttribute("aria-label")).slice(0, 60));
  console.log("ARIA:", JSON.stringify(labels));
  console.log("BODY:", (await page.evaluate(() => document.body.innerText.slice(0, 600))).replace(/\n/g, " | "));
  await page.screenshot({ path: "work/probe-call.png" });
  await b.close();
})();
