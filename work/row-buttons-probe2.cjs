const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
const URL = "http://localhost:5175/";
(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const urls = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('chatStore')));
  console.log(JSON.stringify(urls, null, 2));
  const test = await page.evaluate(async () => {
    const m1 = await import('/src/stores/chatStore.ts');
    const m2 = await import('/src/stores/chatStore.ts?t=1');
    return { same: m1.useChatStore === m2.useChatStore, len1: m1.useChatStore.getState().conversations.length, len2: m2.useChatStore.getState().conversations.length };
  });
  console.log(JSON.stringify(test));
  await browser.close();
})();