const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("button, [role=button], a").forEach((el) => {
      const label = (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim().slice(0, 30);
      if (label) out.push(label);
    });
    return out;
  });
  console.log(JSON.stringify(info, null, 0));
  await b.close();
})();
