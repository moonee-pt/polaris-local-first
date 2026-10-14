const { chromium } = require("playwright");
const EXE = String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1181\chrome-win\chrome.exe`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ["--autoplay-policy=no-user-gesture-required"] });
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  const res = await page.evaluate(async () => {
    const out = {};
    const probe = async (url) => { const r = await fetch(url); return r.status + " " + (r.headers.get("content-type") || ""); };
    out.dry = await probe("/sfx/flesh/dryplap/plapdry01.ogg");
    out.wet = await probe("/sfx/flesh/wetplap/plapwet16.ogg");
    out.credits = await probe("/sfx/flesh/CREDITS.txt");
    const mod = await import("/src/engines/voice/fleshAmbience.ts");
    const loop = mod.createFleshAmbienceLoop({ seed: 42, preset: "mid" });
    const hits = loop.take(20);
    out.hits20s = hits.length;
    out.firstFive = hits.slice(0, 5).map((h) => `${h.atSec.toFixed(2)}s ${h.category}/${h.clip}`);
    out.cues = mod.readFleshCues("嗯…[flesh:hard] 过来 [cum]");
    out.stripped = mod.stripFleshCues("别躲 [flesh:soft] 过来");
    const ctx = new AudioContext();
    out.sampleRate = ctx.sampleRate;
    const decode = async (url) => {
      const data = await (await fetch(url)).arrayBuffer();
      const buf = await ctx.decodeAudioData(data);
      return `${buf.duration.toFixed(2)}s ${buf.numberOfChannels}ch ${buf.sampleRate}Hz`;
    };
    out.decodedDry = await decode("/sfx/flesh/dryplap/plapdry05.ogg").catch((e) => "ERR " + e.message);
    out.decodedWet = await decode("/sfx/flesh/wet/wet11.ogg").catch((e) => "ERR " + e.message);
    out.decodedCum = await decode("/sfx/flesh/cum/cum_out05.ogg").catch((e) => "ERR " + e.message);
    await ctx.close();
    return out;
  });
  console.log(JSON.stringify(res, null, 2));
  await b.close();
})();
