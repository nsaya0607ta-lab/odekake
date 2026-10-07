/**
 * パーツの絵（24×24 の線画）。DOM では SVG、canvas では Path2D で同じ形を描く。
 */
import type { PartKind } from "./model";

export type GlyphId = PartKind | "user" | "bot";

const gear = (() => {
  const teeth: string[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + Math.PI / 8;
    const x1 = 12 + 6 * Math.cos(a), y1 = 12 + 6 * Math.sin(a);
    const x2 = 12 + 8.6 * Math.cos(a), y2 = 12 + 8.6 * Math.sin(a);
    teeth.push(`M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`);
  }
  return ["M12 6a6 6 0 1 0 0 12a6 6 0 1 0 0-12z", "M12 9.6a2.4 2.4 0 1 0 0 4.8a2.4 2.4 0 1 0 0-4.8z", ...teeth];
})();

export const GLYPHS: Record<GlyphId, string[]> = {
  app: [
    "M5 3.5h14a1.6 1.6 0 0 1 1.6 1.6v3.3a1.6 1.6 0 0 1-1.6 1.6H5a1.6 1.6 0 0 1-1.6-1.6V5.1A1.6 1.6 0 0 1 5 3.5z",
    "M5 13.9h14a1.6 1.6 0 0 1 1.6 1.6v3.3a1.6 1.6 0 0 1-1.6 1.6H5a1.6 1.6 0 0 1-1.6-1.6v-3.3A1.6 1.6 0 0 1 5 13.9z",
    "M7 6.75h.01",
    "M7 17.15h.01",
    "M11 6.75h6",
    "M11 17.15h6",
  ],
  dns: ["M10 3.8a6.2 6.2 0 1 0 0 12.4a6.2 6.2 0 1 0 0-12.4z", "M3.8 10h12.4", "M10 3.8c-2.4 2.3-2.4 10.1 0 12.4", "M10 3.8c2.4 2.3 2.4 10.1 0 12.4", "M14.6 14.6L20.4 20.4"],
  cdn: [
    "M12 7.6a4.4 4.4 0 1 0 0 8.8a4.4 4.4 0 1 0 0-8.8z",
    "M12 7.6V5.2",
    "M8.2 14.2l-2.2 1.3",
    "M15.8 14.2l2.2 1.3",
    "M12 2a1.6 1.6 0 1 0 0 3.2a1.6 1.6 0 1 0 0-3.2z",
    "M4.4 15.2a1.6 1.6 0 1 0 0 3.2a1.6 1.6 0 1 0 0-3.2z",
    "M19.6 15.2a1.6 1.6 0 1 0 0 3.2a1.6 1.6 0 1 0 0-3.2z",
  ],
  waf: ["M12 3l7 3v5.2c0 4.4-3 7.9-7 9.8c-4-1.9-7-5.4-7-9.8V6l7-3z", "M9 12l2.2 2.2L15.4 10"],
  lb: ["M12 3.2a1.7 1.7 0 1 0 0 3.4a1.7 1.7 0 1 0 0-3.4z", "M12 6.6v12.6", "M12 9.6c0 3-6.4 2.6-6.4 6.6v3", "M12 9.6c0 3 6.4 2.6 6.4 6.6v3", "M3.6 17.4l2 2.2 2-2.2", "M10 17.4l2 2.2 2-2.2", "M16.4 17.4l2 2.2 2-2.2"],
  cache: ["M13.2 2.8L6 13.2h5.2l-1 8 7.6-10.6h-5.4l.8-7.8z"],
  db: [
    "M4.8 6.2c0-1.8 3.2-3.2 7.2-3.2s7.2 1.4 7.2 3.2-3.2 3.2-7.2 3.2-7.2-1.4-7.2-3.2z",
    "M4.8 6.2v11.6c0 1.8 3.2 3.2 7.2 3.2s7.2-1.4 7.2-3.2V6.2",
    "M4.8 12c0 1.8 3.2 3.2 7.2 3.2s7.2-1.4 7.2-3.2",
  ],
  replica: [
    "M2.8 9.4c0-1.4 2.5-2.5 5.6-2.5s5.6 1.1 5.6 2.5-2.5 2.5-5.6 2.5-5.6-1.1-5.6-2.5z",
    "M2.8 9.4v9c0 1.4 2.5 2.5 5.6 2.5s5.6-1.1 5.6-2.5v-9",
    "M10 5.6c0-1.4 2.5-2.5 5.6-2.5s5.6 1.1 5.6 2.5-2.5 2.5-5.6 2.5",
    "M21.2 5.6v9c0 1.2-1.8 2.2-4.4 2.4",
    "M15 13.6l1.6 1.6-1.6 1.6",
  ],
  queue: ["M4 7.5v9", "M8.2 7.5v9", "M12.4 7.5v9", "M15.6 12h5.2", "M18.6 9.6l2.4 2.4-2.4 2.4"],
  worker: gear,
  user: ["M8.2 2.8h7.6a2.2 2.2 0 0 1 2.2 2.2v14a2.2 2.2 0 0 1-2.2 2.2H8.2A2.2 2.2 0 0 1 6 19V5a2.2 2.2 0 0 1 2.2-2.2z", "M10.8 18.2h2.4"],
  bot: [
    "M6.2 8.6h11.6a2.2 2.2 0 0 1 2.2 2.2v6.4a2.2 2.2 0 0 1-2.2 2.2H6.2A2.2 2.2 0 0 1 4 17.2v-6.4a2.2 2.2 0 0 1 2.2-2.2z",
    "M12 8.6V5.8",
    "M12 3.4a1.2 1.2 0 1 0 0 2.4a1.2 1.2 0 1 0 0-2.4z",
    "M9 13.4v.9",
    "M15 13.4v.9",
    "M7.8 11.4l2.4 1",
    "M16.2 11.4l-2.4 1",
    "M10 17h4",
  ],
};

export function Glyph({ id, size = 24, strokeWidth = 1.8, className }: { id: GlyphId; size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[id].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** canvas 用（一度だけ作っておく） */
const pathCache = new Map<GlyphId, Path2D[]>();
export function glyphPaths(id: GlyphId): Path2D[] {
  let list = pathCache.get(id);
  if (!list) {
    list = GLYPHS[id].map((d) => new Path2D(d));
    pathCache.set(id, list);
  }
  return list;
}
