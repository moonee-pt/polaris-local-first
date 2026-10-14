const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
const URL = process.env.POLARIS_URL || "http://127.0.0.1:5174/";

const SAMPLE = [
  { kind: "speech", text: "唔……说得这么直白。" },
  { kind: "stage", text: "（他把电话换到另一边，声音低下去）" },
  { kind: "speech", text: "是谁教你的，用这种话跟我讨。" },
  { kind: "stage", text: "（停了两秒，才又开口）" },
  { kind: "speech", text: "行，那先说清楚。" }
];

(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.locator('button:has-text("角色")').first().click({ timeout: 5000 });
  await page.waitForTimeout(2000);
  await page.locator('[aria-label="开始通话"]').first().click({ timeout: 5000 });
  await page.waitForTimeout(1200);

  await page.evaluate((sample) => {
    const caption = document.querySelector(".voice-call-caption");
    if (!caption) return;
    caption.querySelectorAll("p").forEach((node) => node.remove());
    const p = document.createElement("p");
    p.className = "voice-call-caption-text";
    p.style.whiteSpace = "pre-wrap";
    for (const part of sample) {
      const span = document.createElement("span");
      if (part.kind === "stage") span.className = "voice-call-caption-stage";
      span.textContent = part.text;
      p.appendChild(span);
    }
    caption.appendChild(p);
    const phase = document.querySelector(".voice-call-phase");
    if (phase) phase.textContent = "在说";
  }, SAMPLE);

  await page.waitForTimeout(600);
  await page.screenshot({ path: "work/call-caption-phone.png" });

  const metrics = await page.evaluate(() => {
    const cap = document.querySelector(".voice-call-caption-text");
    const stage = document.querySelector(".voice-call-caption-stage");
    const input = document.querySelector(".voice-call-input-row");
    const r = (el) => {
      if (!el) return null;
      const box = el.getBoundingClientRect();
      return { top: Math.round(box.top), height: Math.round(box.height) };
    };
    const cs = cap ? getComputedStyle(cap) : null;
    return {
      viewport: [window.innerWidth, window.innerHeight],
      caption: r(cap),
      stage: r(stage),
      input: r(input),
      fontFamily: cs ? cs.fontFamily : null,
      fontSize: cs ? cs.fontSize : null,
      lineHeight: cs ? cs.lineHeight : null
    };
  });
  console.log("METRICS:", JSON.stringify(metrics, null, 2));
  await b.close();
})();
