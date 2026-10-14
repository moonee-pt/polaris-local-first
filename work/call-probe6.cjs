const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.getByText("设置", { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(1000);
  await page.getByText("API / 供应商", { exact: false }).first().click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "work/call-10-provider.png" });
  const dump = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("input, textarea, select").forEach((el) => out.push({ tag: el.tagName, type: el.type || "", ph: (el.placeholder || "").slice(0, 40), aria: el.getAttribute("aria-label") || "", val: String(el.value || "").slice(0, 30) }));
    return { fields: out, text: document.body.innerText.slice(0, 1000) };
  });
  console.log(JSON.stringify(dump, null, 1));
  await b.close();
})();
