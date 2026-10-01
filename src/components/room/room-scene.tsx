"use client";

/**
 * わんこのおへやの背景（壁・窓・棚・時計・床・ラグ・明かり）。
 * viewBox は 1000 × 1120 で、部屋の % 座標（src/lib/room/types.ts の ROOM）と同じ割合で描く。
 * 窓の外と部屋の明るさは、日本時間の今の時間帯（朝・昼・夕方・夜）に合わせる。
 */
import { memo, useMemo } from "react";
import { skyAt, TOKYO, type GeoPoint, type SkyState } from "@/lib/room/sun";
import { CURTAIN_STYLES, FLOOR_STYLES, RUG_STYLES, WALLPAPER_STYLES } from "@/lib/room/themes";
import { ROOM, type RoomTheme } from "@/lib/room/types";

export type DayPhase = "morning" | "day" | "evening" | "night";

const W = 1000;
const H = 1120;
const HZ = (ROOM.horizon / 100) * H;
const px = (pct: number) => (pct / 100) * W;
/** 左右の壁の幅・天井の高さ・左右の壁が床で手前に広がる分（部屋の箱らしさ） */
const SIDE = 44;
const CEIL = 20;
const SIDE_DROP = 64;
const py = (pct: number) => (pct / 100) * H;


export type Season = "sakura" | "rain" | "summer" | "leaves" | "snow" | "none";
/** 窓の外の季節（日本時間の月と、住んでいるところ。北海道は桜が5月で梅雨がなく、沖縄・奄美は雪が降らない） */
export function seasonOf(date: Date, at: GeoPoint = TOKYO): Season {
  const m = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "numeric" }).format(date));
  const north = at.lat >= 41.4, south = at.lat < 29;
  if (north ? m === 5 : south ? m === 2 : m === 3 || m === 4) return "sakura";
  if (m === 6 && !north) return "rain";
  if (m === 7 || m === 8) return "summer";
  if (north ? m === 9 || m === 10 : m === 10 || m === 11) return "leaves";
  if ((m === 12 || m <= 2 || (north && m === 3)) && !south) return "snow";
  return "none";
}

/** 日本時間と、その日の太陽の高さから決める時間帯（犬のことばなどに使う） */
export function dayPhaseOf(date: Date, at: GeoPoint = TOKYO): DayPhase {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "numeric", hourCycle: "h23" }).format(date));
  const alt = skyAt(date, at).altitude;
  if (alt < -4) return "night";
  if (h < 11) return "morning";
  if (h >= 13 && alt < 14) return "evening";
  return "day";
}

/** 部屋の明かりをつける暗さか */
export const lampsOn = (sky: SkyState) => sky.light < 0.5;

const mixColor = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i]! - v) * Math.max(0, Math.min(1, t))).toString(16).padStart(2, "0")).join("")}`;
};

export const RoomScene = memo(function RoomScene({ theme, now, at = TOKYO }: { theme: RoomTheme; now: Date; at?: GeoPoint }) {
  const wall = WALLPAPER_STYLES[theme.wall];
  const sky = useMemo(() => skyAt(now, at), [now, at]);
  const night = sky.light < 0.2;
  const lit = lampsOn(sky);
  const sunUp = sky.altitude > 0;
  // 朝夕の低い日ざしは、窓から斜めに長く差しこむ
  const beamSkew = Math.max(-1, Math.min(1, (sky.azimuth - 180) / 90)) * -110;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <WallPattern id="room-wall" theme={theme} />
        <linearGradient id="room-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky.top} />
          <stop offset="1" stopColor={sky.bottom} />
        </linearGradient>
        <linearGradient id="room-wall-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.06" />
          <stop offset="0.25" stopColor="#000" stopOpacity="0" />
          <stop offset="0.9" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="room-floor-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.16" />
          <stop offset="0.35" stopColor="#000" stopOpacity="0.02" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.06" />
        </linearGradient>
        <filter id="room-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.4 -0.45" />
          <feComposite in="SourceGraphic" operator="in" />
        </filter>
        <filter id="room-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14" /></filter>
        <radialGradient id="room-window-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={mixColor("#FFFBEA", "#FFB27A", sky.warm)} stopOpacity={0.55 * sky.light} />
          <stop offset="1" stopColor="#FFFBEA" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="room-baseboard" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.2" stopColor="#FBF6EC" />
          <stop offset="1" stopColor="#E6DCCB" />
        </linearGradient>
        <linearGradient id="room-floor-ao" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2A1A0A" stopOpacity="0.22" />
          <stop offset="1" stopColor="#2A1A0A" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="room-ceiling" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F1E9DA" />
        </linearGradient>
        <linearGradient id="room-side-left" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2A1A0A" stopOpacity="0.22" />
          <stop offset="1" stopColor="#2A1A0A" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="room-side-right" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#2A1A0A" stopOpacity="0.26" />
          <stop offset="1" stopColor="#2A1A0A" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="room-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.42" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.46" stopColor="#FFFFFF" stopOpacity="0.32" />
          <stop offset="0.52" stopColor="#FFFFFF" stopOpacity="0.08" />
          <stop offset="0.56" stopColor="#FFFFFF" stopOpacity="0.22" />
          <stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="room-lamp-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFE3A3" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFE3A3" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="room-curtain" x1="0" y1="0" x2="1" y2="0">
          {[0, 0.16, 0.33, 0.5, 0.66, 0.83, 1].map((o, i) => (
            <stop key={o} offset={o} stopColor={CURTAIN_STYLES[theme.curtain].color} stopOpacity={i % 2 ? 0.78 : 1} />
          ))}
        </linearGradient>
      </defs>

      {/* 奥の壁（模様・紙の質感・上下のかげ） */}
      <rect x="0" y="0" width={W} height={HZ} fill={wall.base} />
      <rect x="0" y="0" width={W} height={HZ} fill="url(#room-wall)" />
      <rect x="0" y="0" width={W} height={HZ} fill="#7A6040" filter="url(#room-grain)" opacity="0.07" />
      <rect x="0" y="0" width={W} height={HZ} fill="url(#room-wall-shade)" />
      {/* 窓から入る光が壁を明るくする */}
      {sky.light > 0.1 ? <ellipse cx={px((ROOM.window.x0 + ROOM.window.x1) / 2)} cy={py(24)} rx="360" ry="300" fill="url(#room-window-glow)" /> : null}

      <Window sky={sky} curtain={CURTAIN_STYLES[theme.curtain].color} season={seasonOf(now, at)} />
      <WallDecoration deco={theme.deco} lit={lit} />
      <Clock now={now} night={night} />
      <Shelves />

      {/* 床 */}
      <Floor theme={theme} />
      <rect x="0" y={HZ} width={W} height={H - HZ} fill="#5A4030" filter="url(#room-grain)" opacity="0.06" />
      <rect x="0" y={HZ} width={W} height={H - HZ} fill="url(#room-floor-shade)" />
      {/* 窓から差しこむ光 */}
      {sunUp ? (
        <polygon
          points={`${px(ROOM.window.x0) + 30},${HZ} ${px(ROOM.window.x1) - 10},${HZ} ${px(ROOM.window.x1) + 150 + beamSkew},${H * 0.86} ${px(ROOM.window.x0) + 120 + beamSkew},${H * 0.86}`}
          fill={mixColor("#FFF6D8", "#FFAE6E", sky.warm)}
          opacity={0.26 * Math.min(1, sky.altitude / 10)}
          filter="url(#room-soft)"
        />
      ) : null}
      {sky.altitude > 8 ? <SunDust /> : null}
      <RugShape rug={theme.rug} />
      {/* 幅木と、壁と床の境目のかげ */}
      <rect x="0" y={HZ - 22} width={W} height="24" fill="url(#room-baseboard)" />
      <rect x="0" y={HZ + 2} width={W} height="26" fill="url(#room-floor-ao)" />

      {/* 天井と左右の壁：部屋に奥行きを出す */}
      <polygon points={`0,0 ${W},0 ${W - SIDE},${CEIL} ${SIDE},${CEIL}`} fill="url(#room-ceiling)" />
      <polygon points={`0,0 ${SIDE},${CEIL} ${SIDE},${HZ} 0,${HZ + SIDE_DROP}`} fill={wall.base} />
      <polygon points={`0,0 ${SIDE},${CEIL} ${SIDE},${HZ} 0,${HZ + SIDE_DROP}`} fill="url(#room-side-left)" />
      <polygon points={`${W},0 ${W - SIDE},${CEIL} ${W - SIDE},${HZ} ${W},${HZ + SIDE_DROP}`} fill={wall.base} />
      <polygon points={`${W},0 ${W - SIDE},${CEIL} ${W - SIDE},${HZ} ${W},${HZ + SIDE_DROP}`} fill="url(#room-side-right)" />
      <polygon points={`0,${HZ + SIDE_DROP - 26} ${SIDE},${HZ - 22} ${SIDE},${HZ + 2} 0,${HZ + SIDE_DROP}`} fill="#F1E8D8" />
      <polygon points={`${W},${HZ + SIDE_DROP - 26} ${W - SIDE},${HZ - 22} ${W - SIDE},${HZ + 2} ${W},${HZ + SIDE_DROP}`} fill="#F1E8D8" />
      <line x1={SIDE} y1={CEIL} x2={SIDE} y2={HZ} stroke="#000" strokeOpacity="0.1" strokeWidth="2" />
      <line x1={W - SIDE} y1={CEIL} x2={W - SIDE} y2={HZ} stroke="#000" strokeOpacity="0.1" strokeWidth="2" />
      <line x1={SIDE} y1={CEIL} x2={W - SIDE} y2={CEIL} stroke="#000" strokeOpacity="0.08" strokeWidth="2" />
      <PendantLamp lit={lit} />
    </svg>
  );
});

function WallPattern({ id, theme }: { id: string; theme: RoomTheme }) {
  const { ink } = WALLPAPER_STYLES[theme.wall];
  switch (theme.wall) {
    case "mint-stripe":
      return (
        <pattern id={id} width="64" height="64" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="26" height="64" fill={ink} />
          <rect x="34" y="0" width="4" height="64" fill={ink} opacity="0.6" />
        </pattern>
      );
    case "pink-gingham":
      return (
        <pattern id={id} width="56" height="56" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="28" height="56" fill={ink} opacity="0.55" />
          <rect x="0" y="0" width="56" height="28" fill={ink} opacity="0.55" />
        </pattern>
      );
    case "blue-dots":
      return (
        <pattern id={id} width="60" height="60" patternUnits="userSpaceOnUse">
          <circle cx="15" cy="15" r="7" fill={ink} />
          <circle cx="45" cy="45" r="7" fill={ink} />
        </pattern>
      );
    case "flower":
      return (
        <pattern id={id} width="90" height="90" patternUnits="userSpaceOnUse">
          {[[22, 24, ink], [67, 66, "#A8C99A"]].map(([cx, cy, col]) => (
            <g key={`${cx}`} transform={`translate(${cx} ${cy})`}>
              {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-7" rx="5" ry="7" fill={col as string} transform={`rotate(${a})`} />)}
              <circle r="3.5" fill="#F6D27A" />
            </g>
          ))}
        </pattern>
      );
    case "night-stars":
      return (
        <pattern id={id} width="120" height="120" patternUnits="userSpaceOnUse">
          {[[18, 22, 3], [80, 40, 2], [50, 90, 2.6], [104, 100, 1.8], [30, 64, 1.4]].map(([x, y, r]) => (
            <path key={`${x}-${y}`} d={`M${x} ${y! - r! * 2}L${x! + r! * 0.6} ${y! - r! * 0.6}L${x! + r! * 2} ${y}L${x! + r! * 0.6} ${y! + r! * 0.6}L${x} ${y! + r! * 2}L${x! - r! * 0.6} ${y! + r! * 0.6}L${x! - r! * 2} ${y}L${x! - r! * 0.6} ${y! - r! * 0.6}Z`} fill={ink} opacity="0.85" />
          ))}
        </pattern>
      );
    case "wood-panel":
      return (
        <pattern id={id} width="90" height={HZ} patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="3" height={HZ} fill={ink} />
          <path d={`M30 0 C 36 120, 24 240, 32 ${HZ}`} stroke={ink} strokeWidth="1.4" fill="none" opacity="0.6" />
          <path d={`M62 0 C 56 160, 68 320, 60 ${HZ}`} stroke={ink} strokeWidth="1.2" fill="none" opacity="0.5" />
        </pattern>
      );
    default:
      return (
        <pattern id={id} width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M24 18 L30 24 L24 30 L18 24 Z" fill={ink} opacity="0.7" />
        </pattern>
      );
  }
}

/** 窓の外に降るもの（桜・雨・紅葉・雪）。窓わくの内側だけに見える */
function WindowWeather({ season, x0, y0, w, h }: { season: Season; x0: number; y0: number; w: number; h: number }) {
  if (season === "none" || season === "summer") return null;
  const n = season === "rain" ? 22 : 14;
  const look = {
    sakura: { fill: "#F7B8C8", r: 5, dur: 7 },
    leaves: { fill: "#E0843A", r: 6, dur: 8 },
    snow: { fill: "#FFFFFF", r: 4.5, dur: 9 },
    rain: { fill: "#C9DDF2", r: 0, dur: 1.1 },
  }[season];
  return (
    <g clipPath="url(#room-window-clip)">
      {Array.from({ length: n }, (_, i) => {
        const x = x0 + ((i * 53) % w), delay = -((i * 0.73) % look.dur), drift = season === "rain" ? -14 : i % 2 ? 26 : -22;
        return (
          <g key={i}>
            <animateTransform attributeName="transform" type="translate" from={`0 ${-h * 0.15}`} to={`${drift} ${h * 1.1}`} dur={`${look.dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
            {season === "rain" ? (
              <line x1={x} y1={y0} x2={x - 4} y2={y0 + 16} stroke={look.fill} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
            ) : season === "leaves" ? (
              <path d={`M${x} ${y0} q 6 -6 12 0 q -6 6 -12 0 z`} fill={i % 3 ? look.fill : "#C9532F"}>
                <animateTransform attributeName="transform" type="rotate" from={`0 ${x + 6} ${y0}`} to={`360 ${x + 6} ${y0}`} dur="3s" repeatCount="indefinite" additive="sum" />
              </path>
            ) : season === "sakura" ? (
              <ellipse cx={x} cy={y0} rx={look.r} ry={look.r * 0.62} fill={look.fill} opacity="0.95" />
            ) : (
              <circle cx={x} cy={y0} r={look.r * (0.6 + (i % 3) * 0.25)} fill={look.fill} opacity="0.9" />
            )}
          </g>
        );
      })}
    </g>
  );
}

/** 窓から差しこむ光の中を、ほこりがゆっくり舞う */
function SunDust() {
  return (
    <g fill="#FFFBEA">
      {[[300, 760], [380, 820], [450, 700], [340, 900], [520, 860], [420, 960]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.4 + (i % 3)} opacity="0">
          <animate attributeName="opacity" values="0;0.8;0" dur={`${5 + i}s`} begin={`${-i * 1.3}s`} repeatCount="indefinite" />
          <animate attributeName="cy" values={`${y};${y! - 50}`} dur={`${5 + i}s`} begin={`${-i * 1.3}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  );
}

/** 壁の上のかざり（ガーランド・ライト・お星さま）。ライトは夕方と夜に灯る */
function WallDecoration({ deco, lit }: { deco: RoomTheme["deco"]; lit: boolean }) {
  if (deco === "none") return null;
  const sag = (x: number) => 34 + Math.sin((x / W) * Math.PI) * 30;
  const wire = `M0 34 Q ${W / 2} 94 ${W} 34`;
  if (deco === "garland") {
    const colors = ["#F2A7B8", "#8DBDE6", "#F2D16B", "#A8D99A", "#C7B4D9"];
    return (
      <g>
        <path d={wire} fill="none" stroke="#B08A5E" strokeWidth="2.5" />
        {Array.from({ length: 13 }, (_, i) => {
          const x = 40 + i * 76, y = sag(x);
          return <path key={i} d={`M${x - 20} ${y} L${x + 20} ${y} L${x} ${y + 34} Z`} fill={colors[i % colors.length]} stroke="#FFFFFF" strokeWidth="1.5" />;
        })}
      </g>
    );
  }
  if (deco === "lights") {
    const colors = ["#FFE38A", "#FFB3C7", "#9BE7FF", "#B8E986"];
    return (
      <g>
        <path d={wire} fill="none" stroke="#5A6A5A" strokeWidth="2" />
        {Array.from({ length: 16 }, (_, i) => {
          const x = 30 + i * 62, y = sag(x) + 6, c = colors[i % colors.length]!;
          return (
            <g key={i}>
              {lit ? <circle cx={x} cy={y + 8} r="20" fill={c} opacity="0.28" /> : null}
              <rect x={x - 3} y={y - 4} width="6" height="6" fill="#5A6A5A" />
              <ellipse cx={x} cy={y + 8} rx="7" ry="10" fill={c} opacity={lit ? 1 : 0.6} />
            </g>
          );
        })}
      </g>
    );
  }
  return (
    <g>
      {[[120, 90], [250, 60], [470, 120], [640, 70], [900, 100]].map(([x, len], i) => (
        <g key={i}>
          <line x1={x} y1="20" x2={x} y2={20 + len!} stroke="#C9A878" strokeWidth="1.5" />
          <path d={`M${x} ${20 + len! - 4} l6 13 14 2 -10 10 3 14 -13 -7 -13 7 3 -14 -10 -10 14 -2 z`} fill={i % 2 ? "#F6D27A" : "#FFE9A8"} stroke="#E0B84A" strokeWidth="1.2" />
        </g>
      ))}
    </g>
  );
}

/** 月の満ち欠けのかたち（p: 0 新月 → 0.5 満月 → 1） */
function moonPath(cx: number, cy: number, r: number, p: number): string {
  const k = Math.cos(2 * Math.PI * p), rx = Math.abs(k) * r;
  const waxing = p < 0.5;
  const outer = waxing ? 1 : 0;
  const inner = waxing ? (k > 0 ? 0 : 1) : (k > 0 ? 1 : 0);
  return `M${cx} ${cy - r} A ${r} ${r} 0 0 ${outer} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${inner} ${cx} ${cy - r} Z`;
}

function Window({ sky, curtain, season }: { sky: SkyState; curtain: string; season: Season }) {
  const x0 = px(ROOM.window.x0), x1 = px(ROOM.window.x1), y0 = py(ROOM.window.y0), y1 = py(ROOM.window.y1);
  const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2;
  const night = sky.light < 0.2;
  const dark = 1 - sky.light;
  // 太陽：東（左）から西（右）へ、高さのとおりに動く。地平線（丘）より下は見えない
  const horizonY = y1 - h * 0.22;
  const sunX = x0 + w * Math.max(-0.2, Math.min(1.2, (sky.azimuth - 90) / 180));
  const sunY = horizonY - (Math.max(-6, sky.altitude) / 60) * (horizonY - y0 - 10);
  const sunColor = mixColor("#FFF6C8", "#FF8A4A", sky.warm);
  return (
    <g>
      {/* 外の景色 */}
      <rect x={x0} y={y0} width={w} height={h} fill="url(#room-sky)" />
      <g clipPath="url(#room-window-clip)">
        {sky.stars > 0.02 ? [[0.18, 0.2], [0.34, 0.4], [0.52, 0.16], [0.88, 0.5], [0.12, 0.55], [0.64, 0.34], [0.42, 0.08], [0.8, 0.12]].map(([sx, sy], i) => (
          <circle key={i} cx={x0 + w * sx!} cy={y0 + h * sy!} r={i % 3 ? 1.6 : 2.4} fill="#FFF8DA" opacity={sky.stars * (i % 2 ? 0.7 : 1)} />
        )) : null}
        {sky.altitude > -3 ? (
          <>
            <circle cx={sunX} cy={sunY} r="48" fill={sunColor} opacity="0.25" />
            <circle cx={sunX} cy={sunY} r="24" fill={sunColor} />
          </>
        ) : null}
        {sky.light < 0.6 ? (
          <g opacity={Math.min(1, (0.6 - sky.light) * 3)}>
            <circle cx={x0 + w * 0.74} cy={y0 + h * 0.24} r="34" fill="#FFF4C8" opacity="0.12" />
            <circle cx={x0 + w * 0.74} cy={y0 + h * 0.24} r="17" fill="#FFFFFF" opacity="0.08" />
            <path d={moonPath(x0 + w * 0.74, y0 + h * 0.24, 17, sky.moon)} fill="#FFF4C8" />
          </g>
        ) : null}
        <g fill={mixColor("#FFFFFF", "#FFC9A8", sky.warm)} opacity={0.2 + 0.7 * sky.light}>
          <ellipse cx={x0 + w * 0.3} cy={y0 + h * 0.32} rx="38" ry="13" />
          <ellipse cx={x0 + w * 0.42} cy={y0 + h * 0.27} rx="26" ry="14" />
        </g>
      </g>
      <path d={`M${x0} ${y1 - h * 0.18} C ${x0 + w * 0.3} ${y1 - h * 0.34}, ${x0 + w * 0.62} ${y1 - h * 0.12}, ${x1} ${y1 - h * 0.26} L ${x1} ${y1} L ${x0} ${y1} Z`} fill={mixColor("#8DBF6E", "#14282C", dark * 0.9)} />
      <g transform={`translate(${x0 + w * 0.72} ${y1 - h * 0.24})`} fill={mixColor("#5E9C52", "#0F2224", dark * 0.9)}>
        <rect x="-3" y="-4" width="6" height="26" fill={mixColor("#7A5A3A", "#1E1A16", dark)} />
        <circle cx="0" cy="-18" r="20" />
      </g>
      {/* 夜は遠くの家に明かりがともる */}
      {night ? [[0.16, 0.86], [0.3, 0.9], [0.86, 0.84]].map(([sx, sy]) => <rect key={sx} x={x0 + w * sx!} y={y0 + h * sy!} width="6" height="5" fill="#FFD98A" opacity="0.85" />) : null}
      <clipPath id="room-window-clip"><rect x={x0} y={y0} width={w} height={h} /></clipPath>
      <WindowWeather season={season} x0={x0} y0={y0} w={w} h={h} />
      {season === "summer" && !night ? <g>{[0.12, 0.3].map((sx) => <g key={sx} transform={`translate(${x0 + w * sx} ${y1 - h * 0.12})`}><rect x="-2" y="-30" width="4" height="34" fill="#5E9C52" /><circle cx="0" cy="-34" r="11" fill="#F6C12E" /><circle cx="0" cy="-34" r="5" fill="#8A5A30" /></g>)}</g> : null}
      <rect x={x0} y={y0} width={w} height={h} fill="url(#room-glass)" opacity={night ? 0.35 : 1} />
      <rect x={x0} y={y0} width={w} height="10" fill="#000" opacity="0.12" />
      {/* 窓わく */}
      <rect x={x0} y={y0} width={w} height={h} fill="none" stroke="#FFFFFF" strokeWidth="14" />
      <rect x={x0 - 7} y={y0 - 7} width={w + 14} height={h + 14} fill="none" stroke="#D9C3A0" strokeWidth="3" />
      <rect x={cx - 4} y={y0} width="8" height={h} fill="#FFFFFF" />
      <rect x={x0} y={y0 + h / 2 - 4} width={w} height="8" fill="#FFFFFF" />
      <rect x={x0 - 18} y={y1 + 6} width={w + 36} height="14" rx="4" fill="#FFFDF8" />
      <rect x={x0 - 18} y={y1 + 18} width={w + 36} height="4" fill="#000" opacity="0.08" />
      {/* カーテン */}
      <rect x={x0 - 40} y={y0 - 34} width={w + 80} height="10" rx="5" fill="#B08A5E" />
      <path d={`M${x0 - 34} ${y0 - 26} L${x0 + 34} ${y0 - 26} C ${x0 + 30} ${y0 + h * 0.4}, ${x0 + 6} ${y0 + h * 0.6}, ${x0 + 22} ${y1 + 26} L ${x0 - 34} ${y1 + 26} Z`} fill="url(#room-curtain)" />
      <path d={`M${x1 + 34} ${y0 - 26} L${x1 - 34} ${y0 - 26} C ${x1 - 30} ${y0 + h * 0.4}, ${x1 - 6} ${y0 + h * 0.6}, ${x1 - 22} ${y1 + 26} L ${x1 + 34} ${y1 + 26} Z`} fill="url(#room-curtain)" />
      <path d={`M${x0 - 40} ${y0 - 30} L${x1 + 40} ${y0 - 30} L${x1 + 40} ${y0 - 4} Q ${cx} ${y0 + 22} ${x0 - 40} ${y0 - 4} Z`} fill={curtain} />
      <path d={`M${x0 - 40} ${y0 - 30} L${x1 + 40} ${y0 - 30} L${x1 + 40} ${y0 - 4} Q ${cx} ${y0 + 22} ${x0 - 40} ${y0 - 4} Z`} fill="#fff" opacity="0.15" />
      <rect x={x0 - 28} y={y0 + h * 0.62} width="60" height="8" rx="4" fill="#FFF3D6" transform={`rotate(-8 ${x0} ${y0 + h * 0.62})`} />
      <rect x={x1 - 32} y={y0 + h * 0.62} width="60" height="8" rx="4" fill="#FFF3D6" transform={`rotate(8 ${x1} ${y0 + h * 0.62})`} />
    </g>
  );
}

/** 本物の時刻（日本時間）を指す壁かけ時計 */
function Clock({ now, night }: { now: Date; night: boolean }) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0), m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const cx = px(75.5), cy = py(12), r = 46;
  const hand = (deg: number, len: number) => ({ x2: cx + Math.sin((deg * Math.PI) / 180) * len, y2: cy - Math.cos((deg * Math.PI) / 180) * len });
  return (
    <g>
      <circle cx={cx + 3} cy={cy + 5} r={r + 8} fill="#000" opacity="0.08" />
      <circle cx={cx} cy={cy} r={r + 8} fill="#C98F5A" />
      <circle cx={cx} cy={cy} r={r} fill={night ? "#FFF6DE" : "#FFFDF6"} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180, l = i % 3 === 0 ? 9 : 5;
        return <line key={i} x1={cx + Math.sin(a) * (r - 4)} y1={cy - Math.cos(a) * (r - 4)} x2={cx + Math.sin(a) * (r - 4 - l)} y2={cy - Math.cos(a) * (r - 4 - l)} stroke="#6A4A2E" strokeWidth={i % 3 === 0 ? 3 : 1.6} strokeLinecap="round" />;
      })}
      <line x1={cx} y1={cy} {...hand((h % 12) * 30 + m * 0.5, r * 0.5)} stroke="#4A3220" strokeWidth="5" strokeLinecap="round" />
      <line x1={cx} y1={cy} {...hand(m * 6, r * 0.75)} stroke="#4A3220" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4.5" fill="#E4572E" />
      {/* 肉球のかざり */}
      <g transform={`translate(${cx} ${cy + r + 22})`} fill="#C98F5A">
        <ellipse cx="0" cy="4" rx="9" ry="7" />
        {[-10, -3.5, 3.5, 10].map((dx, i) => <ellipse key={dx} cx={dx} cy={i === 0 || i === 3 ? -4 : -8} rx="3.4" ry="4.2" />)}
      </g>
    </g>
  );
}

/**
 * 壁につけた板の棚。上の面（奥ゆき）・前の厚み・金具・壁に落ちる影を描いて、物が「乗っている」ように見せる。
 * 置いたものの下のはし（棚の y）は、上の面のまん中あたりに来る
 */
function Shelves() {
  const BACK = 8, FRONT = 9, THICK = 17;
  return (
    <g>
      <defs>
        <linearGradient id="room-shelf-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B98552" />
          <stop offset="1" stopColor="#E2B683" />
        </linearGradient>
        <linearGradient id="room-shelf-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C38D58" />
          <stop offset="1" stopColor="#9A6838" />
        </linearGradient>
        <linearGradient id="room-shelf-bracket" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5A4636" />
          <stop offset="0.5" stopColor="#8A7462" />
          <stop offset="1" stopColor="#4A382A" />
        </linearGradient>
        <filter id="room-shelf-blur" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="7" /></filter>
      </defs>
      {ROOM.shelves.map((s) => {
        const x0 = px(s.x0), x1 = px(s.x1), y = py(s.y);
        const top = y - BACK, front = y + FRONT, bottom = front + THICK;
        const inset = 9;
        return (
          <g key={s.y}>
            {/* 壁に落ちる影（棚の下にやわらかく） */}
            <path d={`M${x0 + 6} ${bottom - 2} L${x1 + 4} ${bottom - 2} L${x1 - 10} ${bottom + 34} L${x0 + 22} ${bottom + 34} Z`} fill="#2A1A0C" opacity="0.2" filter="url(#room-shelf-blur)" />
            {/* 金具（壁から棚の下を支える） */}
            {[x0 + 46, x1 - 46].map((bx) => (
              <g key={bx}>
                <path d={`M${bx - 5} ${bottom - 1} L${bx + 5} ${bottom - 1} L${bx + 5} ${bottom + 3} L${bx - 1} ${bottom + 40} L${bx - 5} ${bottom + 40} Z`} fill="url(#room-shelf-bracket)" />
                <circle cx={bx - 3} cy={bottom + 30} r="2" fill="#2E2218" />
              </g>
            ))}
            {/* 板の奥のふち：壁とのさかいに細い影 */}
            <rect x={x0 + inset - 2} y={top - 5} width={x1 - x0 - inset * 2 + 4} height="6" fill="#2A1A0C" opacity="0.12" rx="3" />
            {/* 上の面（奥がせまく、手前が広い） */}
            <path d={`M${x0 + inset} ${top} L${x1 - inset} ${top} L${x1} ${front} L${x0} ${front} Z`} fill="url(#room-shelf-top)" />
            {[0.3, 0.62].map((k) => <path key={k} d={`M${x0 + inset * (1 - k)} ${top + (front - top) * k} L${x1 - inset * (1 - k)} ${top + (front - top) * k}`} stroke="#A87444" strokeOpacity="0.28" strokeWidth="1" />)}
            {/* 手前の厚み */}
            <rect x={x0} y={front} width={x1 - x0} height={THICK} fill="url(#room-shelf-front)" />
            <rect x={x0} y={front} width={x1 - x0} height="2.5" fill="#F4D3A6" opacity="0.85" />
            <path d={`M${x0 + 30} ${front + 8} q 40 -3 90 0 M${x1 - 140} ${front + 11} q 50 2 100 -1`} stroke="#7A4E28" strokeOpacity="0.22" strokeWidth="1.4" fill="none" />
            <rect x={x0} y={bottom - 2.5} width={x1 - x0} height="2.5" fill="#5A3A1C" opacity="0.45" />
          </g>
        );
      })}
    </g>
  );
}

function PendantLamp({ lit }: { lit: boolean }) {
  const cx = W / 2;
  return (
    <g>
      <line x1={cx} y1="0" x2={cx} y2="70" stroke="#6A5A4A" strokeWidth="3" />
      {lit ? <ellipse cx={cx} cy="112" rx="120" ry="60" fill="url(#room-lamp-glow)" /> : null}
      <path d={`M${cx - 52} 112 Q ${cx} 50 ${cx + 52} 112 Z`} fill={lit ? "#FFE7A8" : "#F2E2C2"} stroke="#C9A878" strokeWidth="2" />
      <ellipse cx={cx} cy="112" rx="52" ry="8" fill={lit ? "#FFF6D0" : "#E6D2AE"} />
      {lit ? <circle cx={cx} cy="116" r="10" fill="#FFF8DC" /> : null}
    </g>
  );
}

function Floor({ theme }: { theme: RoomTheme }) {
  const f = FLOOR_STYLES[theme.floor];
  const depth = H - HZ;
  /** 奥から手前へ、遠近感のある横の線の位置 */
  const rows = (n: number) => Array.from({ length: n + 1 }, (_, k) => HZ + depth * Math.pow(k / n, 1.45));
  /** 消失点に向かう縦の線（奥の x と手前の x） */
  const cols = (spacing: number) => Array.from({ length: 23 }, (_, i) => (i - 11) * spacing).map((d) => [W / 2 + d, W / 2 + d * 2.3] as const);
  const xAt = (c: readonly [number, number], y: number) => c[0] + (c[1] - c[0]) * ((y - HZ) / depth);
  if (theme.floor === "checker" || theme.floor === "tatami") {
    const r = rows(theme.floor === "checker" ? 7 : 3), c = cols(theme.floor === "checker" ? 90 : 150);
    const cells: React.ReactNode[] = [];
    for (let i = 0; i < r.length - 1; i++) for (let j = 0; j < c.length - 1; j++) {
      if ((i + j) % 2) continue;
      const ya = r[i]!, yb = r[i + 1]!;
      cells.push(<polygon key={`${i}-${j}`} points={`${xAt(c[j]!, ya)},${ya} ${xAt(c[j + 1]!, ya)},${ya} ${xAt(c[j + 1]!, yb)},${yb} ${xAt(c[j]!, yb)},${yb}`} fill={f.line} opacity={theme.floor === "tatami" ? 0.45 : 0.75} />);
    }
    return (
      <g>
        <rect x="0" y={HZ} width={W} height={depth} fill={f.base} />
        {cells}
        {theme.floor === "tatami" ? r.map((y) => <rect key={y} x="0" y={y - 3} width={W} height="6" fill="#6E7A4A" opacity="0.55" />) : null}
      </g>
    );
  }
  if (theme.floor === "carpet") {
    return (
      <g>
        <rect x="0" y={HZ} width={W} height={depth} fill={f.base} />
        {Array.from({ length: 140 }, (_, i) => {
          const x = (i * 137.5) % W, y = HZ + ((i * 61.8) % depth);
          return <circle key={i} cx={x} cy={y} r={1.2 + (y - HZ) / depth} fill={f.line} opacity="0.6" />;
        })}
      </g>
    );
  }
  // 木の床：消失点に向かう板の継ぎ目と、ずらした板の端
  const r = rows(9), c = cols(70);
  // 板ごとに少しだけ色を変えて、本物の床板らしくする
  const tones = ["#FFFFFF", "#000000"];
  const planks: React.ReactNode[] = [];
  for (let j = 0; j < c.length - 1; j++) {
    for (let i = 0; i < r.length - 1; i++) {
      // 板は奥から手前へ長くのびるので、色は 4〜5 段ぶん（継ぎ目から継ぎ目まで）同じにする
      const seg = Math.floor((i + (j % 4) * 1.3) / 4.5);
      // サーバーと端末で同じ値になるよう、小数の計算ではなく整数のハッシュで決める
      const t = (((Math.imul(seg + 7, 73856093) ^ Math.imul(j + 3, 19349663)) >>> 0) % 1000) / 1000;
      const ya = r[i]!, yb = r[i + 1]!;
      planks.push(<polygon key={`p${i}-${j}`} points={`${xAt(c[j]!, ya)},${ya} ${xAt(c[j + 1]!, ya)},${ya} ${xAt(c[j + 1]!, yb)},${yb} ${xAt(c[j]!, yb)},${yb}`} fill={tones[t < 0.5 ? 0 : 1]} opacity={(0.02 + Math.abs(t - 0.5) * 0.08).toFixed(3)} />);
    }
  }
  return (
    <g>
      <rect x="0" y={HZ} width={W} height={depth} fill={f.base} />
      {planks}
      {c.map((cc, i) => <line key={i} x1={cc[0]} y1={HZ} x2={cc[1]} y2={H} stroke={f.line} strokeWidth="2" />)}
      {/* 板の継ぎ目（となりの板とはずらす） */}
      {r.slice(1).map((y, i) => c.slice(0, -1).map((cc, j) => (Math.floor((i + 1 + (j % 4) * 1.3) / 4.5) !== Math.floor((i + (j % 4) * 1.3) / 4.5) ? <line key={`${i}-${j}`} x1={xAt(cc, y)} y1={y} x2={xAt(c[j + 1]!, y)} y2={y} stroke={f.line} strokeWidth="1.4" /> : null)))}
      {/* 木目 */}
      {c.slice(0, -1).map((cc, j) => <line key={`g${j}`} x1={(cc[0] + c[j + 1]![0]) / 2 + 6} y1={HZ} x2={(cc[1] + c[j + 1]![1]) / 2 + 10} y2={H} stroke={f.line} strokeOpacity="0.35" strokeWidth="0.8" />)}
    </g>
  );
}

function RugShape({ rug }: { rug: RoomTheme["rug"] }) {
  const s = RUG_STYLES[rug];
  if (s.shape === "none") return null;
  const cx = W / 2, cy = py(80);
  const edge = "#FFFFFF";
  if (s.shape === "rect") {
    return (
      <g>
        <polygon points={`${cx - 250},${cy - 90} ${cx + 250},${cy - 90} ${cx + 330},${cy + 110} ${cx - 330},${cy + 110}`} fill={s.color} />
        <polygon points={`${cx - 226},${cy - 74} ${cx + 226},${cy - 74} ${cx + 300},${cy + 94} ${cx - 300},${cy + 94}`} fill="none" stroke={edge} strokeWidth="5" strokeDasharray="14 10" opacity="0.8" />
      </g>
    );
  }
  const rx = s.shape === "oval" ? 330 : 270, ry = s.shape === "oval" ? 105 : 120;
  return (
    <g>
      <ellipse cx={cx} cy={cy + 6} rx={rx} ry={ry} fill="#000" opacity="0.06" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={s.color} />
      <ellipse cx={cx} cy={cy} rx={rx - 26} ry={ry - 18} fill="none" stroke={edge} strokeWidth="5" strokeDasharray="14 10" opacity="0.7" />
    </g>
  );
}

/**
 * 部屋全体の明かり（飾ったものや犬にもかかるよう、いちばん上に重ねる）。
 * 夜は部屋を暗くして、天井のライトとフロアランプのまわりだけ明るく残す。夕方は橙、朝は桃色にほんのり染める。
 * lamps は明かりの場所（部屋の %）。いつも四すみを少し暗くして、写真のような落ち着きを出す
 */
export const RoomLighting = memo(function RoomLighting({ now, lamps, at = TOKYO }: { now: Date; lamps: readonly { x: number; y: number; r: number }[]; at?: GeoPoint }) {
  const sky = useMemo(() => skyAt(now, at), [now, at]);
  const dark = Math.max(0, 1 - sky.light);
  const lit = lampsOn(sky);
  const lights = [{ x: 50, y: 11, r: 46 }, ...lamps];
  const morning = sky.azimuth < 180;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" data-lighting>
      <defs>
        <radialGradient id="room-vignette" cx="0.5" cy="0.48" r="0.75">
          <stop offset="0.6" stopColor="#1A1008" stopOpacity="0" />
          <stop offset="1" stopColor="#1A1008" stopOpacity="0.22" />
        </radialGradient>
        <radialGradient id="room-light-hole" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="1" />
          <stop offset="0.55" stopColor="#000" stopOpacity="0.7" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="room-light-warm" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFD98A" stopOpacity="0.32" />
          <stop offset="1" stopColor="#FFD98A" stopOpacity="0" />
        </radialGradient>
        <mask id="room-night-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
          <rect x="0" y="0" width={W} height={H} fill="#fff" />
          {lit ? lights.map((l, i) => <ellipse key={i} cx={px(l.x)} cy={py(l.y)} rx={px(l.r)} ry={px(l.r) * 0.9} fill="url(#room-light-hole)" />) : null}
        </mask>
      </defs>
      {/* 朝焼け・夕焼けの色（太陽が低いほど強い） */}
      {sky.warm > 0.02 && sky.altitude > -8 ? <rect x="0" y="0" width={W} height={H} fill={morning ? "#FFAE96" : "#FF8A3D"} opacity={sky.warm * 0.13} /> : null}
      {/* 外が暗いほど部屋も暗く。明かりがついていれば、そのまわりは明るい */}
      {dark > 0.02 ? <rect x="0" y="0" width={W} height={H} fill="#0F1438" opacity={0.56 * Math.pow(dark, 1.15)} mask="url(#room-night-mask)" /> : null}
      {lit ? lights.map((l, i) => <ellipse key={i} cx={px(l.x)} cy={py(l.y)} rx={px(l.r) * 0.8} ry={px(l.r) * 0.72} fill="url(#room-light-warm)" opacity={Math.min(1, dark * 1.6)} />) : null}
      <rect x="0" y="0" width={W} height={H} fill="url(#room-vignette)" />
    </svg>
  );
});
