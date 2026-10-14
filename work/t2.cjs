const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  async function snap(n){ await page.waitForTimeout(1300); await page.screenshot({ path: "work/t2-"+n+".png" }); }
  async function clickText(t, n){ try{ await page.getByText(t,{exact:true}).first().click({timeout:2500}); await snap(n); return true;}catch(e){ console.log("MISS",t); return false;} }
  await clickText("设置","settings");
  await page.keyboard.press("Escape"); await page.waitForTimeout(600);
  await page.reload({waitUntil:"networkidle"}); await page.waitForTimeout(2000);
  await clickText("协作者设置","persona-settings");
  await page.reload({waitUntil:"networkidle"}); await page.waitForTimeout(2000);
  await clickText("群聊","group"); 
  await clickText("新建群聊","group-create");
  await page.keyboard.press("Escape"); await page.waitForTimeout(500);
  await page.reload({waitUntil:"networkidle"}); await page.waitForTimeout(2000);
  // floating plus
  try{ await page.locator("button, [role=button]").filter({ hasText: /^\+$/ }).first().click({timeout:2500}); await snap("plus"); }catch(e){ console.log("MISS plus"); }
  console.log("BODY:\n", (await page.evaluate(()=>document.body.innerText)).slice(0,900));
  await b.close();
})();
