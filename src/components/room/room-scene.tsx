"use client";

/**
 * わんこのおへやの背景（壁・窓・棚・時計・床・ラグ・明かり）。
 * viewBox は 1000 × 1120 で、部屋の % 座標（src/lib/room/types.ts の ROOM）と同じ割合で描く。
 * 窓の外と部屋の明るさは、日本時間の今の時間帯（朝・昼・夕方・夜）に合わせる。
 */
import { memo } from "react";
import { CURTAIN_STYLES, FLOOR_STYLES, RUG_STYLES, WALLPAPER_STYLES } from "@/lib/room/themes";
import { ROOM, type RoomTheme } from "@/lib/room/types";

export type DayPhase = "morning" | "day" | "evening" | "night";

const W = 1000;
const H = 1120;
const HZ = (ROOM.horizon / 100) * H;
const px = (pct: number) => (pct / 100) * W;
const py = (pct: number) => (pct / 100) * H;

const SKY: Record<DayPhase, [string, string]> = {
  morning: ["#FFD9B5", "#BFE3F7"],
  day: ["#7EC6F2", "#D8F0FF"],
  evening: ["#F59A6B", "#6E5BA6"],
  night: ["#151C47", "#3B3F7A"],
};

export function dayPhaseOf(date: Date): DayPhase {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "numeric", hourCycle: "h23" }).format(date));
  if (h >= 5 && h < 9) return "morning";
  if (h >= 9 && h < 16) return "day";
  if (h >= 16 && h < 19) return "evening";
  return "night";
}

export const RoomScene = memo(function RoomScene({ theme, phase, now }: { theme: RoomTheme; phase: DayPhase; now: Date }) {
  const wall = WALLPAPER_STYLES[theme.wall];
  const night = phase === "night";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <WallPattern id="room-wall" theme={theme} />
        <linearGradient id="room-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={SKY[phase][0]} />
          <stop offset="1" stopColor={SKY[phase][1]} />
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

      {/* 壁 */}
      <rect x="0" y="0" width={W} height={HZ} fill={wall.base} />
      <rect x="0" y="0" width={W} height={HZ} fill="url(#room-wall)" />
      <rect x="0" y="0" width={W} height={HZ} fill="url(#room-wall-shade)" />
      <rect x="0" y="0" width={W} height="16" fill="#FFFFFF" opacity="0.55" />
      <rect x="0" y="16" width={W} height="4" fill="#000" opacity="0.06" />

      <Window phase={phase} curtain={CURTAIN_STYLES[theme.curtain].color} />
      <Clock now={now} night={night} />
      <Shelves />
      <PendantLamp lit={night || phase === "evening"} />

      {/* 床 */}
      <Floor theme={theme} />
      <rect x="0" y={HZ} width={W} height={H - HZ} fill="url(#room-floor-shade)" />
      {/* 窓から差しこむ光 */}
      {phase !== "night" ? (
        <polygon
          points={`${px(ROOM.window.x0) + 30},${HZ} ${px(ROOM.window.x1) - 10},${HZ} ${px(ROOM.window.x1) + 150},${H * 0.86} ${px(ROOM.window.x0) + 120},${H * 0.86}`}
          fill={phase === "evening" ? "#FFB37A" : "#FFF6D8"}
          opacity={phase === "day" ? 0.22 : 0.18}
        />
      ) : null}
      <RugShape rug={theme.rug} />
      {/* 幅木 */}
      <rect x="0" y={HZ - 22} width={W} height="24" fill="#FFFDF8" />
      <rect x="0" y={HZ - 22} width={W} height="4" fill="#000" opacity="0.05" />
      <rect x="0" y={HZ + 2} width={W} height="6" fill="#000" opacity="0.1" />

      {/* 時間帯の明るさ。夜は部屋が暗くなり、ランプのまわりだけ明るい */}
      {phase === "evening" ? <rect x="0" y="0" width={W} height={H} fill="#FF9A4D" opacity="0.08" /> : null}
      {night ? (
        <>
          <rect x="0" y="0" width={W} height={H} fill="#141A44" opacity="0.34" />
          <ellipse cx={W / 2} cy={420} rx={560} ry={520} fill="url(#room-lamp-glow)" />
        </>
      ) : null}
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

function Window({ phase, curtain }: { phase: DayPhase; curtain: string }) {
  const x0 = px(ROOM.window.x0), x1 = px(ROOM.window.x1), y0 = py(ROOM.window.y0), y1 = py(ROOM.window.y1);
  const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2;
  const night = phase === "night";
  return (
    <g>
      {/* 外の景色 */}
      <rect x={x0} y={y0} width={w} height={h} fill="url(#room-sky)" />
      {phase === "day" || phase === "morning" ? <circle cx={x0 + w * (phase === "morning" ? 0.22 : 0.74)} cy={y0 + h * (phase === "morning" ? 0.6 : 0.26)} r="26" fill="#FFF3B0" /> : null}
      {phase === "evening" ? <circle cx={x0 + w * 0.7} cy={y0 + h * 0.74} r="32" fill="#FFC27A" opacity="0.95" /> : null}
      {night ? (
        <>
          <circle cx={x0 + w * 0.72} cy={y0 + h * 0.26} r="20" fill="#FFF4C8" />
          <circle cx={x0 + w * 0.72 + 9} cy={y0 + h * 0.26 - 6} r="18" fill={SKY.night[0]} />
          {[[0.18, 0.2], [0.34, 0.4], [0.52, 0.16], [0.88, 0.5], [0.12, 0.55]].map(([sx, sy]) => <circle key={`${sx}`} cx={x0 + w * sx!} cy={y0 + h * sy!} r="2.2" fill="#FFF8DA" />)}
        </>
      ) : (
        <g fill="#FFFFFF" opacity={phase === "evening" ? 0.5 : 0.85}>
          <ellipse cx={x0 + w * 0.3} cy={y0 + h * 0.32} rx="38" ry="13" />
          <ellipse cx={x0 + w * 0.42} cy={y0 + h * 0.27} rx="26" ry="14" />
        </g>
      )}
      <path d={`M${x0} ${y1 - h * 0.18} C ${x0 + w * 0.3} ${y1 - h * 0.34}, ${x0 + w * 0.62} ${y1 - h * 0.12}, ${x1} ${y1 - h * 0.26} L ${x1} ${y1} L ${x0} ${y1} Z`} fill={night ? "#1F3A3A" : phase === "evening" ? "#5E6A4A" : "#8DBF6E"} />
      <g transform={`translate(${x0 + w * 0.72} ${y1 - h * 0.24})`} fill={night ? "#183030" : phase === "evening" ? "#4D5A3A" : "#5E9C52"}>
        <rect x="-3" y="-4" width="6" height="26" fill={night ? "#2A2622" : "#7A5A3A"} />
        <circle cx="0" cy="-18" r="20" />
      </g>
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

function Shelves() {
  return (
    <g>
      {ROOM.shelves.map((s) => {
        const x0 = px(s.x0), x1 = px(s.x1), y = py(s.y);
        return (
          <g key={s.y}>
            <rect x={x0 + 4} y={y + 4} width={x1 - x0} height="18" fill="#000" opacity="0.1" rx="3" />
            <rect x={x0} y={y} width={x1 - x0} height="16" rx="3" fill="#C9925C" />
            <rect x={x0} y={y} width={x1 - x0} height="4" rx="2" fill="#E3B888" />
            {[x0 + 30, x1 - 30].map((bx) => <path key={bx} d={`M${bx - 6} ${y + 16} L${bx + 6} ${y + 16} L${bx + 6} ${y + 50} Z`} fill="#A87444" />)}
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
  return (
    <g>
      <rect x="0" y={HZ} width={W} height={depth} fill={f.base} />
      {c.map((cc, i) => <line key={i} x1={cc[0]} y1={HZ} x2={cc[1]} y2={H} stroke={f.line} strokeWidth="2" />)}
      {r.slice(1).map((y, i) => c.slice(0, -1).map((cc, j) => ((i + j) % 3 === 0 ? <line key={`${i}-${j}`} x1={xAt(cc, y)} y1={y} x2={xAt(c[j + 1]!, y)} y2={y} stroke={f.line} strokeWidth="1.6" /> : null)))}
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
