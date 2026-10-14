const fs = require("fs");
const path = require("path");
const root = process.argv[2];
function oggInfo(buf) {
  let off = 0, sampleRate = 0, channels = 0, maxGranule = 0n, codec = "?";
  let firstRead = false;
  while (off + 27 <= buf.length) {
    if (buf.toString("ascii", off, off + 4) !== "OggS") break;
    const granule = buf.readBigInt64LE(off + 6);
    const nsegs = buf[off + 26];
    const tableEnd = off + 27 + nsegs;
    if (tableEnd > buf.length) break;
    let payloadLen = 0;
    for (let i = 0; i < nsegs; i++) payloadLen += buf[off + 27 + i];
    if (!firstRead && payloadLen > 20) {
      const p = tableEnd;
      if (buf.toString("ascii", p + 1, p + 7) === "vorbis") {
        codec = "vorbis"; channels = buf[p + 11]; sampleRate = buf.readUInt32LE(p + 12);
      } else if (buf.toString("ascii", p, p + 8) === "OpusHead") {
        codec = "opus"; channels = buf[p + 9]; sampleRate = 48000;
        const inputSr = buf.readUInt32LE(p + 12); if (inputSr) sampleRate = inputSr;
      } else if (buf.toString("ascii", p, p + 4) === "fLaC") {
        codec = "flac";
      }
      firstRead = true;
    }
    if (granule > 0n && granule > maxGranule) maxGranule = granule;
    off = tableEnd + payloadLen;
  }
  let rate = sampleRate;
  if (codec === "opus") rate = sampleRate || 48000;
  const dur = rate ? Number(maxGranule) / rate : 0;
  return { dur, sampleRate, channels, codec };
}
const dirs = fs.readdirSync(root).filter((d) => fs.statSync(path.join(root, d)).isDirectory());
const all = [];
for (const d of dirs) {
  const files = fs.readdirSync(path.join(root, d)).filter((f) => f.endsWith(".ogg")).sort();
  const rows = files.map((f) => ({ f, ...oggInfo(fs.readFileSync(path.join(root, d, f))) }));
  all.push(...rows);
  const durs = rows.map((r) => r.dur);
  console.log(`${d.padEnd(12)} n=${String(rows.length).padStart(2)}  ${Math.min(...durs).toFixed(2)}~${Math.max(...durs).toFixed(2)}s  avg ${(durs.reduce((a,b)=>a+b,0)/durs.length).toFixed(2)}s  codec=${rows[0].codec} sr=${rows[0].sampleRate} ch=${rows[0].channels}`);
}
console.log("--- 明细 ---");
for (const r of all) console.log(`${r.f.padEnd(16)} ${r.dur.toFixed(2)}s`);
const tot = all.reduce((a, b) => a + b.dur, 0);
console.log("files:", all.length, " total:", tot.toFixed(1), "s  avg:", (tot/all.length).toFixed(2), "s");
