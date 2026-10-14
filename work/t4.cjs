const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const m = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile:true, hasTouch:true });
  await m.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await m.waitForTimeout(2500);
  await m.mouse.click(350, 763); await m.waitForTimeout(1500);
  await m.screenshot({ path: "work/t4-create-sheet.png" });
  console.log("AFTER PLUS:\n", (await m.evaluate(()=>document.body.innerText)).slice(0,900));
  await b.close();
})();
