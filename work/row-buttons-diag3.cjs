const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
const URL = "http://localhost:5175/";
(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console-error]', m.text().slice(0, 300)); });
  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(async () => {
    const { useChatStore } = await import('/src/stores/chatStore.ts');
    for (let i = 0; i < 40; i += 1) { if (useChatStore.getState().hydrated) return; await new Promise((r) => setTimeout(r, 250)); }
  });
  await page.evaluate(async () => {
    const { useChatStore } = await import('/src/stores/chatStore.ts');
    const { useSpaceStore } = await import('/src/stores/spaceStore.ts');
    const now = Date.now();
    useChatStore.setState({ conversations: [{ id: 'c-task', title: '做一个落地页', progressTitle: '', collaboratorId: 'per-x', activeProjectId: null, createdAt: now - 60000, updatedAt: now, pinnedAt: null, messages: [
      { id: 'u1', role: 'user', content: '帮我做个产品落地页', timestamp: now - 60000 },
      { id: 'a1', role: 'assistant', content: '先搭骨架。', thinkingText: '先建两个文件。', timestamp: now - 50000 },
      { id: 't1', role: 'system', origin: 'tool-runtime', content: '', timestamp: now - 49000, toolInvocation: { id: 't1', kind: 'createProjectFile', status: 'applied', title: '创建 index.html', summary: '已创建 index.html', originMessageId: 'a1' } },
      { id: 'a2', role: 'assistant', content: '完成。', thinkingText: '收尾。', timestamp: now - 30000 }
    ] }], activeConversationId: 'c-task', hydrated: true, loadedMessageConversationIds: ['c-task'], conversationBodyStatuses: { 'c-task': { state: 'loaded', updatedAt: now } } });
    useSpaceStore.getState().setWorld('chat');
  });
  await page.waitForTimeout(3500);
  const d = await page.evaluate(async () => {
    const { useChatStore } = await import('/src/stores/chatStore.ts');
    const s = useChatStore.getState();
    const conv = s.conversations[0];
    const chat = document.querySelector('.world-chat');
    return {
      active: s.activeConversationId,
      msgLen: conv ? conv.messages.length : -1,
      toolMsgs: conv ? conv.messages.filter((m) => m.toolInvocation).length : -1,
      chatEl: Boolean(chat),
      chatText: chat ? chat.innerText.slice(0, 200) : null,
      msgRows: document.querySelectorAll('.msg-row').length,
      flowShell: Boolean(document.querySelector('.chat-flow-shell')),
      anyFlow: document.querySelectorAll('.chat-flow').length
    };
  });
  console.log(JSON.stringify(d, null, 2));
  await page.screenshot({ path: 'work/row-buttons-diag3.png' });
  await browser.close();
})();