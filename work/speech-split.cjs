const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
const para = "「[breathy] 你今天……不太一样。」（她别开脸，指尖停在领口的扣子上，没敢抬眼看你）「[pause] 别急，我又不会跑。」（笑）「[soft] 过来。」（她把身子往你这边挪了挪，[wetplap:soft] 呼吸一下子乱了）";
const label = { breathy: "气声", pause: "停顿", soft: "轻声", "wetplap:soft": "湿拍打·轻" };
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(15000);
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(6000);
  const ok = await page.evaluate(({ para, label }) => {
    const esc = (s) => s.replace(/[<>&]/g, "");
    const chip = (l) => '<span class="message-performance-tag">' + l + '</span>';
    let html = esc(para);
    html = html.replace(/（[^）]*）/g, (m) => "\u0001" + m + "\u0001");
    html = html.replace(/\[([a-z][a-z: ]{0,24})\]/gi, (m, tag) => label[tag] ? chip(label[tag]) : m);
    html = html.replace(/\u0001([^\u0001]*)\u0001/g, (m, inner) => {
      const body = inner.slice(1, -1);
      return '<span class="message-stage-direction' + (body.length >= 6 ? ' is-block' : '') + '">' + inner + '</span>';
    });
    const box = document.createElement("div");
    box.id = "preview-box";
    box.className = "message-rich-text message-markdown";
    box.style.cssText = "position:fixed;left:0;top:0;width:390px;padding:20px 18px;box-sizing:border-box;background:#fff;font-size:15px;line-height:1.95;z-index:99999;";
    box.innerHTML = '<p class="message-rich-text-paragraph">' + html + "</p>";
    document.body.appendChild(box);
    return "blocks:" + document.querySelectorAll(".message-stage-direction.is-block").length;
  }, { para, label });
  console.log("inject:", ok);
  await page.waitForTimeout(300);
  await page.locator("#preview-box").screenshot({ path: "work/speech-split.png" });
  console.log("done");
  await b.close();
})();