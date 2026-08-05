// 都道府県の地図パス生成スクリプト
// 入力: dataofjapan/land の japan.geojson
// 出力: src/lib/geo/prefecture-paths.json（SVG パス + バウンディングボックス）
//       src/lib/geo/map-insets.json    （離島を囲む枠と見出し）
//
//   node scripts/build-prefecture-paths.mjs path/to/japan.geojson src/lib/geo
//
// 離島の扱い
//   本土から遠く離れた島（沖縄本島・先島諸島・小笠原諸島）は、そのままの位置に
//   描くと地図全体が横に広がって本土が小さくなってしまう。そこで島ごとに
//   「グループ」を作り、海の余白へ寄せて枠付きで描く。位置を動かしたことが
//   分かるように、枠と見出しを別ファイルへ書き出す。
//
//   日本地図（全国）と地方地図では余白の場所が違うため、寄せ先はそれぞれに
//   持たせている（national / regional）。
import fs from "node:fs";
import path from "node:path";

const src = process.argv[2];
const outDir = process.argv[3] ?? "src/lib/geo";

const geo = JSON.parse(fs.readFileSync(src, "utf8"));

const LAT_K = Math.cos((36 * Math.PI) / 180); // 経度方向の縮み補正
const TOLERANCE = 0.008; // 度。海岸線を柔らかく間引く
const MIN_AREA_RATIO = 0.004; // 本土グループで残す島の面積比
const MAX_ISLAND_DIST = 3.6; // 本土グループに含める距離（度）
const MIN_ISPAN = 0.1; // 描画時の島の最小の大きさ（地図座標）

// 本土から離れすぎて既定では落ちてしまう島を拾うための例外
const MAX_ISLAND_DIST_OVERRIDE = {
  46: 6.2, // 奄美群島（与論島まで）を実際の位置に描く
};

/**
 * 離島グループ。bounds に重心が入る島をまとめて1つの枠として扱う。
 *   core       … その都道府県の本体（見出しの位置決めに使う）
 *   national   … 日本地図での寄せ先。place は枠の左上（地図座標）
 *   regional   … 地方地図での寄せ先。省略すると実際の位置のまま
 *   prefecture … 都道府県だけを表示する地図での寄せ先。
 *                こちらは本体の大きさに合わせて自動配置するので指定は不要
 *
 * 都道府県だけを表示すると、東京都のように本土が小さく離島が広がる県では
 * 本土が読めなくなる。そのため都道府県スケールでは、本体の右側へ
 * 縮めた枠を積んで配置する（inset）。
 */
const ISLAND_GROUPS = {
  13: [
    {
      id: "izu",
      label: "伊豆諸島",
      // 都道府県の地図でだけ寄せる（日本地図・地方地図では実際の位置に描く）
      bounds: [138.6, 31.8, 140.5, 35.0],
      insetOnly: ["prefecture"],
    },
    {
      id: "ogasawara",
      label: "小笠原諸島",
      // 南鳥島(154E)・沖ノ鳥島(136E/20N)は離れすぎるため描かない
      bounds: [140.0, 23.0, 145.0, 28.5],
      national: { place: [113.6, -32.6] },
      regional: { place: [114.4, -36.4] },
    },
  ],
  46: [
    {
      id: "amami",
      label: "奄美群島",
      bounds: [128.0, 26.6, 130.2, 29.0],
      insetOnly: ["prefecture"],
    },
  ],
  47: [
    {
      id: "okinawa",
      label: "沖縄本島",
      core: true,
      bounds: [125.8, 25.6, 129.5, 28.2],
      national: { place: [106.5, -41.3] },
      regional: { place: [107.9, -32.2] },
    },
    {
      id: "sakishima",
      label: "先島諸島",
      bounds: [122.0, 23.0, 125.8, 26.2],
      national: { place: [104.3, -39.6] },
      regional: { place: [107.9, -30.4] },
    },
    {
      id: "daito",
      label: "大東諸島",
      bounds: [130.5, 23.5, 132.5, 26.5],
      national: { place: [107.4, -39.6] },
      regional: { place: [110.55, -32.2] },
    },
  ],
};

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

/** 緯度経度 → 地図座標 */
function project([lng, lat]) {
  return [lng * LAT_K, -lat];
}

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

/** 小さすぎる島は、重心を中心に最小の大きさまで広げて見えるようにする */
function enlargeIfTiny(points) {
  const [minX, minY, maxX, maxY] = boundsOf(points);
  const span = Math.max(maxX - minX, maxY - minY);
  if (span >= MIN_ISPAN || span === 0) return points;
  const factor = MIN_ISPAN / span;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return points.map(([x, y]) => [cx + (x - cx) * factor, cy + (y - cy) * factor]);
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
  const [minX, minY, maxX, maxY] = boundsOf(ring);
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

const inBounds = ([lng, lat], [w, s, e, n]) => lng >= w && lng <= e && lat >= s && lat <= n;

/**
 * 図形の変換。[倍率, x の移動量, y の移動量] で表し、
 * x' = x * 倍率 + 移動量 として適用する。市区町村の境界も同じ変換を使う。
 */
function transformFor(placement, groupBounds) {
  if (!placement) return [1, 0, 0];
  const scale = placement.scale ?? 1;
  if (placement.place) {
    return [scale, placement.place[0] - groupBounds[0] * scale, placement.place[1] - groupBounds[1] * scale];
  }
  return [scale, placement.dx ?? 0, placement.dy ?? 0];
}

const applyTransform = (points, [scale, tx, ty]) =>
  points.map(([x, y]) => [x * scale + tx, y * scale + ty]);
const toPath = (rings) =>
  rings.map((pts) => `M${pts.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join("L")}Z`).join("");

const prefectures = [];
const insets = [];

for (const feature of geo.features) {
  const id = feature.properties.id;
  const code = String(id).padStart(2, "0");
  const groups = ISLAND_GROUPS[id] ?? [];
  const maxIslandDist = MAX_ISLAND_DIST_OVERRIDE[id] ?? MAX_ISLAND_DIST;

  const polygons =
    feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;

  // 外環のみ使用（内側の穴は柔らかい表現では不要）
  const rings = polygons.map((poly) => poly[0]).filter((r) => r && r.length >= 4);
  const withArea = rings.map((ring) => ({ ring, area: ringArea(ring), center: centroid(ring) }));
  withArea.sort((a, b) => b.area - a.area);

  // 島をグループへ振り分ける。どのグループにも入らない島は本土グループへ
  const buckets = new Map(groups.map((g) => [g.id, []]));
  const mainland = [];
  for (const item of withArea) {
    const group = groups.find((g) => inBounds(item.center, g.bounds));
    if (group) buckets.get(group.id).push(item);
    else mainland.push(item);
  }

  // 本土グループ: 大きさと本島からの距離で間引く
  let mainlandKept = [];
  if (mainland.length > 0) {
    const largest = mainland[0];
    mainlandKept = mainland.filter(
      ({ area, center }) =>
        area >= largest.area * MIN_AREA_RATIO &&
        Math.hypot(center[0] - largest.center[0], center[1] - largest.center[1]) <= maxIslandDist,
    );
  }

  // 離島グループ: そのグループの中で相対的に小さすぎる島だけを落とす
  const groupKept = new Map();
  for (const group of groups) {
    const items = buckets.get(group.id) ?? [];
    if (items.length === 0) continue;
    groupKept.set(
      group.id,
      items.filter((item) => item.area >= items[0].area * 0.02),
    );
  }

  // 日本地図では小さすぎる島を見える大きさまで広げるが、
  // 都道府県だけを表示する地図では等倍のままにする（本体との大きさが合わなくなるため）
  const simplifyRings = (items, enlarge) =>
    items
      .map((item) => {
        const points = simplify(item.ring.map(project), TOLERANCE);
        return enlarge ? enlargeIfTiny(points) : points;
      })
      .filter((pts) => pts.length >= 3);

  const wideMainland = simplifyRings(mainlandKept, true);
  const wideGroups = new Map([...groupKept].map(([gid, items]) => [gid, simplifyRings(items, true)]));
  const plainMainland = simplifyRings(mainlandKept, false);
  const plainGroups = new Map([...groupKept].map(([gid, items]) => [gid, simplifyRings(items, false)]));

  const coreGroup = groups.find((g) => g.core);

  /** その縮尺で枠として寄せるグループかどうか */
  const isInsetIn = (group, kind) => {
    if (group.insetOnly) return group.insetOnly.includes(kind);
    if (kind === "prefecture") return !group.core;
    return Boolean(group[kind]);
  };

  /**
   * 都道府県だけを表示する地図での枠の位置を、本体の大きさから自動で決める。
   * 本体の右側に、縮めた枠を上から順に積む。
   */
  function autoPlacements(coreBounds) {
    const coreWidth = coreBounds[2] - coreBounds[0];
    const coreHeight = coreBounds[3] - coreBounds[1];
    const gap = Math.max(coreWidth, coreHeight) * 0.06;
    const placements = new Map();
    let cursorY = coreBounds[1];

    for (const group of groups) {
      if (!isInsetIn(group, "prefecture")) continue;
      const rings = plainGroups.get(group.id);
      if (!rings || rings.length === 0) continue;
      const [x0, y0, x1, y1] = boundsOf(rings.flat());
      const width = x1 - x0;
      const height = y1 - y0;
      const scale = Math.min(1, (coreHeight * 1.1) / (height || 1), (coreWidth * 0.5) / (width || 1));
      placements.set(group.id, { place: [coreBounds[2] + gap, cursorY], scale });
      cursorY += height * scale + gap * 2.2;
    }
    return placements;
  }

  const build = (kind) => {
    const wide = kind !== "prefecture";
    const mainlandRings = wide ? wideMainland : plainMainland;
    const groupRings = wide ? wideGroups : plainGroups;

    // 枠にしないグループの図形は、本体と同じ扱いで実際の位置に描く
    const inPlace = groups.filter((g) => !isInsetIn(g, kind)).flatMap((g) => groupRings.get(g.id) ?? []);
    const baseRings = [...mainlandRings, ...inPlace];

    const coreSource =
      mainlandRings.length > 0
        ? mainlandRings
        : (groupRings.get(coreGroup?.id) ?? baseRings);
    const coreBounds = boundsOf((baseRings.length > 0 ? baseRings : coreSource).flat());
    const auto = kind === "prefecture" ? autoPlacements(coreBounds) : null;

    const allRings = [...baseRings];
    let labelSource = coreSource[0] ?? null;

    for (const group of groups) {
      if (!isInsetIn(group, kind)) continue;
      const ringsOfGroup = groupRings.get(group.id);
      if (!ringsOfGroup || ringsOfGroup.length === 0) continue;

      const groupBounds = boundsOf(ringsOfGroup.flat());
      const placement = auto?.get(group.id) ?? group[kind];
      const transform = transformFor(placement, groupBounds);
      const moved = ringsOfGroup.map((pts) => applyTransform(pts, transform));
      allRings.push(...moved);
      if (group.core && mainlandRings.length === 0) labelSource = moved[0];

      const [minX, minY, maxX, maxY] = boundsOf(moved.flat());
      const pad = Math.max(maxX - minX, maxY - minY) * 0.12 + 0.02;
      const frame = [minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2].map((v) =>
        Number(v.toFixed(3)),
      );

      let entry = insets.find((i) => i.id === group.id);
      if (!entry) {
        // bounds と transform は、市区町村の境界を同じ場所へ寄せるために使う
        entry = { id: group.id, label: group.label, prefectureCode: code, bounds: group.bounds };
        insets.push(entry);
      }
      entry[kind] = frame;
      entry[`${kind}Transform`] = transform.map((v) => Number(v.toFixed(4)));
    }

    const [minX, minY, maxX, maxY] = boundsOf(allRings.flat());
    return {
      d: toPath(allRings),
      bbox: [minX, minY, maxX, maxY].map((v) => Number(v.toFixed(3))),
      center: (labelSource ? labelPointOf(labelSource) : [(minX + maxX) / 2, (minY + maxY) / 2]).map((v) =>
        Number(v.toFixed(3)),
      ),
    };
  };

  const national = build("national");
  const regional = build("regional");
  const prefectureScope = build("prefecture");

  prefectures.push({
    code,
    name: feature.properties.nam_ja,
    d: national.d,
    bbox: national.bbox,
    center: national.center,
    // 地方地図・都道府県地図では離島の寄せ先が変わるため、別に持つ
    rd: regional.d,
    rbbox: regional.bbox,
    rcenter: regional.center,
    pd: prefectureScope.d,
    pbbox: prefectureScope.bbox,
    pcenter: prefectureScope.center,
  });
}

prefectures.sort((a, b) => a.code.localeCompare(b.code));
insets.sort((a, b) => a.id.localeCompare(b.id));

fs.mkdirSync(outDir, { recursive: true });
const pathsFile = path.join(outDir, "prefecture-paths.json");
const insetsFile = path.join(outDir, "map-insets.json");
fs.writeFileSync(pathsFile, JSON.stringify(prefectures));
fs.writeFileSync(insetsFile, JSON.stringify(insets, null, 2));

const overall = prefectures.reduce(
  (acc, p) => [
    Math.min(acc[0], p.bbox[0]),
    Math.min(acc[1], p.bbox[1]),
    Math.max(acc[2], p.bbox[2]),
    Math.max(acc[3], p.bbox[3]),
  ],
  [Infinity, Infinity, -Infinity, -Infinity],
);

console.log("prefectures:", prefectures.length, "bytes:", fs.statSync(pathsFile).size);
console.log("insets:", insets.map((i) => i.id).join(", "));
console.log("全国の地図範囲:", overall.map((v) => v.toFixed(2)).join(", "));
for (const inset of insets) {
  console.log(
    `  ${inset.id}: national=${inset.national ? "有" : "-"} regional=${inset.regional ? "有" : "-"} prefecture=${inset.prefectureTransform?.join(",")}`,
  );
}
