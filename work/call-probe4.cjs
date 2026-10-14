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
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "work/call-8-voice.png" });
  const dump = await page.evaluate(() => {
    const inputs = [];
    document.querySelectorAll("input, textarea, select, button").forEach((el) => {
      const tag = el.tagName;
      const ph = el.placeholder || "";
      const aria = el.getAttribute("aria-label") || "";
      const txt = (el.textContent || "").trim().slice(0, 20);
      const val = el.value !== undefined ? String(el.value).slice(0, 26) : "";
      if (tag === "BUTTON" && !txt) return;
      inputs.push({ tag, ph, aria, txt, val, role: el.getAttribute("role") || "" });
    });
    return { items: inputs.slice(0, 40), text: document.body.innerText.slice(0, 900) };
  });
  console.log(JSON.stringify(dump, null, 1));
  await b.close();
})();
