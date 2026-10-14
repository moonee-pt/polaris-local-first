const base = "https://polaris-local-first-two.vercel.app";
(async () => {
  const html = await (await fetch(base + "/")).text();
  const assets = [...new Set([...html.matchAll(/assets\/[A-Za-z0-9_.\-]+\.(js|css)/g)].map((m) => m[0]))];
  console.log("assets:", assets.length);
  const hits = [];
  for (const a of assets) {
    const js = await (await fetch(base + "/" + a)).text();
    for (const m of js.matchAll(/1\.4\.[0-9]+/g)) hits.push(a + " -> " + m[0]);
    for (const m of js.matchAll(/1\.3\.[0-9]+/g)) hits.push(a + " -> " + m[0]);
  }
  console.log([...new Set(hits)].slice(0, 20).join("\n") || "NO_VERSION_STRING");
  const idx = html.match(/assets\/index[A-Za-z0-9_.\-]*\.js/);
  console.log("entry:", idx ? idx[0] : "(none)", "main:", (html.match(/assets\/main-[A-Za-z0-9_.\-]+\.js/)||[])[0]);
})();