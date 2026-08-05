// 都道府県の地図パス生成スクリプト
// 入力: dataofjapan/land の japan.geojson
// 出力: src/lib/geo/prefecture-paths.json（SVG パス + バウンディングボックス）
import fs from "node:fs";

const src = process.argv[2];
const out = process.argv[3];

const geo = JSON.parse(fs.readFileSync(src, "utf8"));

const LAT_K = Math.cos((36 * Math.PI) / 180); // 経度方向の縮み補正
const TOLERANCE = 0.008; // 度。海岸線を柔らかく間引く
const MIN_AREA_RATIO = 0.004; // 主要な島だけ残す
const MAX_ISLAND_DIST = 3.6; // 主島からこれ以上離れた離島は省略

// 沖縄県は先島諸島まで含めると横に広がりすぎるため沖縄本島周辺のみ描画する
const ISLAND_DIST_OVERRIDE = { 47: 1.5 };

// 沖縄県は本土から離れているため、日本海側の余白へインセット配置する
const INSETS = { 47: { dx: 5.0, dy: 14.0 } };

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

// Douglas-Peucker
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

function project([lng, lat], offset) {
  return [(lng + offset.dx) * LAT_K, -(lat + offset.dy)];
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

/**
 * ラベルを置くのに適した点を求める（pole of inaccessibility の簡易版）。
 * 三日月型の県では外接矩形の中心や重心が海上に出てしまうため、
 * 内部の点のうち海岸線から最も遠い点を選ぶ。
 */
function labelPointOf(ring) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  const steps = 24;
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

const prefectures = [];

for (const feature of geo.features) {
  const id = feature.properties.id;
  const offset = INSETS[id] ?? { dx: 0, dy: 0 };
  const maxIslandDist = ISLAND_DIST_OVERRIDE[id] ?? MAX_ISLAND_DIST;
  const polygons =
    feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;

  // 外環のみ使用（内側の穴は柔らかい表現では不要）
  const rings = polygons.map((poly) => poly[0]).filter((r) => r && r.length >= 4);
  const withArea = rings.map((ring) => ({ ring, area: ringArea(ring) }));
  withArea.sort((a, b) => b.area - a.area);
  const largest = withArea[0];
  const mainCenter = centroid(largest.ring);

  const kept = withArea.filter(({ ring, area }) => {
    if (area < largest.area * MIN_AREA_RATIO) return false;
    const c = centroid(ring);
    return Math.hypot(c[0] - mainCenter[0], c[1] - mainCenter[1]) <= maxIslandDist;
  });

  let d = "";
  let labelPoint = null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const { ring } of kept) {
    const pts = simplify(
      ring.map((p) => project(p, offset)),
      TOLERANCE,
    );
    if (pts.length < 3) continue;
    d += `M${pts.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join("L")}Z`;
    if (!labelPoint) labelPoint = labelPointOf(pts);
    for (const [x, y] of pts) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  prefectures.push({
    code: String(id).padStart(2, "0"),
    name: feature.properties.nam_ja,
    d,
    bbox: [minX, minY, maxX, maxY].map((v) => Number(v.toFixed(3))),
    // ラベルは陸地の内側に置く
    center: (labelPoint ?? [(minX + maxX) / 2, (minY + maxY) / 2]).map((v) => Number(v.toFixed(3))),
  });
}

prefectures.sort((a, b) => a.code.localeCompare(b.code));

fs.mkdirSync(out.replace(/\/[^/]+$/, ""), { recursive: true });
fs.writeFileSync(out, JSON.stringify(prefectures));
console.log("prefectures:", prefectures.length, "bytes:", fs.statSync(out).size);
