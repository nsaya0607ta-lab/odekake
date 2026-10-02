"use client";

/**
 * わんこのおへやの背景（壁・窓・棚・時計・床・ラグ・明かり）。
 * viewBox は 1000 × 1120 で、部屋の % 座標（src/lib/room/types.ts の ROOM）と同じ割合で描く。
 * 窓の外と部屋の明るさは、日本時間の今の時間帯（朝・昼・夕方・夜）に合わせる。
 */
import { memo, useId, useMemo } from "react";
import { skyAt, TOKYO, type GeoPoint, type SkyState } from "@/lib/room/sun";
import { overcastOf, WEATHER_LABEL, withWeather, type RoomWeather } from "@/lib/room/weather";
import { EventAmbience, EventWash } from "./room-events";
import { CURTAIN_STYLES, FLOOR_STYLES, ROOM_KIND_STYLES, RUG_STYLES, WALLPAPER_STYLES } from "@/lib/room/themes";
import { ROOM, roomEventOf, windowOf, type FixtureId, type RoomEvent, type RoomKind, type RoomStyle, type RoomTheme } from "@/lib/room/types";

export type DayPhase = "morning" | "day" | "evening" | "night";

const W = 1000;
const H = 1120;
const HZ = (ROOM.horizon / 100) * H;
const px = (pct: number) => (pct / 100) * W;
/** 左右の壁の幅・天井の高さ・左右の壁が床で手前に広がる分（部屋の箱らしさ） */
const SIDE = 44;
const CEIL = 20;
const SIDE_DROP = 64;
/**
 * 引きで見せるため、奥の壁（0〜W × 0〜H）のまわりに天井・横の壁・手前の床をはみ出して描く量。
 * 画面ではこの外わくごと表示し、飾ったものや犬は奥の部屋（0〜W × 0〜H）の上に置く
 */
const PX = 82, PT = 64, PB = W / 0.86 * ROOM.aspect - H - 64;
const VB = `${-PX} ${-PT} ${W + PX * 2} ${H + PT + PB}`;
/** 外わくの中での部屋の位置（%）。my-room.tsx で飾りと犬を置く台をここに合わせる */
export const ROOM_STAGE = { left: (PX / (W + PX * 2)) * 100, top: (PT / (H + PT + PB)) * 100, width: (W / (W + PX * 2)) * 100, height: (H / (H + PT + PB)) * 100 };
/** 部屋（台）から見た、背景の SVG の位置（%）。台より外にはみ出す */
const SCENE_BOX = { left: `${(-PX / W) * 100}%`, top: `${(-PT / H) * 100}%`, width: `${((W + PX * 2) / W) * 100}%`, height: `${((H + PT + PB) / H) * 100}%` } as const;
/** 横の壁と床・天井のさかい目（奥のかど (SIDE, y) から、手前の x へまっすぐのばしたときの y） */
const seam = (x: number, atSide: number, atZero: number) => atSide + ((atZero - atSide) * (SIDE - x)) / SIDE;
const FLOOR_FRONT = seam(-PX, HZ, HZ + SIDE_DROP);
const CEIL_FRONT = seam(-PX, CEIL, 0);
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

export const RoomScene = memo(function RoomScene({ theme, now, at = TOKYO, weather = null, windows = [] }: {
  theme: RoomTheme; now: Date; at?: GeoPoint; weather?: RoomWeather | null;
  /** 置いてある窓の外わく（部屋の %）。壁を照らす光と、床に差しこむ光に使う。窓そのものは FixtureVisual で描く */
  windows?: readonly WindowRect[];
}) {
  const wall = WALLPAPER_STYLES[theme.wall];
  const sky = useMemo(() => withWeather(skyAt(now, at), weather), [now, at, weather]);
  const overcast = overcastOf(weather);
  const lit = lampsOn(sky);
  const event = theme.events === false ? null : roomEventOf(now)?.id ?? null;
  const sunUp = sky.altitude > 0;
  // 朝夕の低い日ざしは、窓から斜めに長く差しこむ
  const beamSkew = Math.max(-1, Math.min(1, (sky.azimuth - 180) / 90)) * -110;
  return (
    <svg viewBox={VB} preserveAspectRatio="none" className="absolute" style={SCENE_BOX} aria-hidden="true" data-scene>
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
        <linearGradient id="room-ceiling-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2A1A0A" stopOpacity="0.14" />
          <stop offset="1" stopColor="#2A1A0A" stopOpacity="0" />
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
      {/* 行事の期間は壁の色味も変える */}
      {event ? <EventWash event={event} /> : null}
      {/* 窓から入る光が壁を明るくする */}
      {sky.light > 0.1 ? windows.map((win, i) => <ellipse key={i} cx={px((win.x0 + win.x1) / 2)} cy={py((win.y0 + win.y1) / 2)} rx={360 * Math.min(1.6, (win.x1 - win.x0) / 30)} ry={300 * Math.min(1.6, (win.x1 - win.x0) / 30)} fill="url(#room-window-glow)" />) : null}

      {theme.room === "nordic" ? <Wainscot windows={windows} /> : null}
      {/* 和室は長押（なげし）を壁にわたす */}
      {theme.style === "shoji" || theme.room === "wa" ? (
        <g>
          <rect x={SIDE} y={py(5.2)} width={W - SIDE * 2} height="16" fill="#9A6A40" />
          <rect x={SIDE} y={py(5.2)} width={W - SIDE * 2} height="3" fill="#C99A66" />
          <rect x={SIDE} y={py(5.2) + 16} width={W - SIDE * 2} height="8" fill="#2A1A0C" opacity="0.12" />
        </g>
      ) : null}
      {/* 行事の期間は、行事のかざり（手前の層）に入れかえる */}
      {event ? null : <WallDecoration deco={theme.deco} lit={lit} />}

      {/* 床 */}
      <Floor theme={theme} />
      <rect x={-PX} y={HZ} width={W + PX * 2} height={H + PB - HZ} fill="#5A4030" filter="url(#room-grain)" opacity="0.06" />
      <rect x={-PX} y={HZ} width={W + PX * 2} height={H + PB - HZ} fill="url(#room-floor-shade)" />
      {/* 窓から差しこむ光（窓ごとに。低い窓ほど床の手前まで届く） */}
      {sunUp ? windows.map((win, i) => (
        <polygon
          key={i}
          points={`${px(win.x0) + 30},${HZ} ${px(win.x1) - 10},${HZ} ${px(win.x1) + 150 + beamSkew},${H * 0.86} ${px(win.x0) + 120 + beamSkew},${H * 0.86}`}
          fill={mixColor("#FFF6D8", "#FFAE6E", sky.warm)}
          opacity={0.26 * Math.min(1, sky.altitude / 10) * (1 - 0.9 * overcast)}
          filter="url(#room-soft)"
        />
      )) : null}
      {sky.altitude > 8 && overcast < 0.5 ? <SunDust /> : null}
      <RugShape rug={theme.rug} />
      {/* 幅木と、壁と床の境目のかげ */}
      <rect x="0" y={HZ - 22} width={W} height="24" fill="url(#room-baseboard)" />
      <rect x="0" y={HZ + 2} width={W} height="26" fill="url(#room-floor-ao)" />

      {/* 天井と左右の壁：部屋に奥行きを出す */}
      <polygon points={`${-PX},${-PT} ${W + PX},${-PT} ${W + PX},${CEIL_FRONT} ${W - SIDE},${CEIL} ${SIDE},${CEIL} ${-PX},${CEIL_FRONT}`} fill={theme.room === "cozy" ? "url(#room-ceiling)" : ROOM_KIND_STYLES[theme.room].ceiling} />
      <polygon points={`${-PX},${-PT} ${W + PX},${-PT} ${W + PX},${CEIL_FRONT} ${W - SIDE},${CEIL} ${SIDE},${CEIL} ${-PX},${CEIL_FRONT}`} fill="url(#room-ceiling-shade)" />
      {[false, true].map((right) => {
        const X = (x: number) => (right ? W - x : x);
        const wallPts = `${X(SIDE)},${CEIL} ${X(SIDE)},${HZ} ${X(-PX)},${FLOOR_FRONT} ${X(-PX)},${CEIL_FRONT}`;
        const boardTop = seam(-PX, HZ - 22, HZ + SIDE_DROP - 26);
        return (
          <g key={String(right)}>
            <polygon points={wallPts} fill={wall.base} />
            {event ? <polygon points={wallPts} fill="url(#ev-wash)" /> : null}
            <polygon points={wallPts} fill={`url(#room-side-${right ? "right" : "left"})`} />
            <polygon points={`${X(-PX)},${boardTop} ${X(SIDE)},${HZ - 22} ${X(SIDE)},${HZ + 2} ${X(-PX)},${FLOOR_FRONT}`} fill="#F1E8D8" />
          </g>
        );
      })}
      <line x1={SIDE} y1={CEIL} x2={SIDE} y2={HZ} stroke="#000" strokeOpacity="0.1" strokeWidth="2" />
      <line x1={W - SIDE} y1={CEIL} x2={W - SIDE} y2={HZ} stroke="#000" strokeOpacity="0.1" strokeWidth="2" />
      <line x1={SIDE} y1={CEIL} x2={W - SIDE} y2={CEIL} stroke="#000" strokeOpacity="0.08" strokeWidth="2" />
      {/* 部屋の雰囲気ごとのつくり（はり・柱・腰壁・ロープ など）と幅木の色 */}
      <RoomArch kind={theme.room} />
      {theme.style === "attic" ? <AtticCeiling /> : null}
      <PendantLamp lit={lit} kind={theme.room} />
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
    case "log":
      // 横に積んだ丸太（上が明るく下がかげる丸み、合わせ目の深いみぞ、ところどころ節）
      return (
        <pattern id={id} width="400" height="56" patternUnits="userSpaceOnUse">
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E0AE74" />
            <stop offset="0.45" stopColor="#C8935C" />
            <stop offset="1" stopColor="#8E5C32" />
          </linearGradient>
          <rect x="0" y="0" width="400" height="56" fill={`url(#${id}-g)`} />
          <rect x="0" y="0" width="400" height="3" fill="#5A3518" opacity="0.7" />
          <rect x="0" y="3" width="400" height="3" fill="#F2C48C" opacity="0.5" />
          <path d="M20 22 q60 -4 140 2 M200 34 q80 3 180 -2" stroke="#8E5C32" strokeOpacity="0.35" strokeWidth="1.5" fill="none" />
          <ellipse cx="120" cy="30" rx="7" ry="4.5" fill="#7A4A24" opacity="0.55" />
          <ellipse cx="310" cy="20" rx="5" ry="3.4" fill="#7A4A24" opacity="0.45" />
        </pattern>
      );
    case "brick":
      // レンガ（段ごとに半分ずらす。色むらと目地）
      return (
        <pattern id={id} width="128" height="64" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="128" height="64" fill="#D9CBB8" />
          {[[2, 2, "#B8604A"], [66, 2, "#A9553F"], [-30, 34, "#C26A52"], [34, 34, "#B05C46"], [98, 34, "#C26A52"]].map(([x, y, c]) => (
            <g key={`${x}-${y}`}>
              <rect x={x as number} y={y as number} width="60" height="28" rx="2" fill={c as string} />
              <rect x={x as number} y={y as number} width="60" height="5" rx="2" fill="#FFFFFF" opacity="0.12" />
              <rect x={x as number} y={(y as number) + 23} width="60" height="5" fill="#000" opacity="0.12" />
            </g>
          ))}
        </pattern>
      );
    case "shiplap":
      // 白い横板ばり（板と板のあいだの細い影）
      return (
        <pattern id={id} width="200" height="46" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="200" height="4" fill={ink} />
          <rect x="0" y="4" width="200" height="2" fill="#FFFFFF" opacity="0.8" />
          <path d="M40 20 q50 2 110 -1" stroke={ink} strokeOpacity="0.35" strokeWidth="1" fill="none" />
        </pattern>
      );
    case "plaster":
      // しっくい（ほんのりむらのある土壁）
      return (
        <pattern id={id} width="180" height="180" patternUnits="userSpaceOnUse">
          {[[30, 40, 46], [120, 30, 54], [80, 120, 60], [160, 150, 42], [20, 150, 38]].map(([x, y, r]) => <circle key={`${x}`} cx={x} cy={y} r={r} fill={ink} opacity="0.12" />)}
          {[[60, 80], [140, 90], [100, 20], [30, 110], [150, 170]].map(([x, y]) => <circle key={`d${x}`} cx={x} cy={y} r="1.6" fill="#B9A27A" opacity="0.5" />)}
        </pattern>
      );
    case "fog-blue":
      return (
        <pattern id={id} width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="20" cy="20" r="1.4" fill={ink} />
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
/** 窓の外に降るもの。天気がわかるときは本当の雨・雪、わからないときは季節のもの。晴れていれば花びらや落ち葉が舞う */
function WindowWeather({ season: seasonal, weather, x0, y0, w, h }: { season: Season; weather: RoomWeather | null; x0: number; y0: number; w: number; h: number }) {
  const wet = weather && (weather.kind === "rain" || weather.kind === "drizzle" || weather.kind === "thunder");
  const season: Season = weather
    ? wet ? "rain" : weather.kind === "snow" ? "snow" : seasonal === "rain" || seasonal === "snow" ? "none" : seasonal
    : seasonal;
  if (season === "none" || season === "summer") return null;
  const n = season === "rain" ? (weather?.kind === "drizzle" ? 14 : weather && weather.precip >= 4 ? 34 : 24) : season === "snow" && weather ? 22 : 14;
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
      {[[120, 90], [250, 60], [470, 120], [640, 70], [760, 34]].map(([x, len], i) => (
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

/** ガラスについた水てきと、つたい落ちるしずく */
function RainOnGlass({ x0, y0, w, h }: { x0: number; y0: number; w: number; h: number }) {
  const drops = Array.from({ length: 26 }, (_, i) => ({ x: x0 + 10 + ((i * 97) % (w - 20)), y: y0 + 10 + ((i * 61) % (h - 20)), r: 2 + (i % 4) * 0.9 }));
  return (
    <g clipPath="url(#room-window-clip)">
      {drops.map((d, i) => (
        <g key={i}>
          <circle cx={d.x} cy={d.y} r={d.r} fill="#DCE8F4" opacity="0.45" />
          <circle cx={d.x - d.r * 0.35} cy={d.y - d.r * 0.35} r={d.r * 0.35} fill="#FFFFFF" opacity="0.8" />
        </g>
      ))}
      {[0.22, 0.58, 0.83].map((sx, i) => (
        <path key={sx} d={`M${x0 + w * sx} ${y0 + 12} q 3 ${h * 0.2} -1 ${h * 0.45}`} stroke="#E4EEF8" strokeOpacity="0.5" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeDasharray={`${h * 0.45} ${h}`}>
          <animate attributeName="stroke-dashoffset" values={`${h * 0.45};${-h}`} dur={`${5 + i * 1.7}s`} repeatCount="indefinite" />
        </path>
      ))}
    </g>
  );
}

/** 窓の外の雲の置き場所（x, y は窓の中の割合、s は大きさ）。くもるほど多く出す */
const CLOUDS = [[0.3, 0.3, 1], [0.78, 0.18, 0.8], [0.08, 0.14, 0.9], [0.56, 0.42, 1.1], [0.95, 0.4, 1], [0.4, 0.1, 1.2], [0.2, 0.5, 1.1], [0.7, 0.58, 1.3]] as const;

function Cloud({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="6" rx="44" ry="13" fill={fill} />
      <circle cx="-16" cy="-2" r="16" fill={fill} />
      <circle cx="8" cy="-8" r="21" fill={fill} />
      <circle cx="28" cy="2" r="13" fill={fill} />
      <ellipse cx="0" cy="12" rx="40" ry="6" fill="#000" opacity="0.06" />
    </g>
  );
}

function Window({ sky, curtain, season, weather, style }: { sky: SkyState; curtain: string; season: Season; weather: RoomWeather | null; style: RoomStyle }) {
  const win = windowOf(style);
  const x0 = px(win.x0), x1 = px(win.x1), y0 = py(win.y0), y1 = py(win.y1);
  const w = x1 - x0, h = y1 - y0;
  const night = sky.light < 0.2;
  const dark = 1 - sky.light;
  const overcast = overcastOf(weather);
  const wet = weather?.kind === "rain" || weather?.kind === "drizzle" || weather?.kind === "thunder";
  const snowy = weather?.kind === "snow";
  const cloudCount = weather ? Math.round(1 + overcast * 7) : 2;
  const cloudFill = mixColor(mixColor("#FFFFFF", "#FFC9A8", sky.warm), wet || weather?.kind === "thunder" ? "#7C8494" : "#B9BEC8", overcast * 0.85);
  // 風が強いほど雲が速く流れる
  const cloudDur = weather ? Math.max(40, 160 - weather.wind * 3) : 140;
  // 太陽：東（左）から西（右）へ、高さのとおりに動く。地平線（丘）より下は見えない
  const horizonY = y1 - h * 0.22;
  const sunX = x0 + w * Math.max(-0.2, Math.min(1.2, (sky.azimuth - 90) / 180));
  const sunY = horizonY - (Math.max(-6, sky.altitude) / 60) * (horizonY - y0 - 10);
  const sunColor = mixColor("#FFF6C8", "#FF8A4A", sky.warm);
  const T = 20;
  const shape = windowShape(style, x0, y0, x1, y1);
  return (
    <g>
      <defs>
        <linearGradient id="room-casing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E2D8C6" />
        </linearGradient>
        <linearGradient id="room-reveal-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1E140A" stopOpacity="0.32" />
          <stop offset="1" stopColor="#1E140A" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="room-reveal-left" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1E140A" stopOpacity="0.2" />
          <stop offset="1" stopColor="#1E140A" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="room-sill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#EDE3D2" />
        </linearGradient>
        <linearGradient id="room-sill-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F3EADB" />
          <stop offset="1" stopColor="#D8CBB4" />
        </linearGradient>
        {/* 外が見える形（窓の種類ごと） */}
        <clipPath id="room-window-clip"><path d={windowShape(style, x0, y0, x1, y1)} /></clipPath>
        <linearGradient id="room-wood-frame" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B98552" />
          <stop offset="1" stopColor="#7A4E2A" />
        </linearGradient>
      </defs>
      {/* 窓のまわり（外の景色より奥に描く部分） */}
      {style === "standard" || style === "bay" ? (
        <g>
          {/* 窓わくのまわりの飾り板（壁から少し出っぱって、右下に影） */}
          <rect x={x0 - T - 2} y={y0 - T + 4} width={w + T * 2 + 8} height={h + T * 2} rx="4" fill="#2A1A0C" opacity="0.14" filter="url(#room-soft)" />
          <rect x={x0 - T} y={y0 - T} width={w + T * 2} height={h + T * 2} rx="3" fill="url(#room-casing)" />
          <rect x={x0 - T} y={y0 - T} width={w + T * 2} height={h + T * 2} rx="3" fill="none" stroke="#C9B89A" strokeWidth="1.5" />
          <rect x={x0 - 3} y={y0 - 3} width={w + 6} height={h + 6} fill="none" stroke="#CDBFA6" strokeWidth="2" />
        </g>
      ) : (
        <g>
          {/* 窓の形にそった飾りわくと、壁に落ちる影 */}
          <path d={shape} fill="none" stroke="#2A1A0C" strokeOpacity="0.16" strokeWidth={T * 2 + 6} filter="url(#room-soft)" transform="translate(3 6)" />
          {style === "shoji" ? <path d={shape} fill="none" stroke="url(#room-wood-frame)" strokeWidth={T * 1.6} strokeLinejoin="round" /> : <path d={shape} fill="none" stroke="url(#room-casing)" strokeWidth={T * 2} strokeLinejoin="round" />}
          <path d={shape} fill="none" stroke="#C9B89A" strokeWidth="1.5" />
        </g>
      )}
      {/* 外の景色 */}
      <g clipPath="url(#room-window-clip)">
      <rect x={x0} y={y0} width={w} height={h} fill="url(#room-sky)" />
        {sky.stars > 0.02 ? [[0.18, 0.2], [0.34, 0.4], [0.52, 0.16], [0.88, 0.5], [0.12, 0.55], [0.64, 0.34], [0.42, 0.08], [0.8, 0.12]].map(([sx, sy], i) => (
          <circle key={i} cx={x0 + w * sx!} cy={y0 + h * sy!} r={i % 3 ? 1.6 : 2.4} fill="#FFF8DA" opacity={sky.stars * (i % 2 ? 0.7 : 1)} />
        )) : null}
        {sky.altitude > -3 && overcast < 0.95 ? (
          <g opacity={1 - overcast * 0.9}>
            <circle cx={sunX} cy={sunY} r="48" fill={sunColor} opacity="0.25" />
            <circle cx={sunX} cy={sunY} r="24" fill={sunColor} />
          </g>
        ) : null}
        {sky.light < 0.6 && overcast < 0.95 ? (
          <g opacity={Math.min(1, (0.6 - sky.light) * 3) * (1 - overcast * 0.85)}>
            <circle cx={x0 + w * 0.74} cy={y0 + h * 0.24} r="34" fill="#FFF4C8" opacity="0.12" />
            <circle cx={x0 + w * 0.74} cy={y0 + h * 0.24} r="17" fill="#FFFFFF" opacity="0.08" />
            <path d={moonPath(x0 + w * 0.74, y0 + h * 0.24, 17, sky.moon)} fill="#FFF4C8" />
          </g>
        ) : null}
        {/* 雲（くもり・雨の日は多く、灰色に。風に流れる） */}
        <g opacity={0.25 + 0.7 * Math.max(sky.light, overcast * 0.6)}>
          <animateTransform attributeName="transform" type="translate" values={`0 0;${w * 0.18} 0;0 0`} dur={`${cloudDur}s`} repeatCount="indefinite" />
          {CLOUDS.slice(0, cloudCount).map(([cx2, cy2, sc], i) => <Cloud key={i} x={x0 + w * cx2} y={y0 + h * cy2} s={sc * (0.8 + overcast * 0.5)} fill={cloudFill} />)}
        </g>
        {/* きりの日は景色がかすむ */}
        {weather?.kind === "fog" ? <rect x={x0} y={y0} width={w} height={h} fill="#F2F2F0" opacity={0.5 * Math.max(0.4, sky.light)} /> : null}
      <path d={`M${x0} ${y1 - h * 0.18} C ${x0 + w * 0.3} ${y1 - h * 0.34}, ${x0 + w * 0.62} ${y1 - h * 0.12}, ${x1} ${y1 - h * 0.26} L ${x1} ${y1} L ${x0} ${y1} Z`} fill={mixColor(snowy || (!weather && season === "snow") ? "#F4F6FA" : "#8DBF6E", "#14282C", dark * 0.9)} />
      <g transform={`translate(${x0 + w * 0.72} ${y1 - h * 0.24})`} fill={mixColor("#5E9C52", "#0F2224", dark * 0.9)}>
        <rect x="-3" y="-4" width="6" height="26" fill={mixColor("#7A5A3A", "#1E1A16", dark)} />
        <circle cx="0" cy="-18" r="20" />
        {snowy ? <path d="M-19 -22 a 19 15 0 0 1 38 0 q -6 -4 -10 0 q -5 -5 -10 0 q -5 -4 -9 0 q -5 -3 -9 0 z" fill="#FAFCFF" /> : null}
      </g>
      {/* 夜は遠くの家に明かりがともる */}
      {night ? [[0.16, 0.86], [0.3, 0.9], [0.86, 0.84]].map(([sx, sy]) => <rect key={sx} x={x0 + w * sx!} y={y0 + h * sy!} width="6" height="5" fill="#FFD98A" opacity="0.85" />) : null}
      <WindowWeather season={season} weather={weather} x0={x0} y0={y0} w={w} h={h} />
      {weather?.kind === "fog" ? <rect x={x0} y={y1 - h * 0.35} width={w} height={h * 0.35} fill="#F4F4F2" opacity={0.45 * Math.max(0.4, sky.light)} /> : null}
      {/* 雨の日はガラスに水てき */}
      {wet ? <RainOnGlass x0={x0} y0={y0} w={w} h={h} /> : null}
      {season === "summer" && !night && !wet ? <g>{[0.12, 0.3].map((sx) => <g key={sx} transform={`translate(${x0 + w * sx} ${y1 - h * 0.12})`}><rect x="-2" y="-30" width="4" height="34" fill="#5E9C52" /><circle cx="0" cy="-34" r="11" fill="#F6C12E" /><circle cx="0" cy="-34" r="5" fill="#8A5A30" /></g>)}</g> : null}
        {/* 大きな窓の外はベランダ */}
        {style === "french" ? <Balcony x0={x0} x1={x1} y1={y1} h={h} dark={dark} /> : null}
      </g>
      <path d={shape} fill="url(#room-glass)" opacity={night ? 0.35 : 1} />
      <WindowFrame style={style} x0={x0} y0={y0} x1={x1} y1={y1} curtain={curtain} sky={sky} />
    </g>
  );
}

/** 屋根裏：左右のすみが、板ばりの斜めの天井になる */
function AtticCeiling() {
  const sx = W * 0.2, sy = H * 0.3;
  const side = (flip: boolean) => {
    const X = (x: number) => (flip ? W - x : x);
    return (
      <g>
        <polygon points={`${X(-PX)},${-PT} ${X(sx + (PT * sx) / sy)},${-PT} ${X(0)},${sy} ${X(-PX)},${sy + (PX * sy) / sx}`} fill="#E9D3B2" />
        {/* 板ばり（斜めの線） */}
        {[0.22, 0.42, 0.62, 0.82].map((k) => <line key={k} x1={X(sx * k)} y1="0" x2={X(0)} y2={sy * k} stroke="#B98A57" strokeOpacity="0.45" strokeWidth="2" />)}
        <polygon points={`${X(-PX)},${-PT} ${X(sx + (PT * sx) / sy)},${-PT} ${X(0)},${sy} ${X(-PX)},${sy + (PX * sy) / sx}`} fill="#3A2410" opacity={flip ? 0.16 : 0.08} />
        {/* はり（太い木） */}
        <line x1={X(sx + 8)} y1="-6" x2={X(-8)} y2={sy + 10} stroke="#8A5A30" strokeWidth="16" />
        <line x1={X(sx + 8)} y1="-6" x2={X(-8)} y2={sy + 10} stroke="#B07A45" strokeWidth="5" transform="translate(-3 -3)" />
        <line x1={X(sx + 14)} y1="0" x2={X(-2)} y2={sy + 18} stroke="#2A1A0C" strokeOpacity="0.15" strokeWidth="10" filter="url(#room-soft)" />
      </g>
    );
  };
  return <g>{side(false)}{side(true)}</g>;
}

/** 窓の外が見える形（SVG の path） */
function windowShape(style: RoomStyle, x0: number, y0: number, x1: number, y1: number): string {
  const w = x1 - x0, cx = (x0 + x1) / 2;
  switch (style) {
    case "arch": { const r = w / 2; return `M${x0} ${y1} V${y0 + r} A ${r} ${r} 0 0 1 ${x1} ${y0 + r} V${y1} Z`; }
    case "round": { const r = w / 2, cy = (y0 + y1) / 2; return `M${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`; }
    case "attic": { const k = (y1 - y0) * 0.3; return `M${x0} ${y1} V${y0 + k} L${cx} ${y0} L${x1} ${y0 + k} V${y1} Z`; }
    // 障子は左半分だけ開けてある
    case "shoji": return `M${x0} ${y0} H${cx} V${y1} H${x0} Z`;
    default: return `M${x0} ${y0} H${x1} V${y1} H${x0} Z`;
  }
}

/** ベランダの手すり（大きな窓の外） */
function Balcony({ x0, x1, y1, h, dark }: { x0: number; x1: number; y1: number; h: number; dark: number }) {
  const top = y1 - h * 0.3, rail = mixColor("#F4F1EA", "#3A3E52", dark * 0.85), floor = mixColor("#C9C2B6", "#2A2C38", dark * 0.85);
  return (
    <g>
      <rect x={x0} y={y1 - h * 0.08} width={x1 - x0} height={h * 0.08} fill={floor} />
      {Array.from({ length: 9 }, (_, i) => <rect key={i} x={x0 + 8 + i * ((x1 - x0 - 16) / 8) - 2.5} y={top} width="5" height={h * 0.22} fill={rail} />)}
      <rect x={x0} y={top - 6} width={x1 - x0} height="10" rx="3" fill={rail} />
      <rect x={x0} y={top - 6} width={x1 - x0} height="3" fill="#FFFFFF" opacity={0.5 * (1 - dark)} />
    </g>
  );
}

/** 窓わく・窓台・カーテン（窓の種類ごと） */
function WindowFrame({ style, x0, y0, x1, y1, curtain, sky }: { style: RoomStyle; x0: number; y0: number; x1: number; y1: number; curtain: string; sky: SkyState }) {
  const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2;
  const sill = (extra = 0) => (
    <g>
      <rect x={x0 - 26 - extra} y={y1 + 26} width={w + 52 + extra * 2} height="16" fill="#2A1A0C" opacity="0.16" filter="url(#room-soft)" />
      <path d={`M${x0 - 14} ${y1 + 2} L${x1 + 14} ${y1 + 2} L${x1 + 26 + extra} ${y1 + 14 + extra * 0.6} L${x0 - 26 - extra} ${y1 + 14 + extra * 0.6} Z`} fill="url(#room-sill)" />
      <rect x={x0 - 26 - extra} y={y1 + 14 + extra * 0.6} width={w + 52 + extra * 2} height="12" rx="2" fill="url(#room-sill-front)" />
      <rect x={x0 - 26 - extra} y={y1 + 14 + extra * 0.6} width={w + 52 + extra * 2} height="1.5" fill="#FFFFFF" />
    </g>
  );
  /** 両わきにまとめたカーテン。drop はすその位置 */
  const drapes = (drop: number, rodY = y0 - 34, tie = 0.62) => (
    <g>
      <rect x={x0 - 40} y={rodY} width={w + 80} height="10" rx="5" fill="#B08A5E" />
      {[x0 - 46, x1 + 46].map((rx) => <circle key={rx} cx={rx} cy={rodY + 5} r="8" fill="#9A7448" />)}
      <path d={`M${x0 - 34} ${rodY + 8} L${x0 + 30} ${rodY + 8} C ${x0 + 26} ${y0 + h * 0.4}, ${x0 + 4} ${y0 + h * tie}, ${x0 + 20} ${drop} L ${x0 - 34} ${drop} Z`} fill="url(#room-curtain)" />
      <path d={`M${x1 + 34} ${rodY + 8} L${x1 - 30} ${rodY + 8} C ${x1 - 26} ${y0 + h * 0.4}, ${x1 - 4} ${y0 + h * tie}, ${x1 - 20} ${drop} L ${x1 + 34} ${drop} Z`} fill="url(#room-curtain)" />
      <rect x={x0 - 28} y={y0 + h * tie} width="60" height="8" rx="4" fill="#FFF3D6" transform={`rotate(-8 ${x0} ${y0 + h * tie})`} />
      <rect x={x1 - 32} y={y0 + h * tie} width="60" height="8" rx="4" fill="#FFF3D6" transform={`rotate(8 ${x1} ${y0 + h * tie})`} />
    </g>
  );
  const valance = (
    <g>
      <path d={`M${x0 - 40} ${y0 - 30} L${x1 + 40} ${y0 - 30} L${x1 + 40} ${y0 - 4} Q ${cx} ${y0 + 22} ${x0 - 40} ${y0 - 4} Z`} fill={curtain} />
      <path d={`M${x0 - 40} ${y0 - 30} L${x1 + 40} ${y0 - 30} L${x1 + 40} ${y0 - 4} Q ${cx} ${y0 + 22} ${x0 - 40} ${y0 - 4} Z`} fill="#fff" opacity="0.15" />
    </g>
  );
  switch (style) {
    case "arch": {
      const r = w / 2, sy = y0 + r;
      return (
        <g>
          <path d={windowShape("arch", x0, y0, x1, y1)} fill="none" stroke="#FFFFFF" strokeWidth="14" />
          <rect x={x0 + 7} y={sy} width="12" height={y1 - sy - 7} fill="url(#room-reveal-left)" />
          {/* 上の半円は扇のように分ける */}
          {[-60, -30, 0, 30, 60].map((a) => <line key={a} x1={cx} y1={sy} x2={cx + Math.sin((a * Math.PI) / 180) * r} y2={sy - Math.cos((a * Math.PI) / 180) * r} stroke="#FFFFFF" strokeWidth="6" />)}
          <circle cx={cx} cy={sy} r={r * 0.28} fill="none" stroke="#FFFFFF" strokeWidth="6" />
          <rect x={x0} y={sy - 4} width={w} height="8" fill="#FFFFFF" />
          <rect x={cx - 4} y={sy} width="8" height={y1 - sy} fill="#FFFFFF" />
          <rect x={x0} y={sy + (y1 - sy) / 2 - 3} width={w} height="6" fill="#FFFFFF" />
          <rect x={cx + 4} y={sy + 7} width="3" height={y1 - sy - 14} fill="#1E140A" opacity="0.1" />
          {sill()}
          {drapes(y1 + 26, y0 - 40, 0.66)}
        </g>
      );
    }
    case "bay": {
      // 出窓：まん中と左右の3まい。左右は斜めに奥へ向かうので、少し暗くせまく見える
      const a = x0 + w * 0.2, b = x1 - w * 0.2;
      return (
        <g>
          <path d={`M${x0} ${y0} L${a} ${y0 + 10} L${a} ${y1 - 6} L${x0} ${y1} Z`} fill="#1E140A" opacity="0.1" />
          <path d={`M${x1} ${y0} L${b} ${y0 + 10} L${b} ${y1 - 6} L${x1} ${y1} Z`} fill="#1E140A" opacity="0.16" />
          {/* 出窓の天井（奥まって影になる） */}
          <path d={`M${x0} ${y0} L${x1} ${y0} L${b} ${y0 + 10} L${a} ${y0 + 10} Z`} fill="#F1E8D8" />
          <path d={`M${x0} ${y0} L${x1} ${y0} L${b} ${y0 + 10} L${a} ${y0 + 10} Z`} fill="url(#room-reveal-top)" />
          <rect x={x0} y={y0} width={w} height={h} fill="none" stroke="#FFFFFF" strokeWidth="14" />
          {[a, b].map((x) => <path key={x} d={`M${x} ${y0 + 10} V${y1 - 6}`} stroke="#FFFFFF" strokeWidth="9" />)}
          <path d={`M${x0} ${y0} L${a} ${y0 + 10} M${x1} ${y0} L${b} ${y0 + 10}`} stroke="#FFFFFF" strokeWidth="6" />
          <rect x={a} y={y0 + h * 0.45} width={b - a} height="6" fill="#FFFFFF" />
          {/* 深い窓台と、小さなサボテン */}
          <path d={`M${x0} ${y1} L${x1} ${y1} L${b} ${y1 - 6} L${a} ${y1 - 6} Z`} fill="#FFFFFF" />
          {sill(14)}
          <g transform={`translate(${x0 + w * 0.12} ${y1 + 8})`}>
            <path d="M-12 0 L12 0 L9 -16 L-9 -16 Z" fill="#D9806B" />
            <rect x="-11" y="-19" width="22" height="5" rx="2" fill="#E8977F" />
            <path d="M-4 -19 v-18 q0 -6 4 -6 q4 0 4 6 v18 z M4 -27 h6 v-8 q0 -4 -3 -4 q-3 0 -3 4 z M-4 -24 h-6 v-6 q0 -4 3 -4 q3 0 3 4 z" fill="#6FAF68" />
          </g>
          {/* 出窓は上のバランスだけ（出窓の中までカーテンでふさがない） */}
          <rect x={x0 - 40} y={y0 - 34} width={w + 80} height="10" rx="5" fill="#B08A5E" />
          {valance}
        </g>
      );
    }
    case "round": {
      const r = w / 2, cy = (y0 + y1) / 2;
      return (
        <g>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#room-wood-frame)" strokeWidth="18" />
          <circle cx={cx} cy={cy} r={r - 8} fill="none" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="3" />
          <path d={`M${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#1E140A" strokeOpacity="0.18" strokeWidth="10" transform={`translate(0 6)`} clipPath="url(#room-window-clip)" />
          <rect x={cx - 4} y={cy - r} width="8" height={r * 2} fill="url(#room-wood-frame)" />
          <rect x={cx - r} y={cy - 4} width={r * 2} height="8" fill="url(#room-wood-frame)" />
          {[45, 135, 225, 315].map((a) => <circle key={a} cx={cx + Math.cos((a * Math.PI) / 180) * r} cy={cy + Math.sin((a * Math.PI) / 180) * r} r="3.5" fill="#E2B85A" />)}
          {/* 下に小さな飾り棚 */}
          <rect x={cx - r * 0.7} y={cy + r + 22} width={r * 1.4} height="10" rx="2" fill="url(#room-wood-frame)" />
          <rect x={cx - r * 0.7} y={cy + r + 32} width={r * 1.4} height="10" fill="#2A1A0C" opacity="0.12" filter="url(#room-soft)" />
          <g transform={`translate(${cx - r * 0.35} ${cy + r + 22})`}>
            <path d="M-8 0 L8 0 L6 -12 L-6 -12 Z" fill="#8DBDE6" />
            {[-5, 0, 5].map((dx, i) => <ellipse key={dx} cx={dx} cy={-18 - (i % 2) * 3} rx="3.5" ry="7" fill="#86C47A" transform={`rotate(${dx * 3} ${dx} -12)`} />)}
          </g>
          <g transform={`translate(${cx + r * 0.35} ${cy + r + 22})`}><rect x="-7" y="-16" width="14" height="16" rx="2" fill="#F4E3C3" /><rect x="-5" y="-14" width="4" height="12" rx="2" fill="#FFFFFF" opacity="0.5" /></g>
        </g>
      );
    }
    case "attic": {
      const k = h * 0.3;
      return (
        <g>
          <path d={windowShape("attic", x0, y0, x1, y1)} fill="none" stroke="#FFFFFF" strokeWidth="14" strokeLinejoin="round" />
          <path d={`M${x0 + 7} ${y0 + k + 4} L${cx} ${y0 + 8} L${x1 - 7} ${y0 + k + 4}`} fill="none" stroke="#1E140A" strokeOpacity="0.16" strokeWidth="8" />
          <rect x={cx - 4} y={y0} width="8" height={h} fill="#FFFFFF" />
          <rect x={x0} y={y0 + k + (h - k) * 0.42} width={w} height="7" fill="#FFFFFF" />
          {sill()}
          {/* 小さなカフェカーテン（下半分） */}
          <rect x={x0 - 8} y={y0 + k + (h - k) * 0.42 - 6} width={w + 16} height="6" rx="3" fill="#B08A5E" />
          {[0, 1].map((i) => <path key={i} d={`M${i ? cx + 2 : x0 - 4} ${y0 + k + (h - k) * 0.42} H${i ? x1 + 4 : cx - 2} V${y1 - 6} Q ${i ? x1 - (w / 4) : x0 + w / 4} ${y1 + 2} ${i ? cx + 2 : x0 - 4} ${y1 - 6} Z`} fill="url(#room-curtain)" opacity="0.92" />)}
        </g>
      );
    }
    case "shoji": {
      // 和室の障子：右は閉めた障子（外の明るさで紙が光る）、左は開いて外が見える
      const paper = mixColor("#FFFBEF", "#5A5C70", (1 - sky.light) * 0.8);
      const grid = (gx0: number, gx1: number, op = 1) => (
        <g opacity={op}>
          <rect x={gx0} y={y0} width={gx1 - gx0} height={h} fill={paper} />
          {[1, 2].map((i) => <rect key={`v${i}`} x={gx0 + ((gx1 - gx0) * i) / 3 - 2} y={y0} width="4" height={h} fill="#8A5A34" />)}
          {[1, 2, 3, 4, 5].map((i) => <rect key={`h${i}`} x={gx0} y={y0 + (h * i) / 6 - 2} width={gx1 - gx0} height="4" fill="#8A5A34" />)}
          <rect x={gx0} y={y0} width={gx1 - gx0} height={h} fill="none" stroke="#6E4424" strokeWidth="9" />
        </g>
      );
      return (
        <g>
          <rect x={x0 + 7} y={y0 + 7} width={cx - x0 - 7} height="14" fill="url(#room-reveal-top)" />
          {/* 開けた障子は、閉めた障子に重なっている */}
          {grid(cx + 10, x1)}
          {grid(cx - 2, x1 - 12, 0.55)}
          <rect x={x0} y={y0} width={cx - x0} height={h} fill="none" stroke="#6E4424" strokeWidth="9" />
          {/* 鴨居と敷居 */}
          <rect x={x0 - 18} y={y0 - 14} width={w + 36} height="14" fill="url(#room-wood-frame)" />
          <rect x={x0 - 18} y={y1} width={w + 36} height="12" fill="url(#room-wood-frame)" />
          <rect x={x0 - 18} y={y1 + 12} width={w + 36} height="10" fill="#2A1A0C" opacity="0.14" filter="url(#room-soft)" />
          {/* 引き手 */}
          <ellipse cx={x1 - 24} cy={y0 + h * 0.55} rx="5" ry="9" fill="#5A3A1C" />
        </g>
      );
    }
    case "french": {
      // 掃き出し窓：左右2まいのガラス戸。床までのカーテン
      return (
        <g>
          <rect x={x0} y={y0} width={w} height={h} fill="none" stroke="#FFFFFF" strokeWidth="14" />
          <rect x={x0 + 7} y={y0 + 7} width={w - 14} height="16" fill="url(#room-reveal-top)" />
          <rect x={cx - 5} y={y0} width="10" height={h} fill="#FFFFFF" />
          <rect x={cx + 5} y={y0 + 7} width="3" height={h - 14} fill="#1E140A" opacity="0.1" />
          {[x0 + 7, cx + 5].map((dx) => <rect key={dx} x={dx} y={y0 + h * 0.62} width={w / 2 - 12} height="6" fill="#FFFFFF" />)}
          {[cx - 14, cx + 9].map((hx) => <rect key={hx} x={hx} y={y0 + h * 0.5} width="5" height="26" rx="2.5" fill="#B9A27A" />)}
          <rect x={x0 - 10} y={y1 - 4} width={w + 20} height="8" fill="#D9CDB8" />
          {drapes(y1 + 4, y0 - 30, 0.55)}
        </g>
      );
    }
    default:
      return (
        <g>
          {/* 窓わく（壁の厚みのぶん奥にあるので、上と左の内がわに影が落ちる） */}
          <rect x={x0} y={y0} width={w} height={h} fill="none" stroke="#FFFFFF" strokeWidth="14" />
          <rect x={x0 + 7} y={y0 + 7} width={w - 14} height="16" fill="url(#room-reveal-top)" />
          <rect x={x0 + 7} y={y0 + 7} width="12" height={h - 14} fill="url(#room-reveal-left)" />
          <rect x={cx - 4} y={y0} width="8" height={h} fill="#FFFFFF" />
          <rect x={cx + 4} y={y0 + 7} width="3" height={h - 14} fill="#1E140A" opacity="0.1" />
          <rect x={x0} y={y0 + h / 2 - 4} width={w} height="8" fill="#FFFFFF" />
          <rect x={x0 + 7} y={y0 + h / 2 + 4} width={w - 14} height="4" fill="#1E140A" opacity="0.12" />
          <rect x={x0 + 7} y={y0 + h / 2 - 4} width={w - 14} height="1.5" fill="#E8DFD0" />
          {/* 窓台：上の面と前の厚み、下の影 */}
          <rect x={x0 - 26} y={y1 + 26} width={w + 52} height="16" fill="#2A1A0C" opacity="0.16" filter="url(#room-soft)" />
          <path d={`M${x0 - 14} ${y1 + 2} L${x1 + 14} ${y1 + 2} L${x1 + 26} ${y1 + 14} L${x0 - 26} ${y1 + 14} Z`} fill="url(#room-sill)" />
          <rect x={x0 - 26} y={y1 + 14} width={w + 52} height="12" rx="2" fill="url(#room-sill-front)" />
          <rect x={x0 - 26} y={y1 + 14} width={w + 52} height="1.5" fill="#FFFFFF" />
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
}

/**
 * 壁かけのお天気ボード（時計のとなり）。住んでいるところの、いまの天気と気温を出す。
 * 天気がわからないときは「--」
 */
function WeatherBoard({ weather, night, place }: { weather: RoomWeather | null; night: boolean; place: string }) {
  const cx = px(88.2), cy = py(8.8), w = 96, h = 120;
  const x0 = cx - w / 2, y0 = cy - h / 2;
  const kind = weather?.kind;
  const label = weather ? WEATHER_LABEL[weather.kind].label.replace("晴れ時々くもり", "晴れ時々") : "わからない";
  const temp = weather?.temp != null ? `${Math.round(weather.temp)}` : "--";
  const ic = { x: cx, y: y0 + 50 };
  const cloud = (dx: number, dy: number, s: number, fill: string) => (
    <g transform={`translate(${ic.x + dx} ${ic.y + dy}) scale(${s})`} fill={fill}>
      <ellipse cx="0" cy="5" rx="17" ry="7" /><circle cx="-7" cy="0" r="8" /><circle cx="4" cy="-3" r="10" /><circle cx="12" cy="2" r="6" />
    </g>
  );
  const sun = (dx: number, dy: number, r: number) => (
    <g transform={`translate(${ic.x + dx} ${ic.y + dy})`}>
      {Array.from({ length: 8 }, (_, i) => <line key={i} x1="0" y1={-r - 3} x2="0" y2={-r - 8} stroke="#F2A93A" strokeWidth="3" strokeLinecap="round" transform={`rotate(${i * 45})`} />)}
      <circle r={r} fill="#FFC53D" /><circle r={r * 0.55} cx={-r * 0.25} cy={-r * 0.25} fill="#FFE08A" />
    </g>
  );
  const moon = (dx: number, dy: number) => <path d={moonPath(ic.x + dx, ic.y + dy, 12, 0.2)} fill="#F2C94C" />;
  let icon: React.ReactNode;
  switch (kind) {
    case "clear": icon = night ? <g>{moon(0, 0)}<circle cx={ic.x + 16} cy={ic.y - 10} r="2" fill="#F2C94C" /></g> : sun(0, 0, 12); break;
    case "partly": icon = <g>{night ? moon(-8, -6) : sun(-8, -6, 10)}{cloud(5, 6, 0.85, "#FFFFFF")}{cloud(5, 6, 0.85, "#00000010")}</g>; break;
    case "cloudy": icon = <g>{cloud(-6, -4, 0.8, "#C9CFD8")}{cloud(5, 5, 0.95, "#E4E8EE")}</g>; break;
    case "fog": icon = <g>{cloud(0, -6, 0.85, "#DCE0E6")}{[6, 12, 18].map((d) => <line key={d} x1={ic.x - 16 + (d % 12)} y1={ic.y + d} x2={ic.x + 16 - (d % 12)} y2={ic.y + d} stroke="#B9C0CA" strokeWidth="3" strokeLinecap="round" />)}</g>; break;
    case "drizzle": case "rain": icon = <g>{cloud(0, -6, 0.95, "#AEB8C6")}{[-10, 0, 10].map((d, i) => <path key={d} d={`M${ic.x + d} ${ic.y + 10 + (i % 2) * 3} q -3 6 0 8 q 3 -2 0 -8`} fill="#5E9BD6" />)}</g>; break;
    case "snow": icon = <g>{cloud(0, -6, 0.95, "#DCE4EE")}{[-10, 0, 10].map((d, i) => <text key={d} x={ic.x + d} y={ic.y + 20 + (i % 2) * 3} fontSize="10" textAnchor="middle" fill="#8DB6E0">❄</text>)}</g>; break;
    case "thunder": icon = <g>{cloud(0, -6, 0.95, "#7C8494")}<path d={`M${ic.x + 2} ${ic.y + 4} l-8 12 h6 l-4 10 l11 -14 h-6 l4 -8 z`} fill="#FFD23A" /></g>; break;
    default: icon = cloud(0, 0, 0.9, "#E6E1D8");
  }
  return (
    <g>
      {/* くぎと、つるすひも */}
      <path d={`M${cx - 24} ${y0 + 4} L${cx} ${y0 - 22} L${cx + 24} ${y0 + 4}`} fill="none" stroke="#8A6A4A" strokeWidth="1.5" />
      <circle cx={cx} cy={y0 - 22} r="3" fill="#6A5A48" />
      {/* 壁に落ちる影 */}
      <rect x={x0 + 6} y={y0 + 9} width={w} height={h} rx="12" fill="#2A1A0C" opacity="0.2" filter="url(#room-soft)" />
      {/* 木のわく */}
      <rect x={x0} y={y0} width={w} height={h} rx="12" fill="url(#room-clock-rim)" />
      <rect x={x0} y={y0} width={w} height={h} rx="12" fill="none" stroke="#6E4524" strokeOpacity="0.5" strokeWidth="1.5" />
      <rect x={x0 + 7} y={y0 + 7} width={w - 14} height={h - 14} rx="7" fill="#FFFBF2" />
      <rect x={x0 + 7} y={y0 + 7} width={w - 14} height="6" rx="3" fill="#000" opacity="0.06" />
      {/* 場所の名ふだ */}
      <rect x={cx - 26} y={y0 + 12} width="52" height="15" rx="4" fill="#E9D6B4" />
      <text x={cx} y={y0 + 23.5} textAnchor="middle" fontSize="10" fontWeight="900" fill="#6A4A2E">{(place || "おてんき").slice(0, 5)}</text>
      {icon}
      {/* 気温 */}
      <text x={cx - 2} y={y0 + 98} textAnchor="middle" fontSize="24" fontWeight="900" fill="#3A2A1C">{temp}<tspan fontSize="12" dx="1">℃</tspan></text>
      <text x={cx} y={y0 + 110} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#8A7A68">{label}</text>
      {/* ガラスの映りこみ */}
      <path d={`M${x0 + 10} ${y0 + 40} L${x0 + 30} ${y0 + 10} L${x0 + 40} ${y0 + 10} L${x0 + 12} ${y0 + 54} Z`} fill="#FFFFFF" opacity="0.35" />
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
      <defs>
        <linearGradient id="room-clock-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E2AE78" />
          <stop offset="0.5" stopColor="#C98F5A" />
          <stop offset="1" stopColor="#8E5C32" />
        </linearGradient>
        <radialGradient id="room-clock-face" cx="0.5" cy="0.42" r="0.6">
          <stop offset="0.75" stopColor={night ? "#FFF6DE" : "#FFFDF6"} />
          <stop offset="1" stopColor={night ? "#E8DCC0" : "#EDE4D2"} />
        </radialGradient>
      </defs>
      {/* 壁に落ちる影（右下にずれて、ぼける） */}
      <circle cx={cx + 7} cy={cy + 10} r={r + 9} fill="#2A1A0C" opacity="0.2" filter="url(#room-soft)" />
      <circle cx={cx} cy={cy} r={r + 10} fill="url(#room-clock-rim)" />
      <circle cx={cx} cy={cy} r={r + 10} fill="none" stroke="#6E4524" strokeOpacity="0.5" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={r + 1.5} fill="#7A4E2A" />
      <circle cx={cx} cy={cy} r={r} fill="url(#room-clock-face)" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180, l = i % 3 === 0 ? 9 : 5;
        return <line key={i} x1={cx + Math.sin(a) * (r - 4)} y1={cy - Math.cos(a) * (r - 4)} x2={cx + Math.sin(a) * (r - 4 - l)} y2={cy - Math.cos(a) * (r - 4 - l)} stroke="#6A4A2E" strokeWidth={i % 3 === 0 ? 3 : 1.6} strokeLinecap="round" />;
      })}
      <line x1={cx} y1={cy} {...hand((h % 12) * 30 + m * 0.5, r * 0.5)} stroke="#4A3220" strokeWidth="5" strokeLinecap="round" />
      <line x1={cx} y1={cy} {...hand(m * 6, r * 0.75)} stroke="#4A3220" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4.5" fill="#E4572E" />
      {/* ガラスの映りこみ */}
      <path d={`M${cx - r * 0.78} ${cy - r * 0.2} A ${r * 0.82} ${r * 0.82} 0 0 1 ${cx + r * 0.25} ${cy - r * 0.78} L ${cx + r * 0.1} ${cy - r * 0.6} A ${r * 0.62} ${r * 0.62} 0 0 0 ${cx - r * 0.6} ${cy - r * 0.08} Z`} fill="#FFFFFF" opacity="0.5" />
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
function Shelves({ only }: { only?: number } = {}) {
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
      {ROOM.shelves.filter((_, i) => only === undefined || i === only).map((s) => {
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

/** 天井の明かり。部屋の雰囲気ごとに形がちがう（明かりの場所は ceilingLights） */
function PendantLamp({ lit, kind }: { lit: boolean; kind: RoomKind }) {
  const cx = W / 2;
  const cord = (x: number, to: number, color = "#6A5A4A") => <line x1={x} y1="0" x2={x} y2={to} stroke={color} strokeWidth="2.5" />;
  const glow = (x: number, y: number, r = 120) => (lit ? <ellipse cx={x} cy={y} rx={r} ry={r / 2} fill="url(#room-lamp-glow)" /> : null);
  switch (kind) {
    case "log":
      // 鉄のランタン（くさりでつるす）
      return (
        <g>
          {Array.from({ length: 7 }, (_, i) => <ellipse key={i} cx={cx} cy={6 + i * 9} rx="3" ry="5" fill="none" stroke="#3A2E24" strokeWidth="2" />)}
          {glow(cx, 110)}
          <path d={`M${cx - 20} 70 h40 l-6 -8 h-28 z`} fill="#2E2620" />
          <rect x={cx - 18} y="70" width="36" height="46" fill={lit ? "#FFD98A" : "#E8D9B8"} opacity="0.92" />
          {lit ? <ellipse cx={cx} cy="96" rx="7" ry="11" fill="#FFF6D0" /> : null}
          {[cx - 18, cx, cx + 18].map((x) => <rect key={x} x={x - 2} y="70" width="4" height="46" fill="#2E2620" />)}
          <path d={`M${cx - 22} 116 h44 l-4 8 h-36 z`} fill="#2E2620" />
        </g>
      );
    case "wa":
      // 和紙のまるいペンダント
      return (
        <g>
          {cord(cx, 64)}
          {glow(cx, 100)}
          <ellipse cx={cx} cy="100" rx="40" ry="34" fill={lit ? "#FFF3D2" : "#F6EEDC"} />
          {[-24, -12, 0, 12, 24].map((d) => <path key={d} d={`M${cx - Math.sqrt(1600 - d * d * 1.2)} ${100 + d} Q ${cx} ${100 + d + 4} ${cx + Math.sqrt(1600 - d * d * 1.2)} ${100 + d}`} stroke="#C9B48E" strokeOpacity="0.6" strokeWidth="1.2" fill="none" />)}
          <ellipse cx={cx - 12} cy="88" rx="12" ry="9" fill="#FFFFFF" opacity="0.5" />
          <rect x={cx - 10} y="62" width="20" height="6" rx="2" fill="#3A2A1C" />
          <rect x={cx - 10} y="132" width="20" height="5" rx="2" fill="#3A2A1C" />
        </g>
      );
    case "nordic":
      // 白いガラスの丸いランプ
      return (
        <g>
          {cord(cx, 70, "#2E2E2E")}
          {glow(cx, 104)}
          <rect x={cx - 8} y="64" width="16" height="10" rx="2" fill="#C9A15A" />
          <circle cx={cx} cy="104" r="32" fill={lit ? "#FFF8E4" : "#F4F6F8"} />
          <circle cx={cx} cy="104" r="32" fill="none" stroke="#D6DCE2" strokeWidth="1.5" />
          <ellipse cx={cx - 11} cy="92" rx="10" ry="7" fill="#FFFFFF" opacity="0.85" />
        </g>
      );
    case "cafe":
      // はだか電球を3つ、長さを変えてつるす
      return (
        <g>
          {[[400, 96], [500, 120], [600, 88]].map(([x, len]) => (
            <g key={x}>
              {cord(x!, len!, "#2A2522")}
              {glow(x!, len! + 18, 70)}
              <rect x={x! - 6} y={len! - 4} width="12" height="12" rx="2" fill="#2A2522" />
              <path d={`M${x! - 9} ${len! + 8} q -6 14 0 24 q 9 8 18 0 q 6 -10 0 -24 z`} fill={lit ? "#FFE3A0" : "#F2EAD8"} opacity="0.9" stroke="#C9A878" strokeWidth="1" />
              {lit ? <path d={`M${x! - 3} ${len! + 14} q 3 6 6 0`} stroke="#FF9A3A" strokeWidth="1.5" fill="none" /> : null}
            </g>
          ))}
        </g>
      );
    case "seaside":
      // 真ちゅうのマリンランプ（ロープでつるす）
      return (
        <g>
          <line x1={cx} y1="0" x2={cx} y2="68" stroke="#C9A878" strokeWidth="4" strokeDasharray="5 3" />
          {glow(cx, 104)}
          <path d={`M${cx - 18} 74 h36 v4 h-36 z M${cx - 22} 128 h44 v6 h-44 z`} fill="#B98A3A" />
          <path d={`M${cx - 16} 78 q -6 25 0 50 h32 q 6 -25 0 -50 z`} fill={lit ? "#FFE8B0" : "#E8EEF2"} opacity="0.92" />
          {[cx - 10, cx, cx + 10].map((x) => <line key={x} x1={x} y1="78" x2={x} y2="128" stroke="#B98A3A" strokeWidth="2.5" />)}
          <line x1={cx - 18} y1="103" x2={cx + 18} y2="103" stroke="#B98A3A" strokeWidth="2.5" />
        </g>
      );
    case "starry":
      // 月のランプと、惑星のモビール
      return (
        <g>
          {cord(cx, 66, "#C9C2E8")}
          {glow(cx, 100)}
          <path d={moonPath(cx, 100, 30, 0.3)} fill={lit ? "#FFF0B0" : "#F2E6B8"} />
          <circle cx={cx} cy="100" r="34" fill="#FFF4C8" opacity={lit ? 0.25 : 0.1} />
          {[[cx - 150, 120, 16, "#F2A7B8", true], [cx - 330, 60, 12, "#8DBDE6", false], [cx - 240, 70, 9, "#B8E986", false], [cx + 230, 130, 10, "#F6D27A", false]].map(([x, y, r, c, ring]) => (
            <g key={x as number}>
              <line x1={x as number} y1="0" x2={x as number} y2={(y as number) - (r as number)} stroke="#C9C2E8" strokeWidth="1.2" />
              <circle cx={x as number} cy={y as number} r={r as number} fill={c as string} />
              <circle cx={(x as number) - (r as number) * 0.35} cy={(y as number) - (r as number) * 0.35} r={(r as number) * 0.35} fill="#FFFFFF" opacity="0.4" />
              {ring ? <ellipse cx={x as number} cy={y as number} rx={(r as number) * 1.8} ry={(r as number) * 0.5} fill="none" stroke="#F6D27A" strokeWidth="2.5" transform={`rotate(-15 ${x} ${y})`} /> : null}
            </g>
          ))}
        </g>
      );
    default:
      return <ConeLamp lit={lit} />;
  }
}

/** 天井の明かりの場所（部屋の %）。夜はここのまわりが明るい */
export function ceilingLights(kind: RoomKind): { x: number; y: number; r: number }[] {
  if (kind === "cafe") return [{ x: 40, y: 11, r: 26 }, { x: 50, y: 13, r: 28 }, { x: 60, y: 10, r: 26 }];
  return [{ x: 50, y: 11, r: 46 }];
}

/** 北欧の部屋の腰壁（白い板の羽目板と、上の見切り）。窓のところはあける */
function Wainscot({ windows }: { windows: readonly WindowRect[] }) {
  const top = py(44.5), bottom = HZ - 22;
  const low = windows.find((w) => w.y1 > 44);
  const gap: [number, number] | null = low ? [px(low.x0) - 26, px(low.x1) + 26] : null;
  const panels: React.ReactNode[] = [];
  for (let x = 0; x < W; x += 110) {
    if (gap && x + 110 > gap[0] && x < gap[1]) continue;
    panels.push(
      <g key={x}>
        <rect x={x + 14} y={top + 22} width="82" height={bottom - top - 34} fill="#000" opacity="0.05" />
        <rect x={x + 16} y={top + 24} width="80" height={bottom - top - 38} fill="#FAFCFD" />
        <path d={`M${x + 16} ${bottom - 14} V${top + 24} H${x + 96}`} stroke="#FFFFFF" strokeWidth="2" fill="none" />
        <path d={`M${x + 96} ${top + 24} V${bottom - 14} H${x + 16}`} stroke="#C9D3DA" strokeWidth="2" fill="none" />
      </g>,
    );
  }
  const seg = (x0: number, x1: number) => (
    <g key={x0}>
      <rect x={x0} y={top} width={x1 - x0} height={bottom - top} fill="#F2F5F7" />
      <rect x={x0} y={top} width={x1 - x0} height="14" fill="#FFFFFF" />
      <rect x={x0} y={top + 14} width={x1 - x0} height="5" fill="#000" opacity="0.08" />
      <rect x={x0} y={top - 4} width={x1 - x0} height="5" fill="#000" opacity="0.06" />
    </g>
  );
  return <g>{gap ? [seg(0, gap[0]), seg(gap[1], W)] : seg(0, W)}{panels}</g>;
}

/** 部屋の雰囲気ごとのつくり（天井や壁のすみ。いちばん手前に描く）と幅木の色 */
function RoomArch({ kind }: { kind: RoomKind }) {
  if (kind === "cozy") return null;
  const k = ROOM_KIND_STYLES[kind];
  const baseboard = (
    <g>
      <rect x="0" y={HZ - 22} width={W} height="24" fill={k.baseboard} />
      <rect x="0" y={HZ - 22} width={W} height="3" fill="#FFFFFF" opacity="0.3" />
      {[false, true].map((right) => {
        const X = (x: number) => (right ? W - x : x);
        const pts = `${X(-PX)},${seam(-PX, HZ - 22, HZ + SIDE_DROP - 26)} ${X(SIDE)},${HZ - 22} ${X(SIDE)},${HZ + 2} ${X(-PX)},${FLOOR_FRONT}`;
        return <g key={String(right)}><polygon points={pts} fill={k.baseboard} /><polygon points={pts} fill="#000" opacity={right ? 0.08 : 0.15} /></g>;
      })}
    </g>
  );
  switch (kind) {
    case "log":
      return (
        <g>
          {baseboard}
          {/* 天井のはり */}
          <rect x={SIDE} y={CEIL - 4} width={W - SIDE * 2} height="34" fill="#8E5C32" />
          <rect x={SIDE} y={CEIL - 4} width={W - SIDE * 2} height="8" fill="#B98552" />
          <rect x={SIDE} y={CEIL + 30} width={W - SIDE * 2} height="10" fill="#2A1A0C" opacity="0.2" filter="url(#room-soft)" />
          {/* 部屋のすみの、丸太の切り口 */}
          {[SIDE, W - SIDE].map((x) => Array.from({ length: Math.floor((HZ - CEIL - 40) / 56) }, (_, i) => {
            const y = CEIL + 58 + i * 56;
            return (
              <g key={`${x}-${i}`}>
                <circle cx={x} cy={y} r="24" fill="#D9A56A" />
                <circle cx={x} cy={y} r="24" fill="none" stroke="#8E5C32" strokeWidth="3" />
                <circle cx={x} cy={y} r="15" fill="none" stroke="#B07A45" strokeWidth="1.5" />
                <circle cx={x} cy={y} r="7" fill="none" stroke="#B07A45" strokeWidth="1.2" />
                <circle cx={x} cy={y} r="2" fill="#8E5C32" />
              </g>
            );
          }))}
        </g>
      );
    case "wa":
      return (
        <g>
          {baseboard}
          {/* 天井の竿縁と、すみの柱 */}
          {Array.from({ length: 12 }, (_, i) => <line key={i} x1={SIDE + ((W - SIDE * 2) * (i + 1)) / 13} y1={CEIL} x2={-PX + ((W + PX * 2) * (i + 1)) / 13} y2={-PT} stroke="#9A6A40" strokeWidth="2" />)}
          {[SIDE, W - SIDE].map((x) => (
            <g key={x}>
              <rect x={x - 13} y={CEIL} width="26" height={HZ + 4 - CEIL} fill="#8A5A34" />
              <rect x={x - 13} y={CEIL} width="6" height={HZ + 4 - CEIL} fill="#B07A45" />
              <rect x={x + 9} y={CEIL} width="4" height={HZ + 4 - CEIL} fill="#5A3A1C" />
            </g>
          ))}
        </g>
      );
    case "nordic":
      return baseboard;
    case "cafe":
      return (
        <g>
          {baseboard}
          {/* 天井をはしる黒い配管 */}
          <rect x={SIDE} y={CEIL + 8} width={W - SIDE * 2} height="12" rx="6" fill="#2A2522" />
          <rect x={SIDE} y={CEIL + 9} width={W - SIDE * 2} height="3" fill="#6A625C" />
          {[120, 380, 640, 900].map((x) => <rect key={x} x={x - 5} y={CEIL - 2} width="10" height="24" rx="2" fill="#1E1A18" />)}
        </g>
      );
    case "seaside":
      return (
        <g>
          {baseboard}
          {/* 壁の上をめぐるロープ */}
          <rect x={SIDE} y={CEIL + 2} width={W - SIDE * 2} height="12" rx="6" fill="#D9C08E" />
          <line x1={SIDE} y1={CEIL + 8} x2={W - SIDE} y2={CEIL + 8} stroke="#B89A62" strokeWidth="12" strokeDasharray="6 8" opacity="0.6" />
          {/* 浮き輪（右の壁の上のほう） */}
          <g transform={`translate(600 ${py(8)})`}>
            <circle r="30" fill="none" stroke="#FFFFFF" strokeWidth="16" />
            {[0, 90, 180, 270].map((a) => <path key={a} d={describeArc(0, 0, 30, a + 20, a + 70)} stroke="#E4572E" strokeWidth="16" fill="none" />)}
            <circle r="30" fill="none" stroke="#C9A878" strokeWidth="2" strokeDasharray="4 4" />
          </g>
        </g>
      );
    case "starry":
      return (
        <g>
          {baseboard}
          {[[90, 6], [230, 12], [380, 4], [620, 10], [760, 5], [910, 12]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2" fill="#F6E7A8" />)}
        </g>
      );
  }
}

const describeArc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
};

function ConeLamp({ lit }: { lit: boolean }) {
  const cx = W / 2;
  return (
    <g>
      <defs>
        <linearGradient id="room-shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={lit ? "#E8C47C" : "#D8C29C"} />
          <stop offset="0.35" stopColor={lit ? "#FFF0C4" : "#F6EAD2"} />
          <stop offset="1" stopColor={lit ? "#D9AE62" : "#C8B08A"} />
        </linearGradient>
      </defs>
      {/* 天井のつけ根 */}
      <ellipse cx={cx} cy="9" rx="16" ry="5" fill="#E6DCCB" />
      <rect x={cx - 10} y="4" width="20" height="6" rx="2" fill="#D7CBB6" />
      <line x1={cx} y1="9" x2={cx} y2="70" stroke="#6A5A4A" strokeWidth="3" />
      <rect x={cx - 5} y="62" width="10" height="12" rx="2" fill="#8A7A66" />
      {lit ? <ellipse cx={cx} cy="112" rx="120" ry="60" fill="url(#room-lamp-glow)" /> : null}
      <path d={`M${cx - 52} 112 Q ${cx} 50 ${cx + 52} 112 Z`} fill="url(#room-shade)" stroke="#C9A878" strokeWidth="1.5" />
      <path d={`M${cx - 30} 100 Q ${cx - 14} 70 ${cx + 4} 70`} fill="none" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx={cx} cy="112" rx="52" ry="8" fill={lit ? "#FFF6D0" : "#B9A07C"} />
      <ellipse cx={cx} cy="110.5" rx="49" ry="5.5" fill={lit ? "#FFFBE8" : "#A68E6A"} />
      {lit ? <circle cx={cx} cy="116" r="10" fill="#FFF8DC" /> : null}
    </g>
  );
}

function Floor({ theme, to = H + PB }: { theme: RoomTheme; to?: number }) {
  const f = FLOOR_STYLES[theme.floor];
  // 引きで見せる手前のぶん（H より下）と、左右のはみ出しまで床をしく
  const FB = H + PB, FX = -PX, FW = W + PX * 2;
  const depth = FB - HZ;
  /** 奥から手前へ、遠近感のある横の線の位置 */
  // 手前にのばすとき（to が部屋の下より下）は、同じ間かくの続きを足す
  const rows = (n: number) => { const out: number[] = []; for (let k = 0; k <= n * 4; k++) { const y = HZ + depth * Math.pow(k / n, 1.45); out.push(y); if (y >= to) break; } return out; };
  const D = to - HZ;
  /** 消失点に向かう縦の線（奥の x と手前の x） */
  const cols = (spacing: number) => Array.from({ length: 33 }, (_, i) => (i - 16) * spacing).map((d) => [W / 2 + d, W / 2 + d * 2.3] as const);
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
        <rect x={FX} y={HZ} width={FW} height={D} fill={f.base} />
        {cells}
        {theme.floor === "tatami" ? r.map((y) => <rect key={y} x={FX} y={y - 3} width={FW} height="6" fill="#6E7A4A" opacity="0.55" />) : null}
      </g>
    );
  }
  if (theme.floor === "carpet") {
    // じゅうたん：毛足のざらつき、奥ほど暗く手前ほど明るい毛並み、うすい織り目の段
    const r = rows(16);
    return (
      <g>
        <defs>
          <filter id="room-carpet-pile" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9 1.6" numOctaves="2" seed="7" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.6 -0.55" />
            <feComposite in="SourceGraphic" operator="in" />
          </filter>
          <linearGradient id="room-carpet-light" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.16" />
            <stop offset="0.45" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.12" />
          </linearGradient>
        </defs>
        <rect x={FX} y={HZ} width={FW} height={D} fill={f.base} />
        <rect x={FX} y={HZ} width={FW} height={D} fill={f.line} filter="url(#room-carpet-pile)" opacity="0.55" />
        <rect x={FX} y={HZ} width={FW} height={D} fill="#FFFFFF" filter="url(#room-carpet-pile)" opacity="0.18" transform="translate(1.5 1)" />
        {r.slice(1, -1).map((y) => <line key={y} x1={FX} y1={y} x2={FX + FW} y2={y} stroke={f.line} strokeOpacity="0.35" strokeWidth={0.6 + ((y - HZ) / depth) * 1.4} />)}
        <rect x={FX} y={HZ} width={FW} height={D} fill="url(#room-carpet-light)" />
      </g>
    );
  }
  if (theme.floor === "herringbone") {
    // ヘリンボーン：短い板を、マスごとに向きを変えて斜めに並べる
    const r = rows(12), c = cols(56);
    const cells: React.ReactNode[] = [];
    for (let i = 0; i < r.length - 1; i++) for (let j = 0; j < c.length - 1; j++) {
      const ya = r[i]!, yb = r[i + 1]!;
      const a = [xAt(c[j]!, ya), ya], b = [xAt(c[j + 1]!, ya), ya], cc = [xAt(c[j + 1]!, yb), yb], d = [xAt(c[j]!, yb), yb];
      const t = (((Math.imul(i + 11, 73856093) ^ Math.imul(j + 5, 19349663)) >>> 0) % 1000) / 1000;
      cells.push(<polygon key={`h${i}-${j}`} points={`${a.join(",")} ${b.join(",")} ${cc.join(",")} ${d.join(",")}`} fill={t < 0.5 ? "#FFFFFF" : "#000000"} opacity={(0.03 + Math.abs(t - 0.5) * 0.1).toFixed(3)} />);
      // 列ごとに向きを変えると、矢羽根（V の字）の模様になる
      const up = j % 2 === 0;
      cells.push(<line key={`l${i}-${j}`} x1={up ? d[0] : a[0]} y1={up ? d[1] : a[1]} x2={up ? b[0] : cc[0]} y2={up ? b[1] : cc[1]} stroke={f.line} strokeWidth="1.4" />);
    }
    return (
      <g>
        <rect x={FX} y={HZ} width={FW} height={D} fill={f.base} />
        {cells}
        {c.map((cc, i) => <line key={i} x1={cc[0]} y1={HZ} x2={xAt(cc, to)} y2={to} stroke={f.line} strokeWidth="1.6" />)}
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
      <rect x={FX} y={HZ} width={FW} height={D} fill={f.base} />
      {planks}
      {c.map((cc, i) => <line key={i} x1={cc[0]} y1={HZ} x2={xAt(cc, to)} y2={to} stroke={f.line} strokeWidth="2" />)}
      {/* 板の継ぎ目（となりの板とはずらす） */}
      {r.slice(1).map((y, i) => c.slice(0, -1).map((cc, j) => (Math.floor((i + 1 + (j % 4) * 1.3) / 4.5) !== Math.floor((i + (j % 4) * 1.3) / 4.5) ? <line key={`${i}-${j}`} x1={xAt(cc, y)} y1={y} x2={xAt(c[j + 1]!, y)} y2={y} stroke={f.line} strokeWidth="1.4" /> : null)))}
      {/* 木目 */}
      {c.slice(0, -1).map((cc, j) => <line key={`g${j}`} x1={(cc[0] + c[j + 1]![0]) / 2 + 6} y1={HZ} x2={xAt([(cc[0] + c[j + 1]![0]) / 2 + 6, (cc[1] + c[j + 1]![1]) / 2 + 10], to)} y2={to} stroke={f.line} strokeOpacity="0.35" strokeWidth="0.8" />)}
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
        <polygon points={`${cx - 250},${cy - 84} ${cx + 250},${cy - 84} ${cx + 334},${cy + 120} ${cx - 334},${cy + 120}`} fill="#000" opacity="0.08" />
        <polygon points={`${cx - 250},${cy - 90} ${cx + 250},${cy - 90} ${cx + 330},${cy + 116} ${cx - 330},${cy + 116}`} fill={mixColor(s.color, "#000000", 0.18)} />
        <polygon points={`${cx - 250},${cy - 90} ${cx + 250},${cy - 90} ${cx + 330},${cy + 110} ${cx - 330},${cy + 110}`} fill={s.color} />
        <polygon points={`${cx - 226},${cy - 74} ${cx + 226},${cy - 74} ${cx + 300},${cy + 94} ${cx - 300},${cy + 94}`} fill="none" stroke={edge} strokeWidth="5" strokeDasharray="14 10" opacity="0.8" />
      </g>
    );
  }
  const rx = s.shape === "oval" ? 330 : 270, ry = s.shape === "oval" ? 105 : 120;
  return (
    <g>
      <ellipse cx={cx} cy={cy + 9} rx={rx + 4} ry={ry + 2} fill="#000" opacity="0.07" />
      {/* 毛足の厚み（手前のふちが少し見える） */}
      <ellipse cx={cx} cy={cy + 5} rx={rx} ry={ry} fill={mixColor(s.color, "#000000", 0.16)} />
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
export const RoomLighting = memo(function RoomLighting({ now, lamps, at = TOKYO, weather = null, room = "cozy", event = null, openBottom = false }: {
  now: Date; lamps: readonly { x: number; y: number; r: number }[]; at?: GeoPoint; weather?: RoomWeather | null; room?: RoomKind; event?: RoomEvent | null;
  /** 部屋の下に机が続くとき。四すみのかげを、下のはしにはかけない */
  openBottom?: boolean;
}) {
  const sky = useMemo(() => withWeather(skyAt(now, at), weather), [now, at, weather]);
  const overcast = overcastOf(weather);
  const dark = Math.max(0, 1 - sky.light);
  const lit = lampsOn(sky);
  const lights = [...ceilingLights(room), ...lamps];
  const kindStyle = ROOM_KIND_STYLES[room];
  const morning = sky.azimuth < 180;
  return (
    <svg viewBox={VB} preserveAspectRatio="none" className="pointer-events-none absolute" style={SCENE_BOX} aria-hidden="true" data-lighting>
      <defs>
        <radialGradient id="room-vignette" cx="0.5" cy={openBottom ? 0.95 : 0.48} r={openBottom ? 0.9 : 0.75}>
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
        <mask id="room-night-mask" maskUnits="userSpaceOnUse" x={-PX} y={-PT} width={W + PX * 2} height={H + PT + PB}>
          <rect x={-PX} y={-PT} width={W + PX * 2} height={H + PT + PB} fill="#fff" />
          {lit ? lights.map((l, i) => <ellipse key={i} cx={px(l.x)} cy={py(l.y)} rx={px(l.r)} ry={px(l.r) * 0.9} fill="url(#room-light-hole)" />) : null}
        </mask>
      </defs>
      {/* 朝焼け・夕焼けの色（太陽が低いほど強い） */}
      {sky.warm > 0.02 && sky.altitude > -8 ? <rect x={-PX} y={-PT} width={W + PX * 2} height={H + PT + PB} fill={morning ? "#FFAE96" : "#FF8A3D"} opacity={sky.warm * 0.13} /> : null}
      {/* 外が暗いほど部屋も暗く。明かりがついていれば、そのまわりは明るい */}
      {dark > 0.02 ? <rect x={-PX} y={-PT} width={W + PX * 2} height={H + PT + PB} fill="#0F1438" opacity={0.56 * Math.pow(dark, 1.15)} mask="url(#room-night-mask)" /> : null}
      {lit ? lights.map((l, i) => <ellipse key={i} cx={px(l.x)} cy={py(l.y)} rx={px(l.r) * 0.8} ry={px(l.r) * 0.72} fill="url(#room-light-warm)" opacity={Math.min(1, dark * 1.6)} />) : null}
      {/* 行事の空気（部屋の色・舞う花びらなど・夜に灯るもの） */}
      {event ? <EventAmbience event={event} dark={dark} /> : null}
      {/* 部屋の雰囲気の色味（ログハウスはあたたかく、北欧はすっきり など） */}
      {kindStyle.tint ? <rect x={-PX} y={-PT} width={W + PX * 2} height={H + PT + PB} fill={kindStyle.tint} opacity={kindStyle.tintOpacity} /> : null}
      {/* くもり・雨の日は、昼でも部屋が少し青く沈む */}
      {overcast > 0.3 && sky.light > 0.2 ? <rect x={-PX} y={-PT} width={W + PX * 2} height={H + PT + PB} fill="#5E6E86" opacity={0.1 * overcast} /> : null}
      {/* 雷：ときどき部屋がぴかっと光る */}
      {weather?.kind === "thunder" ? (
        <rect x={-PX} y={-PT} width={W + PX * 2} height={H + PT + PB} fill="#EEF3FF" opacity="0">
          <animate attributeName="opacity" values="0;0;0;0;0.5;0.05;0.32;0;0" keyTimes="0;0.5;0.7;0.79;0.8;0.81;0.82;0.84;1" dur="13s" repeatCount="indefinite" />
        </rect>
      ) : null}
      <rect x={-PX} y={-PT} width={W + PX * 2} height={H + PT + PB} fill="url(#room-vignette)" />
    </svg>
  );
});

/**
 * もようがえの見本。実際の部屋と同じ描き方で、その素材のところだけを小さく切りとって見せる
 * （壁紙は幅木と床のきわまで、床は遠近感のある手前の床、ラグは床に敷いたところ など）
 */
export function ThemeSwatch({ part, theme }: { part: "wall" | "floor" | "curtain" | "rug" | "deco" | "room"; theme: RoomTheme }) {
  const uid = `sw${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const wall = WALLPAPER_STYLES[theme.wall];
  const wallBg = (
    <>
      <defs><WallPattern id={uid} theme={theme} /></defs>
      <rect x={-PX} y={-PT} width={W + PX * 2} height={HZ + PT} fill={wall.base} />
      <rect x={-PX} y={-PT} width={W + PX * 2} height={HZ + PT} fill={`url(#${uid})`} />
    </>
  );
  const baseboard = (
    <>
      <rect x={-PX} y={HZ - 22} width={W + PX * 2} height="24" fill={theme.room === "cozy" ? "#F7F1E6" : ROOM_KIND_STYLES[theme.room].baseboard} />
      <rect x={-PX} y={HZ - 22} width={W + PX * 2} height="3" fill="#FFFFFF" opacity="0.6" />
      <rect x={-PX} y={HZ + 2} width={W + PX * 2} height="20" fill="#2A1A0A" opacity="0.12" />
    </>
  );
  const svg = (viewBox: string, children: React.ReactNode) => (
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" className="block h-full w-full" aria-hidden="true">{children}</svg>
  );
  switch (part) {
    case "wall":
      // 壁紙と、幅木・床のきわ（部屋の左下あたり）
      return svg("200 410 240 240", <>{wallBg}<Floor theme={theme} />{baseboard}</>);
    case "floor":
      return svg("250 720 500 500", <Floor theme={theme} />);
    case "rug":
      return svg("150 530 690 690", <>{wallBg}<Floor theme={theme} />{baseboard}<RugShape rug={theme.rug} /></>);
    case "deco":
      return svg("290 -20 280 280", <>{wallBg}<WallDecoration deco={theme.deco} lit={false} /></>);
    case "curtain": {
      const c = CURTAIN_STYLES[theme.curtain].color, dark = mixColor(c, "#000000", 0.22), light = mixColor(c, "#FFFFFF", 0.25);
      const panel = (right: boolean) => {
        const X = (x: number) => (right ? 96 - x : x);
        return (
          <g>
            <path d={`M${X(10)} 12 H${X(38)} C ${X(36)} 40, ${X(26)} 52, ${X(33)} 92 H${X(10)} Z`} fill={`url(#${uid}-c)`} />
            <path d={`M${X(10)} 88 H${X(33)} V92 H${X(10)} Z`} fill={dark} opacity="0.5" />
            <rect x={right ? 96 - 34 : 8} y="55" width="26" height="4" rx="2" fill="#FFF3D6" transform={`rotate(${right ? 8 : -8} ${right ? 74 : 22} 57)`} />
          </g>
        );
      };
      return svg("0 0 96 96", (
        <>
          <defs>
            <linearGradient id={`${uid}-c`} x1="0" y1="0" x2="1" y2="0">
              {[0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.84, 1].map((o, i) => <stop key={o} offset={o} stopColor={i % 2 ? dark : light} />)}
            </linearGradient>
            <linearGradient id={`${uid}-s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7DB8E8" /><stop offset="1" stopColor="#D8EEFF" /></linearGradient>
          </defs>
          <rect width="96" height="96" fill={wall.base} />
          <rect x="24" y="18" width="48" height="56" fill={`url(#${uid}-s)`} />
          <path d="M24 60 Q48 52 72 58 V74 H24 Z" fill="#8DBF6E" />
          <rect x="24" y="18" width="48" height="56" fill="none" stroke="#FFFFFF" strokeWidth="4" />
          <path d="M48 18 V74 M24 46 H72" stroke="#FFFFFF" strokeWidth="2.5" />
          <rect x="18" y="74" width="60" height="5" rx="1" fill="#FFFDF8" />
          {panel(false)}
          {panel(true)}
          <rect x="6" y="8" width="84" height="5" rx="2.5" fill="#B08A5E" />
          <circle cx="6" cy="10.5" r="3.5" fill="#9A7448" />
          <circle cx="90" cy="10.5" r="3.5" fill="#9A7448" />
        </>
      ));
    }
    case "room": {
      // 部屋全体のミニチュア（壁・窓・天井・床・幅木・照明）
      const win = windowOf(theme.style);
      return svg(VB, (
        <>
          {wallBg}
          <rect x={px(win.x0)} y={py(win.y0)} width={px(win.x1) - px(win.x0)} height={py(win.y1) - py(win.y0)} fill="#9CCDF0" stroke="#FFFFFF" strokeWidth="18" />
          <Floor theme={theme} />
          {baseboard}
          <RugShape rug={theme.rug} />
          <polygon points={`${-PX},${-PT} ${W + PX},${-PT} ${W + PX},${CEIL_FRONT} ${W - SIDE},${CEIL} ${SIDE},${CEIL} ${-PX},${CEIL_FRONT}`} fill={theme.room === "cozy" ? "#F1E9DA" : ROOM_KIND_STYLES[theme.room].ceiling} />
          {[false, true].map((right) => {
            const X = (x: number) => (right ? W - x : x);
            return <polygon key={String(right)} points={`${X(SIDE)},${CEIL} ${X(SIDE)},${HZ} ${X(-PX)},${FLOOR_FRONT} ${X(-PX)},${CEIL_FRONT}`} fill={mixColor(wall.base, "#2A1A0A", right ? 0.22 : 0.14)} />;
          })}
          <RoomArch kind={theme.room} />
          <PendantLamp lit={false} kind={theme.room} />
        </>
      ));
    }
  }
}

/* ---------- 窓・棚・時計・お天気ボード（動かせる部品） ---------- */

export type WindowRect = { x0: number; x1: number; y0: number; y1: number };
/** 窓のまわり（カーテン・窓台・影）のぶんの余白 */
const WIN_M = 70;
const CLOCK_C = { x: px(75.5), y: py(12) }, WEATHER_C = { x: px(88.2), y: py(8.8) };
const SHELF_0 = { x0: px(ROOM.shelves[0].x0) - 10, y: py(ROOM.shelves[0].y) };

/** 部品の絵の範囲（もとの部屋の座標）。部品の (x, y) はこの範囲の中の anchor の位置 */
function fixtureView(fixture: FixtureId, style: RoomStyle): { x: number; y: number; w: number; h: number; ax: number; ay: number } {
  switch (fixture) {
    case "window": {
      const win = windowOf(style);
      const x0 = px(win.x0), y0 = py(win.y0), w = px(win.x1) - x0, h = py(win.y1) - y0;
      return { x: x0 - WIN_M, y: y0 - WIN_M, w: w + WIN_M * 2, h: h + WIN_M * 2, ax: 0.5, ay: 0.5 };
    }
    case "clock": return { x: CLOCK_C.x - 75, y: CLOCK_C.y - 84, w: 150, h: 168, ax: 0.5, ay: 0.5 };
    case "weather": return { x: WEATHER_C.x - 58, y: WEATHER_C.y - 84, w: 116, h: 168, ax: 0.5, ay: 0.5 };
    // 棚は (x, y) が板の上の面のまん中（物を乗せる高さ）
    case "shelf": return { x: SHELF_0.x0, y: SHELF_0.y - 14, w: 370, h: 96, ax: 0.5, ay: 14 / 96 };
  }
}

/** 部品の大きさ（大きさ1のとき、部屋の幅・高さに対する %）と、(x, y) が絵のどこにあたるか（0〜1） */
export function fixtureSize(fixture: FixtureId, style: RoomStyle): { w: number; h: number; ax: number; ay: number } {
  const v = fixtureView(fixture, style);
  return { w: (v.w / W) * 100, h: (v.h / H) * 100, ax: v.ax, ay: v.ay };
}

/** 置いた窓の、外が見える範囲（部屋の %）。壁の光・床の光・犬が外をながめる場所に使う */
export function windowRectOf(p: { x: number; y: number; scale: number }, style: RoomStyle): WindowRect {
  const win = windowOf(style);
  const hw = ((win.x1 - win.x0) / 2) * p.scale, hh = ((win.y1 - win.y0) / 2) * p.scale;
  return { x0: p.x - hw, x1: p.x + hw, y0: p.y - hh, y1: p.y + hh };
}

/**
 * 窓・棚・時計・お天気ボード1つの絵。もとは部屋に描きこんでいたものを、その場所の範囲だけ切りとって描く。
 * 記念撮影でも1まいの絵として読めるよう、使うグラデーションなどはこの中に入れる
 */
export function FixtureVisual({ fixture, theme, now, at = TOKYO, weather = null, placeName = "" }: {
  fixture: FixtureId; theme: RoomTheme; now: Date; at?: GeoPoint; weather?: RoomWeather | null; placeName?: string;
}) {
  const sky = useMemo(() => withWeather(skyAt(now, at), weather), [now, at, weather]);
  const v = fixtureView(fixture, theme.style);
  const curtain = CURTAIN_STYLES[theme.curtain].color;
  return (
    <svg viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`} className="pointer-events-none block h-auto w-full" aria-hidden="true" style={{ overflow: "visible" }}>
      <defs>
        <filter id="room-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14" /></filter>
        {fixture === "window" ? (
          <>
            <linearGradient id="room-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={sky.top} />
              <stop offset="1" stopColor={sky.bottom} />
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
            <linearGradient id="room-curtain" x1="0" y1="0" x2="1" y2="0">
              {[0, 0.16, 0.33, 0.5, 0.66, 0.83, 1].map((o, i) => <stop key={o} offset={o} stopColor={curtain} stopOpacity={i % 2 ? 0.78 : 1} />)}
            </linearGradient>
          </>
        ) : null}
        {fixture === "weather" ? (
          <linearGradient id="room-clock-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#E2AE78" />
            <stop offset="0.5" stopColor="#C98F5A" />
            <stop offset="1" stopColor="#8E5C32" />
          </linearGradient>
        ) : null}
      </defs>
      {fixture === "window" ? <Window sky={sky} curtain={curtain} season={seasonOf(now, at)} weather={weather} style={theme.style} /> : null}
      {fixture === "clock" ? <Clock now={now} night={sky.light < 0.2} /> : null}
      {fixture === "weather" ? <WeatherBoard weather={weather} night={sky.altitude < -4} place={placeName} /> : null}
      {fixture === "shelf" ? <Shelves only={0} /> : null}
    </svg>
  );
}
