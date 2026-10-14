import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const host = '127.0.0.1';
const port = 4211;
const baseUrl = 'http://' + host + ':' + port;
const server = spawn('npm', ['run', 'dev', '--', '--host', host, '--port', String(port)], { cwd: process.cwd(), stdio: 'pipe', shell: true });
server.stdout.on('data', () => {});
server.stderr.on('data', () => {});
const waitFor = async (url) => {
  for (let i = 0; i < 120; i += 1) {
    try { const r = await fetch(url); if (r.ok || r.status === 404) return true; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};
let browser = null;
try {
  if (!await waitFor(baseUrl + '/?debugQa=1')) throw new Error('no server');
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(baseUrl + '/?debugQa=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell', { timeout: 40000 });
  await page.locator('.world-switch-veil').first().click({ force: true });
  await page.waitForSelector('.chat-composer textarea', { timeout: 40000 });
  await page.waitForTimeout(600);
  const read = () => page.evaluate(() => ({
    label: document.querySelector('.chat-mode-button-label')?.textContent ?? null,
    notes: Array.from(document.querySelectorAll('.system-inline-note')).map((n) => n.textContent)
  }));
  console.log('1) empty state:', JSON.stringify(await read()));
  await page.locator('.chat-mode-button').click();
  await page.waitForSelector('.chat-mode-menu', { timeout: 8000 });
  await page.locator('.chat-mode-option', { hasText: '小说' }).first().click();
  await page.waitForTimeout(600);
  console.log('2) after pick 小说 (no conversation):', JSON.stringify(await read()));
  await page.getByLabel('新对话').first().click({ force: true });
  await page.waitForTimeout(900);
  const stored = await page.evaluate(() => {
    const dev = window.__polarisDev;
    if (!dev) return 'no-dev-bridge';
    const snap = dev.snapshot();
    return { pending: snap?.chat?.pendingOutputMode ?? null };
  });
  console.log('3) after 新对话:', JSON.stringify(await read()));
  console.log('4) store check:', JSON.stringify(stored));
  await page.locator('.chat-mode-button').click();
  await page.waitForTimeout(300);
  await page.locator('.chat-mode-option', { hasText: '音声' }).first().click();
  await page.waitForTimeout(800);
  console.log('5) switch to 音声 inside conversation:', JSON.stringify(await read()));
  console.log('errors:', JSON.stringify(errs.slice(0, 4)));
  await page.screenshot({ path: 'work/mode-shot/fix-verify.png' });
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
