const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.locator('[aria-label="设置"]').first().click({ timeout: 5000 }).catch(async () => {
    await page.getByText("设置", { exact: true }).first().click({ timeout: 5000 });
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "work/call-7-settings.png" });
  const dump = await page.evaluate(() => {
    const inputs = [];
    document.querySelectorAll("input, textarea, select").forEach((el) => {
      inputs.push({ tag: el.tagName, type: el.type || "", ph: el.placeholder || "", aria: el.getAttribute("aria-label") || "", val: (el.value || "").slice(0, 30) });
    });
    const buttons = [];
    document.querySelectorAll("button").forEach((el) => {
      const t = (el.textContent || "").trim().slice(0, 16);
      if (t) buttons.push(t);
    });
    return { inputs: inputs.slice(0, 25), buttons: buttons.slice(0, 45), text: document.body.innerText.slice(0, 500) };
  });
  console.log(JSON.stringify(dump, null, 1));
  await b.close();
})();
