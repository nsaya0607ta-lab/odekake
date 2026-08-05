import Link from "next/link";
import { AreaMap, type MapShape } from "@/components/area-map";
import { IconChevronRight } from "@/components/icons";
import { VisitedBadge } from "@/components/ui";
import type { MapFrame } from "@/components/municipality-map";
import type { AreaTone, PrefectureArea } from "@/lib/geo/prefecture-areas";

const AREA_ACCENT: Record<AreaTone, string> = {
  pink: "#f3d7dd",
  blue: "#d7e5f0",
  green: "#dceacc",
  yellow: "#f2dda0",
  purple: "#e4dcf1",
  teal: "#d3eae4",
  orange: "#f7e0cd",
  rose: "#f5d9d2",
};

export function PrefectureAreaBrowser({
  prefectureName,
  viewBox,
  insets,
  areas,
  hrefBase,
  hasMap,
}: {
  prefectureName: string;
  viewBox: string;
  insets: MapFrame[];
  areas: PrefectureArea[];
  hrefBase: string;
  hasMap: boolean;
}) {
  const viewBoxWidth = Number(viewBox.split(" ")[2] ?? 1);
  const labelSize = Math.max(viewBoxWidth / 24, 0.035);

  const mapShapes: MapShape[] = areas.map((area) => ({
    key: area.slug,
    name: area.name,
    label: area.label,
    paths: area.municipalities.flatMap((municipality) => (municipality.d ? [municipality.d] : [])),
    tone: area.tone,
    visited: area.visitedMunicipalityCount > 0,
    href: `${hrefBase}/area/${area.slug}`,
    labelAt: area.center,
  }));

  return (
    <div className="space-y-4">
      {hasMap ? (
        <section>
          <h2 className="mb-2 px-1 text-base font-bold">エリアから選ぶ</h2>
          <div className="rough-card px-3 py-4">
            <p className="mb-2 text-center text-xs text-ink-soft">
              <span className="rough-pill bg-leaf-soft px-3 py-1 text-leaf-deep">
                エリアをタップすると市区町村を拡大表示
              </span>
            </p>
            <AreaMap
              shapes={mapShapes}
              viewBox={viewBox}
              labelSize={labelSize}
              insets={insets}
              ariaLabel={`${prefectureName}のエリア地図。エリアを選ぶと市区町村地図へ移動します`}
              className="h-auto w-full"
              colorUnvisited
            />
            <p className="mt-2 text-center text-[11px] leading-relaxed text-ink-faint">
              市区町村の位置をもとに、見やすい大きさへ自動でエリア分けしています。
            </p>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 px-1 text-base font-bold">エリア一覧</h2>
        <ul className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
          {areas.map((area) => (
            <li key={area.slug}>
              <Link
                href={`${hrefBase}/area/${area.slug}`}
                className="rough-card pressable flex h-full items-center gap-3 px-4 py-3"
              >
                <span
                  aria-hidden
                  className="h-9 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: AREA_ACCENT[area.tone] }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-snug">{area.name}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <VisitedBadge visited={area.visitedMunicipalityCount > 0} />
                    <span className="text-xs text-ink-faint">
                      {area.municipalities.length}市区町村・{area.spotCount}スポット
                    </span>
                  </span>
                </span>
                <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
