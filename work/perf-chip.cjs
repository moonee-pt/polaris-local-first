const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2200);
  await page.locator('[aria-label="新建对话"]').first().click().catch(() => {});
  await page.waitForTimeout(1500);
  const ok = await page.evaluate(() => {
    const host = document.querySelector(".chat-body");
    if (!host) return "no chat-body";
    const box = document.createElement("div");
    box.style.cssText = "max-width:520px;margin:24px auto;padding:14px 16px;line-height:1.9;font-size:15px;";
    box.className = "message-rich-text message-markdown";
    box.innerHTML = '别躲。<br><span class="message-performance-tag">喘息</span>过来，手给我。<br><span class="message-performance-tag">轻笑</span>急什么……<br><span class="message-performance-tag">身体音·轻</span>';
    host.prepend(box);
    return "ok";
  });
  console.log("inject:", ok);
  await page.waitForTimeout(400);
  const el = page.locator(".message-rich-text").first();
  await el.screenshot({ path: "work/perf-tag-chip.png" });
  const style = await page.locator(".message-performance-tag").first().evaluate((n) => {
    const s = getComputedStyle(n);
    return { color: s.color, bg: s.backgroundColor, fontSize: s.fontSize, radius: s.borderRadius };
  });
  console.log(JSON.stringify(style));
  await b.close();
})();
