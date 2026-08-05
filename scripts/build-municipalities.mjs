// 市区町村マスタ生成スクリプト
// 入力: geolonia/japanese-addresses の住所CSV
// 出力: src/lib/geo/municipalities.json
//
//   node scripts/build-municipalities.mjs path/to/latest.csv src/lib/geo/municipalities.json
//
// 代表座標の求め方
//   住所1件ごとの座標をそのまま平均すると、元データに紛れている明らかに
//   おかしい座標（緯度と経度が入れ替わっているものなど）に引きずられて、
//   市区町村の代表点が海の上や別の県へ飛んでしまう。
//   そこで「日本の範囲に入る点だけを使い、中央値から離れた点を捨ててから平均する」
//   という手順にして、数件の異常値では動かないようにしている。
import fs from "node:fs";
import readline from "node:readline";

const src = process.argv[2];
const out = process.argv[3] ?? "src/lib/geo/municipalities.json";

// 日本のおおよその範囲（南鳥島・沖ノ鳥島まで含む）
const JP_LAT = [20.0, 45.8];
const JP_LNG = [122.0, 154.2];
// 中央値からこれ以上離れた点は、同じ市区町村の座標とみなさない（度）
const OUTLIER_DEGREES = 0.5;

const rl = readline.createInterface({ input: fs.createReadStream(src), crlfDelay: Infinity });

const map = new Map();
let first = true;
for await (const line of rl) {
  if (first) {
    first = false;
    continue;
  }
  const cols = line.split(",").map((c) => c.replace(/^"|"$/g, ""));
  const [prefCode, prefName, , , muniCode, muniName] = cols;
  const lat = Number(cols[12]);
  const lng = Number(cols[13]);
  if (!muniCode || !muniName) continue;

  let entry = map.get(muniCode);
  if (!entry) {
    entry = { code: muniCode, name: muniName, prefCode, prefName, points: [] };
    map.set(muniCode, entry);
  }

  if (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= JP_LAT[0] &&
    lat <= JP_LAT[1] &&
    lng >= JP_LNG[0] &&
    lng <= JP_LNG[1]
  ) {
    entry.points.push([lat, lng]);
  }
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

function representativePoint(points) {
  if (points.length === 0) return [null, null];
  const midLat = median(points.map((p) => p[0]));
  const midLng = median(points.map((p) => p[1]));
  const kept = points.filter(
    ([lat, lng]) => Math.abs(lat - midLat) <= OUTLIER_DEGREES && Math.abs(lng - midLng) <= OUTLIER_DEGREES,
  );
  const used = kept.length > 0 ? kept : [[midLat, midLng]];
  const sum = used.reduce((acc, [lat, lng]) => [acc[0] + lat, acc[1] + lng], [0, 0]);
  return [Number((sum[0] / used.length).toFixed(5)), Number((sum[1] / used.length).toFixed(5))];
}

let missing = 0;
const list = [...map.values()]
  .sort((a, b) => a.code.localeCompare(b.code))
  .map((entry) => {
    const [lat, lng] = representativePoint(entry.points);
    if (lat === null) missing += 1;
    return {
      code: entry.code,
      name: entry.name,
      prefectureCode: entry.prefCode,
      lat,
      lng,
    };
  });

fs.mkdirSync(out.replace(/\/[^/]+$/, ""), { recursive: true });
fs.writeFileSync(out, JSON.stringify(list));
console.log("municipalities:", list.length, "/ 座標なし:", missing);
