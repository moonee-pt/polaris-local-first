import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const host = '127.0.0.1';
const port = 4212;
const baseUrl = `http://${host}:${port}`;
const server = spawn('npm', ['run', 'dev', '--', '--host', host, '--port', String(port)], {
  cwd: process.cwd(), stdio: 'pipe', shell: true
});
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
let failed = false;
try {
  if (!await waitFor(`${baseUrl}/?debugQa=1`)) throw new Error('no server');
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(`${baseUrl}/?debugQa=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell', { timeout: 60000 });
  await page.locator('.world-switch-veil').first().click({ force: true });
  await page.waitForSelector('.chat-composer textarea', { timeout: 40000 });
  await page.waitForTimeout(600);
  await page.getByLabel('新对话').first().click();
  await page.waitForTimeout(1000);

  const read = () => page.evaluate(() => ({
    label: document.querySelector('.chat-mode-button-label')?.textContent ?? null,
    notes: Array.from(document.querySelectorAll('.system-inline-note')).map((n) => n.textContent)
  }));
  const pick = async (text) => {
    await page.locator('.chat-mode-button').click();
    await page.waitForSelector('.chat-mode-menu', { timeout: 8000 });
    await page.locator('.chat-mode-option', { hasText: text }).first().click();
    await page.waitForTimeout(900);
  };

  console.log('a) fresh:', JSON.stringify(await read()));
  await pick('小说');
  console.log('b) pick novel:', JSON.stringify(await read()));
  await pick('音声');
  const after = await read();
  console.log('c) pick voice:', JSON.stringify(after));
  const ok = after.notes.length === 1 && /音声/.test(after.notes[0] ?? '');
  console.log('ASSERT only-last:', ok ? 'PASS' : 'FAIL');
  if (!ok) failed = true;
  console.log('errors:', JSON.stringify(errs.slice(0, 5)));
  await page.screenshot({ path: 'work/mode-shot/dedup-verify.png' });
} catch (e) {
  failed = true;
  console.log('THREW:', String(e).slice(0, 300));
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  process.exit(failed ? 1 : 0);
}
