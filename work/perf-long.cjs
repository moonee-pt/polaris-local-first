const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
const lines = [
  "别躲。……过来。",
  "[pause] 手给我。",
  "[breathy] 你今天……不太一样。",
  "[chuckle] 急什么，我又不会跑。",
  "[panting] 别……别乱动。",
  "[flesh:soft] 就这样，慢慢来。",
  "[moaning] 嗯……",
  "[sighing] 好孩子。"
];
const label = { pause: "停顿", breathy: "气声", chuckle: "轻笑", panting: "喘息", "flesh:soft": "身体音·轻", moaning: "低吟", sighing: "叹气" };
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2200);
  await page.locator('[aria-label="新建对话"]').first().click().catch(() => {});
  await page.waitForTimeout(1500);
  const ok = await page.evaluate(({ lines, label }) => {
    const host = document.querySelector(".chat-body");
    if (!host) return "no host";
    const esc = (s) => s.replace(/[<>&]/g, "");
    const chip = (l) => '<span class="message-performance-tag">' + l + '</span>';
    const box = document.createElement("div");
    box.className = "message-rich-text message-markdown";
    box.style.cssText = "max-width:520px;margin:20px auto;font-size:15px;line-height:1.85;";
    box.innerHTML = lines.map((line) => {
      const html = esc(line).replace(/\[([a-z: ]+)\]/g, (m, tag) => label[tag] ? chip(label[tag]) : m);
      return '<p class="message-rich-text-paragraph">' + html + "</p>";
    }).join("");
    host.prepend(box);
    return "ok";
  }, { lines, label });
  console.log("inject:", ok);
  await page.waitForTimeout(400);
  await page.locator(".message-rich-text").first().screenshot({ path: "work/perf-long.png" });
  const r = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight }));
  console.log("OVERFLOW:", JSON.stringify(r), r.sh <= r.ch ? "OK" : "OVERFLOW");
  await b.close();
})();