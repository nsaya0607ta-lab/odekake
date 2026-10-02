"use client";

/**
 * わんこのおへや：部屋の手前の床に立てた、イーゼルのホワイトボード。
 * きょうの空・歩数・フレンドのおへやなどを「ボードに映して」見せる。
 * スクロールはボードの面の中だけで動き、部屋と床は動かない。
 *
 * 見た目は、測った大きさ（px）そのままの SVG で描く（角の丸み・わくの太さがゆがまない）：
 *   木の脚（前の2本は上の横木でつなぎ、うしろの1本は奥へ）→ アルミのわく（面取りの光とかげ、すみの樹脂キャップ）
 *   → 白い面（ここに中身を映す）→ ペン置き（マーカー3本・イレーサー）→ 床の影
 * 夜は、わくと脚は部屋と同じように暗くなり、面だけは映した光で明るいまま（床にうすく光がこぼれる）。
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

/** 脚の、トレーより下に見える長さ／わくの上に出る長さ／わくの太さ／トレーの高さ（px） */
const LEG = 40, TOP = 16, FRAME = 9, TRAY = 13;
/** ボードの左右に、床に広がる脚のぶんの余白 */
const SIDE = 16;

export function RoomBoard({ children, dark = 0 }: { children: ReactNode; /** 夜の暗さ（0〜1） */ dark?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: 320 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setSize({ w: Math.round(r.width), h: Math.round(r.height) }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { w, h } = size;
  // ボード（わくの外がわ）
  const bx0 = SIDE, bx1 = w - SIDE, by0 = TOP, by1 = h - LEG - TRAY + 3;
  // 映す面
  const sx0 = bx0 + FRAME, sy0 = by0 + FRAME, sx1 = bx1 - FRAME, sy1 = by1 - FRAME;
  // 前の脚（上はわくのうしろ、下は床へ少し開く）
  const legL = { tx: bx0 + 16, bx: 6 }, legR = { tx: bx1 - 16, bx: w - 6 };
  const night = Math.pow(Math.max(0, Math.min(1, dark)), 1.1);
  const shade = 1 - night * 0.5;

  return (
    <div ref={ref} className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6px)] top-[-22px] mx-auto w-[min(97%,480px)]">
      <svg aria-hidden width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 overflow-visible" style={{ filter: night > 0.02 ? `brightness(${shade}) saturate(${1 - night * 0.25})` : undefined }}>
        <defs>
          <linearGradient id="bd-wood" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#7A4A24" />
            <stop offset="0.35" stopColor="#C8925C" />
            <stop offset="0.6" stopColor="#B07A46" />
            <stop offset="1" stopColor="#6A3E1C" />
          </linearGradient>
          <linearGradient id="bd-wood-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5A3618" />
            <stop offset="1" stopColor="#7A5030" />
          </linearGradient>
          <linearGradient id="bd-alu" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FBFCFD" />
            <stop offset="0.22" stopColor="#D5DAE1" />
            <stop offset="0.48" stopColor="#F2F4F7" />
            <stop offset="0.7" stopColor="#BCC2CB" />
            <stop offset="1" stopColor="#9DA4AE" />
          </linearGradient>
          <linearGradient id="bd-alu-v" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.8" />
            <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="1" stopColor="#5A616B" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="bd-tray-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E9ECF0" />
            <stop offset="0.5" stopColor="#C3C9D1" />
            <stop offset="1" stopColor="#8E959F" />
          </linearGradient>
          <radialGradient id="bd-floor-shadow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#1E1206" stopOpacity="0.42" />
            <stop offset="0.65" stopColor="#1E1206" stopOpacity="0.14" />
            <stop offset="1" stopColor="#1E1206" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bd-foot" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#1E1206" stopOpacity="0.55" />
            <stop offset="1" stopColor="#1E1206" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bd-marker" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="0.55" stopColor="#E8EAEE" />
            <stop offset="1" stopColor="#AEB4BC" />
          </linearGradient>
        </defs>

        {/* 床の影（ボードの下と、脚の先） */}
        <ellipse cx={w / 2} cy={h - 7} rx={w * 0.47} ry="13" fill="url(#bd-floor-shadow)" />
        <ellipse cx={w / 2} cy={by1 + TRAY + 10} rx={w * 0.4} ry="10" fill="url(#bd-floor-shadow)" opacity="0.6" />
        {[legL.bx + 4, legR.bx - 4, w / 2].map((x, i) => <ellipse key={i} cx={x} cy={h - (i === 2 ? 12 : 4)} rx={i === 2 ? 9 : 11} ry={i === 2 ? 3 : 4} fill="url(#bd-foot)" />)}

        {/* うしろの脚（奥へ、細く暗く） */}
        <path d={`M${w / 2 - 4} ${by0 + 4} L${w / 2 + 4} ${by0 + 4} L${w / 2 + 3} ${h - 12} L${w / 2 - 3} ${h - 12} Z`} fill="url(#bd-wood-back)" />
        <rect x={w / 2 - 4} y={h - 14} width="8" height="3" rx="1.2" fill="#2A1A0C" />
        {/* 前の脚と、上の横木・ボードをおさえる留め具 */}
        {[legL, legR].map((g, i) => (
          <g key={i}>
            <path d={`M${g.tx - 5} 2 L${g.tx + 5} 2 L${g.bx + 6} ${h - 4} L${g.bx - 6} ${h - 4} Z`} fill="url(#bd-wood)" />
            <path d={`M${g.tx - 1.5} 3 L${g.bx - 2} ${h - 6}`} stroke="#E8BC88" strokeWidth="1" opacity="0.55" />
            <rect x={g.bx - 7} y={h - 7} width="14" height="5" rx="2" fill="#2E2A26" />
            <rect x={g.tx - 6.5} y="0" width="13" height="5" rx="2" fill="#5A3618" />
          </g>
        ))}
        <rect x={legL.tx - 4} y="5" width={legR.tx - legL.tx + 8} height="7" rx="2.5" fill="url(#bd-wood)" />
        <rect x={legL.tx - 4} y="5" width={legR.tx - legL.tx + 8} height="2" rx="1" fill="#F0C890" opacity="0.5" />
        <g transform={`translate(${w / 2} ${by0 - 4})`}>
          <rect x="-22" y="0" width="44" height="12" rx="3" fill="#3A3E46" />
          <rect x="-22" y="0" width="44" height="4" rx="2" fill="#6A707A" />
          <circle cx="0" cy="-3" r="6" fill="#2E3238" />
          <circle cx="-1.6" cy="-4.6" r="2" fill="#8A909A" />
        </g>

        {/* アルミのわく */}
        <rect x={bx0} y={by0} width={bx1 - bx0} height={by1 - by0} rx="7" fill="url(#bd-alu)" />
        <rect x={bx0} y={by0} width={bx1 - bx0} height={by1 - by0} rx="7" fill="url(#bd-alu-v)" />
        <rect x={bx0 + 0.5} y={by0 + 0.5} width={bx1 - bx0 - 1} height={by1 - by0 - 1} rx="6.5" fill="none" stroke="#FFFFFF" strokeOpacity="0.85" />
        {/* 面のふち（内がわへ落ちる面取り） */}
        <rect x={sx0 - 2} y={sy0 - 2} width={sx1 - sx0 + 4} height={sy1 - sy0 + 4} rx="4" fill="#8A919B" />
        <rect x={sx0 - 1} y={sy0 - 1} width={sx1 - sx0 + 2} height={sy1 - sy0 + 2} rx="3.5" fill="#5E656F" />
        {/* すみの樹脂キャップ */}
        {[[bx0, by0, 0], [bx1, by0, 90], [bx1, by1, 180], [bx0, by1, 270]].map(([x, y, r], i) => (
          <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
            <path d="M0 7 Q0 0 7 0 L18 0 L18 7 L7 7 L7 18 L0 18 Z" fill="#454A52" />
            <path d="M0.8 7 Q0.8 0.8 7 0.8 L17 0.8" fill="none" stroke="#7E848E" strokeWidth="1.2" />
          </g>
        ))}

        {/* ペン置き（上の面・前の面）と、マーカー・イレーサー */}
        <path d={`M${bx0 + 10} ${by1 - 2} L${bx1 - 10} ${by1 - 2} L${bx1 - 4} ${by1 + 4} L${bx0 + 4} ${by1 + 4} Z`} fill="#D9DDE3" />
        <rect x={bx0 + 4} y={by1 + 4} width={bx1 - bx0 - 8} height={TRAY - 4} rx="3" fill="url(#bd-tray-front)" />
        <rect x={bx0 + 4} y={by1 + 4} width={bx1 - bx0 - 8} height="1.4" fill="#FFFFFF" opacity="0.8" />
        {[{ x: bx0 + 34, c: "#2F6FC2" }, { x: bx0 + 76, c: "#D9402E" }, { x: bx0 + 118, c: "#2A2E34" }].map((m) => (
          <g key={m.x} transform={`translate(${m.x} ${by1 - 1})`}>
            <ellipse cx="17" cy="4.6" rx="19" ry="1.6" fill="#000" opacity="0.18" />
            <rect x="0" y="-1.6" width="30" height="6" rx="3" fill="url(#bd-marker)" />
            <rect x="0" y="-1.6" width="10" height="6" rx="3" fill={m.c} />
            <rect x="1" y="-1" width="8" height="1.6" rx="0.8" fill="#FFFFFF" opacity="0.35" />
            <rect x="29" y="-0.4" width="4" height="3.6" rx="1.2" fill={m.c} opacity="0.85" />
          </g>
        ))}
        <g transform={`translate(${bx1 - 64} ${by1 - 4})`}>
          <ellipse cx="22" cy="8" rx="24" ry="2" fill="#000" opacity="0.2" />
          <rect x="0" y="3" width="44" height="5" rx="1.5" fill="#E6DCC8" />
          <rect x="0" y="-3" width="44" height="7" rx="2.5" fill="#33373E" />
          <rect x="2" y="-2.4" width="40" height="1.6" rx="0.8" fill="#6E747E" />
        </g>
      </svg>

      {/* 映す面（ここだけスクロールする） */}
      <div className="absolute overflow-hidden rounded-[3px] bg-[#FAFBFC]" style={{ left: sx0, top: sy0, width: Math.max(0, sx1 - sx0), height: Math.max(0, sy1 - sy0) }}>
        {/* 面のうすい消しあと */}
        <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          <path d="M70 10 q 8 4 16 -2 M8 12 l 10 3" fill="none" stroke="#5A6A88" strokeOpacity="0.06" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 space-y-3 overflow-y-auto overscroll-contain p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
        {/* つや（ななめの映りこみ）と、ふちの内がわのかげ */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(112deg,rgba(255,255,255,0)_28%,rgba(255,255,255,.22)_38%,rgba(255,255,255,0)_47%,rgba(255,255,255,0)_70%,rgba(255,255,255,.1)_76%,rgba(255,255,255,0)_82%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_2px_4px_rgba(0,0,0,.28),inset_0_-1px_2px_rgba(0,0,0,.12)]" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-2 bg-gradient-to-b from-[#FAFBFC] to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-[#FAFBFC] to-transparent" />
      </div>
      {/* 夜は、面の光が床にうすくこぼれる */}
      {night > 0.15 ? (
        <div aria-hidden className="pointer-events-none absolute inset-x-[5%] h-10 rounded-[50%] bg-[radial-gradient(closest-side,rgba(220,232,255,.5),rgba(220,232,255,0))]" style={{ top: by1 + TRAY + 2, opacity: night * 0.55 }} />
      ) : null}
    </div>
  );
}
