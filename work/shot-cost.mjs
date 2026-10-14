import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 1000 }, deviceScaleFactor: 2 });
await p.goto("file:///D:/tmp-shots/cost-preview.html");
await p.waitForTimeout(400);
const el = await p.$(".wrap");
await el.screenshot({ path: "D:/tmp-shots/cost-preview-v2.png" });
await b.close();
console.log("shot ok");
