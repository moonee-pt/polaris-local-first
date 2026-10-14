const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  async function snap(n){ await page.waitForTimeout(1300); await page.screenshot({ path: "work/t5-"+n+".png" }); }
  async function click(t,n){ try{ await page.getByText(t,{exact:true}).first().click({timeout:2500}); await snap(n); return true;}catch(e){ console.log("MISS",t); return false;} }
  await click("卡片","cards");
  console.log("CARDS BODY:\n", (await page.evaluate(()=>document.body.innerText)).slice(0,700));
  await click("工作区","workspace");
  console.log("WS BODY:\n", (await page.evaluate(()=>document.body.innerText)).slice(0,700));
  await page.reload({waitUntil:"networkidle"}); await page.waitForTimeout(2000);
  // desktop floating plus
  await page.mouse.click(1250, 719); await snap("plus-desktop");
  console.log("PLUS BODY:\n", (await page.evaluate(()=>document.body.innerText)).slice(0,900));
  await b.close();
})();
