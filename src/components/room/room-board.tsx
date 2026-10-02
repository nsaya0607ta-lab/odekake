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
/** らくがきを描く、カードの下の黒板の高さ（px） */
const STRIP = 30;
/** カードの中身を組む幅（px）。カードがこれよりせまいときは、縮めて映す */
const SCREEN_W = 350;

/** 黒板の幅（置ける領域の幅に対する割合）と、いちばん縦長のときの 高さ ÷ 幅 */
const WIDTH = 0.98, ASPECT_MAX = 1.7;

/**
 * 黒板。置ける領域の下にそろえて、横いっぱい・高さは領域まで（いちばん縦長で ASPECT_MAX）。位置と大きさは変えられない。
 * カードの中は、ふつうにさわる・たてにだけスクロールできる。
 */
export function RoomBoard({ children, dark = 0, drop = DEFAULT_DROP, doodle }: {
  children: ReactNode;
  /** 夜の暗さ（0〜1） */
  dark?: number;
  /** 黒板の下のはしから、置ける領域の下までの高さ（px） */
  drop?: number;
  /** カードの下の黒板に描く、チョークのらくがき（あるときは、そのぶんカードを上につめる） */
  doodle?: ReactNode;
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
  const w = Math.round(WIDTH * area.w), h = Math.round(Math.min(w * ASPECT_MAX, area.h));
  const left = (area.w - w) / 2, top = area.h - h;

  // 黒板の大きさ（左右に 4px ずつ影のよはく、下はチョーク置きのぶんをあける）
  const bw = Math.max(120, w - 8), hw = bw / 2;
  const yb = h - drop - 4;
  const bh = Math.max(120, (yb - 22) * 1.02);
  // カードの大きさと、中身を縮める倍率
  const below = doodle ? STRIP : 0;
  const screenW = bw - INS * 2, screenH = bh - INS * 2 - below;
  const zoom = Math.min(1, screenW / SCREEN_W);

  /* ---------- 夜 ---------- */
  const night = Math.pow(Math.max(0, Math.min(1, dark)), 1.1);
  const dim = night > 0.02 ? { filter: `brightness(${1 - night * 0.5}) saturate(${1 - night * 0.25})` } : undefined;

  return (
    <div ref={areaRef} className="pointer-events-none absolute inset-0">
    <div className="pointer-events-auto absolute" style={{ left, top, width: w, height: h }}>
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
          {/* よこのよはくの、チョークのらくがき（肉球・ハート） */}
          {doodle ? null : <g fill="none" stroke="#F4F1E6" strokeOpacity="0.55" strokeWidth="1.2" strokeLinecap="round">
            <g transform={`translate(${WOOD + 6} ${bh - WOOD - 7}) scale(0.5)`} fill="#F4F1E6" fillOpacity="0.5" stroke="none"><ellipse cx="0" cy="2" rx="5" ry="4" /><circle cx="-5" cy="-4" r="2" /><circle cx="-1.6" cy="-6.4" r="2" /><circle cx="2" cy="-6.4" r="2" /><circle cx="5.4" cy="-4" r="2" /></g>
            <path d={`M${bw - WOOD - 8} ${WOOD + 9} c -3 -3 -6 0 -3 3 l 3 3 l 3 -3 c 3 -3 0 -6 -3 -3 z`} stroke="#FFB4C8" strokeOpacity="0.6" />
          </g>}
        </svg>
        {doodle ? <div aria-hidden className="pointer-events-none absolute" style={{ left: INS - 4, right: INS - 4, bottom: WOOD + 3, height: STRIP + INS - WOOD - 6, ...dim }}>{doodle}</div> : null}
        {/* カード（ここだけ、たてにだけスクロールする） */}
        <div className="absolute overflow-hidden rounded-[8px] bg-[#FBF8F1] shadow-[0_4px_10px_rgba(0,0,0,.45)]" style={{ top: INS, left: INS, right: INS, bottom: INS + below }}>
          {/* 中身は SCREEN_W 以上の幅で組んで、カードの大きさに縮めて映す（小さい・縦長・横長でも文字がつまったり、はみ出したりしない） */}
          <div className="absolute left-0 top-0" style={{ width: screenW / zoom, height: screenH / zoom, zoom }}>
            <div className="absolute inset-0 touch-pan-y space-y-3 overflow-y-auto overflow-x-hidden overscroll-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*:not(:first-child)]:mx-2">
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

    </div>
    </div>
  );
}
