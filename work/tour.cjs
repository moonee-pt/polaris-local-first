const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  const shots = [];
  async function snap(name){ await page.waitForTimeout(1200); await page.screenshot({ path: "work/tour-"+name+".png" }); shots.push(name); }
  const labels = ["群聊","工作区","卡片","图片","协作者设置"];
  for (const l of labels){
    try { const el = page.getByText(l, { exact: true }).first(); await el.click({ timeout: 3000 }); await snap("nav-"+l); }
    catch(e){ console.log("skip", l, e.message.split("\n")[0]); }
  }
  try { await page.getByText("设置", { exact: true }).first().click({ timeout: 3000 }); await snap("settings"); } catch(e){ console.log("settings skip", e.message.split("\n")[0]); }
  console.log("DONE", shots.join(" | "));
  console.log("BODY:\n", (await page.evaluate(()=>document.body.innerText)).slice(0,1200));
  await b.close();
})();
