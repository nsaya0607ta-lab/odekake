"use client";

/**
 * わんこのおへや：部屋の手前の床に、少しななめに立てたイーゼルのホワイトボード。
 * きょうの空・歩数・フレンドのおへやなどを「ボードに映して」見せる。
 * スクロールはボードの面の中だけで動き、部屋と床は動かない。
 *
 * 立体のつくり
 * - ボードの板（アルミのわく・映す面）だけを CSS の 3D で傾ける（足もとのまん中を軸に、右を奥へ TURN°、上をうしろへ LEAN°）。
 *   中の画面もいっしょに傾くが、さわる・スクロールはそのまま使える。
 * - それ以外（わくの厚み・脚・横木・うしろの脚・ペン置きの棚・マーカー・床の影）は傾けずに、
 *   CSS と同じ透視の計算（project）で 3D の点を画面に写して描く。脚の先は床の上に、影は床にねる。
 * 夜は、わくと脚は部屋と同じように暗く、面だけは映した光で明るいまま（床にうすく光がこぼれる）。
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

/** ななめに立てる角度（右のはしが奥へ）と、うしろへのもたれ（度） */
const TURN = 15, LEAN = 6;
/** 透視の強さ（px）。カメラは部屋と同じく、上から見おろす */
const PERSP = 1150;
/** 板の下のはしから床までの高さ（脚の見えるぶん）・板の上に出る脚・わくの太さ・わくの厚み（px） */
const DROP = 38, OVER = 16, FRAME = 9, DEPTH = 9;

type V3 = [number, number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const pts = (ps: [number, number][]) => ps.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

export function RoomBoard({ children, dark = 0 }: { children: ReactNode; /** 夜の暗さ（0〜1） */ dark?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: 330 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setSize({ w: Math.round(r.width), h: Math.round(r.height) }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { w, h } = size;

  /* ---------- 3D の置き方 ---------- */
  // カメラ（透視の中心）は、まん中の、部屋の床の消えるあたり（上の方）
  const cx = w / 2, cy = -h * 0.55;
  const T = rad(TURN), L = rad(LEAN);
  // 板（足もとのまん中が原点。u 右、v 上、n 手前）。手前に来る脚の先が画面からはみ出さないよう、少し上げる
  const bw = Math.max(120, w - 34);
  const lift = Math.round(DROP * 0.55 + bw * Math.sin(T) * 0.16);
  const yb = h - DROP - lift;
  const bh = Math.max(120, (yb - OVER - 6) / Math.cos(L) * 1.02);
  /** 板の座標 → 3D（画面の px、z は手前が＋） */
  const world = (u: number, v: number, n = 0): V3 => {
    // CSS の rotateY(T) rotateX(L)（rotateX が先）と同じ
    const x1 = u, y1 = -v * Math.cos(L) - n * Math.sin(L), z1 = -v * Math.sin(L) + n * Math.cos(L);
    return [w / 2 + x1 * Math.cos(T) + z1 * Math.sin(T), yb + y1, -x1 * Math.sin(T) + z1 * Math.cos(T)];
  };
  /** 3D → 画面（CSS の perspective と同じ） */
  const project = (p: V3): [number, number] => { const k = PERSP / (PERSP - p[2]); return [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]; };
  const P = (u: number, v: number, n = 0) => project(world(u, v, n));
  const scaleAt = (p: V3) => PERSP / (PERSP - p[2]);
  const floorY = yb + DROP;
  /** 板の面に沿って下へのばしたとき、床に着く v */
  const vFloor = (n: number) => -(DROP + n * Math.sin(L)) / Math.cos(L);
  // 床で手前へ向かう向き（板の法線を水平にしたもの）
  const nx = Math.sin(T) * Math.cos(L), nz = Math.cos(T) * Math.cos(L), nl = Math.hypot(nx, nz);
  const fwd: V3 = [nx / nl, 0, nz / nl];
  const hw = bw / 2;

  /* ---------- 脚 ---------- */
  const legBack = -DEPTH - 4;
  const legs = [-1, 1].map((s) => {
    const top = world(s * (hw - 22), bh + OVER + 4, legBack), foot = world(s * (hw + 2), vFloor(legBack), legBack);
    return { top, foot, s };
  });
  const backTop = world(0, bh + 8, legBack - 4);
  const backFoot: V3 = add([w / 2, floorY, world(0, vFloor(0), 0)[2]], mul(fwd, -120));
  /** 3D の2点を結ぶ、太さのある棒（画面で幅をとる） */
  const rod = (a: V3, b: V3, width: number) => {
    const pa = project(a), pb = project(b), dx = pb[0] - pa[0], dy = pb[1] - pa[1], len = Math.hypot(dx, dy) || 1;
    const ox = (-dy / len) * width / 2, oy = (dx / len) * width / 2, ka = scaleAt(a), kb = scaleAt(b);
    return { poly: pts([[pa[0] - ox * ka, pa[1] - oy * ka], [pa[0] + ox * ka, pa[1] + oy * ka], [pb[0] + ox * kb, pb[1] + oy * kb], [pb[0] - ox * kb, pb[1] - oy * kb]]), pa, pb, ox, oy, ka, kb };
  };

  /* ---------- ペン置きの棚（板の下のはしから手前へ、水平に） ---------- */
  const trayA = world(-hw + 8, 7), trayB = world(hw - 8, 7);
  const trayDepth = 15, trayH = 9;
  const tA2 = add(trayA, mul(fwd, trayDepth)), tB2 = add(trayB, mul(fwd, trayDepth));
  const down = (p: V3, k = trayH): V3 => [p[0], p[1] + k, p[2]];
  const along = (t: number, d = 0.5, lift = 0): V3 => add(add(add(trayA, mul([trayB[0] - trayA[0], trayB[1] - trayA[1], trayB[2] - trayA[2]], t)), mul(fwd, trayDepth * d)), [0, -lift, 0]);
  const trayLen = Math.hypot(trayB[0] - trayA[0], trayB[2] - trayA[2]);
  const unit: V3 = [(trayB[0] - trayA[0]) / trayLen, (trayB[1] - trayA[1]) / trayLen, (trayB[2] - trayA[2]) / trayLen];
  const markers = [{ t: 0.1, c: "#2F6FC2" }, { t: 0.22, c: "#D9402E" }, { t: 0.34, c: "#2A2E34" }];

  /* ---------- 夜 ---------- */
  const night = Math.pow(Math.max(0, Math.min(1, dark)), 1.1);
  const dim = night > 0.02 ? { filter: `brightness(${1 - night * 0.5}) saturate(${1 - night * 0.25})` } : undefined;

  const footPts = [...legs.map((g) => g.foot), backFoot];
  const shadowPoly = pts([project(add(down(trayA, 0), [0, floorY - trayA[1], 0])), project(add(add(trayB, [0, floorY - trayB[1], 0]), [0, 0, 0])), project(add(add(tB2, [0, floorY - tB2[1], 0]), mul(fwd, 10))), project(add(add(tA2, [0, floorY - tA2[1], 0]), mul(fwd, 10)))]);
  const backShadow = pts([project([legs[0]!.foot[0], floorY, legs[0]!.foot[2]]), project([legs[1]!.foot[0], floorY, legs[1]!.foot[2]]), project(backFoot)]);

  return (
    <div ref={ref} className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4px)] top-[-24px] mx-auto w-[min(96%,470px)]" style={{ perspective: `${PERSP}px`, perspectiveOrigin: `${cx}px ${cy}px` }}>
      {/* うしろの層：床の影・脚・横木・わくの厚み */}
      <svg aria-hidden width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="pointer-events-none absolute inset-0 overflow-visible" style={dim}>
        <defs>
          <filter id="bd-blur" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="6" /></filter>
          <filter id="bd-blur-s" x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="2.2" /></filter>
          <linearGradient id="bd-edge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#7C838D" /><stop offset="1" stopColor="#B8BEC7" /></linearGradient>
          <linearGradient id="bd-edge-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E4E8ED" /><stop offset="1" stopColor="#A7AEB8" /></linearGradient>
        </defs>
        {/* 床の影：ボードの足もと全体、脚の先 */}
        <polygon points={backShadow} fill="#1E1206" opacity="0.22" filter="url(#bd-blur)" />
        <polygon points={shadowPoly} fill="#1E1206" opacity="0.32" filter="url(#bd-blur)" />
        {footPts.map((f, i) => { const [x, y] = project(f), k = scaleAt(f); return <ellipse key={i} cx={x} cy={y} rx={9 * k} ry={3.2 * k} fill="#1E1206" opacity="0.5" filter="url(#bd-blur-s)" />; })}
        {/* うしろの脚（奥へ） */}
        {(() => { const r = rod(backTop, backFoot, 7); return <g><polygon points={r.poly} fill="#5E3A1C" /><line x1={r.pa[0]} y1={r.pa[1]} x2={r.pb[0]} y2={r.pb[1]} stroke="#8A5E36" strokeWidth="1" opacity="0.6" /></g>; })()}
        {/* 前の脚 */}
        {legs.map((g) => {
          const r = rod(g.top, g.foot, 10);
          const [fx, fy] = project(g.foot), k = scaleAt(g.foot);
          return (
            <g key={g.s}>
              <polygon points={r.poly} fill="#A8723F" />
              <line x1={r.pa[0] - r.ox * 0.45 * r.ka} y1={r.pa[1] - r.oy * 0.45 * r.ka} x2={r.pb[0] - r.ox * 0.45 * r.kb} y2={r.pb[1] - r.oy * 0.45 * r.kb} stroke="#D9A672" strokeWidth={2.2} opacity="0.85" />
              <line x1={r.pa[0] + r.ox * 0.8 * r.ka} y1={r.pa[1] + r.oy * 0.8 * r.ka} x2={r.pb[0] + r.ox * 0.8 * r.kb} y2={r.pb[1] + r.oy * 0.8 * r.kb} stroke="#6A4020" strokeWidth={1.6} opacity="0.8" />
              <rect x={fx - 6.5 * k} y={fy - 4 * k} width={13 * k} height={5 * k} rx={2 * k} fill="#2E2A26" />
            </g>
          );
        })}
        {/* 上の横木 */}
        {(() => { const a = world(-hw + 14, bh + OVER, legBack), b = world(hw - 14, bh + OVER, legBack); const r = rod(a, b, 8); return <g><polygon points={r.poly} fill="#B07A46" /><line x1={r.pa[0]} y1={r.pa[1] - 2.5 * r.ka} x2={r.pb[0]} y2={r.pb[1] - 2.5 * r.kb} stroke="#E2B07C" strokeWidth="1.4" opacity="0.8" /></g>; })()}
        {/* わくの厚み（手前に来る左のはしと、上のはし） */}
        <polygon points={pts([P(-hw, 0), P(-hw, bh), P(-hw, bh, -DEPTH), P(-hw, 0, -DEPTH)])} fill="url(#bd-edge)" />
        <polygon points={pts([P(-hw, bh), P(hw, bh), P(hw, bh, -DEPTH), P(-hw, bh, -DEPTH)])} fill="url(#bd-edge-top)" />
      </svg>

      {/* ボードの板（ここだけ CSS の 3D で傾ける） */}
      <div className="absolute" style={{ left: w / 2 - hw, top: yb - bh, width: bw, height: bh, transform: `rotateY(${TURN}deg) rotateX(${LEAN}deg)`, transformOrigin: "50% 100%" }}>
        {/* アルミのわく（前の面） */}
        <div aria-hidden className="absolute inset-0 rounded-[5px] bg-[linear-gradient(135deg,#FBFCFD_0%,#D3D8DF_24%,#F1F3F6_46%,#BCC2CB_72%,#9AA1AB_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,.95),inset_0_-1px_0_rgba(60,66,76,.45),inset_1px_0_0_rgba(255,255,255,.7),inset_-1px_0_0_rgba(60,66,76,.35)]" style={dim} />
        {/* すみの樹脂キャップ */}
        {(["left-0 top-0", "right-0 top-0 rotate-90", "right-0 bottom-0 rotate-180", "left-0 bottom-0 -rotate-90"] as const).map((pos) => (
          <svg key={pos} aria-hidden viewBox="0 0 18 18" className={`absolute h-[18px] w-[18px] ${pos}`} style={dim}>
            <path d="M0 6 Q0 0 6 0 L18 0 L18 7 L7 7 L7 18 L0 18 Z" fill="#474C54" />
            <path d="M0.8 6 Q0.8 0.8 6 0.8 L17 0.8" fill="none" stroke="#858B95" strokeWidth="1.1" />
          </svg>
        ))}
        {/* 映す面（ここだけスクロールする） */}
        <div className="absolute overflow-hidden rounded-[3px] bg-[#FAFBFC] shadow-[0_0_0_1px_#7E858F,0_0_0_2px_#AEB4BD]" style={{ inset: FRAME }}>
          <div className="absolute inset-0 space-y-3 overflow-y-auto overscroll-contain p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {children}
          </div>
          {/* 面のつや（ななめの映りこみ）と、ふちの内がわのかげ */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(112deg,rgba(255,255,255,0)_26%,rgba(255,255,255,.26)_36%,rgba(255,255,255,0)_46%,rgba(255,255,255,0)_68%,rgba(255,255,255,.12)_74%,rgba(255,255,255,0)_80%)]" />
          <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_2px_5px_rgba(0,0,0,.25),inset_2px_0_4px_rgba(0,0,0,.08)]" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-2 bg-gradient-to-b from-[#FAFBFC] to-transparent" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-[#FAFBFC] to-transparent" />
        </div>
      </div>

      {/* 手前の層：ボードをおさえる留め具・ペン置きの棚・マーカー・イレーサー */}
      <svg aria-hidden width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="pointer-events-none absolute inset-0 overflow-visible" style={dim}>
        <defs>
          <linearGradient id="bd-tray-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C9CED6" /><stop offset="1" stopColor="#EEF0F3" /></linearGradient>
          <linearGradient id="bd-tray-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F1F3F6" /><stop offset="0.45" stopColor="#C6CCD4" /><stop offset="1" stopColor="#8F96A0" /></linearGradient>
        </defs>
        {/* 留め具（板の上のはしのまん中） */}
        {(() => {
          const a = P(-20, bh + 2, 2), b = P(20, bh + 2, 2), c = P(20, bh - 7, 2), d = P(-20, bh - 7, 2), knob = P(0, bh + 6, 4), k = scaleAt(world(0, bh, 0));
          return <g><polygon points={pts([a, b, c, d])} fill="#3A3E46" /><polygon points={pts([a, b, P(20, bh, 2), P(-20, bh, 2)])} fill="#6A707A" /><circle cx={knob[0]} cy={knob[1]} r={5.5 * k} fill="#2E3238" /><circle cx={knob[0] - 1.5 * k} cy={knob[1] - 1.5 * k} r={1.8 * k} fill="#8A909A" /></g>;
        })()}
        {/* 棚：上の面・左のはし・前の面 */}
        <polygon points={pts([project(trayA), project(trayB), project(tB2), project(tA2)])} fill="url(#bd-tray-top)" />
        <polygon points={pts([project(trayA), project(tA2), project(down(tA2)), project(down(trayA))])} fill="#9AA1AB" />
        <polygon points={pts([project(tA2), project(tB2), project(down(tB2)), project(down(tA2))])} fill="url(#bd-tray-front)" />
        <polyline points={pts([project(tA2), project(tB2)])} fill="none" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.9" />
        {/* マーカー（棚の上にねかせる） */}
        {markers.map((m) => {
          const a = along(m.t, 0.45, 3), b = add(a, mul(unit, 30)), cap = add(a, mul(unit, 10)), tip = add(b, mul(unit, 3.5));
          const pa = project(a), pb = project(b), pc = project(cap), pt = project(tip), k = scaleAt(a);
          return (
            <g key={m.t}>
              <line x1={pa[0]} y1={pa[1] + 3.2 * k} x2={pb[0]} y2={pb[1] + 3.2 * k} stroke="#000" strokeOpacity="0.16" strokeWidth={5 * k} strokeLinecap="round" />
              <line x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} stroke="#E6E9ED" strokeWidth={6 * k} strokeLinecap="round" />
              <line x1={pa[0]} y1={pa[1] - 1.4 * k} x2={pb[0]} y2={pb[1] - 1.4 * k} stroke="#FFFFFF" strokeWidth={1.4 * k} strokeLinecap="round" opacity="0.9" />
              <line x1={pa[0]} y1={pa[1]} x2={pc[0]} y2={pc[1]} stroke={m.c} strokeWidth={6.2 * k} strokeLinecap="round" />
              <line x1={pb[0]} y1={pb[1]} x2={pt[0]} y2={pt[1]} stroke={m.c} strokeWidth={3 * k} strokeLinecap="round" />
            </g>
          );
        })}
        {/* イレーサー */}
        {(() => {
          const a = along(0.78, 0.5, 0), b = add(a, mul(unit, 42)), k = scaleAt(a);
          const pa = project(a), pb = project(b);
          return (
            <g>
              <line x1={pa[0]} y1={pa[1] + 2 * k} x2={pb[0]} y2={pb[1] + 2 * k} stroke="#000" strokeOpacity="0.2" strokeWidth={6 * k} strokeLinecap="round" />
              <line x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} stroke="#E6DCC8" strokeWidth={4 * k} />
              <line x1={pa[0]} y1={pa[1] - 4 * k} x2={pb[0]} y2={pb[1] - 4 * k} stroke="#33373E" strokeWidth={6 * k} strokeLinecap="round" />
              <line x1={pa[0] + 2} y1={pa[1] - 5.6 * k} x2={pb[0] - 2} y2={pb[1] - 5.6 * k} stroke="#6E747E" strokeWidth={1.3 * k} strokeLinecap="round" />
            </g>
          );
        })()}
      </svg>

      {/* 夜は、面の光が床にうすくこぼれる */}
      {night > 0.15 ? (() => {
        const c = project(add([w / 2, floorY, world(0, 0, 0)[2]], mul(fwd, 30)));
        return <div aria-hidden className="pointer-events-none absolute h-12 rounded-[50%] bg-[radial-gradient(closest-side,rgba(220,232,255,.5),rgba(220,232,255,0))]" style={{ left: c[0] - w * 0.45, top: c[1] - 24, width: w * 0.9, opacity: night * 0.5 }} />;
      })() : null}
    </div>
  );
}
