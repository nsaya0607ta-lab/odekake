import { PREFECTURES, getPrefecturesByRegion, insetsFor, shapeOf, viewBoxFor } from "@/lib/geo";
import { REGIONS } from "@/lib/geo/regions";
import { AreaMap, type MapInsetFrame, type MapShape } from "./area-map";

/** 地方名ラベルの位置（viewBox 座標。読みやすい場所を選んで調整している） */
const REGION_LABEL: Record<string, [number, number]> = {
  hokkaido: [115.5, -43.4],
  tohoku: [113.9, -39.2],
  kanto: [113.2, -35.5],
  chubu: [111.2, -36.6],
  kinki: [109.7, -34.4],
  chugoku: [107.2, -34.9],
  shikoku: [107.9, -33.5],
  "kyushu-okinawa": [105.4, -31.4],
};

const framesOf = (scope: "national" | "regional", regionSlug?: string): MapInsetFrame[] =>
  insetsFor(scope, regionSlug);

/**
 * 日本地図（地方選択）。地方ごとに色分けし、タップでその地方の画面へ遷移する。
 */
export function JapanMap({
  visitedRegions,
  className,
}: {
  visitedRegions: Record<string, boolean>;
  className?: string;
}) {
  const shapes: MapShape[] = REGIONS.map((region) => ({
    key: region.slug,
    name: region.name,
    paths: getPrefecturesByRegion(region.slug).map((p) => p.d),
    tone: region.tone,
    visited: Boolean(visitedRegions[region.slug]),
    href: `/map/${region.slug}`,
    labelAt: REGION_LABEL[region.slug] ?? null,
  }));

  return (
    <div className={className}>
      <AreaMap
        shapes={shapes}
        viewBox={viewBoxFor(PREFECTURES, "national", 0.3)}
        insets={framesOf("national")}
        ariaLabel="日本地図。地方を選ぶと都道府県一覧へ移動します"
        className="h-auto w-full"
        colorUnvisited
      />
      <p className="mt-1 text-center text-[11px] leading-relaxed text-ink-faint">
        訪問した地方は色が濃くなります。タップすると都道府県一覧へ移動します。
      </p>
    </div>
  );
}

/**
 * 地方地図（都道府県選択）。選んだ地方の県だけを拡大して表示する。
 */
export function RegionMap({
  regionSlug,
  visitedPrefectures,
  className,
}: {
  regionSlug: string;
  visitedPrefectures: Record<string, boolean>;
  className?: string;
}) {
  const prefectures = getPrefecturesByRegion(regionSlug);
  const box = viewBoxFor(prefectures, "regional", 0.2);
  const width = Number(box.split(" ")[2] ?? 1);
  const labelSize = Math.max(0.12, width / 26);

  // 面積の小さい県と、すでに置いたラベルに近すぎる県のラベルは省いて重なりを避ける
  const areaOf = (p: (typeof prefectures)[number]) => {
    const [x0, y0, x1, y1] = shapeOf(p, "regional").bbox;
    return (x1 - x0) * (y1 - y0);
  };
  const placed: Array<[number, number]> = [];
  const showLabel = new Set<string>();
  for (const p of [...prefectures].sort((a, b) => areaOf(b) - areaOf(a))) {
    if (areaOf(p) <= 0.12 && prefectures.length > 5) continue;
    const [cx, cy] = shapeOf(p, "regional").center;
    const overlaps = placed.some(
      ([px, py]) => Math.abs(px - cx) < labelSize * 2.4 && Math.abs(py - cy) < labelSize * 1.1,
    );
    if (overlaps) continue;
    placed.push([cx, cy]);
    showLabel.add(p.code);
  }

  const shapes: MapShape[] = prefectures.map((p) => {
    const shape = shapeOf(p, "regional");
    return {
      key: p.code,
      name: p.name,
      paths: [shape.d],
      tone: p.region.tone,
      visited: Boolean(visitedPrefectures[p.code]),
      href: `/map/${regionSlug}/${p.code}`,
      labelAt: showLabel.has(p.code) ? shape.center : null,
    };
  });

  const insets = framesOf("regional", regionSlug);

  return (
    <div className={className}>
      <AreaMap
        shapes={shapes}
        viewBox={box}
        labelSize={labelSize}
        insets={insets}
        ariaLabel="地方の地図。都道府県を選ぶとエリア一覧へ移動します"
        className="mx-auto h-auto w-full"
        colorUnvisited
      />
      {insets.length > 0 ? (
        <p className="mt-1 text-center text-[11px] leading-relaxed text-ink-faint">
          破線の枠の中は、見やすさのため実際の位置から動かして描いています。
        </p>
      ) : null}
    </div>
  );
}
