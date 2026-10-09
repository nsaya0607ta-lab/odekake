import { getPinballTable } from "@/lib/games/pinball/maps";
import type { Pt, TableGeometry } from "@/lib/games/pinball/table";
import type { PinballTheme } from "@/lib/games/pinball/themes";

const d = (pts: readonly Pt[], closed = false) => `M${pts.map((pt) => `${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join("L")}${closed ? "Z" : ""}`;

type Props = {
  /** マップの id（table を渡さないとき） */
  mapId?: string;
  /** 台の形（自分で作るステージ） */
  table?: TableGeometry;
  /** グラデーションの id に使う（同じ画面に同じ id が2つあると、色がまざる） */
  uid?: string;
  theme: PinballTheme;
  className?: string;
};

/** 台えらびのカードに出す、マップの形の小さな絵（台の形のデータからそのまま描く） */
export function PinballMapPreview({ mapId, table: given, uid, theme, className }: Props) {
  const table = given ?? getPinballTable(mapId ?? "");
  const { colors } = theme;
  const gradId = `pb-map-${uid ?? mapId ?? table.id}`;
  return (
    <svg viewBox="-14 -14 550 1028" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.bg0} />
          <stop offset="100%" stopColor={colors.bg1} />
        </linearGradient>
      </defs>
      <PinballTableShapes table={table} theme={theme} floor={`url(#${gradId})`} />
    </svg>
  );
}

/** 台の形（床・壁・ランプ・ポスト・かざぐるま・バンパー・ガチャ穴・フリッパー）。エディターでも同じ絵を使う */
export function PinballTableShapes({ table, theme, floor }: { table: TableGeometry; theme: PinballTheme; floor: string }) {
  const { colors } = theme;
  return (
    <>
      {/* 床 */}
      <path d="M0 1000 L0 261 A261 261 0 0 1 522 261 L522 1000 Z" fill={floor} stroke={colors.rail} strokeOpacity={0.55} strokeWidth={10} />
      {/* 壁・レール */}
      {table.walls
        .filter((w) => w.look !== "frame")
        .map((w, i) => (
          <path
            key={`w${i}`}
            d={d(w.pts, w.closed)}
            fill={w.look === "sling" ? colors.accent : "none"}
            fillOpacity={0.55}
            stroke={w.look === "ramp-mouth" ? colors.plastic : colors.rail}
            strokeOpacity={0.85}
            strokeWidth={Math.max(6, w.r * 2.4)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      {/* ランプ（のぼり坂は太い透明な道、ワイヤーは細い線） */}
      {table.ramps.map((r) => (
        <g key={r.id}>
          <path d={d(r.path.slice(0, r.topEnd + 1))} fill="none" stroke={colors.accent} strokeOpacity={0.32} strokeWidth={46} strokeLinecap="round" strokeLinejoin="round" />
          <path d={d(r.path.slice(r.topEnd))} fill="none" stroke={colors.rail} strokeOpacity={0.75} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
      {/* ポスト・くぎ */}
      {table.circles.map((c, i) => (
        <circle key={`c${i}`} cx={c.x} cy={c.y} r={c.look === "peg" ? 6 : c.r + 2} fill={c.look === "peg" ? colors.accent : colors.rail} fillOpacity={0.9} />
      ))}
      {/* かざぐるま */}
      {table.pinwheels.map((pw, i) => (
        <g key={`p${i}`} stroke={colors.accent2} strokeWidth={9} strokeLinecap="round">
          <line x1={pw.x - pw.len} y1={pw.y} x2={pw.x + pw.len} y2={pw.y} />
          <line x1={pw.x} y1={pw.y - pw.len} x2={pw.x} y2={pw.y + pw.len} />
        </g>
      ))}
      {/* バンパー */}
      {table.bumpers.map((b, i) => (
        <circle key={`b${i}`} cx={b.x} cy={b.y} r={b.r} fill={colors.accent} stroke="#ffffff" strokeOpacity={0.7} strokeWidth={5} />
      ))}
      {/* ガチャ穴 */}
      <circle cx={table.scoop.x} cy={table.scoop.y} r={15} fill="#000000" stroke={colors.accent} strokeWidth={5} />
      {/* フリッパー */}
      {table.flippers.map((f) => (
        <line
          key={f.side}
          x1={f.pivot.x}
          y1={f.pivot.y}
          x2={f.pivot.x + f.len * Math.cos(f.rest)}
          y2={f.pivot.y + f.len * Math.sin(f.rest)}
          stroke="#ffffff"
          strokeWidth={20}
          strokeLinecap="round"
        />
      ))}
    </>
  );
}
