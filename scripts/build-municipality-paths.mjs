// 市区町村の境界パス生成スクリプト
// 入力: smartnews-smri/japan-topography の全国市区町村 GeoJSON（簡素化1%）
// 出力: src/lib/geo/municipality-paths/{都道府県コード}.json
//
//   node scripts/build-municipality-paths.mjs path/to/N03-21_210101.json src/lib/geo/municipality-paths
//
// 都道府県ごとにファイルを分けているのは、都道府県の画面を開いたときに
// その県の分だけをサーバー側で読み込むため（全国分を端末へ送らない）。
//
// 座標は prefecture-paths.json の「都道府県だけを表示する地図」（pd）に合わせる。
// 離島を寄せて描いている都道府県では、map-insets.json の prefectureTransform を
// 同じように適用する。
import fs from "node:fs";
import path from "node:path";

const src = process.argv[2];
const outDir = process.argv[3] ?? "src/lib/geo/municipality-paths";
const insetsFile = process.argv[4] ?? "src/lib/geo/map-insets.json";

const LAT_K = Math.cos((36 * Math.PI) / 180);
// 市区町村ごとに残す島の面積比（その市区町村のいちばん大きな島に対して）
const MIN_AREA_RATIO = 0.02;


const geo = JSON.parse(fs.readFileSync(src, "utf8"));
const insets = JSON.parse(fs.readFileSync(insetsFile, "utf8"));

function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a / 2);
}

function centroid(ring) {
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p[0];
    y += p[1];
  }
  return [x / ring.length, y / ring.length];
}

function simplify(points, tolerance) {
  if (points.length < 4) return points;
  const sqTol = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxSq = 0;
    let index = -1;
    const [ax, ay] = points[first];
    const [bx, by] = points[last];
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = points[i];
      let t = len ? ((px - ax) * dx + (py - ay) * dy) / len : 0;
      t = Math.max(0, Math.min(1, t));
      const sq = (px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2;
      if (sq > maxSq) {
        maxSq = sq;
        index = i;
      }
    }
    if (maxSq > sqTol && index > 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** 緯度経度 → 地図座標（枠へ寄せる前） */
const projectRaw = ([lng, lat]) => [lng * LAT_K, -lat];

/** その市区町村にかかる変換（枠へ寄せている離島なら縮小＋移動） */
function transformOf(prefectureCode, [lng, lat]) {
  const inset = insets.find(
    (i) =>
      i.prefectureCode === prefectureCode &&
      i.prefectureTransform &&
      lng >= i.bounds[0] &&
      lng <= i.bounds[2] &&
      lat >= i.bounds[1] &&
      lat <= i.bounds[3],
  );
  return inset ? inset.prefectureTransform : [1, 0, 0];
}

const applyTransform = (points, [scale, tx, ty]) =>
  points.map(([x, y]) => [x * scale + tx, y * scale + ty]);

function boundsOf(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distanceToRing(x, y, ring) {
  let min = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j];
    const [bx, by] = ring[i];
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    let t = len ? ((x - ax) * dx + (y - ay) * dy) / len : 0;
    t = Math.max(0, Math.min(1, t));
    min = Math.min(min, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return min;
}

/** ラベルと当たり判定の中心に使う点（陸地の内側で海岸線から最も遠い点） */
function labelPointOf(ring) {
  const [minX, minY, maxX, maxY] = boundsOf(ring);
  const steps = 12;
  let best = null;
  let bestDistance = -1;
  for (let i = 1; i < steps; i++) {
    for (let j = 1; j < steps; j++) {
      const x = minX + ((maxX - minX) * i) / steps;
      const y = minY + ((maxY - minY) * j) / steps;
      if (!pointInRing(x, y, ring)) continue;
      const distance = distanceToRing(x, y, ring);
      if (distance > bestDistance) {
        bestDistance = distance;
        best = [x, y];
      }
    }
  }
  return best ?? [(minX + maxX) / 2, (minY + maxY) / 2];
}

// 市区町村コードごとに、飛び地を含めたすべての外環を集める
const byCode = new Map();
for (const feature of geo.features) {
  const code = feature.properties?.N03_007;
  if (!code || !/^\d{5}$/.test(code)) continue;
  const prefectureCode = code.slice(0, 2);
  const polygons =
    feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;

  let entry = byCode.get(code);
  if (!entry) {
    entry = { code, prefectureCode, rings: [] };
    byCode.set(code, entry);
  }
  for (const polygon of polygons) {
    const ring = polygon[0];
    if (ring && ring.length >= 4) entry.rings.push(ring);
  }
}

// 都道府県ごとにまとめる
const byPrefecture = new Map();
for (const entry of byCode.values()) {
  const list = byPrefecture.get(entry.prefectureCode);
  if (list) list.push(entry);
  else byPrefecture.set(entry.prefectureCode, [entry]);
}

fs.mkdirSync(outDir, { recursive: true });

let totalBytes = 0;
let totalMunicipalities = 0;
const summary = [];

for (const [prefectureCode, entries] of [...byPrefecture].sort((a, b) => a[0].localeCompare(b[0]))) {
  // 描画したときの広さから、1画素より細かくならない程度の間引き幅を決める
  const rendered = entries.flatMap((e) =>
    e.rings.flat().map((p) => {
      const [x, y] = projectRaw(p);
      const [scale, tx, ty] = transformOf(prefectureCode, p);
      return [x * scale + tx, y * scale + ty];
    }),
  );
  const [minX, minY, maxX, maxY] = boundsOf(rendered);
  const span = Math.max(maxX - minX, maxY - minY);

  const municipalities = [];
  for (const entry of entries.sort((a, b) => a.code.localeCompare(b.code))) {
    const withArea = entry.rings.map((ring) => ({ ring, area: ringArea(ring), center: centroid(ring) }));
    withArea.sort((a, b) => b.area - a.area);
    const largest = withArea[0];
    if (!largest) continue;

    const transform = transformOf(prefectureCode, largest.center);
    const scale = transform[0];

    // 間引き幅は、その市区町村自身の大きさに合わせる。
    // 地図全体の広さだけで決めると、東京23区のように小さな市区町村が
    // 数個の頂点まで削られて形が崩れてしまう。
    const rawSpan = (() => {
      const [x0, y0, x1, y1] = boundsOf(largest.ring.map(projectRaw));
      return Math.max(x1 - x0, y1 - y0);
    })();
    const drawn = Math.min(span / 700, Math.max(span / 8000, rawSpan * scale * 0.015));
    const tolerance = drawn / scale;

    const parts = [];
    for (const { ring, area } of withArea) {
      if (area < largest.area * MIN_AREA_RATIO) continue;
      const points = simplify(ring.map(projectRaw), tolerance);
      if (points.length < 3) continue;
      const moved = applyTransform(points, transform);
      parts.push(moved);
    }
    if (parts.length === 0) continue;

    const d = parts
      .map((points) => `M${points.map(([x, y]) => `${x.toFixed(4)} ${y.toFixed(4)}`).join("L")}Z`)
      .join("");

    // 描画したときの大きさ。小さすぎるものは画面側で目印を重ねて押しやすくする
    const [bx0, by0, bx1, by1] = boundsOf(parts.flat());

    municipalities.push({
      code: entry.code,
      d,
      center: labelPointOf(parts[0]).map((v) => Number(v.toFixed(4))),
      span: Number(Math.max(bx1 - bx0, by1 - by0).toFixed(4)),
    });
  }

  const file = path.join(outDir, `${prefectureCode}.json`);
  fs.writeFileSync(file, JSON.stringify(municipalities));
  const bytes = fs.statSync(file).size;
  totalBytes += bytes;
  totalMunicipalities += municipalities.length;
  summary.push({ prefectureCode, count: municipalities.length, kb: Math.round(bytes / 1024) });
}

summary.sort((a, b) => b.kb - a.kb);
console.log("市区町村:", totalMunicipalities, "/ 合計:", (totalBytes / 1024 / 1024).toFixed(2), "MB");
console.log("大きいファイル:", summary.slice(0, 5).map((s) => `${s.prefectureCode}=${s.kb}KB(${s.count})`).join(" "));
console.log("小さいファイル:", summary.slice(-3).map((s) => `${s.prefectureCode}=${s.kb}KB(${s.count})`).join(" "));
