const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
const URL = "http://localhost:5175/";
(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  await page.evaluate(async () => {
    const findUrl = (s) => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes(s)).sort((a, b) => b.length - a.length)[0] || s;
    const { useChatStore } = await import(/* @vite-ignore */ findUrl('/src/stores/chatStore.ts'));
    const { useSpaceStore } = await import(/* @vite-ignore */ findUrl('/src/stores/spaceStore.ts'));
    const { usePersonaStore } = await import(/* @vite-ignore */ findUrl('/src/stores/personaStore.ts'));
    const personaId = usePersonaStore.getState().createPersona();
    usePersonaStore.getState().updateCollaborator(personaId, { name: '小助手' });
    const now = Date.now();
    useChatStore.setState({ conversations: [{ id: 'c1', title: '随便聊聊', progressTitle: '', collaboratorId: personaId, activeProjectId: null, createdAt: now - 60000, updatedAt: now, pinnedAt: null, messages: [
      { id: 'u1', role: 'user', content: '在吗', timestamp: now - 60000 },
      { id: 'a1', role: 'assistant', content: '在的。', timestamp: now - 50000 }
    ] }], activeConversationId: 'c1', hydrated: true, loadedMessageConversationIds: ['c1'], conversationBodyStatuses: { c1: { state: 'loaded', updatedAt: now } } });
    useSpaceStore.getState().setWorld('chat');
  });
  await page.waitForTimeout(2500);
  const dump = async (tag) => {
    const d = await page.evaluate(async () => {
      const findUrl = (s) => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes(s)).sort((a, b) => b.length - a.length)[0] || s;
      const { useSpaceStore } = await import(/* @vite-ignore */ findUrl('/src/stores/spaceStore.ts'));
      const sp = useSpaceStore.getState();
      const anchor = document.querySelector('.world-anchor');
      const title = anchor ? (anchor.querySelector('h1') || {}).textContent : null;
      return { world: sp.activeWorld, shelf: sp.collectionShelf, editing: sp.editingCollaboratorId, frontstage: sp.frontstageCollaboratorId, title, body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 120) };
    });
    console.log(tag, JSON.stringify(d));
  };
  await dump('BEFORE');
  const box = await page.locator('.world-anchor').boundingBox();
  console.log('anchor box', JSON.stringify(box));
  await page.locator('.world-anchor').click();
  await page.waitForTimeout(2000);
  await dump('AFTER-CLICK-ANCHOR');
  await page.screenshot({ path: 'work/logo-click-after.png', fullPage: false });
  await browser.close();
})();