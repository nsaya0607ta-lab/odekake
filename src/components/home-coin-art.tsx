import { useId } from "react";
import { BlueCoinArt, CoinArt } from "@/components/coin-art";

/**
 * ホームの犬カードに降ってくるコインの絵（レア度で、コインそのものの豪華さを変える）。
 *
 * - ふつう（common）：いつもの金貨・青コイン（coin-art.tsx と同じ絵）
 * - 中レア（rare）：縁にギザギザの刻み・内側に粒の飾り・ふくらんだ肉球の刻印・斜めの光沢がある、重たい金貨
 * - 高レア（epic）：小判の形をした「おおばん」。表面に細い横すじの刻み、まん中に肉球の形の宝石
 *   （黄色はルビー、青はサファイア）、上下の縁にも小さな宝石。地金は黄色が金、青がプラチナ
 *
 * 色は黄色・青の2系統。どちらも同じ形で、色だけ変える。
 */

type Kind = "coin" | "blue";
type Tier = "common" | "rare" | "epic";

const METAL = {
  coin: { light: "#FFF6C4", mid: "#F6C850", dark: "#C98A1C", edge: "#9A6412", line: "#B47A18", bead: "#FFF1B0", emboss: "#E3A92E" },
  blue: { light: "#EEF6FF", mid: "#86B6F2", dark: "#2F64BE", edge: "#1E4A93", line: "#3A6CC2", bead: "#E4F1FF", emboss: "#5E92DD" },
} as const;

/** 高レアの青は、サファイアが映えるように地金をプラチナ（銀白）にする */
const PLATINUM = { light: "#FFFFFF", mid: "#D5E1F2", dark: "#8EA5C8", edge: "#5F7BA6", line: "#8199BF", bead: "#FFFFFF", emboss: "#B8C9E2" } as const;

const GEM = {
  coin: { light: "#FFC2D3", mid: "#F2416E", dark: "#9E1240" },
  blue: { light: "#C8E9FF", mid: "#3B8CF0", dark: "#173E9E" },
} as const;

/** 肉球の形（まん中の大きな玉と、上の4つの指） */
function Paw({ cx, cy, s, fill, stroke, strokeWidth = 0 }: { cx: number; cy: number; s: number; fill: string; stroke?: string; strokeWidth?: number }) {
  return (
    <g fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
      <ellipse cx={cx} cy={cy + 2.4 * s} rx={4.6 * s} ry={3.7 * s} />
      <ellipse cx={cx - 5.2 * s} cy={cy - 1.6 * s} rx={1.8 * s} ry={2.2 * s} />
      <ellipse cx={cx - 1.9 * s} cy={cy - 4.4 * s} rx={1.9 * s} ry={2.3 * s} />
      <ellipse cx={cx + 1.9 * s} cy={cy - 4.4 * s} rx={1.9 * s} ry={2.3 * s} />
      <ellipse cx={cx + 5.2 * s} cy={cy - 1.6 * s} rx={1.8 * s} ry={2.2 * s} />
    </g>
  );
}

function RareCoin({ kind, uid }: { kind: Kind; uid: string }) {
  const m = METAL[kind];
  const ticks = Array.from({ length: 36 }, (_, i) => (i / 36) * Math.PI * 2);
  const beads = Array.from({ length: 18 }, (_, i) => (i / 18) * Math.PI * 2);
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={m.light} />
          <stop offset="0.45" stopColor={m.mid} />
          <stop offset="1" stopColor={m.dark} />
        </linearGradient>
        <radialGradient id={`${uid}-face`} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor={m.light} />
          <stop offset="0.55" stopColor={m.mid} />
          <stop offset="1" stopColor={m.dark} />
        </radialGradient>
        <linearGradient id={`${uid}-paw`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={m.light} />
          <stop offset="1" stopColor={m.emboss} />
        </linearGradient>
        <clipPath id={`${uid}-clip`}>
          <circle cx="24" cy="24" r="21" />
        </clipPath>
      </defs>
      {/* 厚みのある縁と、ギザギザの刻み */}
      <circle cx="24" cy="24.8" r="23" fill={m.edge} />
      <circle cx="24" cy="24" r="23" fill={m.dark} />
      <g stroke={m.light} strokeWidth="1.1" opacity="0.75">
        {ticks.map((a) => (
          <line key={a} x1={24 + Math.cos(a) * 21.4} y1={24 + Math.sin(a) * 21.4} x2={24 + Math.cos(a) * 22.8} y2={24 + Math.sin(a) * 22.8} />
        ))}
      </g>
      <circle cx="24" cy="24" r="20.6" fill={`url(#${uid}-rim)`} />
      {/* 内側の面と、粒の飾り */}
      <circle cx="24" cy="24" r="16.4" fill={m.dark} opacity="0.55" />
      <circle cx="24" cy="24.4" r="15.8" fill={`url(#${uid}-face)`} />
      <g fill={m.bead}>
        {beads.map((a) => (
          <circle key={a} cx={24 + Math.cos(a) * 18.4} cy={24 + Math.sin(a) * 18.4} r="0.95" />
        ))}
      </g>
      {/* ふくらんだ肉球：影 → 本体 → 上のてかり */}
      <Paw cx={24} cy={25.2} s={1.55} fill={m.dark} />
      <Paw cx={24} cy={24.4} s={1.55} fill={`url(#${uid}-paw)`} stroke={m.line} strokeWidth={0.5} />
      <ellipse cx="22.4" cy="26.2" rx="2.8" ry="1.3" fill="#fff" opacity="0.55" />
      {/* 斜めの光沢 */}
      <g clipPath={`url(#${uid}-clip)`}>
        <path d="M6 20 L20 4 L26 4 L10 24 Z" fill="#fff" opacity="0.38" />
        <path d="M12 27 L29 8 L31 8 L14 29 Z" fill="#fff" opacity="0.22" />
      </g>
      <circle cx="24" cy="24" r="20.6" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="0.7" />
    </svg>
  );
}

function EpicCoin({ kind, uid }: { kind: Kind; uid: string }) {
  const m = kind === "blue" ? PLATINUM : METAL[kind];
  const g = GEM[kind];
  // 小判の形（縦長の楕円）。表面に横すじ（ござ目）を刻む
  const lines = Array.from({ length: 17 }, (_, i) => 9 + i * 1.9);
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={m.light} />
          <stop offset="0.35" stopColor={m.mid} />
          <stop offset="0.7" stopColor={m.light} />
          <stop offset="1" stopColor={m.dark} />
        </linearGradient>
        <radialGradient id={`${uid}-gem`} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor={g.light} />
          <stop offset="0.5" stopColor={g.mid} />
          <stop offset="1" stopColor={g.dark} />
        </radialGradient>
        <clipPath id={`${uid}-clip`}>
          <ellipse cx="24" cy="24" rx="15" ry="20.5" />
        </clipPath>
      </defs>
      {/* 厚み → 外の縁 → 内の面 */}
      <ellipse cx="24" cy="25" rx="17.6" ry="23" fill={m.edge} />
      <ellipse cx="24" cy="24" rx="17.6" ry="23" fill={m.dark} />
      <ellipse cx="24" cy="24" rx="16.6" ry="22" fill={`url(#${uid}-body)`} />
      <ellipse cx="24" cy="24" rx="15" ry="20.5" fill={m.dark} opacity="0.35" />
      <ellipse cx="24" cy="24.3" rx="14.6" ry="20" fill={`url(#${uid}-body)`} />
      <g clipPath={`url(#${uid}-clip)`} stroke={m.line} strokeWidth="0.55" opacity="0.5">
        {lines.map((y) => (
          <line key={y} x1="6" y1={y} x2="42" y2={y} />
        ))}
      </g>
      {/* まん中の飾り枠と、肉球の宝石 */}
      <ellipse cx="24" cy="24" rx="9.6" ry="11.6" fill={m.mid} stroke={m.edge} strokeWidth="0.9" />
      <ellipse cx="24" cy="24" rx="8.4" ry="10.4" fill="none" stroke={m.light} strokeWidth="0.6" strokeDasharray="1.2 1.1" />
      <Paw cx={24} cy={24.9} s={1.12} fill={g.dark} />
      <Paw cx={24} cy={24.2} s={1.12} fill={`url(#${uid}-gem)`} stroke={g.light} strokeWidth={0.35} />
      <ellipse cx="22.6" cy="25.6" rx="2" ry="1" fill="#fff" opacity="0.75" />
      <circle cx="20.6" cy="20.4" r="0.6" fill="#fff" opacity="0.9" />
      {/* 上下の縁の小さな宝石 */}
      {[6.2, 41.8].map((y) => (
        <g key={y}>
          <path d={`M24 ${y - 2.4} L26.2 ${y} L24 ${y + 2.4} L21.8 ${y} Z`} fill={`url(#${uid}-gem)`} stroke={m.edge} strokeWidth="0.5" />
          <path d={`M24 ${y - 2.4} L25 ${y} L24 ${y - 0.4} Z`} fill="#fff" opacity="0.7" />
        </g>
      ))}
      {[[12.4, 15], [35.6, 15], [12.4, 33], [35.6, 33]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.15" fill={`url(#${uid}-gem)`} stroke={m.edge} strokeWidth="0.4" />
      ))}
      {/* 斜めの光沢 */}
      <g clipPath={`url(#${uid}-clip)`}>
        <path d="M8 22 L22 2 L28 2 L12 26 Z" fill="#fff" opacity="0.4" />
        <path d="M14 32 L32 6 L34 6 L16 34 Z" fill="#fff" opacity="0.22" />
      </g>
      <ellipse cx="24" cy="24" rx="16.6" ry="22" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.7" />
    </svg>
  );
}

export function HomeCoinArt({ kind, tier }: { kind: Kind; tier: Tier }) {
  // 同じ画面に何枚も出るので、グラデーションの id はコインごとに変える
  const uid = `hc${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (tier === "rare") return <RareCoin kind={kind} uid={uid} />;
  if (tier === "epic") return <EpicCoin kind={kind} uid={uid} />;
  return kind === "blue" ? <BlueCoinArt className="h-full w-full" /> : <CoinArt className="h-full w-full" />;
}
