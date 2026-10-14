const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  async function snap(n){ await page.waitForTimeout(1400); await page.screenshot({ path: "work/t3-"+n+".png" }); }
  async function click(t,n){ try{ await page.getByText(t,{exact:true}).first().click({timeout:2500}); await snap(n); return true;}catch(e){ console.log("MISS",t); return false;} }
  await click("协作者设置","personas");
  await click("小助手","persona-detail");
  console.log("DETAIL BODY:\n", (await page.evaluate(()=>document.body.innerText)).slice(0,900));
  await b.close();

  const b2 = await chromium.launch({ executablePath: EXE });
  const m = await b2.newPage({ viewport: { width: 390, height: 844 }, isMobile:true, hasTouch:true });
  await m.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await m.waitForTimeout(2500);
  await m.screenshot({ path: "work/t3-mobile-home.png" });
  try{ await m.getByText("卡片",{exact:true}).first().click({timeout:2500}); await m.waitForTimeout(1200); await m.screenshot({path:"work/t3-mobile-cards.png"});}catch(e){ console.log("MISS mobile cards"); }
  console.log("MOBILE BODY:\n", (await m.evaluate(()=>document.body.innerText)).slice(0,700));
  await b2.close();
})();
