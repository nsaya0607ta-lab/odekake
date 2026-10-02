"use client";

/**
 * わんこのおへや：部屋の下に立てかけた、木のわくの黒板。
 * きょうの空・歩数・フレンドのおへやなどのカードを、マグネットで黒板にとめて見せる。
 * スクロールはカードの中だけで動き、部屋と黒板は動かない。
 * 夜は、わく・マグネット・チョーク置きは部屋と同じように暗く、カードは読みやすいまま。
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

/** 黒板の下のはしから、置ける領域の下までの高さ（チョーク置きのぶん）・木のわくの太さ（px） */
const DEFAULT_DROP = 14, WOOD = 11;
/** 黒板のはしから、カードまでの幅（木のわく ＋ 黒板の余白） */
const INS = WOOD + 12;
/** カードの中身を組む幅（px）。カードがこれよりせまいときは、縮めて映す */
const SCREEN_W = 350;

/** 黒板の置き場所。x は中心、y は下のはし（どちらも置ける領域の 0〜1）、w は幅（領域の幅に対する割合） */
export type BoardPlace = { x: number; y: number; w: number; /** 高さ ÷ 幅。なければ ASPECT */ a?: number };
export const DEFAULT_BOARD: BoardPlace = { x: 0.5, y: 1, w: 1, a: 1.7 };
/** 黒板の 高さ ÷ 幅 */
const ASPECT = 1.02;
/** 横長〜縦長の、えらべる はば（高さ ÷ 幅） */
const ASPECT_MIN = 0.55, ASPECT_MAX = 1.7;
const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * 黒板。わく・チョーク置きをつかんで好きなところへ動かせ、右下のつまみで大きさと形を変えられる。
 * カードの中は、ふつうにさわる・スクロールできる。
 */
export function RoomBoard({ children, dark = 0, drop = DEFAULT_DROP, place = DEFAULT_BOARD, onPlace }: {
  children: ReactNode;
  /** 夜の暗さ（0〜1） */
  dark?: number;
  /** 黒板の下のはしから、置ける領域の下までの高さ（px） */
  drop?: number;
  place?: BoardPlace;
  /** 動かす・大きさを変えるのを終えたとき */
  onPlace?: (p: BoardPlace) => void;
}) {
  // 置ける領域の大きさ
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 390, h: 340 });
  useEffect(() => {
    const el = areaRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setArea({ w: Math.round(r.width), h: Math.round(r.height) }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // ドラッグ中は手もとの値で動かし、はなしたときに保存する
  const [live, setLive] = useState<BoardPlace | null>(null);
  const drag = useRef<{ mode: "move" | "size"; sx: number; sy: number; from: BoardPlace; id: number } | null>(null);
  /** 領域からはみ出しすぎないようにそろえる */
  const fit = (p: BoardPlace): BoardPlace => {
    const a0 = clampN(p.a ?? ASPECT, ASPECT_MIN, ASPECT_MAX);
    const wf = clampN(p.w, 0.3, 0.98);
    // 高さは領域まで（はみ出すぶんは幅をそのままに、高さをちぢめる）
    const a = Math.min(a0, area.h / (wf * area.w));
    const bwpx = wf * area.w, bhpx = bwpx * a;
    const x = clampN(p.x, (bwpx * 0.42) / area.w, 1 - (bwpx * 0.42) / area.w);
    const y = clampN(p.y, Math.min(1, bhpx / area.h), 1);
    return { x, y, w: wf, a };
  };
  const pl = fit(live ?? place);
  const w = Math.round(pl.w * area.w), h = Math.round(w * (pl.a ?? ASPECT));
  const left = pl.x * area.w - w / 2, top = pl.y * area.h - h;
  const onDown = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (!onPlace || t.closest("[data-board-screen]")) return;
    drag.current = { mode: t.closest("[data-board-resize]") ? "size" : "move", sx: e.clientX, sy: e.clientY, from: pl, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    setLive(fit(d.mode === "move"
      ? { ...d.from, x: d.from.x + dx / area.w, y: d.from.y + dy / area.h }
      : (() => {
          // 右下のかどを指についていかせる（左上は動かさない）。幅と高さは別々に変わる
          const w0 = d.from.w * area.w, h0 = w0 * (d.from.a ?? ASPECT);
          const l0 = d.from.x * area.w - w0 / 2, t0 = d.from.y * area.h - h0;
          const w1 = Math.max(area.w * 0.3, w0 + dx), h1 = clampN(h0 + dy, w1 * ASPECT_MIN, w1 * ASPECT_MAX);
          return { x: (l0 + w1 / 2) / area.w, y: (t0 + h1) / area.h, w: w1 / area.w, a: h1 / w1 };
        })()));
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const next = live;
    setLive(null);
    if (next && onPlace) onPlace(next);
  };

  // 黒板の大きさ（左右に 4px ずつ影のよはく、下はチョーク置きのぶんをあける）
  const bw = Math.max(120, w - 8), hw = bw / 2;
  const yb = h - drop - 4;
  const bh = Math.max(120, (yb - 22) * 1.02);
  // カードの大きさと、中身を縮める倍率
  const screenW = bw - INS * 2, screenH = bh - INS * 2;
  const zoom = Math.min(1, screenW / SCREEN_W);

  /* ---------- 夜 ---------- */
  const night = Math.pow(Math.max(0, Math.min(1, dark)), 1.1);
  const dim = night > 0.02 ? { filter: `brightness(${1 - night * 0.5}) saturate(${1 - night * 0.25})` } : undefined;

  return (
    <div ref={areaRef} className="pointer-events-none absolute inset-0">
    <div className="pointer-events-auto absolute" style={{ left, top, width: w, height: h }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {/* うしろの層：やわらかい影と、わくの上の厚み */}
      <svg aria-hidden width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="pointer-events-none absolute inset-0 overflow-visible" style={dim}>
        <defs><filter id="bd-blur" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="6" /></filter></defs>
        <rect x={w / 2 - hw + 6} y={yb - bh + 14} width={bw - 12} height={bh + 6} rx="10" fill="#1E1206" opacity="0.28" filter="url(#bd-blur)" />
        <rect x={w / 2 - hw} y={yb - bh - 2.6} width={bw} height="4" rx="1.5" fill="#B98250" />
      </svg>

      {/* 黒板の板 */}
      <div className="absolute" style={{ left: w / 2 - hw, top: yb - bh, width: bw, height: bh }}>
        {/* 木のわくの黒板（深い緑の面に、うすいチョークのあとと らくがき） */}
        <svg aria-hidden width={bw} height={bh} viewBox={`0 0 ${bw} ${bh}`} className="absolute inset-0" style={dim}>
          <defs>
            <linearGradient id="ck-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#D2A06A" /><stop offset="0.5" stopColor="#B07A46" /><stop offset="1" stopColor="#86552C" /></linearGradient>
            <filter id="ck-wood-h" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.02 0.25" numOctaves="2" seed="5" result="n" /><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.16  0 0 0 0 0.06  0 0 0 1.4 -0.55" /></filter>
            <filter id="ck-wood-v" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.25 0.02" numOctaves="2" seed="9" result="n" /><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.16  0 0 0 0 0.06  0 0 0 1.4 -0.55" /></filter>
            <radialGradient id="ck-slate" cx="0.45" cy="0.4" r="0.8"><stop offset="0" stopColor="#3C5C4C" /><stop offset="1" stopColor="#253B31" /></radialGradient>
            <filter id="ck-smudge" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="3" seed="7" result="n" /><feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.6 -0.78" /></filter>
            <filter id="ck-dust" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="2" result="n" /><feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 2 -1.45" /></filter>
            <clipPath id="ck-ring"><path fillRule="evenodd" d={`M0 0 H${bw} V${bh} H0 Z M${WOOD} ${WOOD} V${bh - WOOD} H${bw - WOOD} V${WOOD} Z`} /></clipPath>
          </defs>
          <rect x="0" y="0" width={bw} height={bh} rx="5" fill="url(#ck-wood)" />
          <g clipPath="url(#ck-ring)">
            <rect x="0" y="0" width={bw} height={WOOD} filter="url(#ck-wood-h)" />
            <rect x="0" y={bh - WOOD} width={bw} height={WOOD} filter="url(#ck-wood-h)" />
            <rect x="0" y={WOOD} width={WOOD} height={bh - WOOD * 2} filter="url(#ck-wood-v)" />
            <rect x={bw - WOOD} y={WOOD} width={WOOD} height={bh - WOOD * 2} filter="url(#ck-wood-v)" />
          </g>
          {[[0, 0, WOOD, WOOD], [bw, 0, bw - WOOD, WOOD], [bw, bh, bw - WOOD, bh - WOOD], [0, bh, WOOD, bh - WOOD]].map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5A3416" strokeOpacity="0.45" strokeWidth="1" />)}
          <rect x="0.6" y="0.6" width={bw - 1.2} height={bh - 1.2} rx="4.5" fill="none" stroke="#F0C894" strokeOpacity="0.8" strokeWidth="1.2" />
          <rect x={WOOD} y={WOOD} width={bw - WOOD * 2} height={bh - WOOD * 2} fill="url(#ck-slate)" />
          <rect x={WOOD} y={WOOD} width={bw - WOOD * 2} height={bh - WOOD * 2} filter="url(#ck-smudge)" opacity="0.16" />
          <rect x={WOOD} y={WOOD} width={bw - WOOD * 2} height={bh - WOOD * 2} filter="url(#ck-dust)" opacity="0.25" />
          {/* わくの内がわのかげ */}
          <rect x={WOOD} y={WOOD} width={bw - WOOD * 2} height="5" fill="#000" opacity="0.25" />
          {/* よこのよはくの、チョークのらくがき（肉球・ハート・星） */}
          <g fill="none" stroke="#F4F1E6" strokeOpacity="0.55" strokeWidth="1.2" strokeLinecap="round">
            <g transform={`translate(${WOOD + 6} ${bh - WOOD - 7}) scale(0.5)`} fill="#F4F1E6" fillOpacity="0.5" stroke="none"><ellipse cx="0" cy="2" rx="5" ry="4" /><circle cx="-5" cy="-4" r="2" /><circle cx="-1.6" cy="-6.4" r="2" /><circle cx="2" cy="-6.4" r="2" /><circle cx="5.4" cy="-4" r="2" /></g>
            <path d={`M${bw - WOOD - 8} ${WOOD + 9} c -3 -3 -6 0 -3 3 l 3 3 l 3 -3 c 3 -3 0 -6 -3 -3 z`} stroke="#FFB4C8" strokeOpacity="0.6" />
          </g>
        </svg>
        {/* カード（ここだけスクロールする） */}
        <div data-board-screen className="absolute overflow-hidden rounded-[8px] bg-[#FBF8F1] shadow-[0_4px_10px_rgba(0,0,0,.45)]" style={{ inset: INS }}>
          {/* 中身は SCREEN_W 以上の幅で組んで、カードの大きさに縮めて映す（小さい・縦長・横長でも文字がつまったり、はみ出したりしない） */}
          <div className="absolute left-0 top-0" style={{ width: screenW / zoom, height: screenH / zoom, zoom }}>
            <div className="absolute inset-0 space-y-3 overflow-y-auto overscroll-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*:not(:first-child)]:mx-2">
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* 手前の層：カードをとめる丸いマグネットと、下のチョーク置き（チョーク3本・黒板けし） */}
      <svg aria-hidden width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="pointer-events-none absolute inset-0 overflow-visible" style={dim}>
        <g>
          <defs>
            <radialGradient id="mag-a" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stopColor="#FFE9A0" /><stop offset="0.5" stopColor="#F2B83A" /><stop offset="1" stopColor="#B8801A" /></radialGradient>
            <radialGradient id="mag-b" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stopColor="#C8F0D8" /><stop offset="0.5" stopColor="#5EB884" /><stop offset="1" stopColor="#2E7A50" /></radialGradient>
            <linearGradient id="ck-tray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E2B47E" /><stop offset="0.4" stopColor="#B88048" /><stop offset="1" stopColor="#7A4C24" /></linearGradient>
          </defs>
          {[{ x: w / 2 - hw + INS + 16, c: "mag-a" }, { x: w / 2 + hw - INS - 16, c: "mag-b" }].map((m) => {
            const y = yb - bh + INS + 4;
            return <g key={m.c}><ellipse cx={m.x + 2.5} cy={y + 4} rx="8.5" ry="4" fill="#000" opacity="0.35" /><circle cx={m.x} cy={y} r="8" fill={`url(#${m.c})`} /><ellipse cx={m.x - 2.5} cy={y - 3} rx="3" ry="1.8" fill="#FFFFFF" opacity="0.7" /></g>;
          })}
          <ellipse cx={w / 2} cy={yb + 10} rx={hw * 0.95} ry="4" fill="#000" opacity="0.18" />
          <rect x={w / 2 - hw + 4} y={yb - 3} width={bw - 8} height="10" rx="3" fill="url(#ck-tray)" />
          <rect x={w / 2 - hw + 4} y={yb - 3} width={bw - 8} height="1.6" rx="0.8" fill="#FFE2B8" opacity="0.8" />
          {[{ x: w / 2 - hw + 26, c: "#FBFAF4", l: 24 }, { x: w / 2 - hw + 56, c: "#FFC4D2", l: 16 }, { x: w / 2 - hw + 78, c: "#FFF1A8", l: 20 }].map((c) => (
            <g key={c.x}><rect x={c.x} y={yb - 7} width={c.l} height="5" rx="2.5" fill={c.c} /><rect x={c.x + 1} y={yb - 6.6} width={c.l - 2} height="1.4" rx="0.7" fill="#FFFFFF" opacity="0.7" /></g>
          ))}
          <g transform={`translate(${w / 2 + hw - 64} ${yb - 12})`}>
            <rect x="0" y="5" width="40" height="5" rx="1.2" fill="#5A5A60" />
            <rect x="0" y="0" width="40" height="6.5" rx="2" fill="#C8955E" />
            <rect x="2" y="0.6" width="36" height="1.6" rx="0.8" fill="#F0C894" opacity="0.8" />
          </g>
        </g>
      </svg>

      {/* つかむところ（上・左右のわく、チョーク置きから下）と、大きさを変えるつまみ */}
      {onPlace ? (
        <>
          {[
            { left: 0, top: 0, width: w, height: Math.max(0, yb - bh + INS) },
            { left: 0, top: yb - INS, width: w, height: Math.max(0, h - yb + INS) },
            { left: 0, top: yb - bh, width: w / 2 - hw + INS, height: bh },
            { left: w / 2 + hw - INS, top: yb - bh, width: w / 2 - hw + INS, height: bh },
          ].map((z, i) => <div key={i} className="absolute cursor-grab touch-none active:cursor-grabbing" style={z} />)}
          <button
            type="button" data-board-resize aria-label="黒板の大きさを変える（右下をドラッグ）"
            className="absolute flex h-7 w-7 cursor-nwse-resize touch-none items-center justify-center rounded-full bg-white/90 shadow-[0_2px_6px_rgba(0,0,0,.3)] ring-1 ring-black/10"
            style={{ left: w / 2 + hw - 16, top: yb - 16 }}
          >
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden><path d="M11 4 L4 11 M11 8 L8 11" stroke="#6A707A" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </>
      ) : null}
    </div>
    </div>
  );
}
