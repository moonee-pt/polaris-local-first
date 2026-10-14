const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
const URL = "http://localhost:4182/";

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.evaluate(async () => {
    const { useChatStore } = await import('/src/stores/chatStore.ts');
    const { useSpaceStore } = await import('/src/stores/spaceStore.ts');
    const now = Date.now();
    useChatStore.setState({
      conversations: [{
        id: 'c-long',
        title: '有记忆写入功能吗。。。。。。。。。。',
        progressTitle: '记忆写入方案：先在对话里自动抽取候选记忆，再考虑跨对话汇总和去重，最后才做长期归档',
        collaboratorId: null,
        activeProjectId: null,
        createdAt: now,
        updatedAt: now,
        pinnedAt: now,
        messages: [{ id: 'm1', role: 'user', content: '随便说点什么内容', createdAt: now }]
      }]
    });
    useSpaceStore.getState().setWorld('collection');
    useSpaceStore.getState().setCollectionShelf('dialogue');
  });
  await page.waitForTimeout(900);
  const info = await page.evaluate(() => {
    const el = document.querySelector('.conversation-card-title-progress');
    if (!el) return { missing: true };
    const cs = getComputedStyle(el);
    const h3 = el.closest('h3');
    const h3cs = getComputedStyle(h3);
    const chain = [];
    let node = el;
    while (node && node !== document.body) {
      const s = getComputedStyle(node);
      chain.push({
        cls: (node.className || node.tagName).toString().slice(0, 46),
        ws: s.whiteSpace,
        tof: s.textOverflow,
        ov: s.overflow,
        maxH: s.maxHeight,
        clamp: s.webkitLineClamp,
        display: s.display,
        h: Math.round(node.getBoundingClientRect().height),
        sh: node.scrollHeight,
        cw: node.clientWidth,
        sw: node.scrollWidth
      });
      node = node.parentElement;
    }
    return {
      text: el.innerText,
      h3: { ws: h3cs.whiteSpace, clamp: h3cs.webkitLineClamp, display: h3cs.display, overflow: h3cs.overflow },
      chain
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})();
