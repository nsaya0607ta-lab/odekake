// 市区町村マスタ生成スクリプト
// 入力: geolonia/japanese-addresses の住所CSV
// 出力: src/lib/geo/municipalities.json
import fs from "node:fs";
import readline from "node:readline";

const src = process.argv[2];
const out = process.argv[3];

const rl = readline.createInterface({ input: fs.createReadStream(src), crlfDelay: Infinity });

const map = new Map();
let first = true;
for await (const line of rl) {
  if (first) { first = false; continue; }
  const cols = line.split(",").map((c) => c.replace(/^"|"$/g, ""));
  const [prefCode, prefName, , , muniCode, muniName] = cols;
  const lat = Number(cols[12]);
  const lng = Number(cols[13]);
  if (!muniCode || !muniName) continue;
  let e = map.get(muniCode);
  if (!e) { e = { code: muniCode, name: muniName, prefCode, prefName, latSum: 0, lngSum: 0, n: 0 }; map.set(muniCode, e); }
  if (Number.isFinite(lat) && Number.isFinite(lng)) { e.latSum += lat; e.lngSum += lng; e.n += 1; }
}

const list = [...map.values()]
  .sort((a, b) => a.code.localeCompare(b.code))
  .map((e) => ({
    code: e.code,
    name: e.name,
    prefectureCode: e.prefCode,
    lat: e.n ? Number((e.latSum / e.n).toFixed(5)) : null,
    lng: e.n ? Number((e.lngSum / e.n).toFixed(5)) : null,
  }));

fs.mkdirSync(out.replace(/\/[^/]+$/, ""), { recursive: true });
fs.writeFileSync(out, JSON.stringify(list));
console.log("municipalities:", list.length);
