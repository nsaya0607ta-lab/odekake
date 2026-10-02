"use client";

/**
 * わんこのおへや：季節の行事かざり
 * =============================================================
 * 行事の期間は、部屋の空気ごと変える。
 * - EventWash     … 壁の色味（奥の壁と左右の壁に重ねる。ハロウィンは夕やみの紫、七夕は夜空の藍 など）
 * - EventWall     … 壁のかざり（しめ縄・ガーランド・こいのぼり・桜の枝・くものす など）
 * - EventFloor    … 部屋の左右のすみに置くもの（鏡もち・門松・ひな人形・ツリー など）
 * - EventAmbience … 明かりの層（置いたものより手前）。部屋の色、舞う花びら・ハート・星、夜に灯るあかり
 * 座標は room-scene と同じ（viewBox 1000 × 1120、壁と床の境目が HZ）。
 * 動き（SMIL）は「視差効果を減らす」設定のときは止める。
 */
import { useEffect, useState, type ReactNode } from "react";
import { ROOM, type RoomEvent } from "@/lib/room/types";

/* room-scene と同じ部屋の寸法 */
const W = 1000;
const H = 1120;
const HZ = (ROOM.horizon / 100) * H;
const PX = 82, PT = 64, PB = W / 0.86 * ROOM.aspect - H - 64;
const CEIL = 20;

/** 部屋の左右のすみ（奥の床）に置くものの足もと */
const L = { x: 158, y: HZ + 96 };
const R = { x: 846, y: HZ + 104 };
const S = 2.05;

/* ---------- 小さな道具 ---------- */

const rgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
/** t > 0 で白に、t < 0 で黒に寄せる */
function shade(c: string, t: number): string {
  return `#${rgb(c).map((v) => Math.round(t > 0 ? v + (255 - v) * t : v * (1 + t)).toString(16).padStart(2, "0")).join("")}`;
}
type Pt = { x: number; y: number };
const qpt = (a: Pt, c: Pt, b: Pt, t: number): Pt => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });
const qang = (a: Pt, c: Pt, b: Pt, t: number) => (Math.atan2(2 * (1 - t) * (c.y - a.y) + 2 * t * (b.y - c.y), 2 * (1 - t) * (c.x - a.x) + 2 * t * (b.x - c.x)) * 180) / Math.PI;
/** たるんだひも（両はしと、まん中のたるみ）。ベジェの制御点はたるみの2倍下 */
const swag = (a: Pt, b: Pt, sag: number) => ({ a, b, c: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + sag * 2 } });
const rnd = (i: number, k = 1) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };

/** 「視差効果を減らす」設定なら動かさない */
function useStill(): boolean {
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setStill(mq.matches);
    const on = () => setStill(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return still;
}

/** 丸いものの立体（左上が明るい） */
const Ball = ({ id, c, hi = 0.62, lo = -0.4 }: { id: string; c: string; hi?: number; lo?: number }) => (
  <defs>
    <radialGradient id={id} cx="0.4" cy="0.36" r="0.7" fx="0.32" fy="0.26">
      <stop offset="0" stopColor={shade(c, hi)} />
      <stop offset="0.45" stopColor={c} />
      <stop offset="1" stopColor={shade(c, lo)} />
    </radialGradient>
  </defs>
);
/** 筒の立体（左右がかげる） */
const Cyl = ({ id, c, hi = 0.3 }: { id: string; c: string; hi?: number }) => (
  <defs>
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor={shade(c, -0.38)} />
      <stop offset="0.3" stopColor={shade(c, hi)} />
      <stop offset="0.55" stopColor={c} />
      <stop offset="1" stopColor={shade(c, -0.45)} />
    </linearGradient>
  </defs>
);
/** 上から下へ */
const Vert = ({ id, stops }: { id: string; stops: [string, number][] }) => (
  <defs>
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      {stops.map(([c, o], i) => <stop key={i} offset={o} stopColor={c} />)}
    </linearGradient>
  </defs>
);
/** 光のにじみ */
const Glow = ({ id, c }: { id: string; c: string }) => (
  <defs>
    <radialGradient id={id} cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor={c} stopOpacity="0.95" />
      <stop offset="0.35" stopColor={c} stopOpacity="0.45" />
      <stop offset="1" stopColor={c} stopOpacity="0" />
    </radialGradient>
  </defs>
);
/** 床に落ちる影 */
const Shadow = ({ rx, ry, x = 0, y = 0, o = 1 }: { rx: number; ry: number; x?: number; y?: number; o?: number }) => (
  <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="url(#ev-shadow)" opacity={o} />
);
/** くり返す動き（止める設定なら出さない） */
const Spin = ({ still, values, dur, begin = "0s", type = "rotate" }: { still: boolean; values: string; dur: number; begin?: string; type?: "rotate" | "translate" | "scale" | "skewX" }) => {
  if (still) return null;
  const n = values.split(";").length;
  // 行って戻る動きはなめらかに、回り続けるものは一定の速さで
  const smooth = n > 2 ? { calcMode: "spline", keyTimes: Array.from({ length: n }, (_, i) => (i / (n - 1)).toFixed(3)).join(";"), keySplines: Array.from({ length: n - 1 }, () => "0.45 0 0.55 1").join(";") } : {};
  return <animateTransform attributeName="transform" type={type} values={values} dur={`${dur}s`} begin={begin} repeatCount="indefinite" additive="sum" {...smooth} />;
};
const Blink = ({ still, values, dur, begin = "0s" }: { still: boolean; values: string; dur: number; begin?: string }) =>
  still ? null : <animate attributeName="opacity" values={values} dur={`${dur}s`} begin={begin} repeatCount="indefinite" />;

const heartPath = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy + r * 0.92} C ${cx - r * 1.25} ${cy + r * 0.1}, ${cx - r * 1.12} ${cy - r * 0.92}, ${cx - r * 0.52} ${cy - r * 0.9} C ${cx - r * 0.18} ${cy - r * 0.9}, ${cx} ${cy - r * 0.62}, ${cx} ${cy - r * 0.42} C ${cx} ${cy - r * 0.62}, ${cx + r * 0.18} ${cy - r * 0.9}, ${cx + r * 0.52} ${cy - r * 0.9} C ${cx + r * 1.12} ${cy - r * 0.92}, ${cx + r * 1.25} ${cy + r * 0.1}, ${cx} ${cy + r * 0.92} Z`;
const starPath = (r: number, inner = 0.45, n = 5) =>
  `${Array.from({ length: n * 2 }, (_, i) => { const a = (i * Math.PI) / n - Math.PI / 2, rr = i % 2 ? r * inner : r; return `${i ? "L" : "M"}${(Math.cos(a) * rr).toFixed(2)} ${(Math.sin(a) * rr).toFixed(2)}`; }).join(" ")}Z`;
/** 桜の花びら（先に切れこみ）。根もとが原点で上にのびる */
const PETAL = "M0 0 C -7 -4, -10 -13, -6 -20 C -4 -22, -2 -21, 0 -18 C 2 -21, 4 -22, 6 -20 C 10 -13, 7 -4, 0 0 Z";
/** もみじ（原点が葉のつけ根） */
const MAPLE = (() => {
  const lobes = [[-90, 1], [-40, 0.86], [-140, 0.86], [10, 0.6], [170, 0.6]] as const;
  const pts: string[] = [];
  const sorted = [...lobes].sort((a, b) => a[0] - b[0]);
  sorted.forEach(([a, len], i) => {
    const next = sorted[(i + 1) % sorted.length]!;
    const mid = (a + (next[0] < a ? next[0] + 360 : next[0])) / 2;
    const p = (ang: number, r: number) => `${(Math.cos((ang * Math.PI) / 180) * r).toFixed(1)} ${(Math.sin((ang * Math.PI) / 180) * r - 6).toFixed(1)}`;
    pts.push(p(a - 9, len * 12), p(a, len * 18), p(a + 9, len * 12), p(mid, 5));
  });
  return `M${pts.join(" L")} Z`;
})();

/** ひもに下がる電球（ゆっくりまたたく） */
function Lights({ a, b, sag, n, colors, still, wire = "#3B4A34", glow = 0.6 }: { a: Pt; b: Pt; sag: number; n: number; colors: string[]; still: boolean; wire?: string; glow?: number }) {
  const s = swag(a, b, sag);
  return (
    <g>
      {colors.map((c) => <Ball key={c} id={`ev-bulb-${c.slice(1)}`} c={c} hi={0.75} lo={-0.15} />)}
      {colors.map((c) => <Glow key={c} id={`ev-bglow-${c.slice(1)}`} c={c} />)}
      <path d={`M${a.x} ${a.y} Q ${s.c.x} ${s.c.y} ${b.x} ${b.y}`} fill="none" stroke={wire} strokeWidth="1.8" />
      {Array.from({ length: n }, (_, i) => {
        const t = (i + 0.5) / n, p = qpt(s.a, s.c, s.b, t), c = colors[i % colors.length]!, tilt = i % 2 ? 14 : -14;
        return (
          <g key={i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${tilt})`}>
            <circle cy="9" r="13" fill={`url(#ev-bglow-${c.slice(1)})`} opacity={glow * 0.6}>
              <Blink still={still} values="0.25;0.75;0.25" dur={2.2 + (i % 4) * 0.6} begin={`${-(i % 5) * 0.7}s`} />
            </circle>
            <rect x="-2.6" y="0" width="5.2" height="4.5" rx="1" fill="#4A4A40" />
            <ellipse cx="0" cy="9.5" rx="3.6" ry="5.6" fill={`url(#ev-bulb-${c.slice(1)})`} />
          </g>
        );
      })}
    </g>
  );
}

/** プレゼントの箱（正面・右の側面・ふたの上が見える） */
function Gift({ x, y, w, h, d, c, rib, bow = true }: { x: number; y: number; w: number; h: number; d: number; c: string; rib: string; bow?: boolean }) {
  const dx = d * 0.55, dy = d * 0.42, rw = Math.max(5, w * 0.15), lid = Math.max(6, h * 0.2);
  const id = `ev-gift-${c.slice(1)}`, rid = `ev-rib-${rib.slice(1)}`;
  const cx = x + w / 2;
  return (
    <g>
      <Vert id={id} stops={[[shade(c, 0.12), 0], [c, 0.5], [shade(c, -0.18), 1]]} />
      <Cyl id={rid} c={rib} hi={0.45} />
      <Shadow rx={w * 0.72 + dx * 0.5} ry={Math.max(6, d * 0.32)} x={cx + dx * 0.3} y={y + 1} />
      {/* 正面・側面・上 */}
      <rect x={x} y={y - h} width={w} height={h} fill={`url(#${id})`} />
      <polygon points={`${x + w},${y} ${x + w},${y - h} ${x + w + dx},${y - h - dy} ${x + w + dx},${y - dy}`} fill={shade(c, -0.32)} />
      <polygon points={`${x},${y - h} ${x + w},${y - h} ${x + w + dx},${y - h - dy} ${x + dx},${y - h - dy}`} fill={shade(c, 0.28)} />
      {/* ふたのふち（少しはみ出す）と、その下のかげ */}
      <rect x={x - 2} y={y - h} width={w + 4} height={lid} fill={shade(c, 0.06)} />
      <rect x={x} y={y - h + lid} width={w} height="3" fill="#000" opacity="0.14" />
      <polygon points={`${x + w + 2},${y - h + lid} ${x + w + 2},${y - h} ${x + w + dx + 2},${y - h - dy} ${x + w + dx + 2},${y - h - dy + lid}`} fill={shade(c, -0.22)} />
      {/* リボン */}
      <rect x={cx - rw / 2} y={y - h} width={rw} height={h} fill={`url(#${rid})`} />
      <polygon points={`${cx - rw / 2},${y - h} ${cx + rw / 2},${y - h} ${cx + rw / 2 + dx},${y - h - dy} ${cx - rw / 2 + dx},${y - h - dy}`} fill={shade(rib, 0.2)} />
      <polygon points={`${x + dx / 2 - 1},${y - h - dy / 2 - rw * 0.22} ${x + w + dx / 2 + 1},${y - h - dy / 2 - rw * 0.22} ${x + w + dx / 2 + 1},${y - h - dy / 2 + rw * 0.22} ${x + dx / 2 - 1},${y - h - dy / 2 + rw * 0.22}`} fill={shade(rib, 0.08)} />
      <polygon points={`${x + w + dx / 2 - rw * 0.3},${y - dy / 2} ${x + w + dx / 2 - rw * 0.3},${y - h - dy / 2} ${x + w + dx / 2 + rw * 0.3},${y - h - dy / 2 - rw * 0.2} ${x + w + dx / 2 + rw * 0.3},${y - dy / 2 - rw * 0.2}`} fill={shade(rib, -0.25)} />
      {bow ? <Bow x={cx + dx / 2} y={y - h - dy / 2} s={Math.max(0.7, w / 46)} c={rib} /> : null}
    </g>
  );
}

/** リボンの結び目 */
function Bow({ x, y, s, c }: { x: number; y: number; s: number; c: string }) {
  const id = `ev-bow-${c.slice(1)}`;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Ball id={id} c={c} hi={0.5} lo={-0.35} />
      <path d="M-1 0 L-12 17 L-8 16 L-6 20 L2 2 Z" fill={shade(c, -0.18)} />
      <path d="M1 0 L11 18 L7 17 L4 21 L-2 2 Z" fill={shade(c, -0.25)} />
      <path d="M0 0 C -6 -15, -24 -15, -22 -3 C -21 5, -8 4, 0 0 Z" fill={`url(#${id})`} />
      <path d="M0 0 C 6 -15, 24 -15, 22 -3 C 21 5, 8 4, 0 0 Z" fill={`url(#${id})`} />
      <path d="M-3 -2 C -8 -9, -16 -9, -16 -4" fill="none" stroke={shade(c, -0.35)} strokeWidth="1.6" opacity="0.6" />
      <path d="M3 -2 C 8 -9, 16 -9, 16 -4" fill="none" stroke={shade(c, -0.35)} strokeWidth="1.6" opacity="0.6" />
      <ellipse cx="0" cy="-1" rx="4.6" ry="4" fill={shade(c, -0.05)} stroke={shade(c, -0.35)} strokeWidth="0.8" />
    </g>
  );
}

/** 木の三方（さんぼう）。お正月の鏡もち・お月見のだんごをのせる */
function Sanbo({ w = 46 }: { w?: number }) {
  return (
    <g>
      <Vert id="ev-hinoki" stops={[["#F3DDB2", 0], ["#E2BF86", 0.6], ["#C99D60", 1]]} />
      <Shadow rx={w * 1.1} ry={10} y={2} />
      {/* 台 */}
      <path d={`M${-w * 0.62} 0 L${-w * 0.56} ${-38} L${w * 0.56} ${-38} L${w * 0.62} 0 Z`} fill="url(#ev-hinoki)" />
      <path d={`M${-w * 0.25} -6 Q 0 -30 ${w * 0.25} -6 Z`} fill="#7A5430" opacity="0.55" />
      <path d={`M${-w * 0.62} 0 L${-w * 0.56} -38`} stroke="#B98A50" strokeWidth="1.5" />
      <path d={`M${w * 0.62} 0 L${w * 0.56} -38`} stroke="#9C7038" strokeWidth="2" />
      {/* 折敷（おしき） */}
      <path d={`M${-w} -38 L${w} -38 L${w - 2} -48 L${-w + 2} -48 Z`} fill="#D9B377" />
      <path d={`M${-w + 2} -48 L${w - 2} -48 L${w - 12} -58 L${-w + 12} -58 Z`} fill="#F1D9AA" />
      <path d={`M${-w} -38 L${w} -38`} stroke="#A57A42" strokeWidth="2" />
      <path d={`M${-w + 2} -48 L${w - 2} -48`} stroke="#FFF4DC" strokeWidth="1.2" opacity="0.8" />
    </g>
  );
}

/** 桜の花（5まいの花びら、まん中は紅く、しべ） */
function Sakura({ x, y, r = 1, rot = 0, tone = 0 }: { x: number; y: number; r?: number; rot?: number; tone?: number }) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot}) scale(${r})`}>
      {[0, 72, 144, 216, 288].map((a) => <path key={a} d={PETAL} transform={`rotate(${a})`} fill={tone ? "url(#ev-petal-b)" : "url(#ev-petal)"} stroke="#E79BB4" strokeWidth="0.6" />)}
      <circle r="4.4" fill="#E0577F" opacity="0.85" />
      {[0, 51, 103, 154, 206, 257, 309].map((a) => <g key={a} transform={`rotate(${a})`}><line x1="0" y1="0" x2="0" y2="-8" stroke="#D4507A" strokeWidth="0.8" /><circle cy="-8.5" r="1.1" fill="#F6D27A" /></g>)}
    </g>
  );
}
const SakuraDefs = () => (
  <defs>
    <linearGradient id="ev-petal" x1="0.5" y1="1" x2="0.5" y2="0"><stop offset="0" stopColor="#F59AB8" /><stop offset="0.45" stopColor="#FBD0DE" /><stop offset="1" stopColor="#FFF5F8" /></linearGradient>
    <linearGradient id="ev-petal-b" x1="0.5" y1="1" x2="0.5" y2="0"><stop offset="0" stopColor="#EE7FA4" /><stop offset="0.5" stopColor="#F8B9CE" /><stop offset="1" stopColor="#FDE3EC" /></linearGradient>
  </defs>
);

/** 桃の花（丸い花びら・濃いピンク） */
function Momo({ x, y, r = 1 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${r})`}>
      {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-6" rx="5.4" ry="6.4" transform={`rotate(${a})`} fill="url(#ev-momo)" />)}
      <circle r="2.6" fill="#B8325E" />
      {[0, 60, 120, 180, 240, 300].map((a) => <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 3.6} cy={Math.sin((a * Math.PI) / 180) * 3.6} r="0.9" fill="#F8D66A" />)}
    </g>
  );
}

/** 木の枝（根もとが太く、先が細い） */
function Branch({ d, w, c = "#5A3A28" }: { d: string; w: number; c?: string }) {
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke={c} strokeWidth={w} />
      <path d={d} stroke={shade(c, 0.28)} strokeWidth={w * 0.28} transform="translate(-0.8 -1.2)" opacity="0.7" />
    </g>
  );
}

/* =============================================================
 * 壁の色味
 * ============================================================= */

const WASH: Record<RoomEvent, { top: string; topO: number; bottom: string; bottomO: number }> = {
  newyear: { top: "#FFE6A6", topO: 0.38, bottom: "#F4C98A", bottomO: 0.12 },
  valentine: { top: "#FFC3D5", topO: 0.42, bottom: "#FFDCE6", bottomO: 0.16 },
  hina: { top: "#FFD0D9", topO: 0.4, bottom: "#FFE9D6", bottomO: 0.14 },
  hanami: { top: "#FFD3E2", topO: 0.42, bottom: "#FFF0F4", bottomO: 0.12 },
  kodomo: { top: "#BFE6F5", topO: 0.42, bottom: "#DDF2D8", bottomO: 0.16 },
  tanabata: { top: "#14205A", topO: 0.62, bottom: "#3A4C8E", bottomO: 0.24 },
  tsukimi: { top: "#262E66", topO: 0.52, bottom: "#7A6A8C", bottomO: 0.18 },
  halloween: { top: "#2A1442", topO: 0.66, bottom: "#6A3A6E", bottomO: 0.3 },
  christmas: { top: "#7E1A26", topO: 0.32, bottom: "#FFE0B0", bottomO: 0.2 },
};

/** 壁の色味のグラデーション（奥の壁にはここで重ね、左右の壁は room-scene が同じ id で重ねる） */
export function EventWash({ event }: { event: RoomEvent }) {
  const w = WASH[event];
  return (
    <g>
      <defs>
        <linearGradient id="ev-wash" gradientUnits="userSpaceOnUse" x1="0" y1={CEIL} x2="0" y2={HZ}>
          <stop offset="0" stopColor={w.top} stopOpacity={w.topO} />
          <stop offset="1" stopColor={w.bottom} stopOpacity={w.bottomO} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={HZ} fill="url(#ev-wash)" />
    </g>
  );
}

/* =============================================================
 * 壁のかざり
 * ============================================================= */

/** 行事かざりで共通に使う影・ぼかし・花びらの色（場面の SVG と手前の SVG の両方に置く） */
export function EventDefs() {
  return (
    <defs>
      <radialGradient id="ev-shadow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#1E1206" stopOpacity="0.42" />
        <stop offset="0.6" stopColor="#1E1206" stopOpacity="0.18" />
        <stop offset="1" stopColor="#1E1206" stopOpacity="0" />
      </radialGradient>
      <filter id="ev-drop" x="-20%" y="-20%" width="140%" height="170%">
        <feDropShadow dx="3" dy="7" stdDeviation="4.5" floodColor="#2A1A0A" floodOpacity="0.24" />
      </filter>
      <radialGradient id="ev-momo" cx="0.5" cy="0.9" r="0.9"><stop offset="0" stopColor="#E84F86" /><stop offset="0.6" stopColor="#F6A0BE" /><stop offset="1" stopColor="#FFE1EA" /></radialGradient>
      <SakuraDefs />
    </defs>
  );
}

/** 置いたものより手前の SVG（部屋と同じ大きさ）の置き場所 */
const FRONT_BOX = { left: `${(-PX / W) * 100}%`, top: `${(-PT / H) * 100}%`, width: `${((W + PX * 2) / W) * 100}%`, height: `${((H + PT + PB) / H) * 100}%` } as const;

/**
 * 天井からつるす行事のかざり（ガーランド・しめ縄・こいのぼり・くものす など）。
 * 窓や棚・時計より手前に下がるので、置いたものにかくれない。夜の暗さは明かりの層がかける。
 */
export function EventFront({ event, lit }: { event: RoomEvent; lit: boolean }) {
  const still = useStill();
  return (
    <svg viewBox={`${-PX} ${-PT} ${W + PX * 2} ${H + PT + PB}`} preserveAspectRatio="none" className="pointer-events-none absolute" style={FRONT_BOX} aria-hidden="true" data-event-front>
      <EventDefs />
      <g filter="url(#ev-drop)">{WALLS[event]({ lit, still })}</g>
    </svg>
  );
}

type Draw = (o: { lit: boolean; still: boolean }) => ReactNode;

const WALLS: Record<RoomEvent, Draw> = {
  /* ---------- お正月：しめ縄・紙垂・だいだい、両はしに扇 ---------- */
  newyear: () => {
    const s = swag({ x: 290, y: 78 }, { x: 710, y: 78 }, 26);
    const twists = Array.from({ length: 34 }, (_, i) => { const t = (i + 0.5) / 34; return { p: qpt(s.a, s.c, s.b, t), a: qang(s.a, s.c, s.b, t), w: 1 - Math.abs(t - 0.5) * 0.9 }; });
    const fan = (x: number, y: number, flip: boolean) => (
      <g transform={`translate(${x} ${y}) rotate(${flip ? 12 : -12}) scale(${flip ? -1 : 1} 1)`}>
        <path d="M0 0 L-62 -40 A 74 74 0 0 1 62 -40 Z" fill="url(#ev-fan)" stroke="#8A1C24" strokeWidth="1.2" />
        <path d="M-50 -32 A 60 60 0 0 1 50 -32" fill="none" stroke="#E9C25A" strokeWidth="6" />
        <circle cx="-14" cy="-50" r="11" fill="#FFFFFF" opacity="0.85" />
        <path d="M18 -54 q 8 -10 18 -4 q -4 10 -18 4 z" fill="#E9C25A" />
        {Array.from({ length: 13 }, (_, i) => { const a = -147 + i * (114 / 12); return <line key={i} x1="0" y1="0" x2={Math.cos((a * Math.PI) / 180) * 74} y2={Math.sin((a * Math.PI) / 180) * 74} stroke="#7A1018" strokeOpacity="0.25" strokeWidth="1" />; })}
        <circle r="4" fill="#E9C25A" stroke="#8A6A1A" strokeWidth="1" />
        <path d="M0 2 q -4 20 4 34 l -5 14 h 10 l -5 -14" fill="none" stroke="#C9303A" strokeWidth="2.4" />
      </g>
    );
    return (
      <g>
        <defs>
          <linearGradient id="ev-straw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F2DCA0" /><stop offset="0.45" stopColor="#D9B46A" /><stop offset="1" stopColor="#A87C3A" /></linearGradient>
          <linearGradient id="ev-fan" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#B81E2C" /><stop offset="0.5" stopColor="#D9303E" /><stop offset="1" stopColor="#EE5A5A" /></linearGradient>
          <Ball id="ev-daidai" c="#F28A2A" hi={0.55} lo={-0.3} />
        </defs>
        <g transform="translate(112 150) scale(0.78)">{fan(0, 0, false)}</g>
        <g transform="translate(888 150) scale(0.78)">{fan(0, 0, true)}</g>
        {/* しめ縄（太い縄に、ななめのより目） */}
        <path d={`M${s.a.x} ${s.a.y} Q ${s.c.x} ${s.c.y} ${s.b.x} ${s.b.y}`} fill="none" stroke="url(#ev-straw)" strokeWidth="26" strokeLinecap="round" />
        {twists.map((k, i) => (
          <g key={i} transform={`translate(${k.p.x.toFixed(1)} ${k.p.y.toFixed(1)}) rotate(${(k.a + 58).toFixed(1)})`}>
            <path d={`M0 ${-13 * k.w - 2} Q 3 0 0 ${13 * k.w + 2}`} fill="none" stroke="#9A7032" strokeWidth="2.2" opacity="0.75" />
            <path d={`M2.4 ${-11 * k.w} Q 5 0 2.4 ${11 * k.w}`} fill="none" stroke="#FFF0C4" strokeWidth="1.2" opacity="0.6" />
          </g>
        ))}
        {/* 両はしの房 */}
        {[s.a, s.b].map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.y})`}>
            {Array.from({ length: 9 }, (_, k) => <path key={k} d={`M${-6 + k * 1.5} 0 q ${(k - 4) * 1.5} 26 ${(k - 4) * 2.4} 52`} stroke={k % 2 ? "#C9A35A" : "#E6CC8A"} strokeWidth="2" fill="none" />)}
            <rect x="-9" y="-4" width="18" height="9" rx="2" fill="#A87C3A" />
          </g>
        ))}
        {/* 紙垂（しで） */}
        {[0.17, 0.36, 0.64, 0.83].map((t) => {
          const p = qpt(s.a, s.c, s.b, t);
          return (
            <g key={t} transform={`translate(${p.x.toFixed(1)} ${(p.y + 10).toFixed(1)})`}>
              <path d="M-7 0 h14 l-2 18 h-12 z" fill="#FFFFFF" stroke="#D9D6CF" strokeWidth="0.8" />
              <path d="M-5 18 h12 l-2 18 h-12 z" fill="#F2F1EC" stroke="#D9D6CF" strokeWidth="0.8" />
              <path d="M-7 36 h12 l-2 18 h-12 z" fill="#FFFFFF" stroke="#D9D6CF" strokeWidth="0.8" />
              <path d="M-5 54 h12 l-2 16 h-12 z" fill="#F2F1EC" stroke="#D9D6CF" strokeWidth="0.8" />
            </g>
          );
        })}
        {/* まん中：うらじろ・だいだい・ゆずり葉 */}
        <g transform={`translate(500 ${qpt(s.a, s.c, s.b, 0.5).y + 16})`}>
          {[-1, 1].map((d) => (
            <g key={d} transform={`scale(${d} 1)`}>
              <path d="M0 0 Q 30 -6 52 6" fill="none" stroke="#3E6A3A" strokeWidth="2" />
              {Array.from({ length: 9 }, (_, i) => <ellipse key={i} cx={6 + i * 5.2} cy={-1 + i * 0.4} rx="2.6" ry="7" fill={i % 2 ? "#4E8A42" : "#5E9C4A"} transform={`rotate(${30 + i * 4} ${6 + i * 5.2} ${-1 + i * 0.4})`} />)}
            </g>
          ))}
          <path d="M-8 8 C -26 18, -30 36, -22 44 C -12 34, -8 22, -8 8 Z" fill="#3E7A3A" />
          <path d="M8 8 C 26 18, 30 36, 22 44 C 12 34, 8 22, 8 8 Z" fill="#4E8A42" />
          <circle cy="18" r="19" fill="url(#ev-daidai)" />
          <circle cx="-6" cy="12" r="1" fill="#C96A1A" opacity="0.6" /><circle cx="5" cy="24" r="1" fill="#C96A1A" opacity="0.6" />
          <path d="M-2 0 q 6 -8 14 -4 q -4 8 -14 4 z" fill="#4E7A3A" />
        </g>
      </g>
    );
  },

  /* ---------- バレンタイン：ハートのガーランドと電球、LOVE のタグ ---------- */
  valentine: ({ still }) => {
    const s = swag({ x: 120, y: 66 }, { x: 880, y: 66 }, 46);
    const hearts = Array.from({ length: 13 }, (_, i) => ({ t: (i + 0.5) / 13, i }));
    const tints = ["ev-h-red", "ev-h-pink", "ev-h-rose", "ev-h-white"];
    const letters = ["L", "O", "V", "E"];
    return (
      <g>
        <Ball id="ev-h-red" c="#E33A62" hi={0.55} />
        <Ball id="ev-h-pink" c="#F58BAA" hi={0.6} />
        <Ball id="ev-h-rose" c="#E3A48A" hi={0.6} />
        <Ball id="ev-h-white" c="#FBE8EE" hi={0.7} lo={-0.15} />
        <path d={`M${s.a.x} ${s.a.y} Q ${s.c.x} ${s.c.y} ${s.b.x} ${s.b.y}`} fill="none" stroke="#C98A8A" strokeWidth="2" />
        {hearts.map(({ t, i }) => {
          const p = qpt(s.a, s.c, s.b, t);
          if (i >= 5 && i <= 8) {
            // まん中の4つは LOVE のタグ
            const k = i - 5;
            return (
              <g key={i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${(k - 1.5) * 4})`}>
                <line x1="0" y1="0" x2="0" y2="12" stroke="#C98A8A" strokeWidth="1.2" />
                <path d="M-17 12 h34 v34 l-17 12 l-17 -12 z" fill={k % 2 ? "#F58BAA" : "#E33A62"} stroke={k % 2 ? "#D9628A" : "#A8183C"} strokeWidth="1" />
                <path d="M-14 15 h28" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="2 2.5" />
                <text x="0" y="40" textAnchor="middle" fontSize="22" fontWeight="900" fill="#FFFFFF" fontFamily="Georgia, serif">{letters[k]}</text>
              </g>
            );
          }
          const r = 13 + (i % 3) * 3;
          return (
            <g key={i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
              <line x1="0" y1="0" x2="0" y2={10 + (i % 2) * 8} stroke="#C98A8A" strokeWidth="1" />
              <g transform={`translate(0 ${10 + (i % 2) * 8 + r * 0.9})`}>
                <Spin still={still} values={`-5;5;-5`} dur={4 + (i % 3)} begin={`${-i * 0.6}s`} />
                <path d={heartPath(0, 0, r)} fill={`url(#${tints[i % 4]})`} stroke="#00000018" strokeWidth="0.6" />
                <ellipse cx={-r * 0.48} cy={-r * 0.4} rx={r * 0.22} ry={r * 0.13} fill="#FFFFFF" opacity="0.7" transform={`rotate(-35 ${-r * 0.48} ${-r * 0.4})`} />
              </g>
            </g>
          );
        })}
        <Lights a={{ x: 150, y: 52 }} b={{ x: 850, y: 52 }} sag={58} n={22} colors={["#FFE3B0", "#FFC2D6"]} still={still} wire="#B98A7A" />
      </g>
    );
  },

  /* ---------- ひなまつり：桃の枝のガーランドと、つるしびな ---------- */
  hina: ({ still }) => {
    const s = swag({ x: 160, y: 70 }, { x: 840, y: 70 }, 34);
    const strand = (x: number, len: number, seed: number) => {
      const items = 6;
      return (
        <g transform={`translate(${x} 92)`}>
          <Spin still={still} values="-1.6;1.6;-1.6" dur={6 + seed} begin={`${-seed}s`} />
          <line x1="0" y1="0" x2="0" y2={len} stroke="#C9303A" strokeWidth="1.4" />
          {Array.from({ length: items }, (_, i) => {
            const y = 14 + i * ((len - 24) / (items - 1)), kind = (i + seed) % 4;
            return (
              <g key={i} transform={`translate(0 ${y.toFixed(1)})`}>
                {kind === 0 ? <g><circle r="9" fill="url(#ev-temari)" /><path d="M-9 0 h18 M0 -9 v18 M-6.4 -6.4 l12.8 12.8 M6.4 -6.4 l-12.8 12.8" stroke="#F6D27A" strokeWidth="1.2" /></g> : null}
                {kind === 1 ? <g><path d="M0 -10 C 9 -10, 11 2, 0 10 C -11 2, -9 -10, 0 -10 Z" fill="url(#ev-peach)" /><path d="M0 -10 q -6 -6 -12 -2 q 6 4 12 2 z" fill="#5E9C4A" /><path d="M0 -8 v16" stroke="#E07A9A" strokeWidth="0.8" opacity="0.6" /></g> : null}
                {kind === 2 ? <Momo x={0} y={0} r={1.35} /> : null}
                {kind === 3 ? <g><path d="M-9 4 Q -6 -10 0 -9 Q 9 -8 10 -2 L 14 -4 L 12 2 Q 6 8 -9 4 Z" fill="#FFFFFF" stroke="#E5B9C6" strokeWidth="0.8" /><circle cx="5" cy="-4" r="1.3" fill="#2A2A2A" /><path d="M-4 0 q 4 -6 8 0" fill="none" stroke="#E57A9A" strokeWidth="1.2" /></g> : null}
              </g>
            );
          })}
          <g transform={`translate(0 ${len})`}>
            <circle r="4" fill="#E9C25A" />
            {Array.from({ length: 7 }, (_, k) => <line key={k} x1={-3 + k} y1="3" x2={-4.5 + k * 1.5} y2="20" stroke="#C9303A" strokeWidth="1.2" />)}
          </g>
        </g>
      );
    };
    return (
      <g>
        <Ball id="ev-temari" c="#D9405A" hi={0.5} />
        <Ball id="ev-peach" c="#F49AB4" hi={0.65} />
        {/* つるしびな（左右に2本ずつ、その上の輪） */}
        {[[88, 132], [176, 196]].map(([cx, cx2], k) => (
          <g key={k}>
            {k === 0 ? (
              <g>
                <ellipse cx="132" cy="90" rx="50" ry="9" fill="none" stroke="#C9303A" strokeWidth="6" />
                <ellipse cx="132" cy="88" rx="50" ry="9" fill="none" stroke="#F6D27A" strokeWidth="1.4" />
                {strand(cx!, 230, 0)}{strand(cx2!, 200, 1)}{strand(132, 260, 2)}
              </g>
            ) : (
              <g transform="translate(1000 0) scale(-1 1)">
                <ellipse cx="132" cy="90" rx="50" ry="9" fill="none" stroke="#C9303A" strokeWidth="6" />
                <ellipse cx="132" cy="88" rx="50" ry="9" fill="none" stroke="#F6D27A" strokeWidth="1.4" />
                {strand(88, 210, 3)}{strand(176, 240, 1)}{strand(132, 256, 2)}
              </g>
            )}
          </g>
        ))}
        {/* 桃の枝のガーランド */}
        <Branch d={`M${s.a.x} ${s.a.y} Q ${s.c.x} ${s.c.y} ${s.b.x} ${s.b.y}`} w={5} c="#6A4430" />
        {Array.from({ length: 26 }, (_, i) => {
          const t = (i + 0.5) / 26, p = qpt(s.a, s.c, s.b, t), up = i % 2 ? -1 : 1;
          return (
            <g key={i}>
              {i % 3 === 0 ? <ellipse cx={p.x + 8} cy={p.y + 8 * up} rx="10" ry="3.4" fill="#6FA552" transform={`rotate(${up * 30} ${p.x + 8} ${p.y + 8 * up})`} /> : null}
              {i % 4 === 1 ? <ellipse cx={p.x - 4} cy={p.y - 5} rx="3.2" ry="4.6" fill="#E84F86" /> : <Momo x={p.x + rnd(i) * 6 - 3} y={p.y + up * (4 + rnd(i, 2) * 5)} r={1.15 + rnd(i, 3) * 0.5} />}
            </g>
          );
        })}
      </g>
    );
  },

  /* ---------- お花見：両すみから桜の枝、まん中にぼんぼり ---------- */
  hanami: ({ still }) => {
    const side = (mirror: boolean) => {
      const flowers = [[60, 60], [96, 46], [130, 72], [168, 58], [204, 84], [238, 70], [276, 96], [310, 86], [92, 98], [150, 104], [196, 122], [250, 130], [118, 140], [40, 110], [70, 150], [222, 158], [342, 112], [166, 172], [292, 150]];
      return (
        <g transform={mirror ? "translate(1000 0) scale(-1 1)" : undefined}>
          <Branch d="M-20 40 C 60 60, 140 70, 360 110" w={13} />
          <Branch d="M70 58 C 110 90, 150 120, 200 176" w={7} />
          <Branch d="M180 74 C 220 100, 260 130, 300 160" w={5.5} />
          <Branch d="M-20 96 C 20 110, 60 130, 90 170" w={6} />
          <Branch d="M250 92 C 280 80, 300 70, 330 66" w={4} />
          {flowers.map(([x, y], i) => <Sakura key={i} x={x!} y={y!} r={0.82 + rnd(i) * 0.4} rot={rnd(i, 2) * 70} tone={i % 3 === 0 ? 1 : 0} />)}
          {[[110, 60], [260, 108], [180, 150], [30, 128]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="3.4" ry="5" fill="#EE7FA4" transform={`rotate(${30 + i * 40} ${x} ${y})`} />)}
          {[[230, 92], [140, 90], [320, 100]].map(([x, y], i) => <path key={i} d={`M${x} ${y} q 8 -10 16 -4 q -6 8 -16 4 z`} fill="#8AB060" opacity="0.9" />)}
        </g>
      );
    };
    const s = swag({ x: 380, y: 92 }, { x: 620, y: 92 }, 18);
    return (
      <g>
        <SakuraDefs />
        <Vert id="ev-chochin" stops={[["#FFFFFF", 0], ["#FFE6EE", 0.5], ["#F7B6CB", 1]]} />
        {side(false)}
        {side(true)}
        <path d={`M${s.a.x} ${s.a.y} Q ${s.c.x} ${s.c.y} ${s.b.x} ${s.b.y}`} fill="none" stroke="#8A6A4A" strokeWidth="1.6" />
        {[0.1, 0.3, 0.5, 0.7, 0.9].map((t, i) => {
          const p = qpt(s.a, s.c, s.b, t);
          return (
            <g key={t} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
              <Spin still={still} values="-3;3;-3" dur={5 + i} begin={`${-i}s`} />
              <line x1="0" y1="0" x2="0" y2="8" stroke="#3A2A20" strokeWidth="1.2" />
              <rect x="-7" y="8" width="14" height="5" rx="1" fill="#2A2020" />
              <ellipse cx="0" cy="34" rx="16" ry="22" fill="url(#ev-chochin)" stroke="#E79BB4" strokeWidth="0.8" />
              {[-14, -7, 0, 7, 14].map((dy) => <path key={dy} d={`M${-Math.sqrt(1 - (dy / 22) ** 2) * 16} ${34 + dy} Q 0 ${36 + dy} ${Math.sqrt(1 - (dy / 22) ** 2) * 16} ${34 + dy}`} fill="none" stroke="#D98AA4" strokeWidth="0.7" opacity="0.6" />)}
              <Sakura x={0} y={34} r={0.5} />
              <rect x="-7" y="55" width="14" height="5" rx="1" fill="#2A2020" />
              <path d="M0 60 v8" stroke="#C9303A" strokeWidth="2" />
            </g>
          );
        })}
      </g>
    );
  },

  /* ---------- こどもの日：吹き流しとこいのぼり、矢車 ---------- */
  kodomo: ({ still }) => {
    const koi = (x: number, y: number, len: number, c: string, belly: string, id: string, i: number) => {
      const h = len * 0.2;
      const body = `M0 0 C ${len * 0.08} ${-h * 1.15}, ${len * 0.56} ${-h * 1.08}, ${len * 0.82} ${-h * 0.38} L ${len} ${-h * 1.05} L ${len * 0.92} 0 L ${len} ${h * 1.05} L ${len * 0.82} ${h * 0.38} C ${len * 0.56} ${h * 1.08}, ${len * 0.08} ${h * 1.15}, 0 0 Z`;
      return (
        <g transform={`translate(${x} ${y})`}>
          <Spin still={still} values="-3;4;-3" dur={3.2 + i * 0.5} begin={`${-i * 0.8}s`} />
          <defs>
            <clipPath id={`${id}-clip`}><path d={body} /></clipPath>
            <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={shade(c, -0.25)} /><stop offset="0.45" stopColor={c} /><stop offset="0.62" stopColor={shade(c, 0.25)} /><stop offset="0.75" stopColor={belly} /><stop offset="1" stopColor={shade(belly, -0.1)} />
            </linearGradient>
          </defs>
          <path d={body} fill={`url(#${id}-g)`} />
          <g clipPath={`url(#${id}-clip)`}>
            {Array.from({ length: 7 }, (_, col) => Array.from({ length: 4 }, (_, row) => {
              const sx = len * 0.26 + col * len * 0.085, sy = -h * 0.95 + row * h * 0.42 + (col % 2) * h * 0.21;
              return <path key={`${col}-${row}`} d={`M${sx} ${sy} q ${len * 0.045} ${h * 0.32} 0 ${h * 0.42}`} fill="none" stroke={shade(c, 0.45)} strokeWidth="1.3" opacity="0.55" />;
            }))}
            {/* しっぽの縞 */}
            {[0.84, 0.9].map((k) => <path key={k} d={`M${len * k} ${-h * 1.2} v ${h * 2.4}`} stroke={shade(c, -0.3)} strokeWidth="1.5" opacity="0.5" />)}
          </g>
          {/* えら・目・口 */}
          <path d={`M${len * 0.22} ${-h * 0.82} Q ${len * 0.28} 0 ${len * 0.22} ${h * 0.82}`} fill="none" stroke="#FFFFFF" strokeWidth="2.4" opacity="0.85" />
          <ellipse cx="1" cy="0" rx={h * 0.24} ry={h * 0.72} fill="#FFFFFF" stroke={shade(c, -0.2)} strokeWidth="1.4" />
          <circle cx={len * 0.11} cy={-h * 0.28} r={h * 0.34} fill="#FFFFFF" stroke="#E9C25A" strokeWidth="2" />
          <circle cx={len * 0.115} cy={-h * 0.28} r={h * 0.19} fill="#1A1A22" />
          <circle cx={len * 0.1} cy={-h * 0.36} r={h * 0.07} fill="#FFFFFF" />
          {/* ひれ */}
          <path d={`M${len * 0.4} ${h * 0.85} q ${len * 0.05} ${h * 0.55} ${len * 0.12} ${h * 0.4} q -${len * 0.04} -${h * 0.2} -${len * 0.03} -${h * 0.5} z`} fill={shade(c, 0.15)} />
        </g>
      );
    };
    const pinwheel = (x: number, y: number) => (
      <g transform={`translate(${x} ${y})`}>
        <g>
          <Spin still={still} values="0;360" dur={3.5} />
          {["#E4573A", "#F2D16B", "#3E7CC8", "#5E9C52", "#FFFFFF", "#B65A7A", "#E4573A", "#3E7CC8"].map((c, i) => (
            <path key={i} d="M0 0 L 7 -24 L 0 -30 Z" fill={c} stroke="#00000022" strokeWidth="0.6" transform={`rotate(${i * 45})`} />
          ))}
        </g>
        <circle r="5.5" fill="#E9C25A" stroke="#A8822A" strokeWidth="1.2" />
      </g>
    );
    return (
      <g>
        {/* ひも */}
        <path d="M110 82 Q 500 140 890 96" fill="none" stroke="#8A6A4A" strokeWidth="2.2" />
        {pinwheel(110, 82)}
        {/* 吹き流し */}
        <g transform="translate(190 92)">
          <Spin still={still} values="-2;3;-2" dur={3} />
          <ellipse cx="0" cy="0" rx="8" ry="20" fill="#E9C25A" />
          {["#3E7CC8", "#F2F2F2", "#E4573A", "#F2D16B", "#5E9C52"].map((c, i) => (
            <path key={c} d={`M0 ${-18 + i * 8} C 40 ${-22 + i * 8}, 70 ${-6 + i * 8}, 110 ${-12 + i * 9} L 110 ${-5 + i * 9} C 70 ${1 + i * 8}, 40 ${-14 + i * 8}, 0 ${-10 + i * 8} Z`} fill={c} stroke="#00000014" strokeWidth="0.6" />
          ))}
        </g>
        {koi(330, 106, 170, "#2E3448", "#F2F2F2", "ev-koi-a", 0)}
        {koi(530, 120, 138, "#D9402E", "#FFE9D6", "ev-koi-b", 1)}
        {koi(700, 116, 112, "#2F6FC2", "#EAF4FF", "ev-koi-c", 2)}
      </g>
    );
  },

  /* ---------- 七夕：天井から吹き流し、星のかざり ---------- */
  tanabata: ({ still }) => {
    const streamer = (x: number, len: number, palette: string[], seed: number) => (
      <g transform={`translate(${x} 52)`}>
        <line x1="0" y1="-30" x2="0" y2="0" stroke="#8A6A4A" strokeWidth="1.4" />
        <g>
          <Spin still={still} type="skewX" values="0;3;0;-3;0" dur={7 + seed} begin={`${-seed * 1.3}s`} />
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2, sx = Math.cos(a) * 30, c = palette[i % palette.length]!, ln = len * (0.85 + rnd(i, seed) * 0.15);
            return Math.sin(a) < -0.15 ? null : (
              <g key={i}>
                <path d={`M${sx - 4.5} 18 L${sx + 4.5} 18 L${sx * 1.08 + 4} ${ln} L${sx * 1.08 - 4} ${ln} Z`} fill={c} opacity={0.75 + Math.sin(a) * 0.25} />
                <path d={`M${sx - 4.5} 18 L${sx - 1.5} 18 L${sx * 1.08 - 1} ${ln} L${sx * 1.08 - 4} ${ln} Z`} fill="#FFFFFF" opacity="0.22" />
              </g>
            );
          })}
        </g>
        {/* くす玉 */}
        <circle cx="0" cy="8" r="28" fill={`url(#ev-kusu-${seed})`} />
        {Array.from({ length: 22 }, (_, i) => { const a = i * 2.4, r = 6 + (i % 5) * 4.5; return <circle key={i} cx={Math.cos(a) * r} cy={8 + Math.sin(a) * r * 0.9} r="3.6" fill={shade(palette[0]!, 0.5)} opacity="0.7" />; })}
      </g>
    );
    const s = swag({ x: 330, y: 70 }, { x: 670, y: 70 }, 26);
    return (
      <g>
        <Ball id="ev-kusu-0" c="#F06A8A" />
        <Ball id="ev-kusu-1" c="#4A8AE0" />
        <Ball id="ev-gold" c="#F2C84A" hi={0.6} lo={-0.3} />
        {streamer(178, 236, ["#F06A8A", "#FFD2DE", "#F7A8BC", "#FFFFFF", "#E84F7A", "#FBE1A0"], 0)}
        {streamer(822, 236, ["#4A8AE0", "#BFE0FF", "#7AB0F0", "#FFFFFF", "#9C7AE0", "#A0E0D0"], 1)}
        <path d={`M${s.a.x} ${s.a.y} Q ${s.c.x} ${s.c.y} ${s.b.x} ${s.b.y}`} fill="none" stroke="#C9B48A" strokeWidth="1.4" />
        {Array.from({ length: 9 }, (_, i) => {
          const t = (i + 0.5) / 9, p = qpt(s.a, s.c, s.b, t), r = i % 2 ? 11 : 15;
          return (
            <g key={i} transform={`translate(${p.x.toFixed(1)} ${(p.y + 14 + (i % 2) * 10).toFixed(1)})`}>
              <line x1="0" y1={-14 - (i % 2) * 10} x2="0" y2={-r} stroke="#C9B48A" strokeWidth="1" />
              <Spin still={still} values="-12;12;-12" dur={5 + (i % 3)} begin={`${-i}s`} />
              <path d={starPath(r)} fill="url(#ev-gold)" stroke="#B88A2A" strokeWidth="0.8" />
              <path d={starPath(r * 0.45)} fill="#FFF6C8" opacity="0.7" />
            </g>
          );
        })}
      </g>
    );
  },

  /* ---------- お月見：丸い額の月と、もみじのガーランド ---------- */
  tsukimi: ({ still }) => {
    const s = swag({ x: 140, y: 72 }, { x: 860, y: 72 }, 30);
    const cx = 676, cy = 236;
    return (
      <g>
        <defs>
          <radialGradient id="ev-moon" cx="0.42" cy="0.38" r="0.65"><stop offset="0" stopColor="#FFFBE6" /><stop offset="0.6" stopColor="#FBE7A6" /><stop offset="1" stopColor="#E9C468" /></radialGradient>
          <radialGradient id="ev-moonhalo" cx="0.5" cy="0.5" r="0.5"><stop offset="0.45" stopColor="#FFF3C0" stopOpacity="0.55" /><stop offset="1" stopColor="#FFF3C0" stopOpacity="0" /></radialGradient>
        </defs>
        {/* 天井からつるした、月のランプ（うさぎの影絵つき） */}
        <line x1={cx} y1={CEIL} x2={cx} y2={cy - 50} stroke="#4A3A2A" strokeWidth="1.6" />
        <rect x={cx - 7} y={cy - 54} width="14" height="7" rx="2" fill="#8A6A3A" />
        <circle cx={cx} cy={cy} r="96" fill="url(#ev-moonhalo)" />
        <circle cx={cx} cy={cy} r="48" fill="url(#ev-moon)" />
        {[[-16, -14, 9], [14, 8, 7], [-6, 18, 5], [20, -18, 5], [-24, 10, 4]].map(([x, y, r], i) => <circle key={i} cx={cx + x!} cy={cy + y!} r={r} fill="#D9B45A" opacity="0.26" />)}
        <g transform={`translate(${cx + 4} ${cy + 10}) scale(0.62)`} fill="#C9A24A" opacity="0.45">
          <ellipse cx="0" cy="0" rx="12" ry="9" /><circle cx="9" cy="-9" r="6" /><ellipse cx="9" cy="-20" rx="2.4" ry="8" transform="rotate(15 9 -20)" /><ellipse cx="13" cy="-19" rx="2.2" ry="7.5" transform="rotate(30 13 -19)" />
          <path d="M-26 6 h16 l-2 10 h-12 z" /><path d="M8 -4 L -14 -16" stroke="#C9A24A" strokeWidth="3" />
        </g>
        <ellipse cx={cx - 18} cy={cy - 22} rx="12" ry="7" fill="#FFFFFF" opacity="0.5" transform={`rotate(-30 ${cx - 18} ${cy - 22})`} />
        {/* もみじのガーランド */}
        <path d={`M${s.a.x} ${s.a.y} Q ${s.c.x} ${s.c.y} ${s.b.x} ${s.b.y}`} fill="none" stroke="#8A6A4A" strokeWidth="1.6" />
        {Array.from({ length: 21 }, (_, i) => {
          const t = (i + 0.5) / 21, p = qpt(s.a, s.c, s.b, t), c = ["#D9402E", "#F28A2A", "#E9B23A", "#B8302A"][i % 4]!;
          return (
            <g key={i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${(rnd(i) - 0.5) * 60 + 180}) scale(${0.95 + rnd(i, 2) * 0.35})`}>
              <Spin still={still} values="-8;8;-8" dur={4 + (i % 4)} begin={`${-i * 0.5}s`} />
              <path d={MAPLE} fill={c} stroke={shade(c, -0.3)} strokeWidth="0.8" />
              <path d="M0 -6 V -22 M0 -8 L 12 -14 M0 -8 L -12 -14" stroke={shade(c, -0.35)} strokeWidth="0.7" opacity="0.6" />
              <path d="M0 0 v 6" stroke="#6A3A1E" strokeWidth="1.4" />
            </g>
          );
        })}
      </g>
    );
  },

  /* ---------- ハロウィン：フラッグ・オレンジの電球・くものす・こうもり ---------- */
  halloween: ({ still }) => {
    const s = swag({ x: 120, y: 74 }, { x: 880, y: 74 }, 42);
    const flagC = ["#F28A2A", "#5A2E8A", "#1E1A26", "#7AB83A"];
    const web = (mirror: boolean) => (
      <g transform={mirror ? "translate(1000 0) scale(-1 1)" : undefined} fill="none" stroke="#FFFFFF" strokeOpacity="0.62" strokeWidth="1.3">
        {[0, 18, 36, 54, 72, 90].map((a) => <line key={a} x1="44" y1="20" x2={44 + Math.cos((a * Math.PI) / 180) * 170} y2={20 + Math.sin((a * Math.PI) / 180) * 170} />)}
        {[34, 64, 96, 128, 160].map((r) => (
          <path key={r} d={[0, 18, 36, 54, 72, 90].map((a, i) => {
            const x = 44 + Math.cos((a * Math.PI) / 180) * r, y = 20 + Math.sin((a * Math.PI) / 180) * r;
            if (!i) return `M${x.toFixed(1)} ${y.toFixed(1)}`;
            const m = ((a - 9) * Math.PI) / 180, rr = r * 0.9;
            return `Q ${(44 + Math.cos(m) * rr).toFixed(1)} ${(20 + Math.sin(m) * rr).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
          }).join(" ")} />
        ))}
      </g>
    );
    const bat = (x: number, y: number, s2: number, i: number) => (
      <g transform={`translate(${x} ${y}) scale(${s2})`}>
        <Spin still={still} type="translate" values={`0 0;${i % 2 ? 26 : -22} -12;0 0`} dur={6 + i} begin={`${-i * 1.7}s`} />
        <g>
          <Spin still={still} type="scale" values="1 1;1 0.35;1 1" dur={0.42 + i * 0.05} />
          <path d="M0 0 C -8 -10, -22 -16, -40 -8 C -34 -6, -32 -1, -34 4 C -28 0, -24 0, -20 6 C -16 0, -10 0, -6 6 Z" fill="#1A1424" />
          <path d="M0 0 C 8 -10, 22 -16, 40 -8 C 34 -6, 32 -1, 34 4 C 28 0, 24 0, 20 6 C 16 0, 10 0, 6 6 Z" fill="#1A1424" />
        </g>
        <ellipse cx="0" cy="2" rx="6.5" ry="8" fill="#241C30" />
        <path d="M-4 -5 l-2 -7 4 4 z M4 -5 l2 -7 -4 4 z" fill="#241C30" />
        <circle cx="-2.4" cy="0" r="1.3" fill="#FFB84A" /><circle cx="2.4" cy="0" r="1.3" fill="#FFB84A" />
      </g>
    );
    return (
      <g>
        {web(false)}
        {web(true)}
        {/* ぶらさがるくも */}
        <g transform="translate(156 0)">
          <Spin still={still} type="translate" values="0 0;0 34;0 0" dur={7} />
          <line x1="0" y1="20" x2="0" y2="150" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="1" />
          <g transform="translate(0 158)">
            {[-1, 1].map((d) => [0, 1, 2, 3].map((k) => <path key={`${d}${k}`} d={`M0 0 q ${d * 9} ${-6 + k * 4} ${d * 14} ${-1 + k * 5}`} fill="none" stroke="#1A1424" strokeWidth="1.6" />))}
            <ellipse cx="0" cy="2" rx="7" ry="8.5" fill="#1A1424" /><circle cx="0" cy="-7" r="4.5" fill="#241C30" />
            <circle cx="-1.6" cy="-7.6" r="1" fill="#FF5A3A" /><circle cx="1.6" cy="-7.6" r="1" fill="#FF5A3A" />
          </g>
        </g>
        {/* フラッグ */}
        <path d={`M${s.a.x} ${s.a.y} Q ${s.c.x} ${s.c.y} ${s.b.x} ${s.b.y}`} fill="none" stroke="#3A2A20" strokeWidth="2" />
        {Array.from({ length: 13 }, (_, i) => {
          const t = (i + 0.5) / 13, p = qpt(s.a, s.c, s.b, t), a = qang(s.a, s.c, s.b, t), c = flagC[i % 4]!;
          return (
            <g key={i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${a.toFixed(1)})`}>
              <path d="M-24 0 L24 0 L0 48 Z" fill={c} />
              <path d="M-24 0 L0 48 L-6 0 Z" fill="#FFFFFF" opacity="0.1" />
              <path d="M24 0 L0 48 L8 0 Z" fill="#000000" opacity="0.14" />
              <path d="M-24 0 H24" stroke={shade(c, -0.3)} strokeWidth="3" />
              {i % 4 === 0 ? <g transform="translate(0 16)" fill="#1E1A26"><path d="M-6 -2 l3 -4 3 4 z M2 -2 l3 -4 3 4 z" transform="translate(-1 0)" /><path d="M-7 4 q 7 6 14 0 l-2 2 -2 -1 -2 2 -2 -2 -2 1 z" /></g> : null}
              {i % 4 === 1 ? <g transform="translate(0 16) scale(0.32)" fill="#F2D16B"><path d={starPath(22)} /></g> : null}
              {i % 4 === 2 ? <g transform="translate(0 14)"><path d="M-7 10 Q -8 -6 0 -7 Q 8 -6 7 10 l-2.4 -3 -2.3 3 -2.3 -3 -2.3 3 -2.3 -3 z" fill="#FFFFFF" /><circle cx="-2.4" cy="-1" r="1.3" fill="#1E1A26" /><circle cx="2.4" cy="-1" r="1.3" fill="#1E1A26" /></g> : null}
              {i % 4 === 3 ? <g transform="translate(0 15)"><path d="M0 -6 v12 M-6 0 h12" stroke="#FFFFFF" strokeWidth="0" /><circle r="6" fill="#1E1A26" /><circle cx="-2" cy="-1" r="1.4" fill="#7AB83A" /><circle cx="2" cy="-1" r="1.4" fill="#7AB83A" /></g> : null}
            </g>
          );
        })}
        <Lights a={{ x: 170, y: 60 }} b={{ x: 830, y: 60 }} sag={62} n={18} colors={["#FFA23A", "#B57CFF"]} still={still} wire="#2A2020" glow={0.9} />
        <Vert id="ev-ghost" stops={[["#FFFFFF", 0], ["#F2F0FA", 0.6], ["#D8D4EA", 1]]} />
        {/* ふわふわおばけ */}
        <g transform="translate(318 318) scale(1.7)">
          <Spin still={still} type="translate" values="0 0;0 -12;0 0" dur={3.6} />
          <path d="M-20 22 C -24 -4, -18 -28, 0 -28 C 18 -28, 24 -4, 20 22 Q 16 16 12 22 Q 8 28 4 22 Q 0 16 -4 22 Q -8 28 -12 22 Q -16 16 -20 22 Z" fill="url(#ev-ghost)" />
          <ellipse cx="-7" cy="-8" rx="3.2" ry="4.4" fill="#2A2436" /><ellipse cx="7" cy="-8" rx="3.2" ry="4.4" fill="#2A2436" />
          <circle cx="-6" cy="-9.5" r="1" fill="#FFFFFF" /><circle cx="8" cy="-9.5" r="1" fill="#FFFFFF" />
          <ellipse cx="0" cy="2" rx="3" ry="2.2" fill="#2A2436" />
          <ellipse cx="-12" cy="-1" rx="3.4" ry="2" fill="#FFB0C8" opacity="0.7" /><ellipse cx="12" cy="-1" rx="3.4" ry="2" fill="#FFB0C8" opacity="0.7" />
          <path d="M-20 4 q -10 -2 -12 -10 M20 4 q 10 -2 12 -10" stroke="#ECEAF6" strokeWidth="5" strokeLinecap="round" fill="none" />
        </g>
        {bat(330, 236, 1, 0)}
        {bat(700, 200, 0.8, 1)}
        {bat(560, 268, 0.62, 2)}
      </g>
    );
  },

  /* ---------- クリスマス：もみのガーランド・リボン・電球・くつした ---------- */
  christmas: ({ still }) => {
    const s = swag({ x: 110, y: 64 }, { x: 890, y: 64 }, 52);
    const needles = Array.from({ length: 240 }, (_, i) => {
      const t = i / 239, p = qpt(s.a, s.c, s.b, t), a = qang(s.a, s.c, s.b, t);
      return { p, a: a + (rnd(i) - 0.5) * 150 + (i % 2 ? 90 : -90), len: 14 + rnd(i, 2) * 12, c: ["#1F4A2E", "#2E6A3E", "#3E7A4A", "#5E9C5A"][i % 4]! };
    });
    const stocking = (x: number, y: number, c: string, flip: boolean) => (
      <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}>
        <line x1="0" y1="-24" x2="0" y2="0" stroke="#8A6A4A" strokeWidth="1.4" />
        <path d="M-14 6 L 14 6 L 14 54 C 14 66, 24 66, 34 70 C 46 76, 40 94, 24 92 L 2 88 C -12 86, -14 76, -14 64 Z" fill={`url(#ev-sock-${c.slice(1)})`} stroke={shade(c, -0.35)} strokeWidth="1" />
        <path d="M-12 40 h26 M-12 56 h26" stroke="#FFFFFF" strokeWidth="3" strokeDasharray="4 4" opacity="0.65" />
        <rect x="-18" y="-4" width="36" height="17" rx="7" fill="#FFFFFF" />
        <rect x="-18" y="6" width="36" height="7" rx="3" fill="#E9E4DC" />
        <path d="M30 76 a 6 6 0 1 1 0.1 0" fill="#FFFFFF" opacity="0.4" />
      </g>
    );
    return (
      <g>
        <Ball id="ev-sock-C9303A" c="#C9303A" hi={0.35} />
        <Ball id="ev-sock-2E6A3E" c="#2E6A3E" hi={0.35} />
        <Ball id="ev-o-red" c="#D92E3A" />
        <Ball id="ev-o-gold" c="#E8B83A" />
        <Ball id="ev-o-silver" c="#C8D0DA" hi={0.8} />
        <Ball id="ev-cone" c="#8A5A30" hi={0.4} />
        {stocking(212, 132, "#C9303A", false)}
        {stocking(788, 132, "#2E6A3E", true)}
        {/* ガーランド（太い芯の上に、針葉をたくさん） */}
        <path d={`M${s.a.x} ${s.a.y} Q ${s.c.x} ${s.c.y} ${s.b.x} ${s.b.y}`} fill="none" stroke="#1F4A2E" strokeWidth="30" strokeLinecap="round" />
        {needles.map((n, i) => (
          <line key={i} x1={n.p.x.toFixed(1)} y1={n.p.y.toFixed(1)} x2={(n.p.x + Math.cos((n.a * Math.PI) / 180) * n.len).toFixed(1)} y2={(n.p.y + Math.sin((n.a * Math.PI) / 180) * n.len).toFixed(1)} stroke={n.c} strokeWidth="3.2" strokeLinecap="round" />
        ))}
        {/* 松ぼっくりとオーナメント */}
        {[0.08, 0.2, 0.36, 0.64, 0.8, 0.92].map((t, i) => {
          const p = qpt(s.a, s.c, s.b, t), id = ["ev-o-red", "ev-o-gold", "ev-o-silver"][i % 3];
          return i % 3 === 2 ? (
            <g key={t} transform={`translate(${p.x.toFixed(1)} ${(p.y + 14).toFixed(1)})`}>
              <ellipse rx="8" ry="12" fill="url(#ev-cone)" />
              {[-6, -2, 2, 6].map((y) => <path key={y} d={`M-7 ${y} q 7 4 14 0`} fill="none" stroke="#5A3A1E" strokeWidth="1.2" />)}
            </g>
          ) : (
            <g key={t} transform={`translate(${p.x.toFixed(1)} ${(p.y + 8).toFixed(1)})`}>
              <line x1="0" y1="0" x2="0" y2={8 + (i % 2) * 10} stroke="#B8A07A" strokeWidth="1" />
              <rect x="-3.5" y={6 + (i % 2) * 10} width="7" height="5" rx="1" fill="#C9A35A" />
              <circle cy={20 + (i % 2) * 10} r="11" fill={`url(#${id})`} />
              <ellipse cx="-4" cy={15 + (i % 2) * 10} rx="3" ry="2" fill="#FFFFFF" opacity="0.7" />
            </g>
          );
        })}
        <Lights a={{ x: 120, y: 66 }} b={{ x: 880, y: 66 }} sag={50} n={26} colors={["#FFE7A0", "#FFD27A", "#FF8A7A", "#9ADFFF"]} still={still} wire="#1F3A26" glow={0.85} />
        {/* リボン（たるみの3か所） */}
        {[0, 0.5, 1].map((t) => { const p = qpt(s.a, s.c, s.b, t); return <Bow key={t} x={p.x} y={p.y - 2} s={1.45} c="#C9202E" />; })}
      </g>
    );
  },
};

/* =============================================================
 * すみに置くもの
 * ============================================================= */

/**
 * 部屋のすみに置く行事のもの（左右で1つずつの層）。
 * 置いたものと同じく「奥ほど下」に重なるよう、足もとの高さ（部屋の % ）を zIndex に使う。
 */
export const EVENT_FLOOR_Y = { L: (L.y / H) * 100, R: (R.y / H) * 100 } as const;

export function EventFloor({ event, side, lit }: { event: RoomEvent; side: "L" | "R"; lit: boolean }) {
  const still = useStill();
  const f = FLOORS[event], at = side === "L" ? L : R;
  return (
    <svg viewBox={`${-PX} ${-PT} ${W + PX * 2} ${H + PT + PB}`} preserveAspectRatio="none" className="pointer-events-none absolute" style={FRONT_BOX} aria-hidden="true" data-event-floor>
      <EventDefs />
      <g transform={`translate(${at.x} ${at.y}) scale(${(side === "L" ? f.ls : f.rs) ?? S})`}>{(side === "L" ? f.left : f.right)({ lit, still })}</g>
    </svg>
  );
}

/** 夜に灯るもの（明かりの層に光を足す位置。左右のすみの中の座標） */
type GlowPt = { side: "L" | "R"; x: number; y: number; r: number; c: string };

const FLOORS: Record<RoomEvent, { left: Draw; right: Draw; glows?: GlowPt[]; ls?: number; rs?: number }> = {
  /* ---------- お正月 ---------- */
  newyear: {
    ls: 2.3,
    // 鏡もち（三方・四方紅・うらじろ・だいだい）
    left: () => (
      <g>
        <Sanbo />
        <Vert id="ev-mochi" stops={[["#FFFFFF", 0], ["#FBF7EE", 0.55], ["#E6DCC8", 1]]} />
        <path d="M-40 -52 L 0 -64 L 40 -52 L 0 -42 Z" fill="#FFFFFF" stroke="#D9303A" strokeWidth="3" />
        {[-1, 1].map((d) => (
          <g key={d} transform={`translate(${d * 22} -62) scale(${d} 1)`}>
            {Array.from({ length: 6 }, (_, i) => <ellipse key={i} cx={6 + i * 4} cy={-2 - i * 2.2} rx="2.2" ry="6" fill={i % 2 ? "#4E8A42" : "#5E9C4A"} transform={`rotate(${50 + i * 6} ${6 + i * 4} ${-2 - i * 2.2})`} />)}
          </g>
        ))}
        <ellipse cx="0" cy="-70" rx="33" ry="15" fill="url(#ev-mochi)" stroke="#E2D8C4" strokeWidth="0.8" />
        <ellipse cx="0" cy="-64" rx="30" ry="4" fill="#000" opacity="0.06" />
        <ellipse cx="0" cy="-88" rx="25" ry="12.5" fill="url(#ev-mochi)" stroke="#E2D8C4" strokeWidth="0.8" />
        <ellipse cx="-8" cy="-93" rx="9" ry="3" fill="#FFFFFF" opacity="0.9" />
        <Ball id="ev-daidai" c="#F28A2A" hi={0.55} lo={-0.3} />
        <circle cx="0" cy="-108" r="12" fill="url(#ev-daidai)" />
        <path d="M0 -119 q 8 -10 18 -5 q -6 9 -18 5 z" fill="#3E7A3A" />
        <path d="M0 -119 q -6 -8 -14 -6 q 4 8 14 6 z" fill="#4E8A42" />
      </g>
    ),
    // 門松
    right: () => (
      <g>
        <Cyl id="ev-take" c="#5E9C4A" hi={0.4} />
        <Vert id="ev-komo" stops={[["#E9CF92", 0], ["#CDA866", 0.6], ["#A8823F", 1]]} />
        <Ball id="ev-nanten" c="#D9282E" hi={0.6} />
        <Shadow rx={52} ry={11} y={2} />
        {/* 竹（ななめに切った口から中の空洞） */}
        {[[0, -168, 17], [-17, -138, 16], [17, -124, 16]].map(([x, h, w]) => (
          <g key={x}>
            <rect x={x! - w! / 2} y={h} width={w} height={-h!} fill="url(#ev-take)" />
            {[0.38, 0.62].map((k) => <g key={k}><rect x={x! - w! / 2} y={h! * k} width={w} height="3" fill="#3E6A30" opacity="0.55" /><rect x={x! - w! / 2} y={h! * k + 3} width={w} height="1.2" fill="#BFE09A" opacity="0.6" /></g>)}
            <path d={`M${x! - w! / 2} ${h} L${x! + w! / 2} ${h! - 15} L${x! + w! / 2} ${h} Z`} fill="#F4F0D8" />
            <ellipse cx={x} cy={h! - 7.5} rx={w! / 2 - 1.5} ry="6.5" transform={`rotate(-41 ${x} ${h! - 7.5})`} fill="#E6E8C8" stroke="#3E6A30" strokeWidth="1" />
            <ellipse cx={x! + 0.6} cy={h! - 7} rx={w! / 2 - 4} ry="4" transform={`rotate(-41 ${x} ${h! - 7.5})`} fill="#7A8A50" opacity="0.65" />
          </g>
        ))}
        {/* 松と南天 */}
        {[[-34, -70, -1], [34, -72, 1], [-14, -84, -1], [20, -88, 1]].map(([x, y, d], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${d} 1)`}>
            <path d="M0 0 q 8 -6 16 -4" stroke="#5A3A20" strokeWidth="2.4" fill="none" />
            {Array.from({ length: 16 }, (_, k) => { const a = -170 + k * 11; return <line key={k} x1="14" y1="-4" x2={14 + Math.cos((a * Math.PI) / 180) * 15} y2={-4 + Math.sin((a * Math.PI) / 180) * 12} stroke={k % 3 ? "#2E5A2E" : "#4E7E3E"} strokeWidth="1.6" strokeLinecap="round" />; })}
          </g>
        ))}
        {[[-24, -78], [-20, -72], [-28, -72], [-24, -66], [28, -80], [32, -74], [24, -74]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.2" fill="url(#ev-nanten)" />)}
        {/* こも（わらの巻き）となわ */}
        <path d="M-40 -64 L 40 -64 L 36 0 L -36 0 Z" fill="url(#ev-komo)" />
        {Array.from({ length: 16 }, (_, i) => <line key={i} x1={-38 + i * 5} y1="-64" x2={-34 + i * 4.6} y2="0" stroke="#9A7032" strokeWidth="0.8" opacity="0.5" />)}
        <path d="M-40 -64 L 40 -64" stroke="#F4E2B0" strokeWidth="2" />
        {[-48, -26, -8].map((y) => (
          <g key={y}>
            <rect x="-39" y={y} width="78" height="6" fill="#8A6430" />
            {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${-37 + i * 6.4} ${y + 6} l 3.2 -6`} stroke="#C9A35A" strokeWidth="1.4" />)}
          </g>
        ))}
        {/* 梅の花 */}
        {[[-30, -58, "#FFFFFF"], [30, -60, "#E84F6A"], [-6, -66, "#E84F6A"]].map(([x, y, c], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>{[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 3.6} cy={Math.sin((a * Math.PI) / 180) * 3.6} r="3.2" fill={c as string} stroke="#C9405A" strokeWidth="0.4" />)}<circle r="1.6" fill="#F6D27A" /></g>
        ))}
      </g>
    ),
  },

  /* ---------- バレンタイン ---------- */
  valentine: {
    ls: 2.2,
    left: () => (
      <g>
        <Gift x={-50} y={0} w={58} h={46} d={34} c="#F7A8BC" rib="#E33A62" />
        <Gift x={-30} y={-46} w={38} h={30} d={24} c="#FFFFFF" rib="#E33A62" />
        {/* ハートのチョコの箱 */}
        <g transform="translate(36 0)">
          <Ball id="ev-chocobox" c="#C21E44" hi={0.4} />
          <Shadow rx={30} ry={7} y={1} />
          <path d={heartPath(0, -16, 22)} transform="scale(1 0.62) translate(0 -8)" fill="#8A1030" />
          <path d={heartPath(0, -22, 22)} transform="scale(1 0.62) translate(0 -12)" fill="url(#ev-chocobox)" />
          <path d="M-14 -24 q 14 -10 28 0" stroke="#F6D27A" strokeWidth="2" fill="none" />
          <Bow x={0} y={-24} s={0.6} c="#F6D27A" />
        </g>
      </g>
    ),
    // ハートの風船（ゆれる）
    right: ({ still }) => (
      <g>
        <Shadow rx={18} ry={5} y={1} />
        <path d="M-8 0 h16 l-2 -14 h-12 z" fill="#E33A62" />
        <rect x="-6" y="-17" width="12" height="4" rx="2" fill="#F7A8BC" />
        {[[-26, -170, "#E33A62", 26], [16, -196, "#F58BAA", 23], [30, -142, "#FBE8EE", 20], [-6, -120, "#E3A48A", 18]].map(([x, y, c, r], i) => (
          <g key={i}>
            <Ball id={`ev-bal-${i}`} c={c as string} hi={0.55} lo={-0.3} />
            <path d={`M0 -16 Q ${(x as number) * 0.4} ${((y as number) - 16) * 0.5} ${x} ${(y as number) + (r as number) * 0.9}`} fill="none" stroke="#A88A8A" strokeWidth="0.9" />
            <g transform={`translate(${x} ${y})`}>
              <Spin still={still} values="-4;4;-4" dur={4.5 + i * 0.7} begin={`${-i}s`} />
              <path d={heartPath(0, 0, r as number)} fill={`url(#ev-bal-${i})`} />
              <path d={`M-3 ${(r as number) * 0.92} l3 5 3 -5 z`} fill={shade(c as string, -0.2)} />
              <ellipse cx={-(r as number) * 0.48} cy={-(r as number) * 0.38} rx={(r as number) * 0.24} ry={(r as number) * 0.14} transform={`rotate(-35 ${-(r as number) * 0.48} ${-(r as number) * 0.38})`} fill="#FFFFFF" opacity="0.75" />
              <ellipse cx={(r as number) * 0.4} cy={(r as number) * 0.15} rx={(r as number) * 0.08} ry={(r as number) * 0.18} fill="#FFFFFF" opacity="0.3" />
            </g>
          </g>
        ))}
      </g>
    ),
  },

  /* ---------- ひなまつり ---------- */
  hina: {
    // 二段のひな壇（金屏風・ぼんぼり・おだいりさま・おひなさま）
    left: () => (
      <g>
        <Vert id="ev-mosen" stops={[["#E8404E", 0], ["#C82838", 1]]} />
        <Vert id="ev-byobu" stops={[["#F8E2A0", 0], ["#E9C25A", 0.55], ["#C99A3A", 1]]} />
        <Vert id="ev-bonbori" stops={[["#FFFFFF", 0], ["#FFF3E0", 0.6], ["#F6D9B8", 1]]} />
        <Shadow rx={78} ry={13} y={2} />
        {/* 金屏風（4枚の折り目） */}
        {[-56, -28, 0, 28].map((x, i) => <path key={x} d={`M${x} -40 L ${x} -132 L ${x + 28} ${i % 2 ? -132 : -128} L ${x + 28} -40 Z`} fill="url(#ev-byobu)" opacity={i % 2 ? 0.86 : 1} stroke="#A8822A" strokeWidth="0.8" />)}
        <path d="M-50 -110 q 20 -10 40 0 t 40 0 t 30 -4" fill="none" stroke="#FFFFFF" strokeWidth="5" opacity="0.4" strokeLinecap="round" />
        <rect x="-58" y="-136" width="116" height="5" fill="#2A1A10" />
        {/* 段 */}
        <path d="M-74 0 L 74 0 L 74 -20 L -74 -20 Z" fill="url(#ev-mosen)" />
        <path d="M-74 -20 L 74 -20 L 68 -26 L -68 -26 Z" fill="#F0606A" />
        <path d="M-58 -26 L 58 -26 L 58 -40 L -58 -40 Z" fill="url(#ev-mosen)" />
        <path d="M-58 -40 L 58 -40 L 52 -45 L -52 -45 Z" fill="#F0606A" />
        <path d="M-74 -10 H 74" stroke="#F6D27A" strokeWidth="1" opacity="0.5" />
        {/* ぼんぼり */}
        {[-64, 64].map((x) => (
          <g key={x} transform={`translate(${x} -26)`}>
            <rect x="-1.6" y="-30" width="3.2" height="30" fill="#2A1A10" />
            <ellipse cx="0" cy="-1" rx="7" ry="2.5" fill="#2A1A10" />
            <path d="M-10 -32 Q -11 -46 0 -50 Q 11 -46 10 -32 Q 0 -28 -10 -32 Z" fill="url(#ev-bonbori)" stroke="#D9B48A" strokeWidth="0.6" />
            <Momo x={0} y={-40} r={0.55} />
            <rect x="-6" y="-52" width="12" height="3" rx="1" fill="#2A1A10" />
          </g>
        ))}
        {/* おだいりさま */}
        <g transform="translate(-24 -45)">
          <Vert id="ev-sokutai" stops={[["#3E4878", 0], ["#22284A", 1]]} />
          <path d="M-22 0 C -26 -16, -18 -34, 0 -38 C 18 -34, 26 -16, 22 0 Z" fill="url(#ev-sokutai)" />
          <path d="M-22 0 C -24 -10, -22 -18, -16 -22 L -10 0 Z M22 0 C 24 -10, 22 -18, 16 -22 L 10 0 Z" fill="#1A1E38" />
          <path d="M-6 -36 L 0 -26 L 6 -36" fill="none" stroke="#FFFFFF" strokeWidth="2" />
          <path d="M-4 -36 L 0 -29 L 4 -36" fill="none" stroke="#C9303A" strokeWidth="1.4" />
          <rect x="-2" y="-30" width="4" height="22" rx="1" fill="#E3C08A" />
          {Array.from({ length: 6 }, (_, i) => <circle key={i} cx={-14 + (i % 3) * 14} cy={-22 + Math.floor(i / 3) * 12} r="2" fill="#8A90C0" opacity="0.6" />)}
          <circle cx="0" cy="-46" r="9.5" fill="#FFF6EC" />
          <path d="M-9.5 -47 Q -9 -57 0 -57 Q 9 -57 9.5 -47 Q 6 -52 0 -52 Q -6 -52 -9.5 -47 Z" fill="#141414" />
          <path d="M-5 -56 Q -6 -72 4 -76 L 8 -72 Q 2 -66 4 -56 Z" fill="#141414" />
          <path d="M-3.5 -46 h2.4 M1.1 -46 h2.4" stroke="#141414" strokeWidth="1" />
          <circle cx="0" cy="-41.5" r="1.1" fill="#D9405A" />
        </g>
        {/* おひなさま */}
        <g transform="translate(24 -45)">
          <Vert id="ev-junihitoe" stops={[["#E04050", 0], ["#A81E30", 1]]} />
          <path d="M-24 0 C -28 -16, -18 -34, 0 -38 C 18 -34, 28 -16, 24 0 Z" fill="#7A3A8A" />
          <path d="M-22 0 C -26 -16, -17 -33, 0 -37 C 17 -33, 26 -16, 22 0 Z" fill="#3E8A5A" />
          <path d="M-20 0 C -24 -16, -16 -32, 0 -36 C 16 -32, 24 -16, 20 0 Z" fill="url(#ev-junihitoe)" />
          {Array.from({ length: 7 }, (_, i) => <path key={i} d={starPath(2.6, 0.5, 4)} transform={`translate(${-12 + (i % 4) * 8} ${-24 + Math.floor(i / 4) * 12})`} fill="#F6D27A" opacity="0.8" />)}
          <path d="M-7 -36 L 0 -25 L 7 -36" fill="none" stroke="#FFFFFF" strokeWidth="2" />
          <path d="M-5 -36 L 0 -28 L 5 -36" fill="none" stroke="#3E8A5A" strokeWidth="1.4" />
          <path d="M-8 -22 L 0 -34 L 8 -22 Z" fill="#F6D27A" opacity="0.95" />
          <path d="M-6 -25 L 0 -32 L 6 -25" fill="none" stroke="#C9303A" strokeWidth="1" />
          <circle cx="0" cy="-46" r="9.5" fill="#FFF6EC" />
          <path d="M-10 -46 Q -10 -58 0 -58 Q 10 -58 10 -46 L 11 -28 L 7 -30 L 7 -46 Q 0 -52 -7 -46 L -7 -30 L -11 -28 Z" fill="#141414" />
          <path d="M-7 -58 L -4 -64 L 0 -59 L 4 -64 L 7 -58 Z" fill="#E9C25A" />
          <path d="M-3.5 -46 h2.4 M1.1 -46 h2.4" stroke="#141414" strokeWidth="1" />
          <circle cx="0" cy="-41.5" r="1.1" fill="#D9405A" />
        </g>
      </g>
    ),
    // ひしもちと桃の花
    right: () => (
      <g>
        <Cyl id="ev-vase-w" c="#E8E2D6" hi={0.6} />
        <Shadow rx={58} ry={11} y={2} />
        {/* 花びん */}
        <g transform="translate(28 0)">
          <Branch d="M0 -46 C -6 -90, -20 -120, -30 -150" w={3.2} c="#6A4430" />
          <Branch d="M2 -46 C 8 -86, 20 -110, 28 -138" w={2.8} c="#6A4430" />
          <Branch d="M0 -70 C 10 -96, 4 -120, 8 -160" w={2.4} c="#6A4430" />
          {[[-30, -150], [-24, -130], [-14, -112], [28, -138], [22, -116], [12, -98], [8, -160], [6, -136], [-8, -92], [16, -80]].map(([x, y], i) => <Momo key={i} x={x!} y={y!} r={1.05 + rnd(i) * 0.3} />)}
          {[[-20, -122], [18, -128], [4, -148]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="6" ry="2.4" fill="#6FA552" transform={`rotate(${-30 + i * 30} ${x} ${y})`} />)}
          <path d="M-14 0 C -20 -16, -18 -34, -8 -44 L 8 -44 C 18 -34, 20 -16, 14 0 Z" fill="url(#ev-vase-w)" />
          <path d="M-12 -24 q 12 -6 24 0" fill="none" stroke="#3E5A9A" strokeWidth="2" opacity="0.7" />
          <ellipse cx="0" cy="-44" rx="8" ry="2.4" fill="#C9C2B4" />
        </g>
        {/* ひしもち */}
        <g transform="translate(-30 0)">
          <path d="M-30 0 L 30 0 L 26 -12 L -26 -12 Z" fill="#6A3A20" />
          <path d="M-26 -12 L 26 -12 L 22 -16 L -22 -16 Z" fill="#8A5430" />
          {[["#9CC46A", "#7AA24A"], ["#FFFDF6", "#E6DFD0"], ["#F7A8C0", "#E084A2"]].map(([top, side], i) => {
            const y = -16 - i * 9;
            return (
              <g key={i}>
                <path d={`M-28 ${y} L 0 ${y + 8} L 28 ${y} L 28 ${y - 7} L 0 ${y + 1} L -28 ${y - 7} Z`} fill={side} />
                {i === 2 ? <path d={`M-28 ${y - 7} L 0 ${y - 15} L 28 ${y - 7} L 0 ${y + 1} Z`} fill={top} /> : null}
              </g>
            );
          })}
          <path d="M-28 -50 L 0 -42 L 28 -50" fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.6" />
        </g>
      </g>
    ),
    glows: [{ side: "L", x: -64, y: -66, r: 34, c: "#FFD9A0" }, { side: "L", x: 64, y: -66, r: 34, c: "#FFD9A0" }],
    ls: 1.8,
  },

  /* ---------- お花見 ---------- */
  hanami: {
    // 大きな花びんに生けた桜
    left: () => (
      <g>
        <SakuraDefs />
        <Vert id="ev-vase-ai" stops={[["#5A7AC0", 0], ["#2E4A8A", 0.6], ["#1E3266", 1]]} />
        <Shadow rx={46} ry={10} y={2} />
        <Branch d="M0 -60 C -20 -110, -40 -150, -70 -190" w={4.5} />
        <Branch d="M0 -60 C 12 -110, 30 -150, 58 -200" w={4} />
        <Branch d="M0 -60 C 0 -120, -6 -170, 4 -230" w={3.8} />
        <Branch d="M-40 -150 C -60 -150, -76 -140, -90 -130" w={2.4} />
        <Branch d="M30 -150 C 50 -140, 62 -126, 74 -110" w={2.4} />
        {[[-70, -190], [-56, -170], [-40, -152], [-88, -130], [-74, -142], [58, -200], [46, -178], [30, -152], [74, -110], [62, -130], [4, -230], [-4, -206], [6, -184], [-12, -160], [16, -132], [-26, -120], [-62, -206], [40, -214], [18, -220], [-20, -220], [84, -150]].map(([x, y], i) => <Sakura key={i} x={x!} y={y!} r={0.9 + rnd(i) * 0.35} rot={rnd(i, 2) * 70} tone={i % 3 === 0 ? 1 : 0} />)}
        <path d="M-24 0 C -34 -14, -34 -44, -16 -58 L 16 -58 C 34 -44, 34 -14, 24 0 Z" fill="url(#ev-vase-ai)" />
        <path d="M-24 0 C -34 -14, -34 -44, -16 -58 L -8 -58 C -24 -44, -26 -14, -16 0 Z" fill="#FFFFFF" opacity="0.14" />
        <path d="M-26 -30 q 26 -10 52 0" fill="none" stroke="#E9EEF8" strokeWidth="2" opacity="0.7" />
        {[-14, 0, 14].map((x) => <Sakura key={x} x={x} y={-30} r={0.4} />)}
        <ellipse cx="0" cy="-58" rx="16" ry="4" fill="#1A2A55" />
      </g>
    ),
    // 花見だんごとお茶
    right: ({ still }) => (
      <g>
        <Vert id="ev-urushi" stops={[["#D9303A", 0], ["#9A1820", 1]]} />
        <Ball id="ev-dpink" c="#F5A7C0" hi={0.6} lo={-0.25} />
        <Ball id="ev-dwhite" c="#FBF6EA" hi={0.8} lo={-0.15} />
        <Ball id="ev-dgreen" c="#9CC46A" hi={0.55} lo={-0.3} />
        <Cyl id="ev-yunomi" c="#E8DCC4" hi={0.5} />
        <Shadow rx={60} ry={11} y={2} />
        {/* お盆 */}
        <ellipse cx="-12" cy="-4" rx="46" ry="12" fill="#6A1018" />
        <ellipse cx="-12" cy="-8" rx="46" ry="12" fill="url(#ev-urushi)" />
        <ellipse cx="-12" cy="-9" rx="40" ry="9" fill="#B8202A" />
        {[[-30, -14, -12], [-14, -10, -8], [2, -8, -4]].map(([x, y, rot], i) => (
          <g key={i} transform={`translate(${x} ${y}) rotate(${rot})`}>
            <line x1="-26" y1="0" x2="22" y2="0" stroke="#D9B477" strokeWidth="2" />
            <circle cx="-13" cy="-4" r="7" fill="url(#ev-dgreen)" />
            <circle cx="0" cy="-4" r="7" fill="url(#ev-dwhite)" />
            <circle cx="13" cy="-4" r="7" fill="url(#ev-dpink)" />
          </g>
        ))}
        {/* 湯のみと湯気 */}
        <g transform="translate(40 0)">
          <Shadow rx={16} ry={4} y={1} />
          <path d="M-12 0 L -13 -28 L 13 -28 L 12 0 Z" fill="url(#ev-yunomi)" />
          <ellipse cx="0" cy="-28" rx="13" ry="4" fill="#8DB25A" stroke="#D9CDB4" strokeWidth="1.2" />
          <path d="M-12 -12 q 12 4 24 0" stroke="#7AA24A" strokeWidth="1.5" fill="none" opacity="0.6" />
          {[-4, 4].map((x, i) => (
            <path key={x} d={`M${x} -34 q -5 -8 0 -16 q 5 -8 0 -16`} fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" opacity="0.5">
              <Blink still={still} values="0;0.6;0" dur={3} begin={`${-i * 1.4}s`} />
            </path>
          ))}
        </g>
      </g>
    ),
  },

  /* ---------- こどもの日 ---------- */
  kodomo: {
    // かぶとかざり
    left: () => (
      <g>
        <Vert id="ev-byobu" stops={[["#F8E2A0", 0], ["#E9C25A", 0.55], ["#C99A3A", 1]]} />
        <Ball id="ev-hachi" c="#2A3352" hi={0.45} lo={-0.45} />
        <Vert id="ev-kuwa" stops={[["#FFF0B0", 0], ["#E9C25A", 0.4], ["#A8781E", 1]]} />
        <Vert id="ev-lacq" stops={[["#3A2A24", 0], ["#120C0A", 1]]} />
        <Shadow rx={70} ry={12} y={2} />
        {/* 屏風 */}
        {[-60, -30, 0, 30].map((x, i) => <path key={x} d={`M${x} -20 L ${x} -150 L ${x + 30} ${i % 2 ? -150 : -146} L ${x + 30} -20 Z`} fill="url(#ev-byobu)" opacity={i % 2 ? 0.85 : 1} stroke="#A8822A" strokeWidth="0.8" />)}
        <path d="M-50 -130 C -30 -110, -10 -140, 20 -120 S 50 -110, 56 -128" fill="none" stroke="#3E7CC8" strokeWidth="5" opacity="0.35" />
        {/* 台 */}
        <rect x="-56" y="-22" width="112" height="22" fill="url(#ev-lacq)" />
        <rect x="-56" y="-22" width="112" height="3" fill="#E9C25A" />
        <rect x="-56" y="-3" width="112" height="3" fill="#C99A3A" />
        <path d="M-60 -22 L 60 -22 L 54 -28 L -54 -28 Z" fill="#4A3A30" />
        {/* しころ（首を守る板） */}
        {[0, 1, 2, 3].map((k) => {
          const y = -66 + k * 10, w = 40 + k * 7;
          return (
            <g key={k}>
              <path d={`M${-w} ${y} Q 0 ${y - 16} ${w} ${y} L ${w + 4} ${y + 11} Q 0 ${y - 4} ${-w - 4} ${y + 11} Z`} fill={k % 2 ? "#26304E" : "#2E3A5E"} stroke="#141A30" strokeWidth="0.8" />
              {Array.from({ length: 9 }, (_, i) => { const x = -w + 8 + i * ((w * 2 - 16) / 8); return <line key={i} x1={x} y1={y + 2 - (1 - (x / w) ** 2) * 6} x2={x} y2={y + 8 - (1 - (x / w) ** 2) * 6} stroke={k % 2 ? "#E4573A" : "#5A8AE0"} strokeWidth="2" />; })}
            </g>
          );
        })}
        {/* ふきかえし */}
        {[-1, 1].map((d) => <path key={d} d={`M${d * 34} -70 Q ${d * 56} -78 ${d * 60} -60 Q ${d * 56} -48 ${d * 42} -52 Z`} fill="#2E3A5E" stroke="#E9C25A" strokeWidth="2" />)}
        {/* 鉢（はち）と星（びょう） */}
        <path d="M-38 -66 A 38 46 0 0 1 38 -66 Z" fill="url(#ev-hachi)" />
        {[-26, -13, 0, 13, 26].map((x) => Array.from({ length: 4 }, (_, i) => <circle key={`${x}${i}`} cx={x * (1 - i * 0.12)} cy={-72 - i * 9 - (1 - (x / 38) ** 2) * 2} r="1.5" fill="#E9C25A" opacity="0.85" />))}
        <path d="M-40 -66 Q 0 -58 40 -66 L 38 -60 Q 0 -52 -38 -60 Z" fill="#141A30" />
        {/* くわがた */}
        <path d="M-5 -74 C -16 -100, -34 -130, -46 -158 L -36 -160 C -26 -132, -10 -104, 3 -78 Z" fill="url(#ev-kuwa)" stroke="#8A6014" strokeWidth="0.8" />
        <path d="M5 -74 C 16 -100, 34 -130, 46 -158 L 36 -160 C 26 -132, 10 -104, -3 -78 Z" fill="url(#ev-kuwa)" stroke="#8A6014" strokeWidth="0.8" />
        <circle cx="0" cy="-80" r="9" fill="url(#ev-kuwa)" stroke="#8A6014" strokeWidth="0.8" />
        <circle cx="0" cy="-80" r="4" fill="#C9303A" />
      </g>
    ),
    ls: 1.85,
    // しょうぶと柏もち
    right: () => (
      <g>
        <Cyl id="ev-vase-g" c="#7AA0B8" hi={0.5} />
        <Vert id="ev-kashiwa" stops={[["#7AAE4A", 0], ["#4E7A2A", 1]]} />
        <Shadow rx={56} ry={10} y={2} />
        <g transform="translate(-26 0)">
          {[[-18, -170, -14], [-4, -186, -4], [8, -176, 8], [18, -150, 16], [-12, -140, -10]].map(([x, h, lean], i) => <path key={i} d={`M${x! * 0.3} -40 Q ${x} ${h! * 0.6} ${x! + lean!} ${h}`} stroke={i % 2 ? "#4E8A3A" : "#5E9C4A"} strokeWidth="4.5" fill="none" strokeLinecap="round" />)}
          {[[-10, -150], [12, -162]].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              {[0, 120, 240].map((a) => <path key={a} d="M0 0 C -8 4, -10 14, -2 20 C 2 12, 3 6, 0 0 Z" fill="#6A4AB8" transform={`rotate(${a})`} />)}
              {[60, 180, 300].map((a) => <path key={a} d="M0 0 C -5 -4, -6 -12, 0 -16 C 4 -10, 4 -4, 0 0 Z" fill="#8A6ADA" transform={`rotate(${a})`} />)}
              <path d="M-2 4 l 2 -6 2 6 z" fill="#F6D27A" />
            </g>
          ))}
          <path d="M-14 0 L -16 -40 L 16 -40 L 14 0 Z" fill="url(#ev-vase-g)" />
          <ellipse cx="0" cy="-40" rx="16" ry="4" fill="#4A6A80" />
        </g>
        <g transform="translate(32 0)">
          <ellipse cx="0" cy="-3" rx="32" ry="8" fill="#E8E2D6" />
          <ellipse cx="0" cy="-5" rx="28" ry="6" fill="#FFFFFF" />
          {[[-12, -10], [10, -10], [-1, -20]].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <ellipse cx="0" cy="0" rx="13" ry="8" fill="#FBF7EE" />
              <path d="M-14 2 C -10 -12, 10 -12, 14 2 C 10 -2, 6 0, 0 -2 C -6 0, -10 -2, -14 2 Z" fill="url(#ev-kashiwa)" />
              <path d="M-12 0 Q 0 -10 12 0" stroke="#3E6A2A" strokeWidth="0.8" fill="none" />
            </g>
          ))}
        </g>
      </g>
    ),
  },

  /* ---------- 七夕 ---------- */
  tanabata: {
    ls: 2.25,
    // 笹かざり
    left: () => (
      <g>
        <Cyl id="ev-sasa" c="#6FA552" hi={0.45} />
        <Vert id="ev-leaf" stops={[["#9CCB6A", 0], ["#5E9C3A", 1]]} />
        <Ball id="ev-gold" c="#F2C84A" hi={0.6} lo={-0.3} />
        <Cyl id="ev-pot" c="#B98552" hi={0.4} />
        <Shadow rx={42} ry={9} y={2} />
        <rect x="-3.5" y="-260" width="7" height="230" fill="url(#ev-sasa)" />
        {[-60, -105, -150, -195, -240].map((y) => <rect key={y} x="-4" y={y} width="8" height="2.5" fill="#3E6A30" />)}
        {[[-80, -1], [-120, 1], [-160, -1], [-200, 1], [-235, -1], [-100, 1], [-180, -1]].map(([y, d], i) => {
          const ex = d! * (52 - i * 3), ey = y! - 30;
          return (
            <g key={i}>
              <path d={`M0 ${y} Q ${ex * 0.5} ${y! - 6} ${ex} ${ey}`} stroke="#5E9C3A" strokeWidth="2" fill="none" />
              {[0, 1, 2, 3].map((k) => <path key={k} d="M0 0 Q 4 -14 0 -30 Q -4 -14 0 0 Z" fill="url(#ev-leaf)" transform={`translate(${ex - d! * k * 8} ${ey + k * 3}) rotate(${d! * (110 + k * 22)})`} />)}
            </g>
          );
        })}
        {/* 短冊・星・あみかざり */}
        {[[-44, -136, "#E4573A"], [38, -170, "#F2D16B"], [-34, -214, "#3E7CC8"], [44, -110, "#B65A7A"], [-50, -96, "#FFFFFF"], [26, -224, "#5E9C52"]].map(([x, y, c], i) => (
          <g key={i} transform={`translate(${x} ${y}) rotate(${(i % 2 ? 1 : -1) * 6})`}>
            <line x1="0" y1="-12" x2="0" y2="0" stroke="#8A6A4A" strokeWidth="0.6" />
            <rect x="-5" y="0" width="10" height="30" fill={c as string} stroke="#00000022" strokeWidth="0.5" />
            {[7, 12, 17, 22].map((ly) => <line key={ly} x1="-1.5" y1={ly} x2="-1.5" y2={ly + 3} stroke="#3A2A20" strokeWidth="0.8" opacity="0.55" />)}
          </g>
        ))}
        {[[20, -140], [-20, -180], [10, -250]].map(([x, y], i) => <path key={i} d={starPath(8)} transform={`translate(${x} ${y})`} fill="url(#ev-gold)" stroke="#B88A2A" strokeWidth="0.6" />)}
        <g transform="translate(46 -150)">
          {Array.from({ length: 5 }, (_, i) => <path key={i} d={`M${-6 + i * 3} 0 L ${-8 + i * 4} 30`} stroke="#E84F7A" strokeWidth="1" />)}
          {[6, 14, 22].map((y) => <path key={y} d={`M-7 ${y} L 8 ${y + 1}`} stroke="#E84F7A" strokeWidth="1" />)}
        </g>
        <path d="M-22 0 L -20 -32 L 20 -32 L 22 0 Z" fill="url(#ev-pot)" />
        <ellipse cx="0" cy="-32" rx="20" ry="4" fill="#8A5A30" />
        <path d="M-22 -14 H 22" stroke="#7A4A20" strokeWidth="2" />
      </g>
    ),
    // 行灯（あんどん）
    right: () => (
      <g>
        <Vert id="ev-washi" stops={[["#FFF9E8", 0], ["#FFE7B0", 0.6], ["#F6C878", 1]]} />
        <Glow id="ev-andon" c="#FFD58A" />
        <circle cx="0" cy="-60" r="70" fill="url(#ev-andon)" opacity="0.4" />
        <Shadow rx={36} ry={8} y={2} />
        <rect x="-26" y="-108" width="52" height="96" fill="url(#ev-washi)" />
        <rect x="-26" y="-108" width="14" height="96" fill="#FFFFFF" opacity="0.25" />
        {[-26, 26].map((x) => <rect key={x} x={x - 3} y="-114" width="6" height="114" fill="#4A2A18" />)}
        {[-108, -76, -44, -12].map((y) => <rect key={y} x="-26" y={y - 1.5} width="52" height="3" fill="#4A2A18" opacity={y === -108 || y === -12 ? 1 : 0.55} />)}
        <path d="M0 -20 C -6 -40, 10 -54, 2 -76 C 14 -60, 16 -40, 0 -20 Z" fill="#3E7CC8" opacity="0.18" />
        <rect x="-32" y="-118" width="64" height="6" fill="#3A2010" />
      </g>
    ),
    glows: [{ side: "R", x: 0, y: -60, r: 60, c: "#FFD58A" }],
  },

  /* ---------- お月見 ---------- */
  tsukimi: {
    ls: 2.3,
    // 月見だんご
    left: () => (
      <g>
        <Sanbo />
        <Ball id="ev-dango" c="#FBF5E6" hi={0.9} lo={-0.18} />
        <path d="M-38 -54 L 0 -64 L 38 -54 L 0 -46 Z" fill="#FFFFFF" stroke="#E6DFD0" strokeWidth="1" />
        {[[4, -64], [3, -78], [2, -92], [1, -106]].map(([n, y], row) => Array.from({ length: n! }, (_, i) => (
          <circle key={`${row}-${i}`} cx={(i - (n! - 1) / 2) * 15} cy={y} r="8.6" fill="url(#ev-dango)" stroke="#E2D8C4" strokeWidth="0.6" />
        )))}
      </g>
    ),
    // すすきと、うさぎの置きもの
    right: () => (
      <g>
        <Cyl id="ev-vase-t" c="#8A6A4A" hi={0.4} />
        <Vert id="ev-plume" stops={[["#FFF8E6", 0], ["#E9D6A0", 0.5], ["#C9AE70", 1]]} />
        <Ball id="ev-usagi" c="#F4F2EE" hi={0.8} lo={-0.22} />
        <Shadow rx={56} ry={10} y={2} />
        <g transform="translate(18 0)">
          {[[-30, -190], [-10, -210], [10, -200], [28, -176], [-40, -160], [20, -150]].map(([x, h], i) => (
            <g key={i}>
              <path d={`M0 -40 Q ${x! * 0.3} ${h! * 0.6} ${x} ${h}`} stroke="#A89060" strokeWidth="1.6" fill="none" />
              <path d={`M${x} ${h} q ${x! < 0 ? -10 : 10} 18 ${x! < 0 ? -4 : 4} 46 q ${x! < 0 ? 12 : -12} -16 ${x! < 0 ? 4 : -4} -46 z`} fill="url(#ev-plume)" opacity="0.95" />
            </g>
          ))}
          {[[-36, -110], [36, -96], [-24, -86]].map(([x, y], i) => <path key={i} d={`M0 -40 Q ${x! * 0.5} ${y! * 0.6} ${x} ${y}`} stroke="#6A8A3A" strokeWidth="1.2" fill="none" />)}
          {[[-36, -110], [36, -96], [-24, -86], [-30, -100], [30, -88]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.6" fill="#B65AA8" />)}
          <path d="M-12 0 C -20 -14, -16 -32, -8 -40 L 8 -40 C 16 -32, 20 -14, 12 0 Z" fill="url(#ev-vase-t)" />
          <ellipse cx="0" cy="-40" rx="8" ry="2.4" fill="#4A3020" />
        </g>
        {[[-34, 0, 1], [-58, 4, 0.8]].map(([x, y, s2], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${s2})`}>
            <Shadow rx={16} ry={4} y={1} />
            <ellipse cx="0" cy="-12" rx="16" ry="12" fill="url(#ev-usagi)" />
            <circle cx={-8} cy="-26" r="9" fill="url(#ev-usagi)" />
            <ellipse cx="-12" cy="-42" rx="3.4" ry="11" fill="#F4F2EE" transform="rotate(-12 -12 -42)" />
            <ellipse cx="-4" cy="-42" rx="3.4" ry="11" fill="#F4F2EE" transform="rotate(10 -4 -42)" />
            <ellipse cx="-12" cy="-42" rx="1.5" ry="8" fill="#F5B0C0" transform="rotate(-12 -12 -42)" />
            <ellipse cx="-4" cy="-42" rx="1.5" ry="8" fill="#F5B0C0" transform="rotate(10 -4 -42)" />
            <circle cx="-11" cy="-27" r="1.6" fill="#D9303A" />
            <circle cx="14" cy="-8" r="4" fill="#FFFFFF" />
          </g>
        ))}
      </g>
    ),
  },

  /* ---------- ハロウィン ---------- */
  halloween: {
    // ジャック・オー・ランタンの山とろうそく
    left: ({ lit, still }) => {
      const pumpkin = (x: number, y: number, r: number, face: boolean, i: number) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <Shadow rx={r * 1.2} ry={r * 0.26} y={2} />
          {[[-0.55, 0.5, 0.25], [0.55, 0.5, 0.25], [-0.27, 0.5, 0.1], [0.27, 0.5, 0.1], [0, 0.5, 0]].map(([cx, rx, dark], k) => (
            <ellipse key={k} cx={cx! * r} cy={-r * 0.78} rx={rx! * r} ry={r * 0.8} fill="url(#ev-pumpkin)" opacity={1 - dark!} stroke="#B8501A" strokeWidth="0.8" />
          ))}
          <path d={`M-2 ${-r * 1.52} q -2 -${r * 0.3} 6 -${r * 0.42}`} stroke="#4E6A2A" strokeWidth={r * 0.16} strokeLinecap="round" fill="none" />
          <path d={`M3 ${-r * 1.6} q 14 -6 10 6 q -4 6 -10 0`} stroke="#5E8A3A" strokeWidth="1.4" fill="none" />
          {face ? (
            <g fill="url(#ev-carve)">
              <path d={`M${-r * 0.45} ${-r * 0.9} l ${r * 0.18} ${-r * 0.26} l ${r * 0.18} ${r * 0.26} z`} />
              <path d={`M${r * 0.09} ${-r * 0.9} l ${r * 0.18} ${-r * 0.26} l ${r * 0.18} ${r * 0.26} z`} />
              <path d={`M-4 ${-r * 0.74} l 4 -6 4 6 z`} />
              <path d={`M${-r * 0.5} ${-r * 0.5} Q 0 ${-r * 0.18} ${r * 0.5} ${-r * 0.5} Q ${r * 0.3} ${-r * 0.2} 0 ${-r * 0.24} Q ${-r * 0.3} ${-r * 0.2} ${-r * 0.5} ${-r * 0.5} Z M${-r * 0.16} ${-r * 0.4} h ${r * 0.1} v ${r * 0.1} h -${r * 0.1} z M${r * 0.08} ${-r * 0.36} h ${r * 0.1} v ${r * 0.1} h -${r * 0.1} z`} fillRule="evenodd" />
              {lit ? <circle cy={-r * 0.78} r={r * 0.9} fill="url(#ev-pglow)" opacity="0.5"><Blink still={still} values="0.35;0.6;0.4;0.55;0.35" dur={2.4} begin={`${-i}s`} /></circle> : null}
            </g>
          ) : null}
        </g>
      );
      return (
        <g>
          <Ball id="ev-pumpkin" c="#F28A2A" hi={0.4} lo={-0.3} />
          <defs>
            <radialGradient id="ev-carve" cx="0.5" cy="0.6" r="0.6"><stop offset="0" stopColor="#FFF6B0" /><stop offset="0.5" stopColor="#FFC23A" /><stop offset="1" stopColor="#E0701A" /></radialGradient>
          </defs>
          <Glow id="ev-pglow" c="#FFB04A" />
          {pumpkin(14, -34, 22, false, 0)}
          {pumpkin(-24, 0, 32, true, 1)}
          {pumpkin(30, 2, 26, true, 2)}
          {/* ろうそく */}
          {[[-60, 0, 26], [-48, 2, 18]].map(([x, y, h], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <Shadow rx={8} ry={2.4} y={1} />
              <rect x="-4.5" y={-h!} width="9" height={h} rx="2" fill="#F4EEE0" />
              <path d={`M-4.5 ${-h! + 2} q 2 6 0 10`} stroke="#E6DCC8" strokeWidth="2" fill="none" />
              <path d={`M0 ${-h! - 12} C -4 ${-h! - 5}, -3 ${-h! - 1}, 0 ${-h!} C 3 ${-h! - 1}, 4 ${-h! - 5}, 0 ${-h! - 12} Z`} fill="#FFC23A">
                <Blink still={still} values="1;0.75;0.95;0.8;1" dur={0.9 + i * 0.3} />
              </path>
              <circle cy={-h! - 6} r="10" fill="url(#ev-pglow)" opacity={lit ? 0.6 : 0.3} />
            </g>
          ))}
        </g>
      );
    },
    // 魔女の大なべ
    right: ({ still }) => (
      <g>
        <Ball id="ev-pot-iron" c="#3A3644" hi={0.35} lo={-0.5} />
        <Ball id="ev-potion" c="#7AE04A" hi={0.6} lo={-0.3} />
        <Glow id="ev-green" c="#9CFF6A" />
        <Shadow rx={46} ry={10} y={2} />
        {/* 脚と大なべ */}
        {[-22, 0, 22].map((x) => <path key={x} d={`M${x} -10 l ${x / 4} 12`} stroke="#2A2630" strokeWidth="5" strokeLinecap="round" />)}
        <path d="M-40 -56 C -46 -20, -30 -4, 0 -4 C 30 -4, 46 -20, 40 -56 Z" fill="url(#ev-pot-iron)" />
        <circle cx="0" cy="-74" r="42" fill="url(#ev-green)" opacity="0.5" />
        <ellipse cx="0" cy="-56" rx="38" ry="9" fill="url(#ev-potion)" />
        {[[-14, 0], [8, 1], [20, 2]].map(([x, k]) => (
          <circle key={x} cx={x} cy="-58" r={3 + k!} fill="#C8FF9A" opacity="0.8">
            {still ? null : <><animate attributeName="cy" values="-58;-84" dur={`${1.8 + k! * 0.5}s`} repeatCount="indefinite" begin={`${-k!}s`} /><animate attributeName="opacity" values="0.9;0" dur={`${1.8 + k! * 0.5}s`} repeatCount="indefinite" begin={`${-k!}s`} /></>}
          </circle>
        ))}
        <ellipse cx="0" cy="-56" rx="42" ry="10" fill="none" stroke="#4A4656" strokeWidth="6" />
        <path d="M-40 -58 A 42 10 0 0 1 0 -66" fill="none" stroke="#8A8698" strokeWidth="2" opacity="0.7" />
        <path d="M-36 -40 C -38 -26, -28 -14, -14 -12" fill="none" stroke="#6A6678" strokeWidth="3" opacity="0.6" strokeLinecap="round" />
      </g>
    ),
    glows: [{ side: "L", x: -24, y: -26, r: 30, c: "#FFB04A" }, { side: "L", x: 30, y: -22, r: 26, c: "#FFB04A" }, { side: "L", x: -56, y: -36, r: 16, c: "#FFC870" }, { side: "R", x: 0, y: -60, r: 40, c: "#9CFF6A" }],
  },

  /* ---------- クリスマス ---------- */
  christmas: {
    rs: 2.45,
    // プレゼントの山とランタン
    left: ({ lit }) => (
      <g>
        <Gift x={-62} y={2} w={52} h={40} d={30} c="#C9303A" rib="#F2D16B" />
        <Gift x={-8} y={0} w={44} h={52} d={26} c="#2E6A3E" rib="#E9E4DC" />
        <Gift x={-46} y={-38} w={36} h={28} d={22} c="#F4EEE0" rib="#C9303A" />
        {/* ランタン */}
        <g transform="translate(58 0)">
          <Glow id="ev-candle" c="#FFC870" />
          <Shadow rx={18} ry={5} y={1} />
          <circle cy="-30" r="34" fill="url(#ev-candle)" opacity={lit ? 0.75 : 0.35} />
          <path d="M-14 0 h28 l-2 -6 h-24 z" fill="#2A2420" />
          <rect x="-12" y="-50" width="24" height="44" fill="#FFF6E0" opacity="0.35" stroke="#2A2420" strokeWidth="2.4" />
          <path d="M0 -50 v44 M-12 -28 h24" stroke="#2A2420" strokeWidth="1.2" opacity="0.6" />
          <rect x="-4" y="-24" width="8" height="16" rx="1.5" fill="#F4EEE0" />
          <path d="M0 -36 C -3 -30, -2 -26, 0 -25 C 2 -26, 3 -30, 0 -36 Z" fill="#FFC23A" />
          <path d="M-14 -50 L 0 -60 L 14 -50 Z" fill="#2A2420" />
          <path d="M-4 -60 a 4 4 0 1 1 8 0" fill="none" stroke="#2A2420" strokeWidth="2" />
        </g>
      </g>
    ),
    // ツリー
    right: ({ still }) => {
      const tiers = [[-34, 96, 74], [-80, 82, 68], [-122, 68, 60], [-160, 54, 52], [-194, 40, 44]] as const;
      const ornaments = [[-50, -50, "red"], [34, -56, "gold"], [-10, -40, "silver"], [60, -38, "red"], [-30, -96, "silver"], [26, -102, "red"], [-46, -86, "gold"], [8, -134, "gold"], [-22, -146, "red"], [30, -140, "silver"], [-8, -176, "red"], [14, -186, "gold"], [-66, -30, "gold"], [52, -84, "gold"]] as const;
      const lights = Array.from({ length: 30 }, (_, i) => { const row = i % 5, t = Math.floor(i / 5) / 5 + rnd(i) * 0.12; const tier = tiers[row]!; return { x: (t - 0.5) * tier[1] * 1.7, y: tier[0] - 6 - rnd(i, 2) * 26, c: ["#FFE7A0", "#FF8A7A", "#9ADFFF", "#FFD27A"][i % 4]! }; });
      return (
        <g transform="scale(0.86)">
          <Vert id="ev-fir" stops={[["#3E8A4E", 0], ["#2A6A3A", 0.6], ["#1A4A28", 1]]} />
          <defs>
            <linearGradient id="ev-fir-side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#000" stopOpacity="0.28" /><stop offset="0.35" stopColor="#000" stopOpacity="0" /><stop offset="0.7" stopColor="#FFF" stopOpacity="0.06" /><stop offset="1" stopColor="#000" stopOpacity="0.3" /></linearGradient>
          </defs>
          <Ball id="ev-o-red" c="#D92E3A" />
          <Ball id="ev-o-gold" c="#E8B83A" />
          <Ball id="ev-o-silver" c="#C8D0DA" hi={0.8} />
          <Ball id="ev-star" c="#F6CF4A" hi={0.7} lo={-0.25} />
          <Glow id="ev-starglow" c="#FFE38A" />
          {lights.map((l) => l.c).filter((c, i, a) => a.indexOf(c) === i).map((c) => <Glow key={c} id={`ev-bglow-${c.slice(1)}`} c={c} />)}
          <Shadow rx={100} ry={16} y={2} />
          {/* 木箱 */}
          <path d="M-28 0 L -32 -34 L 32 -34 L 28 0 Z" fill="#B97A42" />
          {[-20, -6, 8, 22].map((x) => <line key={x} x1={x} y1="-34" x2={x * 0.92} y2="0" stroke="#8A5428" strokeWidth="1.4" />)}
          <rect x="-34" y="-38" width="68" height="6" rx="2" fill="#D9A062" />
          {/* 枝（下から重ねる） */}
          {tiers.map(([y, w, h], i) => {
            const teeth = 9 - i;
            const bottom = Array.from({ length: teeth * 2 + 1 }, (_, k) => { const x = w - (k * w * 2) / (teeth * 2); return `L${x.toFixed(1)} ${(y + (k % 2 ? -7 : 2) + Math.abs(x) * 0.08).toFixed(1)}`; }).join(" ");
            const d = `M0 ${y - h - 20} C ${w * 0.3} ${y - h * 0.7}, ${w * 0.7} ${y - h * 0.25}, ${w} ${y} ${bottom} C ${-w * 0.7} ${y - h * 0.25}, ${-w * 0.3} ${y - h * 0.7}, 0 ${y - h - 20} Z`;
            return (
              <g key={i}>
                <path d={d} fill="url(#ev-fir)" />
                <path d={d} fill="url(#ev-fir-side)" />
                {Array.from({ length: teeth * 2 }, (_, k) => { const x = w - ((k + 0.5) * w * 2) / (teeth * 2); return <path key={k} d={`M${x.toFixed(1)} ${(y - 14).toFixed(1)} q ${(-x * 0.06).toFixed(1)} 8 ${(-x * 0.02).toFixed(1)} 13`} stroke="#6AB070" strokeWidth="1.6" fill="none" opacity="0.55" />; })}
              </g>
            );
          })}
          {/* ビーズのガーランド */}
          {[[-74, -40, 70, -64], [-56, -100, 52, -122], [-40, -150, 38, -170]].map(([x0, y0, x1, y1], i) => (
            <path key={i} d={`M${x0} ${y0} Q ${(x0! + x1!) / 2} ${(y0! + y1!) / 2 + 18} ${x1} ${y1}`} fill="none" stroke="#F6D27A" strokeWidth="3.4" strokeDasharray="0.1 6" strokeLinecap="round" />
          ))}
          {ornaments.map(([x, y, k], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <rect x="-2.4" y="-9" width="4.8" height="3.4" rx="1" fill="#C9A35A" />
              <circle r="7" fill={`url(#ev-o-${k})`} />
              <ellipse cx="-2.4" cy="-2.6" rx="2" ry="1.3" fill="#FFFFFF" opacity="0.75" />
            </g>
          ))}
          {lights.map((l, i) => (
            <g key={i}>
              <circle cx={l.x} cy={l.y} r="8" fill={`url(#ev-bglow-${l.c.slice(1)})`} opacity="0.5">
                <Blink still={still} values="0.15;0.75;0.15" dur={1.8 + (i % 4) * 0.5} begin={`${-(i % 7) * 0.4}s`} />
              </circle>
              <circle cx={l.x} cy={l.y} r="2.2" fill={l.c} />
            </g>
          ))}
          {/* 星 */}
          <circle cx="0" cy="-240" r="34" fill="url(#ev-starglow)" opacity="0.6">
            <Blink still={still} values="0.45;0.8;0.45" dur={3} />
          </circle>
          <path d={starPath(17)} transform="translate(0 -240)" fill="url(#ev-star)" stroke="#B8862A" strokeWidth="1" />
          <path d={starPath(7)} transform="translate(-2 -243)" fill="#FFF8D0" opacity="0.7" />
          {/* 足もとのプレゼント */}
          <Gift x={-96} y={4} w={34} h={26} d={20} c="#3E7CC8" rib="#FFFFFF" />
          <Gift x={44} y={6} w={40} h={30} d={22} c="#C9303A" rib="#F2D16B" />
        </g>
      );
    },
    glows: [{ side: "R", x: 0, y: -120, r: 110, c: "#FFD78A" }, { side: "R", x: 0, y: -206, r: 36, c: "#FFE38A" }, { side: "L", x: 58, y: -30, r: 40, c: "#FFC870" }],
  },
};

/* =============================================================
 * 明かりの層：部屋の色と、舞うもの、夜の灯り
 * ============================================================= */

const AMBIENCE: Record<RoomEvent, { tint: string; o: number }> = {
  newyear: { tint: "#FFCF70", o: 0.07 },
  valentine: { tint: "#FF7FA6", o: 0.08 },
  hina: { tint: "#FFA0B8", o: 0.06 },
  hanami: { tint: "#FFA8C4", o: 0.08 },
  kodomo: { tint: "#7FD0C0", o: 0.05 },
  tanabata: { tint: "#1A2A7A", o: 0.12 },
  tsukimi: { tint: "#2A3270", o: 0.1 },
  halloween: { tint: "#5A2088", o: 0.14 },
  christmas: { tint: "#FFB060", o: 0.07 },
};

/** 行事の部屋の色（部屋の手前にのばした床にも同じ色をかける） */
export const eventTint = (event: RoomEvent) => AMBIENCE[event];

export const EventAmbience = function EventAmbience({ event, dark }: { event: RoomEvent; dark: number }) {
  const still = useStill();
  const a = AMBIENCE[event];
  const glows = FLOORS[event].glows ?? [];
  const fall = (n: number, draw: (i: number) => ReactNode, o: { dur: number; drift: number; from?: number; to?: number; up?: boolean }) =>
    Array.from({ length: n }, (_, i) => {
      const x = 30 + rnd(i, 7) * 940, dur = o.dur * (0.8 + rnd(i, 8) * 0.5), begin = -rnd(i, 9) * dur;
      const y0 = o.up ? (o.to ?? H) : (o.from ?? -PT), y1 = o.up ? (o.from ?? -PT) : (o.to ?? H + PB);
      const midY = y0 + (y1 - y0) * rnd(i, 10);
      return (
        <g key={i} transform={still ? `translate(${x.toFixed(0)} ${midY.toFixed(0)})` : undefined}>
          {still ? null : <animateTransform attributeName="transform" type="translate" values={`${x.toFixed(0)} ${y0};${(x + o.drift * (rnd(i, 11) - 0.3)).toFixed(0)} ${((y0 + y1) / 2).toFixed(0)};${(x + o.drift * (rnd(i, 12) - 0.5) * 1.6).toFixed(0)} ${y1}`} dur={`${dur.toFixed(1)}s`} begin={`${begin.toFixed(1)}s`} repeatCount="indefinite" />}
          <g>
            {still ? null : <animateTransform attributeName="transform" type="rotate" values={`0;${rnd(i, 13) > 0.5 ? 360 : -360}`} dur={`${(4 + rnd(i, 14) * 4).toFixed(1)}s`} repeatCount="indefinite" />}
            {draw(i)}
          </g>
        </g>
      );
    });
  const twinkle = (n: number, draw: (i: number) => ReactNode, area: { y0: number; y1: number }) =>
    Array.from({ length: n }, (_, i) => (
      <g key={i} transform={`translate(${(20 + rnd(i, 21) * 960).toFixed(0)} ${(area.y0 + rnd(i, 22) * (area.y1 - area.y0)).toFixed(0)})`} opacity="0.7">
        <Blink still={still} values="0.1;0.95;0.1" dur={2 + rnd(i, 23) * 3} begin={`${(-rnd(i, 24) * 4).toFixed(1)}s`} />
        {draw(i)}
      </g>
    ));
  return (
    <g>
      <defs>
        <SakuraDefs />
        <Glow id="ev-amb-gold" c="#FFE7A0" />
        <Glow id="ev-amb-white" c="#FFFFFF" />
        <Glow id="ev-amb-fly" c="#D8FF7A" />
        {glows.map((g) => <Glow key={g.c} id={`ev-nglow-${g.c.slice(1)}`} c={g.c} />)}
        <radialGradient id="ev-fog" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#D8C8F0" stopOpacity="0.55" /><stop offset="1" stopColor="#D8C8F0" stopOpacity="0" /></radialGradient>
      </defs>
      <rect x={-PX} y={-PT} width={W + PX * 2} height={H + PT + PB} fill={a.tint} opacity={a.o + dark * a.o * 0.6} style={{ mixBlendMode: "soft-light" }} />
      <rect x={-PX} y={-PT} width={W + PX * 2} height={H + PT + PB} fill={a.tint} opacity={a.o * 0.55} />
      {/* 夜、灯るもののまわりを明るく */}
      {glows.map((g, i) => {
        const f = FLOORS[event], base = g.side === "L" ? L : R, sc = (g.side === "L" ? f.ls ?? S : f.rs ?? S) * (event === "christmas" && g.side === "R" ? 0.86 : 1);
        return <circle key={i} cx={base.x + g.x * sc} cy={base.y + g.y * sc} r={g.r * sc * (0.6 + dark * 0.35)} fill={`url(#ev-nglow-${g.c.slice(1)})`} opacity={0.08 + dark * 0.42} style={{ mixBlendMode: "screen" }} />;
      })}
      {event === "newyear" ? twinkle(16, () => <g><circle r="9" fill="url(#ev-amb-gold)" /><path d="M0 -8 L1.6 -1.6 L8 0 L1.6 1.6 L0 8 L-1.6 1.6 L-8 0 L-1.6 -1.6 Z" fill="#FFF3C0" /></g>, { y0: 40, y1: HZ + 200 }) : null}
      {event === "valentine" ? fall(11, (i) => <path d={heartPath(0, 0, 7 + rnd(i, 3) * 6)} fill={["#FF7FA6", "#FFC2D6", "#E33A62"][i % 3]} opacity="0.75" />, { dur: 16, drift: 60, up: true, from: -40, to: H + 60 }) : null}
      {event === "hina" ? fall(10, (i) => <ellipse rx="5" ry="7" fill={i % 2 ? "#F6A0BE" : "#FFD3E0"} opacity="0.85" />, { dur: 15, drift: 140 }) : null}
      {event === "hanami" ? fall(18, (i) => <path d={PETAL} transform={`scale(${0.7 + rnd(i, 4) * 0.5}) translate(0 10)`} fill={i % 3 ? "url(#ev-petal)" : "url(#ev-petal-b)"} opacity="0.92" />, { dur: 13, drift: 220 }) : null}
      {event === "kodomo" ? twinkle(12, () => <circle r="7" fill="url(#ev-amb-white)" />, { y0: 0, y1: H }) : null}
      {event === "tanabata" ? (
        <g>
          {twinkle(30, (i) => <g transform={`scale(${0.5 + rnd(i, 5) * 0.7})`}><circle r="8" fill="url(#ev-amb-white)" /><path d="M0 -7 L1.2 -1.2 L7 0 L1.2 1.2 L0 7 L-1.2 1.2 L-7 0 L-1.2 -1.2 Z" fill="#FFFFFF" /></g>, { y0: -40, y1: HZ - 60 })}
          {fall(7, () => <circle r="9" fill="url(#ev-amb-fly)" />, { dur: 22, drift: 300, up: true, from: HZ - 140, to: H })}
        </g>
      ) : null}
      {event === "tsukimi" ? (
        <g>
          <circle cx="676" cy="236" r="200" fill="url(#ev-amb-gold)" opacity={0.18 + dark * 0.2} style={{ mixBlendMode: "screen" }} />
          {fall(8, (i) => <path d={MAPLE} fill={["#D9402E", "#F28A2A", "#E9B23A"][i % 3]} opacity="0.88" transform={`scale(${0.7 + rnd(i, 6) * 0.4})`} />, { dur: 15, drift: 180 })}
        </g>
      ) : null}
      {event === "halloween" ? (
        <g>
          {[0, 1, 2, 3, 4].map((i) => (
            <ellipse key={i} cx={100 + i * 220} cy={HZ + 70 + (i % 2) * 40} rx="230" ry="46" fill="url(#ev-fog)" opacity="0.45">
              {still ? null : <animate attributeName="cx" values={`${100 + i * 220};${160 + i * 220};${100 + i * 220}`} dur={`${12 + i * 2}s`} repeatCount="indefinite" />}
            </ellipse>
          ))}
          {fall(9, () => <circle r="2.4" fill="#FFB04A" opacity="0.85" />, { dur: 14, drift: 120, up: true, from: 80, to: H })}
        </g>
      ) : null}
      {event === "christmas" ? twinkle(18, (i) => <circle r={6 + rnd(i, 7) * 10} fill={["#FFE7A0", "#FF9A8A", "#A8E0B0"][i % 3]} opacity="0.35" />, { y0: -30, y1: H }) : null}
    </g>
  );
};
