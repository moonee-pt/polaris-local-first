const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;

async function run(b, viewport, tag) {
  const page = await b.newPage({ viewport });
  page.on("pageerror", (e) => console.log(tag, "PAGEERROR:", String(e).slice(0, 200)));
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.locator('[aria-label="新建对话"]').first().click({ timeout: 5000 });
  await page.waitForTimeout(2000);
  await page.locator('[aria-label="开始通话"]').first().click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  const metrics = await page.evaluate(() => {
    const stage = document.querySelector(".voice-call-stage");
    const inner = document.querySelector(".voice-call-stage-inner");
    const hangup = document.querySelector(".voice-call-control.is-hangup");
    const input = document.querySelector(".voice-call-input-row");
    const r = (el) => (el ? el.getBoundingClientRect() : null);
    return {
      stageScroll: stage ? [stage.scrollHeight, stage.clientHeight] : null,
      stageOverflowX: stage ? [stage.scrollWidth, stage.clientWidth] : null,
      innerScroll: inner ? [inner.scrollHeight, inner.clientHeight] : null,
      hangup: r(hangup),
      input: r(input),
      viewport: [window.innerWidth, window.innerHeight]
    };
  });
  console.log(tag, JSON.stringify(metrics));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `work/call-${tag}-stage.png` });
  await page.locator('[aria-label="挂断"]').click();
  await page.waitForTimeout(2000);
  const card = page.locator(".voice-call-record").first();
  if (await card.count() > 0) {
    await card.screenshot({ path: `work/call-${tag}-card.png` });
    const box = await card.boundingBox();
    console.log(tag, "CARD BOX:", JSON.stringify(box));
  } else {
    console.log(tag, "NO CARD");
  }
  await page.close();
}

(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  await run(b, { width: 1366, height: 768 }, "desk");
  await run(b, { width: 390, height: 844 }, "phone");
  await b.close();
})();
