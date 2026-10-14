const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.getByText("设置", { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(1200);
  await page.getByText("语音", { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(1200);
  const switches = await page.locator('[role="switch"], input[type="checkbox"]').count();
  console.log("SWITCHES:", switches);
  const labels = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('[role="switch"], input[type="checkbox"]').forEach((el) => out.push(el.outerHTML.slice(0, 160)));
    return out;
  });
  console.log(JSON.stringify(labels, null, 1));
  await page.locator('[role="switch"], input[type="checkbox"]').first().click({ timeout: 5000 }).catch((e) => console.log("click failed"));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "work/call-9-voice-on.png" });
  const fields = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("input, textarea, select").forEach((el) => out.push({ tag: el.tagName, type: el.type || "", ph: el.placeholder || "", aria: el.getAttribute("aria-label") || "", val: String(el.value || "").slice(0, 24) }));
    return out;
  });
  console.log(JSON.stringify(fields, null, 1));
  await b.close();
})();
