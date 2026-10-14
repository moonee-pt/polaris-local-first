const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
const URL = "http://localhost:4182/";

const SEED = async () => {
  const { usePersonaStore } = await import('/src/stores/personaStore.ts');
  const { useChatStore } = await import('/src/stores/chatStore.ts');
  const { useSpaceStore } = await import('/src/stores/spaceStore.ts');
  const personaId = usePersonaStore.getState().createPersona();
  usePersonaStore.getState().updateCollaborator(personaId, { name: '小助手' });
  const now = Date.now();
  const mk = (id, title, progressTitle, extra) => ({
    id,
    title,
    progressTitle,
    collaboratorId: personaId,
    activeProjectId: null,
    createdAt: now - 86400000,
    updatedAt: now,
    pinnedAt: null,
    messages: [{ id: `${id}-m1`, role: 'user', content: '随便说点什么内容', createdAt: now }],
    ...(extra || {})
  });
  useChatStore.setState({
    conversations: [
      mk('c-long', '有记忆写入功能吗。。。。。。。。。。', '记忆写入方案：先在对话里自动抽取候选记忆，再考虑跨对话汇总和去重，最后才做长期归档', { pinnedAt: now }),
      mk('c-plain', '新对话', ''),
      mk('c-ws', '帮我看看这个卡片布局怎么改', '卡片布局调整中', { activeProjectId: 'p-demo' })
    ]
  });
  useSpaceStore.getState().setWorld('collection');
  useSpaceStore.getState().setCollectionShelf('dialogue');
  return { personaId };
};

const audit = async (page) => page.evaluate(() => {
  const rows = [...document.querySelectorAll('.conversation-card')];
  return {
    rowCount: rows.length,
    removed: {
      workspaceBadge: document.querySelectorAll('.conversation-card-workspace-badge').length,
      inlineStates: document.querySelectorAll('.conversation-card-inline-states').length,
      microActions: document.querySelectorAll('.conversation-card-actions, .micro-action-btn').length
    },
    titles: rows.map((row) => {
      const mine = row.querySelector('.conversation-card-title-mine');
      const progress = row.querySelector('.conversation-card-title-progress');
      const clipped = (el) => (el ? el.scrollWidth > el.clientWidth + 1 : null);
      const lineBoxes = (el) => {
        if (!el) return null;
        const range = document.createRange();
        range.selectNodeContents(el);
        return range.getClientRects().length;
      };
      return {
        id: row.className.includes('pinned') ? 'pinned' : 'plain',
        mine: mine ? { text: mine.innerText.slice(0, 24), clipped: clipped(mine), lines: lineBoxes(mine) } : null,
        progress: progress ? { text: progress.innerText.slice(0, 24), clipped: clipped(progress), lines: lineBoxes(progress) } : null
      };
    })
  };
});

const longPress = async (page, index) => {
  const handle = await page.locator('.conversation-card-main').nth(index).elementHandle();
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  await page.evaluate(({ el, x, y }) => {
    const opts = { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
  }, { el: handle, x: box.x + box.width * 0.4, y: box.y + box.height / 2 });
  await page.waitForTimeout(800);
  await page.evaluate(({ el, x, y }) => {
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }));
  }, { el: handle, x: box.x + box.width * 0.4, y: box.y + box.height / 2 });
  await page.waitForTimeout(450);
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const errs = [];
  for (const cfg of [
    { name: 'phone', width: 390, height: 844, touch: true },
    { name: 'mid', width: 560, height: 900, touch: true }
  ]) {
    const ctx = await browser.newContext({
      viewport: { width: cfg.width, height: cfg.height },
      deviceScaleFactor: 2,
      hasTouch: cfg.touch,
      isMobile: cfg.touch
    });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errs.push(`${cfg.name}: ${m.text()}`); });
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(4000);
    await page.evaluate(SEED);
    await page.waitForTimeout(900);
    console.log(`[${cfg.name}]`, JSON.stringify(await audit(page), null, 1));
    await page.screenshot({ path: `work/row-${cfg.name}.png` });
    await longPress(page, 0);
    const sheet = await page.evaluate(() => {
      const s = document.querySelector('.conversation-card-menu-sheet');
      if (!s) return { open: false };
      return {
        open: true,
        title: s.querySelector('.conversation-card-menu-title')?.innerText,
        items: [...s.querySelectorAll('.conversation-card-menu-item')].map((b) => b.innerText.trim()),
        rowHeight: Math.round(s.querySelector('.conversation-card-menu-item')?.getBoundingClientRect().height || 0)
      };
    });
    console.log(`[${cfg.name}] sheet`, JSON.stringify(sheet));
    await page.screenshot({ path: `work/row-${cfg.name}-sheet.png` });

    await page.locator('.conversation-card-menu-item').first().click();
    await page.waitForTimeout(400);
    const renameState = await page.evaluate(() => ({
      editorOpen: Boolean(document.querySelector('.conversation-card-edit input')),
      sheetClosed: !document.querySelector('.conversation-card-menu-sheet'),
      stillOnDialogue: Boolean(document.querySelector('.conversation-card-list'))
    }));
    console.log(`[${cfg.name}] rename`, JSON.stringify(renameState));
    await page.screenshot({ path: `work/row-${cfg.name}-rename.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await longPress(page, 1);
    const pinLabel = await page.locator('.conversation-card-menu-item').nth(1).innerText();
    await page.locator('.conversation-card-menu-item').nth(1).click();
    await page.waitForTimeout(500);
    const pinState = await page.evaluate(() => ({
      pinnedRows: document.querySelectorAll('.conversation-card.pinned').length,
      firstTitle: document.querySelector('.conversation-card .conversation-card-title-mine')?.innerText
    }));
    console.log(`[${cfg.name}] pin`, JSON.stringify({ pinLabel: pinLabel.trim(), ...pinState }));
    await ctx.close();
  }
  console.log('ERRORS:', errs.slice(0, 8));
  await browser.close();
})();
