import { PREFECTURES, getPrefecturesByRegion, viewBoxFor } from "@/lib/geo";
import { REGIONS } from "@/lib/geo/regions";
import { AreaMap, type MapShape } from "./area-map";

/** 地方名ラベルの位置（viewBox 座標。読みやすい場所を選んで調整している） */
const REGION_LABEL: Record<string, [number, number]> = {
  hokkaido: [115.5, -43.4],
  tohoku: [113.9, -39.2],
  kanto: [113.2, -35.5],
  chubu: [111.2, -36.6],
  kinki: [109.7, -34.4],
  chugoku: [107.2, -34.9],
  shikoku: [107.9, -33.5],
  "kyushu-okinawa": [105.5, -32.3],
};

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
        viewBox={viewBoxFor(PREFECTURES, 0.3)}
        ariaLabel="日本地図。地方を選ぶと都道府県一覧へ移動します"
        className="h-auto w-full"
      />
      <p className="mt-1 text-center text-[11px] text-ink-faint">
        沖縄県は見やすさのため、地図の左上へ移動して表示しています。
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
  // 県が多い地方はラベルが重なるため、面積の小さい県のラベルは省く
  const areaOf = (p: (typeof prefectures)[number]) =>
    (p.bbox[2] - p.bbox[0]) * (p.bbox[3] - p.bbox[1]);
  const showLabel = new Set(
    prefectures.filter((p) => areaOf(p) > 0.12 || prefectures.length <= 5).map((p) => p.code),
  );

  const shapes: MapShape[] = prefectures.map((p) => ({
    key: p.code,
    name: p.name,
    paths: [p.d],
    tone: p.region.tone,
    visited: Boolean(visitedPrefectures[p.code]),
    href: `/map/${regionSlug}/${p.code}`,
    labelAt: showLabel.has(p.code) ? p.center : null,
  }));

  const box = viewBoxFor(prefectures, 0.2);
  const width = Number(box.split(" ")[2] ?? 1);

  return (
    <AreaMap
      shapes={shapes}
      viewBox={box}
      // 表示範囲が狭いほど文字も小さくする
      labelSize={Math.max(0.12, width / 26)}
      ariaLabel="地方の地図。都道府県を選ぶと市区町村一覧へ移動します"
      className={className}
    />
  );
}
