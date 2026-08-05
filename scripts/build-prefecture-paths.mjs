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
    if (!labelPoint) labelPoint = centroid(pts);
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
    // ラベル位置は最大の島の重心（外接矩形の中心だと海上に出ることがある）
    center: (labelPoint ?? [(minX + maxX) / 2, (minY + maxY) / 2]).map((v) => Number(v.toFixed(3))),
  });
}

prefectures.sort((a, b) => a.code.localeCompare(b.code));

fs.mkdirSync(out.replace(/\/[^/]+$/, ""), { recursive: true });
fs.writeFileSync(out, JSON.stringify(prefectures));
console.log("prefectures:", prefectures.length, "bytes:", fs.statSync(out).size);
