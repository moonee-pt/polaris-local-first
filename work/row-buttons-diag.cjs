const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
const URL = "http://localhost:5175/";
(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const diag = await page.evaluate(async () => {
    const { useChatStore } = await import('/src/stores/chatStore.ts');
    const { useSpaceStore } = await import('/src/stores/spaceStore.ts');
    return {
      world: useSpaceStore.getState().activeWorld,
      convs: useChatStore.getState().conversations.length,
      active: useChatStore.getState().activeConversationId,
      hydrated: useChatStore.getState().hydrated,
      bodyText: document.body.innerText.slice(0, 400),
      shell: Boolean(document.querySelector('.app-shell')),
      classes: [...document.body.querySelectorAll('section,main,div[class*=world]')].slice(0, 12).map((e) => e.className)
    };
  });
  console.log(JSON.stringify(diag, null, 2));
  await page.screenshot({ path: 'work/row-buttons-diag.png', fullPage: false });
  await browser.close();
})();