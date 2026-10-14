import fs from "node:fs";
const file = "package.json";
const text = fs.readFileSync(file, "utf8");
const next = text.replace('"version": "1.6.2"', '"version": "1.7.0"');
if (next === text) throw new Error("version anchor not found");
fs.writeFileSync(file, next, "utf8");
console.log("bumped");
