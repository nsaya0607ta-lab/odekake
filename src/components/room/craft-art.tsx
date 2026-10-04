"use client";

/**
 * おみやげクラフトの作品の絵（SVG）。どれも壁に掛けるもの。光は左上から。
 * 掛けひも・くぎ・ピンも描き、壁に落ちる影をうすく付ける。材料のおみやげと同じ色・形で描く（どんぐり・もみじ・貝がら など）。
 * 同じ作品を2つ飾っても id がぶつからないよう、useId で id を分ける。
 */
import { useId, type ReactNode } from "react";
import type { CraftId } from "@/lib/room/crafts";

const SVG_CLASS = "pointer-events-none block h-auto w-full";
const r2 = (n: number) => Math.round(n * 100) / 100;

/** くぎ（真ちゅうの頭） */
function Nail({ x, y }: { x: number; y: number }) {
  return <g><circle cx={x} cy={y} r="2.2" fill="#B8862E" /><circle cx={x - 0.6} cy={y - 0.6} r="0.8" fill="#FFF0C0" /></g>;
}

/** どんぐり（横から見た形。rot で向きを変える） */
function Acorn({ g, x, y, s = 1, rot = 0 }: { g: (n: string) => string; x: number; y: number; s?: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M-5 0 C -5 6 -2.4 9.4 0 10 C 2.4 9.4 5 6 5 0 Z" fill={`url(#${g("nut")})`} />
      <ellipse cx="-2" cy="3.6" rx="1.1" ry="2.4" fill="#FFFFFF" opacity="0.35" />
      <path d="M-6 0.4 C -6 -4 6 -4 6 0.4 C 3.4 1.8 -3.4 1.8 -6 0.4 Z" fill={`url(#${g("cap")})`} />
      <path d="M-4 -1.6 q1 1 2 0 M-1 -2 q1 1 2 0 M2 -1.6 q1 1 2 0" stroke="#4A3018" strokeWidth="0.4" fill="none" opacity="0.6" />
      <path d="M0 -2.6 q0.6 -2 2 -2.4" stroke="#5E4428" strokeWidth="1" strokeLinecap="round" fill="none" />
    </g>
  );
}

/** もみじの葉（中心が根もと） */
function Maple({ g, x, y, s = 1, rot = 0, tone = "m" }: { g: (n: string) => string; x: number; y: number; s?: number; rot?: number; tone?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M0 -14 L2 -6 L8 -10 L6 -3 L13 -2 L7 2 L10 7 L3 4 L0 10 L-3 4 L-10 7 L-7 2 L-13 -2 L-6 -3 L-8 -10 L-2 -6 Z" fill={`url(#${g(tone)})`} stroke="#8A1E14" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M0 10 L0 -12 M0 2 L-10 -1 M0 2 L10 -1 M0 1 L-6 -8 M0 1 L6 -8" stroke="#A8281A" strokeWidth="0.5" fill="none" opacity="0.8" />
    </g>
  );
}

/** 貝がら（ホタテ形） */
function Shell({ g, x, y, s = 1, rot = 0 }: { g: (n: string) => string; x: number; y: number; s?: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M0 9 C -9 9 -11 0 -9 -4 C -7 -9 7 -9 9 -4 C 11 0 9 9 0 9 Z" fill={`url(#${g("shell")})`} stroke="#C08A60" strokeWidth="0.6" />
      {[-6, -3, 0, 3, 6].map((dx) => <path key={dx} d={`M0 8.6 Q ${dx * 0.55} 0 ${dx} -7`} stroke="#D49A6E" strokeWidth="0.8" fill="none" opacity="0.6" />)}
      <path d="M-3 8.6 L-4 11 L4 11 L3 8.6 Z" fill="#E8B88A" />
      <path d="M-7 -4 C -5 -7 -2 -7.6 0 -7.6" stroke="#FFFFFF" strokeWidth="1" fill="none" opacity="0.7" />
    </g>
  );
}

/** まつぼっくり */
function Pinecone({ g, x, y, s = 1 }: { g: (n: string) => string; x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="7" rx="6.6" ry="9" fill="#4A2C14" />
      {[[0, 0, 3], [-3, 3.6, 3], [3, 3.6, 3], [0, 7, 3], [-4, 8, 2.6], [4, 8, 2.6], [-2.4, 11.6, 2.4], [2.4, 11.6, 2.4], [0, 14.4, 2]].map(([dx, dy, w], i) => (
        <path key={i} d={`M${dx! - w!} ${dy} Q ${dx} ${dy! + 3.4} ${dx! + w!} ${dy} Q ${dx} ${dy! - 1} ${dx! - w!} ${dy} Z`} fill={`url(#${g("pc")})`} stroke="#3E2410" strokeWidth="0.4" />
      ))}
    </g>
  );
}

/** 共通のグラデーション（どんぐり・もみじ・貝がら・まつぼっくり・木） */
function Defs({ g }: { g: (n: string) => string }) {
  return (
    <defs>
      <radialGradient id={g("nut")} cx="0.35" cy="0.3" r="0.85"><stop offset="0" stopColor="#E8B07A" /><stop offset="0.55" stopColor="#B8682E" /><stop offset="1" stopColor="#6E3A16" /></radialGradient>
      <linearGradient id={g("cap")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9C7A50" /><stop offset="1" stopColor="#5E4428" /></linearGradient>
      <radialGradient id={g("m")} cx="0.5" cy="0.6" r="0.7"><stop offset="0" stopColor="#F2902E" /><stop offset="0.6" stopColor="#E0461E" /><stop offset="1" stopColor="#A8241A" /></radialGradient>
      <radialGradient id={g("y")} cx="0.5" cy="0.6" r="0.7"><stop offset="0" stopColor="#FFE07A" /><stop offset="1" stopColor="#E8A21A" /></radialGradient>
      <linearGradient id={g("shell")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF6EC" /><stop offset="0.6" stopColor="#F2CFA8" /><stop offset="1" stopColor="#D49A6E" /></linearGradient>
      <linearGradient id={g("pc")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C08A52" /><stop offset="1" stopColor="#6E4422" /></linearGradient>
      <linearGradient id={g("wood")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C8925A" /><stop offset="1" stopColor="#7A4C26" /></linearGradient>
      <linearGradient id={g("twig")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#A87A4E" /><stop offset="1" stopColor="#5E3C20" /></linearGradient>
      <filter id={g("wall")} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6" /></filter>
    </defs>
  );
}

export function CraftArt({ id, label }: { id: CraftId; label?: string }) {
  const u = `cr${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const g = (n: string) => `${u}-${n}`;
  const a11y = label ? { role: "img" as const, "aria-label": label } : {};
  let viewBox = "0 0 100 100";
  const body = ((): ReactNode => {
    switch (id) {
      case "acorn-wreath": {
        // 小えだを編んだ輪に、どんぐりをぐるりと。下に赤いリボン
        const ring = Array.from({ length: 16 }, (_, i) => i);
        return (
          <>
            <path d="M50 6 L50 18" stroke="#8A6A44" strokeWidth="0.8" />
            <Nail x={50} y={6} />
            <circle cx="52" cy="58" r="34" fill="none" stroke="#3A2614" strokeWidth="10" opacity="0.12" filter={`url(#${g("wall")})`} />
            {/* 編んだ小えだ（何本も重ねる） */}
            {[0, 1, 2, 3].map((k) => <circle key={k} cx="50" cy="56" r={31 - k * 1.6} fill="none" stroke={k % 2 ? "#7A4E2A" : "#9C6E40"} strokeWidth="3.2" strokeDasharray={`${18 + k * 3} ${6 + k}`} transform={`rotate(${k * 40} 50 56)`} />)}
            {ring.map((i) => { const a = (i / 16) * Math.PI * 2; return <path key={i} d={`M${r2(50 + Math.cos(a) * 26)} ${r2(56 + Math.sin(a) * 26)} l${r2(Math.cos(a + 1.2) * 7)} ${r2(Math.sin(a + 1.2) * 7)}`} stroke="#6E4422" strokeWidth="1.2" strokeLinecap="round" />; })}
            {/* 葉っぱ */}
            {[30, 110, 200, 290].map((deg, i) => { const a = (deg * Math.PI) / 180; return <ellipse key={i} cx={r2(50 + Math.cos(a) * 31)} cy={r2(56 + Math.sin(a) * 31)} rx="5" ry="2.4" fill="#6CA84E" transform={`rotate(${deg + 90} ${r2(50 + Math.cos(a) * 31)} ${r2(56 + Math.sin(a) * 31)})`} />; })}
            {/* どんぐり */}
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = (i / 8) * Math.PI * 2 - Math.PI / 2 + 0.2; return <Acorn key={i} g={g} x={r2(50 + Math.cos(a) * 30)} y={r2(56 + Math.sin(a) * 30 - 3)} s={1.05} rot={r2((a * 180) / Math.PI + 90)} />; })}
            {/* リボン */}
            <path d="M50 86 C 40 78 32 82 36 88 C 40 92 46 90 50 86 Z M50 86 C 60 78 68 82 64 88 C 60 92 54 90 50 86 Z" fill="#D8343E" stroke="#A81E28" strokeWidth="0.6" />
            <path d="M50 86 L44 98 L47 96 L48 99 Z M50 86 L56 97 L53 95.6 L52 98.6 Z" fill="#C8282E" />
            <circle cx="50" cy="86" r="2.6" fill="#C8282E" />
          </>
        );
      }
      case "maple-garland": {
        // 麻ひもに、もみじ（赤と黄）を5まい。両はしはピン
        viewBox = "0 0 160 70";
        const at = (t: number) => ({ x: 10 + t * 140, y: 12 + Math.sin(t * Math.PI) * 16 });
        return (
          <>
            <path d="M10 12 Q 80 46 150 12" stroke="#3A2614" strokeWidth="3" fill="none" opacity="0.1" filter={`url(#${g("wall")})`} transform="translate(2 4)" />
            <path d="M10 12 Q 80 44 150 12" stroke="#C9A06A" strokeWidth="1.4" fill="none" />
            <Nail x={10} y={12} /><Nail x={150} y={12} />
            {[0.14, 0.32, 0.5, 0.68, 0.86].map((t, i) => {
              const p = at(t);
              return (
                <g key={t}>
                  <path d={`M${r2(p.x)} ${r2(p.y)} L${r2(p.x)} ${r2(p.y + 6)}`} stroke="#C9A06A" strokeWidth="0.8" />
                  <rect x={r2(p.x - 1.6)} y={r2(p.y + 3)} width="3.2" height="4" rx="0.8" fill="#D9B48A" />
                  <Maple g={g} x={r2(p.x)} y={r2(p.y + 20)} s={1.25} rot={(i % 2 ? 1 : -1) * 8} tone={i % 2 ? "y" : "m"} />
                </g>
              );
            })}
          </>
        );
      }
      case "shell-mobile": {
        // 流木のバーから4本のひも。貝がらと、まん中に鳥のはね
        viewBox = "0 0 100 120";
        return (
          <>
            <path d="M50 4 L50 18" stroke="#8A6A44" strokeWidth="0.8" />
            <Nail x={50} y={4} />
            <path d="M14 20 C 30 16 70 16 86 21" stroke={`url(#${g("twig")})`} strokeWidth="5" strokeLinecap="round" fill="none" />
            <path d="M16 19 C 30 15.6 70 15.6 84 20" stroke="#E8CBA0" strokeWidth="1" fill="none" opacity="0.6" />
            <path d="M50 18 L20 20 M50 18 L80 20" stroke="#8A6A44" strokeWidth="0.6" />
            {([[20, 58], [38, 80], [62, 72], [80, 54]] as const).map(([x, len], i) => (
              <g key={x}>
                <path d={`M${x} 21 L${x} ${len}`} stroke="#B9A88A" strokeWidth="0.6" />
                <Shell g={g} x={x} y={len + 8} s={1.05} rot={i % 2 ? 10 : -10} />
              </g>
            ))}
            {/* まん中のはね */}
            <path d="M50 21 L50 64" stroke="#B9A88A" strokeWidth="0.6" />
            <g transform="translate(50 64) rotate(8)">
              <path d="M0 0 C 6 6 7 22 3 34 L 1 40 L -1 40 C -5 26 -6 10 0 0 Z" fill="#E3EAF2" stroke="#9BB0C8" strokeWidth="0.5" />
              <path d="M0 2 C 1 14 1.6 28 0.6 40" stroke="#8C7A64" strokeWidth="0.9" fill="none" />
              {[8, 14, 20, 26].map((y) => <path key={y} d={`M0.6 ${y} l-4 2 M0.6 ${y} l4 1`} stroke="#B4C3D6" strokeWidth="0.5" />)}
            </g>
          </>
        );
      }
      case "pressed-flowers": {
        // 木の額に、さくらの花びらと、ひらたく押したたんぽぽ
        viewBox = "0 0 90 110";
        return (
          <>
            <path d="M45 4 L18 22 M45 4 L72 22" stroke="#8A6A44" strokeWidth="0.8" />
            <Nail x={45} y={4} />
            <rect x="12" y="24" width="70" height="84" rx="3" fill="#3A2614" opacity="0.14" filter={`url(#${g("wall")})`} />
            <rect x="8" y="20" width="74" height="86" rx="3" fill={`url(#${g("wood")})`} />
            <rect x="8" y="20" width="74" height="86" rx="3" fill="none" stroke="#5E3818" strokeWidth="0.8" />
            <path d="M10 22 H80" stroke="#E8C08A" strokeWidth="1.2" opacity="0.8" />
            <rect x="15" y="27" width="60" height="72" rx="1" fill="#FBF6EA" />
            <rect x="15" y="27" width="60" height="72" rx="1" fill="none" stroke="#5E3818" strokeWidth="0.6" opacity="0.4" />
            {/* たんぽぽ（押し花：ひらたく、少し色があせている） */}
            {([[34, 52], [58, 66]] as const).map(([x, y], k) => (
              <g key={k}>
                <path d={`M${x} ${y + 6} C ${x - 2} ${y + 14} ${x + 2} ${y + 18} ${x} ${y + 22}`} stroke="#8AAE6A" strokeWidth="1.2" fill="none" />
                <path d={`M${x} ${y + 16} c -6 -2 -9 -6 -10 -10 c 4 1 8 4 10 10 z`} fill="#9ABE78" />
                {Array.from({ length: 16 }, (_, i) => <ellipse key={i} cx={x} cy={y - 5.4} rx="1.4" ry="4" fill="#F2CF5A" transform={`rotate(${i * 22.5} ${x} ${y})`} />)}
                <circle cx={x} cy={y} r="2.2" fill="#E0AA2A" />
              </g>
            ))}
            {/* さくらの花びら */}
            {([[56, 38, 20], [66, 50, -30], [24, 76, 60], [42, 34, -10], [46, 80, 30]] as const).map(([x, y, r], i) => (
              <g key={i} transform={`translate(${x} ${y}) rotate(${r}) scale(0.7)`}>
                <path d="M0 6 C -6 2 -6 -4 -2 -7 L 0 -4 L 2 -7 C 6 -4 6 2 0 6 Z" fill="#F9C2D2" stroke="#E89AB2" strokeWidth="0.6" />
              </g>
            ))}
            <text x="45" y="95" textAnchor="middle" fontSize="4" fontWeight="700" fill="#A88A6A">はるの おさんぽ</text>
            <path d="M33 96.6 H57" stroke="#C9B49A" strokeWidth="0.4" />
            {/* ガラスの光 */}
            <path d="M18 30 L34 30 L18 50 Z" fill="#FFFFFF" opacity="0.35" />
          </>
        );
      }
      case "sunflower-swag": {
        // ひまわりを逆さに束ねて、麻ひもでしばる（ドライフラワーのスワッグ）
        viewBox = "0 0 80 120";
        return (
          <>
            <path d="M40 4 L40 18" stroke="#8A6A44" strokeWidth="0.8" />
            <Nail x={40} y={4} />
            {/* 茎の束（上） */}
            {[-6, -3, 0, 3, 6].map((dx) => <path key={dx} d={`M${40 + dx * 0.4} 16 L${40 + dx} 50`} stroke="#6E8A3E" strokeWidth="2" strokeLinecap="round" />)}
            <path d="M28 46 C 22 52 22 60 26 64 C 28 58 30 52 34 48 Z M52 46 C 58 52 58 60 54 64 C 52 58 50 52 46 48 Z" fill="#7A9A4E" />
            {/* 麻ひも */}
            <path d="M34 28 Q40 31 46 28 M34 31 Q40 34 46 31" stroke="#C9A06A" strokeWidth="1.6" fill="none" />
            <path d="M40 32 q-4 6 -6 8 M40 32 q4 6 6 8" stroke="#C9A06A" strokeWidth="1.2" fill="none" />
            {/* 花（下向き） */}
            {([[29, 66, 0.62], [51, 66, 0.62], [40, 78, 0.72]] as const).map(([x, y, s], i) => (
              <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
                {Array.from({ length: 14 }, (_, k) => <ellipse key={k} cx="0" cy="-12" rx="3.2" ry="7" fill={k % 2 ? "#F2B02A" : "#FFC84A"} stroke="#D8901A" strokeWidth="0.3" transform={`rotate(${k * 25.7})`} />)}
                <circle r="7.6" fill="#5A3418" />
                <circle r="7.6" fill="none" stroke="#3E2410" strokeDasharray="1.2 1.4" />
                <path d="M-4 -3 C -2 -5 1 -5.6 3 -5" stroke="#9A6A3A" strokeWidth="0.8" fill="none" />
              </g>
            ))}
          </>
        );
      }
      case "new-year": {
        // わらのしめ縄に、紙垂（しで）・つばき・なんてんの実
        viewBox = "0 0 100 100";
        return (
          <>
            <path d="M50 4 L50 14" stroke="#8A6A44" strokeWidth="0.8" />
            <Nail x={50} y={4} />
            <defs>
              <linearGradient id={g("straw")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F2DCA0" /><stop offset="1" stopColor="#C8A45A" /></linearGradient>
              <radialGradient id={g("cam")} cx="0.4" cy="0.3" r="0.8"><stop offset="0" stopColor="#FF6A7A" /><stop offset="1" stopColor="#B8182A" /></radialGradient>
            </defs>
            {/* しめ縄の輪 */}
            <circle cx="50" cy="40" r="22" fill="none" stroke={`url(#${g("straw")})`} strokeWidth="7" />
            <circle cx="50" cy="40" r="22" fill="none" stroke="#B08A40" strokeWidth="7" strokeDasharray="3 4" opacity="0.5" />
            {/* たれた わら */}
            {[-8, -4, 0, 4, 8].map((dx) => <path key={dx} d={`M${50 + dx} 62 L${50 + dx * 1.3} 86`} stroke="#D8B868" strokeWidth="2" strokeLinecap="round" />)}
            {/* 紙垂 */}
            {[-1, 1].map((sd) => (
              <path key={sd} d={`M${50 + sd * 14} 58 l${sd * 4} 0 l${-sd * 3} 7 l${sd * 4} 0 l${-sd * 3} 7 l${sd * 4} 0 l${-sd * 3} 7`} fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinejoin="round" />
            ))}
            {/* つばき2輪 */}
            {([[38, 22], [62, 24]] as const).map(([x, y], i) => (
              <g key={i} transform={`translate(${x} ${y})`}>
                <ellipse cx="-6" cy="5" rx="6" ry="3" fill="#2F6A3A" transform="rotate(-30 -6 5)" />
                {[0, 72, 144, 216, 288].map((r) => <path key={r} d="M0 0 C -5 -2 -6 -9 0 -10 C 6 -9 5 -2 0 0 Z" fill={`url(#${g("cam")})`} stroke="#8A101C" strokeWidth="0.4" transform={`rotate(${r})`} />)}
                <circle r="2.6" fill="#FFE07A" />
              </g>
            ))}
            {/* なんてんの実 */}
            {([[48, 16], [52, 14], [50, 19], [55, 18], [45, 19], [52, 22]] as const).map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="2.2" fill="#D8202A" /><circle cx={x - 0.7} cy={y - 0.7} r="0.6" fill="#FFFFFF" opacity="0.8" /></g>)}
            {([[44, 26, -40], [58, 28, 40]] as const).map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx="5" ry="1.8" fill="#4E8A3A" transform={`rotate(${r} ${x} ${y})`} />)}
            {/* 水引 */}
            <path d="M42 62 Q50 56 58 62 M42 64 Q50 58 58 64" stroke="#E04A3A" strokeWidth="1" fill="none" />
            <path d="M43 66 Q50 60 57 66" stroke="#E8C040" strokeWidth="1" fill="none" />
          </>
        );
      }
      case "pinecone-ornament": {
        // ひもにまつぼっくりを4つ。赤い木の実のビーズと、白い雪の粉
        viewBox = "0 0 150 80";
        const at = (t: number) => ({ x: 10 + t * 130, y: 10 + Math.sin(t * Math.PI) * 14 });
        return (
          <>
            <path d="M10 10 Q 75 38 140 10" stroke="#3A2614" strokeWidth="3" fill="none" opacity="0.1" filter={`url(#${g("wall")})`} transform="translate(2 4)" />
            <path d="M10 10 Q 75 38 140 10" stroke="#B0302A" strokeWidth="1.4" fill="none" />
            <Nail x={10} y={10} /><Nail x={140} y={10} />
            {[0.18, 0.4, 0.62, 0.84].map((t, i) => {
              const p = at(t);
              return (
                <g key={t}>
                  <path d={`M${r2(p.x)} ${r2(p.y)} L${r2(p.x)} ${r2(p.y + 10 + (i % 2) * 6)}`} stroke="#B0302A" strokeWidth="0.8" />
                  <Pinecone g={g} x={r2(p.x)} y={r2(p.y + 12 + (i % 2) * 6)} s={1.25} />
                  {/* てっぺんの雪 */}
                  <path d={`M${r2(p.x - 6)} ${r2(p.y + 14 + (i % 2) * 6)} q6 -4 12 0 q-6 2 -12 0 z`} fill="#FFFFFF" opacity="0.9" />
                </g>
              );
            })}
            {[0.07, 0.29, 0.51, 0.73, 0.95].map((t) => { const p = at(t); return <g key={t}><circle cx={r2(p.x)} cy={r2(p.y + 1)} r="2.6" fill="#D8202A" /><circle cx={r2(p.x - 0.8)} cy={r2(p.y + 0.2)} r="0.8" fill="#FFFFFF" opacity="0.8" /></g>; })}
          </>
        );
      }
      case "treasure-box": {
        // 木の標本箱：仕切りの中に、石・はね・小えだ。名前のラベルつき
        viewBox = "0 0 100 100";
        return (
          <>
            <path d="M50 4 L22 16 M50 4 L78 16" stroke="#8A6A44" strokeWidth="0.8" />
            <Nail x={50} y={4} />
            <rect x="14" y="18" width="76" height="76" rx="3" fill="#3A2614" opacity="0.14" filter={`url(#${g("wall")})`} />
            <rect x="10" y="14" width="80" height="80" rx="3" fill={`url(#${g("wood")})`} />
            <rect x="15" y="19" width="70" height="70" fill="#F6EEDC" />
            <path d="M15 42.3 H85 M15 65.6 H85 M38.3 19 V89 M61.6 19 V89" stroke="#A87A4E" strokeWidth="1.6" />
            {/* 石 */}
            {([[26.6, 31], [50, 31], [26.6, 77]] as const).map(([x, y], i) => (
              <g key={i}><ellipse cx={x} cy={y} rx="8" ry="5.4" fill={["#B9B2A6", "#C9B8A0", "#A8A49C"][i]} /><ellipse cx={x - 2.4} cy={y - 2} rx="3" ry="1.2" fill="#FFFFFF" opacity="0.6" /></g>
            ))}
            {/* はね */}
            {([[73.3, 31, -40], [50, 77, -50]] as const).map(([x, y, r], i) => (
              <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
                <path d="M0 -9 C 4 -4 4 4 1 9 L -1 9 C -4 4 -4 -4 0 -9 Z" fill="#E3EAF2" stroke="#9BB0C8" strokeWidth="0.4" />
                <path d="M0 -8 L0 10" stroke="#8C7A64" strokeWidth="0.6" />
              </g>
            ))}
            {/* 小えだ */}
            <path d="M42 56 L58 52 M50 54 L54 48" stroke={`url(#${g("twig")})`} strokeWidth="2.2" strokeLinecap="round" />
            <ellipse cx="55" cy="47" rx="2.4" ry="1.2" fill="#7CC05A" transform="rotate(-30 55 47)" />
            {/* のこりの区画：ラベル */}
            <rect x="66" y="50" width="14" height="6" rx="1" fill="#FFFFFF" stroke="#C9A06A" strokeWidth="0.5" />
            <text x="73" y="54.6" textAnchor="middle" fontSize="3" fontWeight="700" fill="#7A4A2E">たからもの</text>
            <path d="M22 52 l6 0 M22 55 l4 0" stroke="#C9B8A0" strokeWidth="1" />
            <rect x="66" y="72" width="12" height="8" rx="1" fill="#E8DCC4" />
            {/* ガラスの光 */}
            <path d="M15 19 L40 19 L15 50 Z" fill="#FFFFFF" opacity="0.3" />
            <rect x="10" y="14" width="80" height="80" rx="3" fill="none" stroke="#5E3818" strokeWidth="0.8" />
          </>
        );
      }
    }
  })();
  return <svg viewBox={viewBox} overflow="visible" className={SVG_CLASS} {...a11y}><Defs g={g} />{body}</svg>;
}
