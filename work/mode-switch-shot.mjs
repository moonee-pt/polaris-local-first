import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const host = '127.0.0.1';
const port = 4199;
const baseUrl = `http://${host}:${port}`;
const outDir = 'work/mode-shot';

const server = spawn('npm', ['run', 'dev', '--', '--host', host, '--port', String(port)], {
  cwd: process.cwd(),
  stdio: 'pipe',
  shell: true
});
let logs = '';
server.stdout.on('data', (c) => { logs += String(c); });
server.stderr.on('data', (c) => { logs += String(c); });

const waitForServer = async (url) => {
  for (let i = 0; i < 120; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};

let browser = null;
try {
  await mkdir(outDir, { recursive: true });
  const up = await waitForServer(baseUrl + '/?debugQa=1');
  console.log('server up:', up);
  if (!up) throw new Error('dev server did not start');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') console.log('[page error]', m.text()); });
  await page.goto(baseUrl + '/?debugQa=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell', { timeout: 30000 });
  const hasComposerEarly = await page.locator('.chat-composer textarea').count();
  if (!hasComposerEarly) {
    const info = await page.evaluate(() => {
      const shell = document.querySelector('.app-shell');
      const labelled = Array.from(document.querySelectorAll('[aria-label]')).slice(0, 40).map((el) => el.getAttribute('aria-label'));
      return { shellClass: shell?.className ?? null, labelled };
    });
    console.log('pre-switch info:', JSON.stringify(info, null, 2));
    const candidates = ['切换到对话', '对话', '聊天', 'Chat'];
    for (const label of candidates) {
      const loc = page.getByLabel(label, { exact: false });
      const n = await loc.count();
      if (n > 0) {
        const vis = await loc.first().isVisible().catch(() => false);
        console.log('label candidate', label, 'count', n, 'visible', vis);
        if (vis) {
          await loc.first().click({ timeout: 8000 }).catch((e) => console.log('click failed', label, String(e).slice(0, 120)));
          break;
        }
      }
    }
  }
  await page.waitForSelector('.chat-composer textarea', { timeout: 30000 });
  await page.waitForTimeout(400);

  const layout = await page.evaluate(() => ({
    docScrollW: document.documentElement.scrollWidth,
    docClientW: document.documentElement.clientWidth,
    hasSwitch: Boolean(document.querySelector('.chat-mode-switch')),
    switchText: document.querySelector('.chat-mode-button')?.textContent ?? null,
    switchRect: (() => { const el = document.querySelector('.chat-mode-switch'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
    boxRect: (() => { const el = document.querySelector('.chat-box-shell'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })()
  }));
  console.log('layout:', JSON.stringify(layout, null, 2));
  await page.screenshot({ path: `${outDir}/01-closed.png` });

  await page.click('.chat-mode-button');
  await page.waitForSelector('.chat-mode-menu', { timeout: 5000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outDir}/02-open.png` });
  const menuInfo = await page.evaluate(() => {
    const menu = document.querySelector('.chat-mode-menu');
    const r = menu?.getBoundingClientRect();
    const shell = document.querySelector('.app-shell')?.getBoundingClientRect();
    return {
      options: Array.from(document.querySelectorAll('.chat-mode-option')).map((o) => o.textContent),
      menuRect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom) } : null,
      shellH: shell ? Math.round(shell.height) : null
    };
  });
  console.log('menu:', JSON.stringify(menuInfo, null, 2));

  await page.screenshot({ path: `${outDir}/03-open-clipped-shell.png`, clip: { x: 0, y: 768 - 320, width: 1366, height: 320 } });
  await page.keyboard.press('Escape');

  const newChat = page.getByLabel('新对话');
  console.log('newChat count', await newChat.count());
  if (await newChat.count()) {
    await newChat.first().click();
    await page.waitForTimeout(600);
  }
  const afterNewChat = await page.evaluate(() => ({
    textareaPlaceholder: document.querySelector('.chat-composer textarea')?.getAttribute('placeholder') ?? null,
    noteCount: document.querySelectorAll('.system-inline-note').length
  }));
  console.log('after new chat:', JSON.stringify(afterNewChat));

  await page.click('.chat-mode-button');
  await page.waitForSelector('.chat-mode-menu', { timeout: 5000 });
  const novelOption = page.locator('.chat-mode-option', { hasText: '小说' }).first();
  await novelOption.click();
  await page.waitForTimeout(500);
  const afterSwitch = await page.evaluate(() => ({
    buttonLabel: document.querySelector('.chat-mode-button-label')?.textContent ?? null,
    notes: Array.from(document.querySelectorAll('.system-inline-note')).map((n) => n.textContent),
    menuOpen: Boolean(document.querySelector('.chat-mode-menu'))
  }));
  console.log('after switch to novel:', JSON.stringify(afterSwitch, null, 2));
  await page.screenshot({ path: `${outDir}/04-novel-switched.png` });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.chat-composer textarea', { timeout: 30000 });
  await page.waitForTimeout(800);
  const afterReload = await page.evaluate(() => ({
    buttonLabel: document.querySelector('.chat-mode-button-label')?.textContent ?? null,
    notes: Array.from(document.querySelectorAll('.system-inline-note')).map((n) => n.textContent)
  }));
  console.log('after reload (persistence):', JSON.stringify(afterReload, null, 2));
  await page.screenshot({ path: `${outDir}/05-after-reload.png` });

} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
