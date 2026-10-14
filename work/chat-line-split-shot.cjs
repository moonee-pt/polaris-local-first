const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
const URL = process.env.POLARIS_URL || "http://127.0.0.1:5178/work/snapshot-chat-lines.html";

(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 300)));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE:", m.text().slice(0, 200));
  });
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1200);

  const report = await page.evaluate(() => {
    const lines = [...document.querySelectorAll(".message-rich-text-line")].map((el) => {
      const box = el.getBoundingClientRect();
      return { text: el.textContent, top: Math.round(box.top), height: Math.round(box.height) };
    });
    const note = document.querySelector(".system-inline-note");
    const noteBox = note ? note.getBoundingClientRect() : null;
    const noteCs = note ? getComputedStyle(note) : null;
    return {
      lineCount: lines.length,
      lines,
      note: noteBox
        ? {
            text: note.textContent,
            top: Math.round(noteBox.top),
            height: Math.round(noteBox.height),
            color: noteCs.color,
            background: noteCs.backgroundColor,
            fontSize: noteCs.fontSize
          }
        : null,
      bubbleBg: (() => {
        const el = document.querySelector(".bubble.assistant");
        return el ? getComputedStyle(el).backgroundColor : null;
      })()
    };
  });
  console.log("REPORT:", JSON.stringify(report, null, 2));

  const flow = page.locator(".chat-flow");
  await flow.screenshot({ path: "work/chat-line-split-phone.png" });
  await page.screenshot({ path: "work/chat-line-split-full.png", fullPage: true });
  await b.close();
})();
