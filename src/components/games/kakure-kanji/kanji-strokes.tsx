import { memo } from "react";
import type { Stroke } from "@/lib/games/kakure-kanji/types";

/**
 * 出題漢字を筆画ごとの SVG で描く。筆画ごとに描くので、答えに使う画だけを光らせたり、
 * 解説で色をつけたりできる（文字のフォントでは、どの線がどの画か分からない）。
 * 将来のなぞり操作も、この path の形で当たり判定をする想定（docs/kakure-kanji.md）。
 */
export const KanjiStrokes = memo(function KanjiStrokes({
  strokes,
  highlight,
  mode = "normal",
  glowKey,
  label,
  guides = false,
  className,
}: {
  strokes: Stroke[];
  /** 色をつける筆画 */
  highlight?: readonly number[];
  /** normal: ふつう / focus: 色のついていない画をうすくする（解説用） */
  mode?: "normal" | "focus";
  /** 値が変わるたびに光るアニメーションをやりなおす */
  glowKey?: string | number;
  label: string;
  /** 半紙の十字の補助線 */
  guides?: boolean;
  className?: string;
}) {
  const lit = new Set(highlight ?? []);
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={label} className={className} data-mode={mode}>
      {guides && (
        <g data-part="guides" aria-hidden="true">
          <rect x="1.5" y="1.5" width="97" height="97" rx="2" />
          <line x1="50" y1="3" x2="50" y2="97" />
          <line x1="3" y1="50" x2="97" y2="50" />
        </g>
      )}
      <g data-part="ink" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {strokes.map((s) => (
          <path key={s.id} d={s.d} strokeWidth={s.width ?? 5.2} data-lit={lit.has(s.id) ? "true" : undefined} />
        ))}
      </g>
      {glowKey !== undefined && lit.size > 0 && (
        <g key={glowKey} data-part="glow" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {strokes
            .filter((s) => lit.has(s.id))
            .map((s) => (
              <path key={s.id} d={s.d} strokeWidth={(s.width ?? 5.2) + 0.4} pathLength={1} />
            ))}
        </g>
      )}
    </svg>
  );
});
