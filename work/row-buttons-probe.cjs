const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
const URL = "http://localhost:5175/";

const SEED = async () => {
  const findUrl = (suffix) => {
    const hit = performance.getEntriesByType('resource').map((e) => e.name)
      .filter((n) => n.includes(suffix)).sort((a, b) => b.length - a.length)[0];
    return hit || suffix;
  };
  const { useChatStore } = await import(/* @vite-ignore */ findUrl('/src/stores/chatStore.ts'));
  const { useSpaceStore } = await import(/* @vite-ignore */ findUrl('/src/stores/spaceStore.ts'));
  const now = Date.now();
  const tool = (id, originMessageId, kind, title, summary, status) => ({
    id, role: 'system', origin: 'tool-runtime', content: '', timestamp: now,
    toolInvocation: { id, kind, status, title, summary, originMessageId }
  });
  const a1 = 'a1', a2 = 'a2', a3 = 'a3';
  useChatStore.setState({
    conversations: [{
      id: 'c-task', title: '做一个落地页', progressTitle: '', collaboratorId: null,
      activeProjectId: null, createdAt: now - 60000, updatedAt: now, pinnedAt: null,
      messages: [
        { id: 'u1', role: 'user', content: '帮我做个产品落地页', timestamp: now - 60000 },
        { id: a1, role: 'assistant', content: '先搭骨架，建两个文件。', thinkingText: '用户要落地页。第一步先建 index.html 和 style.css 两个文件。', timestamp: now - 50000 },
        tool('t1', a1, 'createProjectFile', '创建 index.html', '已创建 index.html', 'applied'),
        tool('t2', a1, 'createProjectFile', '创建 style.css', '已创建 style.css', 'applied'),
        { id: a2, role: 'assistant', content: '骨架好了，接下来替换文案和配色。', thinkingText: '骨架已就绪。现在替换首屏文案，并把主色改成品牌绿。', timestamp: now - 40000 },
        tool('t3', a2, 'replaceProjectFileLines', '替换 index.html', '已替换首屏文案', 'applied'),
        tool('t4', a2, 'editProjectFileText', '写入 style.css', '已写入配色变量', 'applied'),
        { id: a3, role: 'assistant', content: '完成，落地页已就绪。', thinkingText: '两个文件都改完了，收尾。', timestamp: now - 30000 }
      ]
    }],
    activeConversationId: 'c-task',
    hydrated: true,
    loadedMessageConversationIds: ['c-task'],
    conversationBodyStatuses: { 'c-task': { state: 'loaded', updatedAt: now } }
  });
  useSpaceStore.getState().setWorld('chat');
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  await page.evaluate(SEED);
  await page.waitForTimeout(3000);
  const audit = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.msg-row')];
    return {
      rowCount: rows.length,
      rows: rows.map((row) => ({
        cls: row.className.replace(/\s+/g, ' '),
        toolEvents: row.querySelectorAll('.tool-event').length,
        btns: [...row.querySelectorAll('.micro-action-btn')].map((b) => b.getAttribute('aria-label') || b.getAttribute('title')),
        thinking: row.querySelectorAll('.thinking-inline-trigger').length,
        bubble: ((row.querySelector('.bubble') || {}).innerText || '').slice(0, 40)
      }))
    };
  });
  console.log(JSON.stringify(audit, null, 2));
  await page.screenshot({ path: 'work/row-buttons-phone.png', fullPage: true });
  await browser.close();
})();