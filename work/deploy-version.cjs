const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto("https://polaris-local-first-two.vercel.app/", { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(3000);
  const readVersion = () => page.evaluate(() => {
    const el = document.querySelector(".collaborator-scope-drawer-version");
    return el ? el.textContent : null;
  });
  let v = await readVersion();
  if (!v) {
    await page.locator('text=全部角色').first().click().catch(() => {});
    await page.waitForTimeout(1200);
    v = await readVersion();
  }
  console.log("DEPLOYED_VERSION:", v);
  await b.close();
})();