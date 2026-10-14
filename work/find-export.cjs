const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  const room = page.getByText("群聊", { exact: true }).first();
  if (await room.count()) { await room.click().catch(()=>{}); await page.waitForTimeout(1500); }
  const info = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("*").forEach(el => {
      if (el.children.length === 0 && el.textContent && el.textContent.trim() === "导出") {
        let p = el, chain = [];
        for (let i=0;i<6 && p;i++){ chain.push(p.tagName+"."+(p.className||"")); p = p.parentElement; }
        out.push(chain.join(" < "));
      }
    });
    return out;
  });
  console.log(JSON.stringify(info, null, 2));
  await b.close();
})();
