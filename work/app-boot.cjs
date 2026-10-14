const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text().slice(0, 300)); });
  page.on("pageerror", (e) => console.log("PAGEERR:", String(e).slice(0, 400)));
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(9000);
  const info = await page.evaluate(() => ({ root: document.getElementById("root")?.childElementCount ?? -1, bodyLen: document.body.innerHTML.length, title: document.title }));
  console.log("INFO:", JSON.stringify(info));
  await page.screenshot({ path: "work/app-boot.png" });
  await b.close();
})();