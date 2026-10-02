"use client";

/**
 * わんこのおへや：部屋の手前の床に、少しななめに立てたイーゼルのホワイトボード。
 * きょうの空・歩数・フレンドのおへやなどを「ボードに映して」見せる。
 * スクロールはボードの面の中だけで動き、部屋と床は動かない。
 *
 * 立体のつくり
 * - ボードの板（アルミのわく・映す面）だけを CSS の 3D で傾ける（足もとのまん中を軸に、右を奥へ TURN°、上をうしろへ LEAN°）。
 *   中の画面もいっしょに傾くが、さわる・スクロールはそのまま使える。
 * - それ以外（わくの厚み・アルミの三脚・まん中の柱と留め具・ペン置きの棚・マーカー・床の影）は傾けずに、
 *   CSS と同じ透視の計算（project）で 3D の点を画面に写して描く。脚の先は床の上に、影は床にねる。
 * 夜は、わくと脚は部屋と同じように暗く、面だけは映した光で明るいまま（床にうすく光がこぼれる）。
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

/** 立てる向き（右のはしを奥へ回す角度・うしろへのもたれ、度）。いまは正面向き */
const TURN = 0, LEAN = 0;
/** 透視の強さ（px）。カメラは部屋と同じく、上から見おろす */
const PERSP = 1150;
/** 板の下のはしから床までの高さ（脚の見えるぶん）・板の上に出る脚・わくの太さ・わくの厚み（px） */
const DEFAULT_DROP = 38, OVER = 16, FRAME = 9, DEPTH = 9;
/** コルク掲示板：木のわくの太さと、わくの内がわに見えるコルクの幅（px） */
const WOOD = 11, CORK_PAD = 9;
/** 映す中身を組む幅（px）。面がこれよりせまいときは、縮めて映す */
const SCREEN_W = 350;

type V3 = [number, number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const pts = (ps: [number, number][]) => ps.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

/** ボードの置き場所（机の上での位置と大きさ）。x は中心、y は足もと（どちらも机の領域の 0〜1）、w は幅（机の幅に対する割合） */
export type BoardPlace = { x: number; y: number; w: number; /** 高さ ÷ 幅（脚まで）。なければ ASPECT */ a?: number };
export const DEFAULT_BOARD: BoardPlace = { x: 0.5, y: 0.6, w: 0.74, a: 1 };
/** ボード（脚まで）の 高さ ÷ 幅 */
const ASPECT = 1.02;
/** 横長〜縦長の、えらべる はば（高さ ÷ 幅） */
const ASPECT_MIN = 0.55, ASPECT_MAX = 1.7;
const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * 机の上のボード。わく・ペン置き・上の留め具をつかんで好きなところへ動かせ、右下のつまみで大きさを変えられる。
 * 映す面の中は、ふつうにさわる・スクロールできる。
 */
export function RoomBoard({ children, dark = 0, drop = DEFAULT_DROP, place = DEFAULT_BOARD, onPlace, above = 0, stand = true, look = "whiteboard" }: {
  children: ReactNode;
  /** 夜の暗さ（0〜1） */
  dark?: number;
  /** 板の下のはしから、置いた面（机）までの高さ（px） */
  drop?: number;
  place?: BoardPlace;
  /** 動かす・大きさを変えるのを終えたとき */
  onPlace?: (p: BoardPlace) => void;
  /** 置ける領域（机の天板）より上に、ボードがはみ出してよい高さ（px）。机に立てたボードは、奥の床の前にそびえる */
  above?: number;
  /** 三脚・留め具・置いた面の影を描くか（false なら、かべにかけたボードのように、わくとペン置きだけ） */
  stand?: boolean;
  /** 見た目：アルミのホワイトボード／木のわくのコルク掲示板（中身をポスターのようにピンでとめる） */
  look?: "whiteboard" | "cork" | "chalk" | "tape";
}) {
  const cork = look === "cork", chalk = look === "chalk", tape = look === "tape";
  /** 木のわくがあるもの（掲示板・黒板） */
  const wooden = cork || chalk;
  /** 板のはしから、映す面までの幅（コルクは 木のわく ＋ コルクの余白） */
  const INS = cork ? WOOD + CORK_PAD : chalk ? WOOD + 12 : tape ? 7 : FRAME;
  const DROP = drop;
  // 置ける領域（机）の大きさ
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
  /** 机からはみ出しすぎないようにそろえる */
  const fit = (p: BoardPlace): BoardPlace => {
    const a0 = clampN(p.a ?? ASPECT, ASPECT_MIN, ASPECT_MAX);
    const wf = clampN(p.w, 0.3, 0.98);
    // 高さは机の領域の 1.15 倍まで（はみ出すぶんは幅をそのままに、高さをちぢめる）
    const a = Math.min(a0, (area.h + above) / (wf * area.w));
    const bwpx = wf * area.w, bhpx = bwpx * a;
    const x = clampN(p.x, (bwpx * 0.42) / area.w, 1 - (bwpx * 0.42) / area.w);
    // 足もとは机の天板の上（奥のふちから手前のふちまで）。上は above まではみ出してよい
    const y = clampN(p.y, Math.max(above > 0 ? 0.12 : 0, Math.min(1, (bhpx - above) / area.h)), 1);
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

  /* ---------- 3D の置き方 ---------- */
  // カメラ（透視の中心）は、まん中の、部屋の床の消えるあたり（上の方）
  const cx = w / 2, cy = -h * 0.55;
  const T = rad(TURN), L = rad(LEAN);
  // 板（足もとのまん中が原点。u 右、v 上、n 手前）。手前に来る脚の先が画面からはみ出さないよう、少し上げる
  // 三脚のないときは、左右の余白（脚が開くぶん）がいらないので広く
  const bw = Math.max(120, w - (stand ? 34 : tape ? 14 : 8));
  const lift = Math.round(4 + bw * Math.sin(T) * 0.16 + DROP * Math.sin(T) * 0.55);
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
  // 映す面の大きさと、中身を縮める倍率
  const screenW = bw - INS * 2, screenH = bh - INS * 2;
  const zoom = Math.min(1, screenW / SCREEN_W);

  /* ---------- 脚 ---------- */
  const legBack = -DEPTH - 4;
  // アルミの三脚：前の2本はボードのうしろから床へ開き、うしろの1本は奥へ。まん中の柱がボードの上をおさえる
  const legs = [-1, 1].map((s) => {
    const top = world(s * (hw - 40), bh * 0.6, legBack), foot = world(s * (hw + 4), vFloor(legBack), legBack);
    return { top, foot, s };
  });
  const backTop = world(0, bh * 0.55, legBack - 6);
  const mastBottom = world(0, bh * 0.3, legBack - 2), mastTop = world(0, bh + OVER + 2, legBack - 2);
  const backFoot: V3 = add([w / 2, floorY, world(0, vFloor(0), 0)[2]], mul(fwd, -120));
  /** 3D の2点を結ぶ、太さのある棒（画面で幅をとる） */
  const rod = (a: V3, b: V3, width: number) => {
    const pa = project(a), pb = project(b), dx = pb[0] - pa[0], dy = pb[1] - pa[1], len = Math.hypot(dx, dy) || 1;
    const ox = (-dy / len) * width / 2, oy = (dx / len) * width / 2, ka = scaleAt(a), kb = scaleAt(b);
    return { poly: pts([[pa[0] - ox * ka, pa[1] - oy * ka], [pa[0] + ox * ka, pa[1] + oy * ka], [pb[0] + ox * kb, pb[1] + oy * kb], [pb[0] - ox * kb, pb[1] - oy * kb]]), pa, pb, ox, oy, ka, kb };
  };

  const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  /** アルミのパイプの脚（上は太く、のびる下の段は少し細い。つぎ目に黒い樹脂の留め具、先にゴムの足） */
  const tube = (a: V3, b: V3, width: number, tone: number) => {
    const j = lerp(a, b, 0.72);
    const up = rod(a, j, width), lo = rod(j, b, width * 0.8), collar = rod(lerp(a, b, 0.68), lerp(a, b, 0.76), width * 1.45), foot = rod(lerp(a, b, 0.97), b, width * 1.35);
    const body = tone < 1 ? "#A3AAB4" : "#C4CAD2", hi = tone < 1 ? "#D8DDE3" : "#FFFFFF", lo2 = tone < 1 ? "#5E656F" : "#7A818B";
    const lines = (r: ReturnType<typeof rod>) => (
      <>
        <line x1={r.pa[0] - r.ox * 0.4 * r.ka} y1={r.pa[1] - r.oy * 0.4 * r.ka} x2={r.pb[0] - r.ox * 0.4 * r.kb} y2={r.pb[1] - r.oy * 0.4 * r.kb} stroke={hi} strokeWidth="1.5" opacity="0.9" />
        <line x1={r.pa[0] + r.ox * 0.75 * r.ka} y1={r.pa[1] + r.oy * 0.75 * r.ka} x2={r.pb[0] + r.ox * 0.75 * r.kb} y2={r.pb[1] + r.oy * 0.75 * r.kb} stroke={lo2} strokeWidth="1.2" opacity="0.8" />
      </>
    );
    return (
      <g>
        <polygon points={up.poly} fill={body} />{lines(up)}
        <polygon points={lo.poly} fill={body} />{lines(lo)}
        <polygon points={collar.poly} fill="#2E3238" />
        <line x1={collar.pa[0] - collar.ox * 0.35 * collar.ka} y1={collar.pa[1] - collar.oy * 0.35 * collar.ka} x2={collar.pb[0] - collar.ox * 0.35 * collar.kb} y2={collar.pb[1] - collar.oy * 0.35 * collar.kb} stroke="#6A707A" strokeWidth="1" />
        <polygon points={foot.poly} fill="#24272C" />
      </g>
    );
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
    <div ref={areaRef} className="pointer-events-none absolute inset-0">
    <div
      className="pointer-events-auto absolute"
      style={{ left, top, width: w, height: h, perspective: `${PERSP}px`, perspectiveOrigin: `${cx}px ${cy}px` }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
    >
      {/* うしろの層：床の影・アルミの三脚・まん中の柱・わくの厚み */}
      <svg aria-hidden width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="pointer-events-none absolute inset-0 overflow-visible" style={dim}>
        <defs>
          <filter id="bd-blur" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="6" /></filter>
          <filter id="bd-blur-s" x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="2.2" /></filter>
          <linearGradient id="bd-edge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#7C838D" /><stop offset="1" stopColor="#B8BEC7" /></linearGradient>
          <linearGradient id="bd-edge-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E4E8ED" /><stop offset="1" stopColor="#A7AEB8" /></linearGradient>
        </defs>
        {stand ? <>
        {/* 床の影：ボードの足もと全体、脚の先 */}
        <polygon points={backShadow} fill="#1E1206" opacity="0.22" filter="url(#bd-blur)" />
        <polygon points={shadowPoly} fill="#1E1206" opacity="0.32" filter="url(#bd-blur)" />
        {footPts.map((f, i) => { const [x, y] = project(f), k = scaleAt(f); return <ellipse key={i} cx={x} cy={y} rx={9 * k} ry={3.2 * k} fill="#1E1206" opacity="0.5" filter="url(#bd-blur-s)" />; })}
        {/* うしろの脚（奥へ、少し暗い） */}
        {tube(backTop, backFoot, 6, 0.8)}
        {/* 前の脚（ボードのうしろから床へ） */}
        {legs.map((g) => <g key={g.s}>{tube(g.top, g.foot, 7.5, 1)}</g>)}
        </> : (
          // 三脚なし：ボードの下にやわらかい影だけ
          <rect x={w / 2 - hw + 6} y={yb - bh + (tape ? 8 : 14)} width={bw - 12} height={bh + (tape ? 0 : 6)} rx="10" fill="#1E1206" opacity={tape ? 0.2 : 0.28} filter="url(#bd-blur)" />
        )}
        {/* まん中の柱（ボードの上に出て、留め具をささえる） */}
        {stand && (() => { const r = rod(mastBottom, mastTop, 7); return <g><polygon points={r.poly} fill="#B9BFC8" /><line x1={r.pa[0] - r.ox * 0.4 * r.ka} y1={r.pa[1] - r.oy * 0.4 * r.ka} x2={r.pb[0] - r.ox * 0.4 * r.kb} y2={r.pb[1] - r.oy * 0.4 * r.kb} stroke="#FFFFFF" strokeWidth="1.6" opacity="0.85" /><line x1={r.pa[0] + r.ox * 0.75 * r.ka} y1={r.pa[1] + r.oy * 0.75 * r.ka} x2={r.pb[0] + r.ox * 0.75 * r.kb} y2={r.pb[1] + r.oy * 0.75 * r.kb} stroke="#6E757F" strokeWidth="1.2" opacity="0.8" /></g>; })()}
        {/* わくの厚み（手前に来る左のはしと、上のはし） */}
        {tape ? null : <>
          <polygon points={pts([P(-hw, 0), P(-hw, bh), P(-hw, bh, -DEPTH), P(-hw, 0, -DEPTH)])} fill={wooden ? "#6E4420" : "url(#bd-edge)"} />
          <polygon points={pts([P(-hw, bh), P(hw, bh), P(hw, bh, -DEPTH), P(-hw, bh, -DEPTH)])} fill={wooden ? "#B98250" : "url(#bd-edge-top)"} />
        </>}
      </svg>

      {/* ボードの板（ここだけ CSS の 3D で傾ける） */}
      <div className="absolute" style={{ left: w / 2 - hw, top: yb - bh, width: bw, height: bh, transform: `rotateY(${TURN}deg) rotateX(${LEAN}deg)`, transformOrigin: "50% 100%" }}>
        {tape ? (
          // 写真のプリントのような白いふち
          <div aria-hidden className="absolute inset-0 rounded-[3px] bg-[#FFFDF8] shadow-[0_1px_1px_rgba(40,30,20,.25)]" style={dim} />
        ) : chalk ? (
          // 木のわくの黒板（深い緑の面に、うすいチョークのあとと らくがき）
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
        ) : cork ? (
          // 木のわく（木目・面取り）と、コルクの面（つぶつぶ・色むら）
          <svg aria-hidden width={bw} height={bh} viewBox={`0 0 ${bw} ${bh}`} className="absolute inset-0" style={dim}>
            <defs>
              <linearGradient id="cork-wood" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#C68A52" /><stop offset="0.5" stopColor="#A86E3C" /><stop offset="1" stopColor="#7E4E26" />
              </linearGradient>
              <filter id="cork-wood-grain" x="0" y="0" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency="0.02 0.25" numOctaves="2" seed="5" result="n" />
                <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.16  0 0 0 0 0.06  0 0 0 1.4 -0.55" />
              </filter>
              <filter id="cork-grain-v" x="0" y="0" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency="0.25 0.02" numOctaves="2" seed="9" result="n" />
                <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.16  0 0 0 0 0.06  0 0 0 1.4 -0.55" />
              </filter>
              <filter id="cork-dots" x="0" y="0" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
                <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.38  0 0 0 0 0.22  0 0 0 0 0.08  0 0 0 3.2 -1.45" />
              </filter>
              <filter id="cork-light" x="0" y="0" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="21" result="n" />
                <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 0.92  0 0 0 0 0.78  0 0 0 2.2 -1.3" />
              </filter>
              <clipPath id="cork-ring"><path fillRule="evenodd" d={`M0 0 H${bw} V${bh} H0 Z M${WOOD} ${WOOD} V${bh - WOOD} H${bw - WOOD} V${WOOD} Z`} /></clipPath>
            </defs>
            {/* 木のわく：上下は横目、左右は縦目 */}
            <rect x="0" y="0" width={bw} height={bh} rx="6" fill="url(#cork-wood)" />
            <g clipPath="url(#cork-ring)">
              <rect x="0" y="0" width={bw} height={WOOD} filter="url(#cork-wood-grain)" />
              <rect x="0" y={bh - WOOD} width={bw} height={WOOD} filter="url(#cork-wood-grain)" />
              <rect x="0" y={WOOD} width={WOOD} height={bh - WOOD * 2} filter="url(#cork-grain-v)" />
              <rect x={bw - WOOD} y={WOOD} width={WOOD} height={bh - WOOD * 2} filter="url(#cork-grain-v)" />
            </g>
            {/* 四すみの、わくの合わせ目（ななめ） */}
            {[[0, 0, WOOD, WOOD], [bw, 0, bw - WOOD, WOOD], [bw, bh, bw - WOOD, bh - WOOD], [0, bh, WOOD, bh - WOOD]].map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5A3416" strokeOpacity="0.45" strokeWidth="1" />)}
            <rect x="0.6" y="0.6" width={bw - 1.2} height={bh - 1.2} rx="5.5" fill="none" stroke="#E8B884" strokeOpacity="0.8" strokeWidth="1.2" />
            <rect x={WOOD - 1.5} y={WOOD - 1.5} width={bw - WOOD * 2 + 3} height={bh - WOOD * 2 + 3} fill="none" stroke="#4A2A10" strokeOpacity="0.55" strokeWidth="1.5" />
            {/* コルク */}
            <rect x={WOOD} y={WOOD} width={bw - WOOD * 2} height={bh - WOOD * 2} fill="#C79362" />
            <rect x={WOOD} y={WOOD} width={bw - WOOD * 2} height={bh - WOOD * 2} filter="url(#cork-dots)" />
            <rect x={WOOD} y={WOOD} width={bw - WOOD * 2} height={bh - WOOD * 2} filter="url(#cork-light)" opacity="0.7" />
            {/* わくの内がわに落ちるかげ */}
            <rect x={WOOD} y={WOOD} width={bw - WOOD * 2} height="5" fill="#2A1606" opacity="0.18" />
            <rect x={WOOD} y={WOOD} width="4" height={bh - WOOD * 2} fill="#2A1606" opacity="0.12" />
          </svg>
        ) : (
          <>
            {/* アルミのわく（前の面） */}
            <div aria-hidden className="absolute inset-0 rounded-[5px] bg-[linear-gradient(135deg,#FBFCFD_0%,#D3D8DF_24%,#F1F3F6_46%,#BCC2CB_72%,#9AA1AB_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,.95),inset_0_-1px_0_rgba(60,66,76,.45),inset_1px_0_0_rgba(255,255,255,.7),inset_-1px_0_0_rgba(60,66,76,.35)]" style={dim} />
            {/* すみの樹脂キャップ */}
            {(["left-0 top-0", "right-0 top-0 rotate-90", "right-0 bottom-0 rotate-180", "left-0 bottom-0 -rotate-90"] as const).map((pos) => (
              <svg key={pos} aria-hidden viewBox="0 0 18 18" className={`absolute h-[18px] w-[18px] ${pos}`} style={dim}>
                <path d="M0 6 Q0 0 6 0 L18 0 L18 7 L7 7 L7 18 L0 18 Z" fill="#474C54" />
                <path d="M0.8 6 Q0.8 0.8 6 0.8 L17 0.8" fill="none" stroke="#858B95" strokeWidth="1.1" />
              </svg>
            ))}
          </>
        )}
        {/* 映す面（ここだけスクロールする） */}
        <div data-board-screen className={`absolute overflow-hidden ${cork ? "rounded-[6px] bg-[#FBF8F1] shadow-[0_3px_6px_rgba(40,20,5,.35),0_1px_1px_rgba(40,20,5,.3)]" : chalk ? "rounded-[8px] bg-[#FBF8F1] shadow-[0_4px_10px_rgba(0,0,0,.45)]" : tape ? "rounded-[2px] bg-[#FBF8F1]" : "rounded-[3px] bg-[#FAFBFC] shadow-[0_0_0_1px_#7E858F,0_0_0_2px_#AEB4BD]"}`} style={{ inset: INS }}>
          {/* 中身は SCREEN_W 以上の幅で組んで、面の大きさに縮めて映す（ボードが小さい・縦長・横長でも文字がつまったり、はみ出したりしない） */}
          <div className="absolute left-0 top-0" style={{ width: screenW / zoom, height: screenH / zoom, zoom }}>
            <div className="absolute inset-0 space-y-3 overflow-y-auto overscroll-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*:not(:first-child)]:mx-2">
              {children}
            </div>
          </div>
          {/* 面のつや（ななめの映りこみ）と、ふちの内がわのかげ（ホワイトボードのとき） */}
          {look !== "whiteboard" ? null : <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(112deg,rgba(255,255,255,0)_26%,rgba(255,255,255,.26)_36%,rgba(255,255,255,0)_46%,rgba(255,255,255,0)_68%,rgba(255,255,255,.12)_74%,rgba(255,255,255,0)_80%)]" />}
          {look !== "whiteboard" ? null : <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_2px_5px_rgba(0,0,0,.25),inset_2px_0_4px_rgba(0,0,0,.08)]" />}
        </div>
      </div>

      {/* 手前の層：ボードをおさえる留め具・ペン置きの棚・マーカー・イレーサー */}
      <svg aria-hidden width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="pointer-events-none absolute inset-0 overflow-visible" style={dim}>
        <defs>
          <linearGradient id="bd-tray-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C9CED6" /><stop offset="1" stopColor="#EEF0F3" /></linearGradient>
          <linearGradient id="bd-tray-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F1F3F6" /><stop offset="0.45" stopColor="#C6CCD4" /><stop offset="1" stopColor="#8F96A0" /></linearGradient>
        </defs>
        {/* 留め具（板の上のはしのまん中） */}
        {stand && (() => {
          // 柱の上から板の上のはしにかぶさる、黒い樹脂のつめ（前に少しだけ出る）
          const a = P(-16, bh + 4, 2), b = P(16, bh + 4, 2), c = P(14, bh - 6, 2), d = P(-14, bh - 6, 2), k = scaleAt(world(0, bh, 0));
          const topA = P(-16, bh + 4, legBack - 2), topB = P(16, bh + 4, legBack - 2), knob = P(0, bh + 10, legBack - 4);
          return <g><polygon points={pts([topA, topB, b, a])} fill="#4A4F57" /><polygon points={pts([a, b, c, d])} fill="#2A2D33" /><polyline points={pts([a, b])} fill="none" stroke="#7A808A" strokeWidth="1.1" /><circle cx={knob[0]} cy={knob[1]} r={4.2 * k} fill="#2A2D33" /><circle cx={knob[0] - 1.2 * k} cy={knob[1] - 1.2 * k} r={1.4 * k} fill="#8A909A" /></g>;
        })()}
        {chalk ? (
          // カードを止める丸いマグネットと、下のチョーク置き（チョーク3本・黒板けし）
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
        ) : tape ? (
          // マスキングテープ（上の左右と、右下）
          <g>
            <defs>
              <pattern id="tape-a" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#FFC9D6" /><rect width="3" height="6" fill="#FFB0C2" /></pattern>
              <pattern id="tape-b" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#BFE3F2" /><circle cx="4" cy="4" r="1.4" fill="#FFFFFF" /></pattern>
            </defs>
            {[{ x: w / 2 - hw + 8, y: yb - bh + 6, r: -38, f: "tape-a" }, { x: w / 2 + hw - 8, y: yb - bh + 6, r: 38, f: "tape-b" }, { x: w / 2 + hw - 10, y: yb - 6, r: -40, f: "tape-a" }].map((t, i) => (
              <g key={i} transform={`translate(${t.x} ${t.y}) rotate(${t.r})`} opacity="0.9">
                <rect x="-26" y="-8" width="52" height="16" fill={`url(#${t.f})`} />
                <rect x="-26" y="-8" width="52" height="16" fill="#FFFFFF" opacity="0.18" />
                <path d="M-26 -8 l 2 2 -2 2 2 2 -2 2 2 2 -2 2 2 2 M26 -8 l -2 2 2 2 -2 2 2 2 -2 2 2 2 -2 2" fill="none" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="1" />
              </g>
            ))}
          </g>
        ) : cork ? (
          // 押しピン（ポスターの上の左右）
          <g>
            <defs>
              <radialGradient id="pin-red" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stopColor="#FF9A8A" /><stop offset="0.45" stopColor="#E0423A" /><stop offset="1" stopColor="#9A1E1A" /></radialGradient>
              <radialGradient id="pin-blue" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stopColor="#A8CCFF" /><stop offset="0.45" stopColor="#3A7AD8" /><stop offset="1" stopColor="#1E4A9A" /></radialGradient>
            </defs>
            {[{ x: w / 2 - hw + INS + 14, c: "pin-red" }, { x: w / 2 + hw - INS - 14, c: "pin-blue" }].map((pin) => {
              const y = yb - bh + INS + 6;
              return (
                <g key={pin.c}>
                  <ellipse cx={pin.x + 3} cy={y + 5} rx="6" ry="3.2" fill="#000" opacity="0.28" />
                  <circle cx={pin.x} cy={y} r="6.2" fill={`url(#${pin.c})`} />
                  <circle cx={pin.x - 2} cy={y - 2.2} r="1.8" fill="#FFFFFF" opacity="0.85" />
                </g>
              );
            })}
          </g>
        ) : <>
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
        </>}
      </svg>

      {/* 夜は、面の光が床にうすくこぼれる */}
      {stand && night > 0.15 ? (() => {
        const c = project(add([w / 2, floorY, world(0, 0, 0)[2]], mul(fwd, 30)));
        return <div aria-hidden className="pointer-events-none absolute h-12 rounded-[50%] bg-[radial-gradient(closest-side,rgba(220,232,255,.5),rgba(220,232,255,0))]" style={{ left: c[0] - w * 0.45, top: c[1] - 24, width: w * 0.9, opacity: night * 0.5 }} />;
      })() : null}

      {/* つかむところ（上の留め具とわく・左右のわく・ペン置きから下）と、大きさを変えるつまみ */}
      {onPlace ? (
        <>
          {[
            { left: 0, top: 0, width: w, height: Math.max(0, yb - bh + INS) },
            { left: 0, top: yb - INS, width: w, height: Math.max(0, h - yb + INS) },
            { left: 0, top: yb - bh, width: w / 2 - hw + INS, height: bh },
            { left: w / 2 + hw - INS, top: yb - bh, width: w / 2 - hw + INS, height: bh },
          ].map((z, i) => <div key={i} className="absolute cursor-grab touch-none active:cursor-grabbing" style={z} />)}
          <button
            type="button" data-board-resize aria-label="ボードの大きさを変える（右下をドラッグ）"
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

/** 机の大きさを測る（天板と、その手前に置くものの両方で使う） */
function useBox(init: { w: number; h: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(init);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setSize({ w: Math.round(r.width), h: Math.round(r.height) }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}
/** 机の手前のふちの厚み（px） */
export const DESK_EDGE = 24;

/** 朝夕の色・夜の暗さ・行事の色を、部屋の明かりの層と同じようにかける */
function Lighting({ w, h, dark, warm, tint }: { w: number; h: number; dark: number; warm: number; tint?: { tint: string; o: number } | null }) {
  const night = Math.pow(Math.max(0, Math.min(1, dark)), 1.15);
  return (
    <>
      {warm > 0.02 ? <rect x="0" y="0" width={w} height={h} fill="#FF9A5A" opacity={warm * 0.13} /> : null}
      {night > 0.02 ? <rect x="0" y="0" width={w} height={h} fill="#0F1438" opacity={0.56 * night} /> : null}
      {tint ? <rect x="0" y="0" width={w} height={h} fill={tint.tint} opacity={tint.o * 0.55} /> : null}
    </>
  );
}

/**
 * 部屋の手前の机（木の天板）。机ごしに部屋をながめる。
 * 木目は、横にのばしたノイズで描く（本物の板のように、細い筋と色むら）。左の窓からの光、奥ほど少し暗く、手前のふちに丸みと厚み。
 */
/**
 * 手前の机（自分が座っている机の天板）。画面の下のほうに、浅い奥行きで見える。
 * 天板は遠近感どおり、奥ほど木目がつまって細かく、奥のふちは細い光の線、手前のふちに丸みと厚み。
 * 机のむこうには部屋の床が続き（FloorBelow）、ボードは机に立って床の前にそびえる。
 */
export function RoomDesk({ dark = 0, warm = 0, tint = null }: { dark?: number; /** 朝夕の色の強さ */ warm?: number; /** 行事の色 */ tint?: { tint: string; o: number } | null }) {
  const [ref, { w, h }] = useBox({ w: 390, h: 160 });
  const top = h - DESK_EDGE;
  // 奥 → 手前の、遠近感のある位置（0〜1 を天板の y に）
  const depthY = (t: number) => Math.pow(t, 1.7) * top;
  const bands = Array.from({ length: 7 }, (_, i) => ({ y0: depthY(i / 7), y1: depthY((i + 1) / 7), s: 0.28 + 0.72 * ((i + 0.5) / 7) }));
  const lines = Array.from({ length: 22 }, (_, i) => { const t = (i + 0.5) / 22, y = depthY(t); return { y, o: 0.06 + t * 0.12, sw: 0.4 + t * 1.1, wob: 0.4 + t * 1.8, ph: i * 1.9 }; });
  return (
    <div ref={ref} className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: "clamp(132px, 40%, 184px)" }} aria-hidden="true">
      {/* 机のむこうの床：机に近いほど少し暗い（机の下のかげ） */}
      <div className="absolute inset-x-0 -top-7 h-7 bg-gradient-to-b from-transparent to-[#1E1206]/20" />
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
        <defs>
          <linearGradient id="desk-top" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#B07B48" />
            <stop offset="0.5" stopColor="#C8945D" />
            <stop offset="1" stopColor="#D9A970" />
          </linearGradient>
          <filter id="desk-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.004 0.13" numOctaves="3" seed="11" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.36  0 0 0 0 0.2  0 0 0 0 0.08  0 0 0 1.5 -0.62" />
          </filter>
          <filter id="desk-blotch" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.003 0.03" numOctaves="2" seed="4" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.98  0 0 0 0 0.86  0 0 0 0 0.66  0 0 0 0.9 -0.35" />
          </filter>
          <linearGradient id="desk-gloss" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#FFF4DA" stopOpacity="0" />
            <stop offset="0.15" stopColor="#FFF4DA" stopOpacity="0.35" />
            <stop offset="0.45" stopColor="#FFF4DA" stopOpacity="0.08" />
            <stop offset="1" stopColor="#FFF4DA" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="desk-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3A2210" stopOpacity="0.22" />
            <stop offset="0.35" stopColor="#3A2210" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="desk-edge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F3D2A2" />
            <stop offset="0.12" stopColor="#D2A06A" />
            <stop offset="0.45" stopColor="#A9743F" />
            <stop offset="1" stopColor="#6E4421" />
          </linearGradient>
          {bands.map((b, i) => <clipPath key={i} id={`desk-band-${i}`}><rect x="0" y={b.y0} width={w} height={b.y1 - b.y0 + 0.5} /></clipPath>)}
        </defs>
        {/* 天板 */}
        <rect x="0" y="0" width={w} height={top} fill="url(#desk-top)" />
        {/* 木目のノイズは、奥の帯ほど縦にちぢめて描く（遠近感） */}
        {bands.map((b, i) => (
          <g key={i} clipPath={`url(#desk-band-${i})`}>
            <g transform={`translate(0 ${b.y0}) scale(1 ${b.s})`}>
              <rect x="0" y="0" width={w} height={(b.y1 - b.y0) / b.s + 2} filter="url(#desk-blotch)" opacity="0.3" />
              <rect x="0" y="0" width={w} height={(b.y1 - b.y0) / b.s + 2} filter="url(#desk-grain)" opacity="0.8" />
            </g>
          </g>
        ))}
        {lines.map((l, i) => (
          <path key={i} d={Array.from({ length: 9 }, (_, k) => `${k ? "L" : "M"}${((k / 8) * w).toFixed(1)} ${(l.y + Math.sin(l.ph + k * 0.8) * l.wob).toFixed(1)}`).join(" ")} fill="none" stroke="#7A4A22" strokeOpacity={l.o} strokeWidth={l.sw} />
        ))}
        {/* 窓からの光の映りこみ（奥の左に、横長に）と、奥ほど少し暗く */}
        <ellipse cx={w * 0.26} cy={depthY(0.3)} rx={w * 0.34} ry={top * 0.16} fill="url(#desk-gloss)" />
        <rect x="0" y="0" width={w} height={top} fill="url(#desk-far)" />
        {/* 奥のふち（丸めた角に光が当たる） */}
        <rect x="0" y="0" width={w} height="1.6" fill="#FFE6BE" opacity="0.95" />
        <rect x="0" y="1.6" width={w} height="1.2" fill="#6A4020" opacity="0.25" />
        {/* 手前のふち（丸みと厚み） */}
        <rect x="0" y={top - 3} width={w} height="3" fill="#FFF0D6" opacity="0.35" />
        <rect x="0" y={top} width={w} height={DESK_EDGE} fill="url(#desk-edge)" />
        <rect x="0" y={top + 0.5} width={w} height="1.4" fill="#FFF3DC" opacity="0.95" />
        <Lighting w={w} h={h} dark={dark} warm={warm} tint={tint} />
      </svg>
    </div>
  );
}

/** 机の上の、ボードより手前に置いたもの（左に多肉植物の鉢、右にコーヒーのマグ） */
export function RoomDeskFront({ dark = 0, warm = 0 }: { dark?: number; warm?: number }) {
  const [ref, { w, h }] = useBox({ w: 390, h: 160 });
  const y = h - DESK_EDGE - 10;
  const mx = w - 46, px = 36;
  const night = Math.pow(Math.max(0, Math.min(1, dark)), 1.15);
  return (
    <div ref={ref} className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: "clamp(132px, 40%, 184px)" }} aria-hidden="true">
      {/* 夜は、置いたものもボードのわくと同じように暗く */}
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block overflow-visible" style={night > 0.02 || warm > 0.02 ? { filter: `brightness(${1 - night * 0.5}) saturate(${1 - night * 0.25}) sepia(${warm * 0.15})` } : undefined}>
        <defs>
          <linearGradient id="mug-body" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#C9CFD7" /><stop offset="0.3" stopColor="#FFFFFF" /><stop offset="0.65" stopColor="#F1F3F6" /><stop offset="1" stopColor="#A9B0BA" />
          </linearGradient>
          <radialGradient id="coffee" cx="0.4" cy="0.4" r="0.7"><stop offset="0" stopColor="#8A5530" /><stop offset="1" stopColor="#4A2A14" /></radialGradient>
          <linearGradient id="pot" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#B85E3A" /><stop offset="0.35" stopColor="#E08A5E" /><stop offset="1" stopColor="#9A4A2A" />
          </linearGradient>
          <radialGradient id="leaf" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#B9DDA0" /><stop offset="0.6" stopColor="#7BB068" /><stop offset="1" stopColor="#4E8A4A" /></radialGradient>
          <filter id="desk-soft" x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="3" /></filter>
        </defs>
        {/* 多肉植物の鉢 */}
        <g>
          <ellipse cx={px + 6} cy={y + 2} rx="24" ry="6" fill="#2A1606" opacity="0.32" filter="url(#desk-soft)" />
          <path d={`M${px - 16} ${y - 26} L${px + 16} ${y - 26} L${px + 12} ${y} Q ${px} ${y + 4} ${px - 12} ${y} Z`} fill="url(#pot)" />
          <rect x={px - 18} y={y - 31} width="36" height="7" rx="2.5" fill="#C8704A" />
          <rect x={px - 18} y={y - 31} width="36" height="2" rx="1" fill="#F2A882" opacity="0.8" />
          <ellipse cx={px} cy={y - 30} rx="15" ry="3.2" fill="#5A3A22" />
          {[[-9, -36, -35], [9, -36, 35], [-4, -42, -12], [5, -42, 14], [0, -46, 0], [-12, -32, -60], [12, -32, 60]].map(([dx, dy, r], i) => (
            <ellipse key={i} cx={px + dx!} cy={y + dy!} rx="5.2" ry="9" transform={`rotate(${r} ${px + dx!} ${y + dy! + 6})`} fill="url(#leaf)" stroke="#4E7A3E" strokeWidth="0.6" />
          ))}
        </g>
        {/* コーヒーのマグ */}
        <g>
          <ellipse cx={mx + 6} cy={y + 2} rx="26" ry="6" fill="#2A1606" opacity="0.32" filter="url(#desk-soft)" />
          <path d={`M${mx + 15} ${y - 26} q 15 0 15 11 q 0 11 -15 11`} fill="none" stroke="#D3D8DF" strokeWidth="5" />
          <path d={`M${mx + 15} ${y - 26} q 15 0 15 11 q 0 11 -15 11`} fill="none" stroke="#FFFFFF" strokeWidth="1.4" opacity="0.7" />
          <path d={`M${mx - 17} ${y - 32} L${mx - 16} ${y - 3} Q ${mx} ${y + 3} ${mx + 16} ${y - 3} L${mx + 17} ${y - 32} Z`} fill="url(#mug-body)" />
          <path d={`M${mx} ${y - 10} C ${mx - 9} ${y - 15}, ${mx - 7} ${y - 22}, ${mx} ${y - 18.5} C ${mx + 7} ${y - 22}, ${mx + 9} ${y - 15}, ${mx} ${y - 10} Z`} fill="#EE8FA8" />
          <ellipse cx={mx} cy={y - 32} rx="17" ry="4.8" fill="#EEF1F4" />
          <ellipse cx={mx} cy={y - 31.4} rx="14.5" ry="3.8" fill="url(#coffee)" />
          <ellipse cx={mx - 4} cy={y - 32.2} rx="5" ry="1.1" fill="#C8956A" opacity="0.6" />
          {/* 湯気 */}
          {[-5, 5].map((dx, i) => (
            <path key={dx} d={`M${mx + dx} ${y - 38} q -5 -8 0 -16 q 5 -8 0 -16`} fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" opacity="0.45">
              <animate attributeName="opacity" values="0;0.55;0" dur="3.6s" begin={`${-i * 1.6}s`} repeatCount="indefinite" />
            </path>
          ))}
        </g>
      </svg>
    </div>
  );
}
