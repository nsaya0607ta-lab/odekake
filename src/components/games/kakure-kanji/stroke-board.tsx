"use client";

import { useCallback, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { Stroke } from "@/lib/games/kakure-kanji/types";
import styles from "./kakure-kanji.module.css";

/**
 * 出題漢字の筆画をタップしてえらぶ盤。はじめは全部灰色で、えらんだ画が黒くなる。
 * 当たり判定は「指の位置から、それぞれの画の線そのものまでの距離」でいちばん近い画を選ぶ
 * （SVG の線を細かく点に分けて測る）。交わっている画（1画目と7画目など）も、近いほうが選ばれる。
 * 指をすべらせると、通った画をまとめて黒く（最初の画を消したときは、まとめて灰色に）できる。
 */

/** 線からこの距離（viewBox の単位。盤の幅=100）までなら、その画に当たったことにする */
const HIT_RADIUS = 7.5;
const SAMPLE_STEP = 1.2;

type Samples = { id: number; points: { x: number; y: number }[]; half: number }[];

export function StrokeBoard({
  strokes,
  selected,
  onChange,
  glow,
  disabled,
  label,
}: {
  strokes: Stroke[];
  selected: ReadonlySet<number>;
  onChange: (next: Set<number>) => void;
  /** 正解したときに金色に光らせる画（key が変わるたびに光りなおす） */
  glow: { strokes: number[]; key: number } | null;
  disabled?: boolean;
  label: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef(new Map<number, SVGPathElement>());
  const samples = useRef<Samples>([]);
  const gesture = useRef<{ adding: boolean; touched: Set<number>; next: Set<number> } | null>(null);

  useLayoutEffect(() => {
    samples.current = strokes.map((s) => {
      const path = pathRefs.current.get(s.id);
      const points: { x: number; y: number }[] = [];
      if (path) {
        const length = path.getTotalLength();
        for (let at = 0; at <= length; at += SAMPLE_STEP) {
          const p = path.getPointAtLength(at);
          points.push({ x: p.x, y: p.y });
        }
        const end = path.getPointAtLength(length);
        points.push({ x: end.x, y: end.y });
      }
      return { id: s.id, points, half: (s.width ?? 5.2) / 2 };
    });
  }, [strokes]);

  const hit = useCallback((clientX: number, clientY: number): number | null => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    let best: number | null = null;
    let bestDistance = Infinity;
    for (const s of samples.current) {
      for (const p of s.points) {
        const d = Math.hypot(p.x - point.x, p.y - point.y) - s.half;
        if (d < bestDistance) {
          bestDistance = d;
          best = s.id;
        }
      }
    }
    return bestDistance <= HIT_RADIUS ? best : null;
  }, []);

  const apply = (id: number) => {
    const g = gesture.current;
    if (!g || g.touched.has(id)) return;
    g.touched.add(id);
    if (g.adding) g.next.add(id);
    else g.next.delete(id);
    onChange(new Set(g.next));
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    const id = hit(event.clientX, event.clientY);
    if (id === null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { adding: !selected.has(id), touched: new Set(), next: new Set(selected) };
    apply(id);
    navigator.vibrate?.(5);
  };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!gesture.current) return;
    const id = hit(event.clientX, event.clientY);
    if (id !== null && !gesture.current.touched.has(id)) {
      apply(id);
      navigator.vibrate?.(4);
    }
  };
  const end = () => {
    gesture.current = null;
  };

  const lit = new Set(glow?.strokes ?? []);
  return (
    <div className={styles.boardInner}>
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        className={styles.strokeBoard}
        role="img"
        aria-label={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        data-disabled={disabled ? "true" : undefined}
      >
        <g data-part="guides" aria-hidden="true">
          <rect x="1.5" y="1.5" width="97" height="97" rx="2" />
          <line x1="50" y1="3" x2="50" y2="97" />
          <line x1="3" y1="50" x2="97" y2="50" />
        </g>
        <g data-part="ink" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {strokes.map((s) => (
            <path
              key={s.id}
              ref={(el) => {
                if (el) pathRefs.current.set(s.id, el);
                else pathRefs.current.delete(s.id);
              }}
              d={s.d}
              strokeWidth={s.width ?? 5.2}
              data-on={selected.has(s.id) ? "true" : undefined}
            />
          ))}
        </g>
        {glow && lit.size > 0 && (
          <g key={glow.key} data-part="glow" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {strokes
              .filter((s) => lit.has(s.id))
              .map((s) => (
                <path key={s.id} d={s.d} strokeWidth={(s.width ?? 5.2) + 0.6} pathLength={1} />
              ))}
          </g>
        )}
      </svg>
      {/* 画面読み上げ・キーボードでも遊べるように、画ごとのボタン（見た目はかくす） */}
      <div className={styles.srOnly} role="group" aria-label="画をえらぶ">
        {strokes.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={selected.has(s.id)}
            disabled={disabled}
            onClick={() => {
              const next = new Set(selected);
              if (next.has(s.id)) next.delete(s.id);
              else next.add(s.id);
              onChange(next);
            }}
          >
            {s.id}画目（{s.kind}）
          </button>
        ))}
      </div>
    </div>
  );
}
