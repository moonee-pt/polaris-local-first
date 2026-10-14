const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
const URL = "http://localhost:5175/";
(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(async () => {
    const { useChatStore } = await import('/src/stores/chatStore.ts');
    for (let i = 0; i < 40; i += 1) { if (useChatStore.getState().hydrated) return; await new Promise((r) => setTimeout(r, 250)); }
  });
  await page.evaluate(async () => {
    const { useChatStore } = await import('/src/stores/chatStore.ts');
    const { useSpaceStore } = await import('/src/stores/spaceStore.ts');
    const now = Date.now();
    const tool = (id, om, kind, title, summary, status) => ({ id, role: 'system', origin: 'tool-runtime', content: '', timestamp: now, toolInvocation: { id, kind, status, title, summary, originMessageId: om } });
    useChatStore.setState({ conversations: [{ id: 'c-task', title: '做一个落地页', progressTitle: '', collaboratorId: null, activeProjectId: null, createdAt: now - 60000, updatedAt: now, pinnedAt: null, messages: [
      { id: 'u1', role: 'user', content: '帮我做个产品落地页', timestamp: now - 60000 },
      { id: 'a1', role: 'assistant', content: '先搭骨架，建两个文件。', thinkingText: '先建两个文件。', timestamp: now - 50000 },
      tool('t1', 'a1', 'createProjectFile', '创建 index.html', '已创建 index.html', 'applied'),
      { id: 'a2', role: 'assistant', content: '完成，落地页已就绪。', thinkingText: '收尾。', timestamp: now - 30000 }
    ] }], activeConversationId: 'c-task', hydrated: true });
    useSpaceStore.getState().setWorld('chat');
  });
  await page.waitForTimeout(3000);
  const diag = await page.evaluate(async () => {
    const { useSpaceStore } = await import('/src/stores/spaceStore.ts');
    const { useChatStore } = await import('/src/stores/chatStore.ts');
    return { world: useSpaceStore.getState().activeWorld, convs: useChatStore.getState().conversations.length, active: useChatStore.getState().activeConversationId, body: document.body.innerText.slice(0, 300), chatWorld: Boolean(document.querySelector('.world-chat')), msgRows: document.querySelectorAll('.msg-row').length, toolEvents: document.querySelectorAll('.tool-event').length };
  });
  console.log(JSON.stringify(diag, null, 2));
  await page.screenshot({ path: 'work/row-buttons-diag2.png' });
  await browser.close();
})();