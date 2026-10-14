const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  const found = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("*").forEach((el) => {
      const txt = (el.textContent || "").trim();
      const al = el.getAttribute("aria-label") || "";
      const ti = el.getAttribute("title") || "";
      if (al === "新建对话" || ti === "新建对话" || txt === "新建对话" || txt === "新对话") {
        out.push({ tag: el.tagName, cls: el.className, aria: al, title: ti, txt: txt.slice(0, 12) });
      }
    });
    return out.slice(0, 10);
  });
  console.log(JSON.stringify(found, null, 1));
  await b.close();
})();
