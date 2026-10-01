"use client";

/**
 * わんこのおへやの家具の絵（SVG）。
 * 光は左上（窓のほう）から当たる前提で、上面と左をあかるく、右下をくらく塗り、
 * 布・木・陶器それぞれの質感（ぬいめ・木目・つや）を描きこむ。
 * 同じ家具を2つ置いてもグラデーションの id がぶつからないよう、useId で id を分ける。
 */
import { useId } from "react";
import type { FurnitureId } from "@/lib/room/types";

const SVG_CLASS = "pointer-events-none block h-auto w-full";

/**
 * 犬が遊んでいるあいだの家具の動き。
 * wobble ゆれる / sway 葉がゆれる / squish 乗られて沈む / clatter お皿がかたかた / on 明かりがつく /
 * inside ハウスの中からのぞく / inside-sleep ハウスの中で寝ている / nibbled クッキーを1まいもらった /
 * book 本を1さつ引き出した / empty ごはんを食べきった
 */
export type FurnitureFx = "wobble" | "sway" | "squish" | "clatter" | "on" | "inside" | "inside-sleep" | "nibbled" | "book" | "empty";

type Art = { u: string; lit: boolean; fx?: FurnitureFx };

export function FurnitureArt({ id, label, lit, fx }: { id: FurnitureId; label?: string; lit: boolean; fx?: FurnitureFx }) {
  const u = `fa${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const a11y = label ? { role: "img" as const, "aria-label": label } : {};
  const art: Art = { u, lit, fx };
  switch (id) {
    case "sofa": return <Sofa {...art} a11y={a11y} />;
    case "dog-bed": return <DogBed {...art} a11y={a11y} />;
    case "plant": return <Plant {...art} a11y={a11y} />;
    case "bookshelf": return <Bookshelf {...art} a11y={a11y} />;
    case "lamp": return <Lamp {...art} a11y={a11y} />;
    case "table": return <Table {...art} a11y={a11y} />;
    case "dog-house": return <DogHouse {...art} a11y={a11y} />;
    default: return <Bowl {...art} a11y={a11y} />;
  }
}

type P = Art & { a11y: object };

/** 床に落ちるやわらかいかげ */
function FloorShadow({ cx, cy, rx, ry, o = 0.22 }: { cx: number; cy: number; rx: number; ry: number; o?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#3A2614" opacity={o} filter="url(#fa-blur)" />;
}
function Blur() {
  return <filter id="fa-blur" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="3.2" /></filter>;
}

/** 背もたれの置きクッション（ふっくらした四角） */
const backPillow = (x0: number, x1: number) => {
  const m = (x0 + x1) / 2;
  return `M${x0 + 7} 31 Q${x0 + 1} 21 ${x0 + 15} 20 Q${m} 15 ${x1 - 15} 20 Q${x1 - 1} 21 ${x1 - 7} 31 Q${x1 + 2} 60 ${x1 - 5} 90 Q${m} 96 ${x0 + 5} 90 Q${x0 - 2} 60 ${x0 + 7} 31 Z`;
};

function Sofa({ u, a11y }: P) {
  const g = (n: string) => `${u}-${n}`;
  const seats: [number, number][] = [[40, 131], [129, 220]];
  return (
    <svg viewBox="0 0 260 150" className={SVG_CLASS} {...a11y}>
      <defs>
        <Blur />
        {/* ベルベットの毛羽（細かいざらつき） */}
        <filter id={g("fabric")} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="3" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 0 0.08  0 0 0 0.22 0" result="a" />
          <feComposite in="a" in2="SourceAlpha" operator="in" result="t" />
          <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="t" /></feMerge>
        </filter>
        <linearGradient id={g("frame")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#D98A72" /><stop offset="1" stopColor="#A85540" /></linearGradient>
        <radialGradient id={g("pillow")} cx="0.38" cy="0.3" r="0.85"><stop offset="0" stopColor="#F7BDA6" /><stop offset="0.55" stopColor="#E3907A" /><stop offset="1" stopColor="#B9604B" /></radialGradient>
        <linearGradient id={g("seatTop")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E99A83" /><stop offset="1" stopColor="#F6B9A2" /></linearGradient>
        <linearGradient id={g("seatFront")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E1907A" /><stop offset="0.7" stopColor="#C76E58" /><stop offset="1" stopColor="#A9533F" /></linearGradient>
        <linearGradient id={g("base")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#B9604B" /><stop offset="1" stopColor="#8A4030" /></linearGradient>
        <linearGradient id={g("armL")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#F2A98F" /><stop offset="0.6" stopColor="#D98069" /><stop offset="1" stopColor="#B65B46" /></linearGradient>
        <linearGradient id={g("armR")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#D47A63" /><stop offset="0.5" stopColor="#BF6650" /><stop offset="1" stopColor="#97483A" /></linearGradient>
        <radialGradient id={g("scrollL")} cx="0.35" cy="0.35" r="0.7"><stop offset="0" stopColor="#F9C3AE" /><stop offset="1" stopColor="#D27D66" /></radialGradient>
        <radialGradient id={g("scrollR")} cx="0.35" cy="0.35" r="0.7"><stop offset="0" stopColor="#E59C85" /><stop offset="1" stopColor="#B05A45" /></radialGradient>
        <linearGradient id={g("sheen")} x1="0" y1="0" x2="1" y2="0.4"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0.16" /><stop offset="0.4" stopColor="#FFFFFF" stopOpacity="0" /><stop offset="1" stopColor="#3A1008" stopOpacity="0.14" /></linearGradient>
        <linearGradient id={g("ao")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5A2418" stopOpacity="0.42" /><stop offset="1" stopColor="#5A2418" stopOpacity="0" /></linearGradient>
        <linearGradient id={g("leg")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#B07A45" /><stop offset="1" stopColor="#5E3A1E" /></linearGradient>
        <linearGradient id={g("mustard")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FCE3A0" /><stop offset="1" stopColor="#DDAE4C" /></linearGradient>
        <linearGradient id={g("cream")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFFBF2" /><stop offset="1" stopColor="#E6D8C2" /></linearGradient>
        <linearGradient id={g("throw")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#A4C6E6" /><stop offset="0.5" stopColor="#8BB2DA" /><stop offset="1" stopColor="#6E95BF" /></linearGradient>
        <pattern id={g("knit")} width="7" height="9" patternUnits="userSpaceOnUse"><path d="M0 0 l3.5 4.5 l3.5 -4.5 M0 4.5 l3.5 4.5 l3.5 -4.5" stroke="#FFFFFF" strokeOpacity="0.32" fill="none" strokeWidth="1.1" /></pattern>
      </defs>
      <FloorShadow cx={130} cy={141} rx={124} ry={8} o={0.3} />
      {/* うしろの脚（奥にあるので暗く短い） */}
      {[54, 202].map((x) => <path key={x} d={`M${x} 124 h7 l-1.5 11 h-4 z`} fill="#4A2C16" />)}

      <g filter={`url(#${g("fabric")})`}>
        {/* 背もたれのわく */}
        <path d="M22 44 C22 20 38 11 62 11 H198 C222 11 238 20 238 44 V100 H22 Z" fill={`url(#${g("frame")})`} />
        <path d="M40 14.5 C80 11 180 11 220 14.5" stroke="#FFFFFF" strokeOpacity="0.32" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M22 44 C22 20 38 11 62 11 H198 C222 11 238 20 238 44 V100 H22 Z" fill={`url(#${g("sheen")})`} />
        {/* 置きクッション（ふっくら。合わせ目のパイピング） */}
        {seats.map(([x0, x1], i) => (
          <g key={x0}>
            <path d={backPillow(x0, x1)} fill="#7A3324" opacity="0.2" transform="translate(1.5 2.5)" />
            <path d={backPillow(x0, x1)} fill={`url(#${g("pillow")})`} />
            {/* しわ */}
            <path d={`M${x0 + 18} ${40 + i * 3} q 10 8 6 22 M${x1 - 20} 36 q -8 14 -2 30`} stroke="#9C4A37" strokeOpacity="0.12" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <path d={`M${x0 + 14} 27 q ${(x1 - x0) / 2 - 10} -6 ${x1 - x0 - 28} 0`} stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="3" fill="none" strokeLinecap="round" />
          </g>
        ))}
        {/* 座面：上の面（奥ゆき）と、ふくらんだ前の面 */}
        {seats.map(([x0, x1]) => (
          <g key={`s${x0}`}>
            <path d={`M${x0} 101 Q${x0 - 2} 88 ${x0 + 9} 86 H${x1 - 9} Q${x1 + 2} 88 ${x1} 101 Z`} fill={`url(#${g("seatTop")})`} />
            <path d={`M${x0} 101 H${x1} Q${x1 + 4} 109 ${x1 - 1} 117 Q${(x0 + x1) / 2} 122 ${x0 + 1} 117 Q${x0 - 4} 109 ${x0} 101 Z`} fill={`url(#${g("seatFront")})`} />
            <path d={`M${x0 + 8} 106 Q${(x0 + x1) / 2} 104 ${x1 - 8} 106`} stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d={`M${x0 + 2} 101 H${x1 - 2}`} stroke="#FAD0BE" strokeOpacity="0.85" strokeWidth="1.6" strokeLinecap="round" />
            <path d={`M${x0 + 12} 90 H${x1 - 14}`} stroke="#FFFFFF" strokeOpacity="0.3" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        ))}
        {/* 背もたれと座面のさかい・座面どうしのすきまの影 */}
        <rect x="40" y="85" width="180" height="8" fill={`url(#${g("ao")})`} />
        <path d="M130 87 V117" stroke="#7A3324" strokeOpacity="0.35" strokeWidth="2" />
        {/* 台座 */}
        <rect x="26" y="112" width="208" height="16" rx="5" fill={`url(#${g("base")})`} />
        <rect x="26" y="112" width="208" height="5" fill="#5A2418" opacity="0.25" />
        {/* ひじかけ（くるっと巻いた形。光の当たる左は明るい） */}
        {[[4, "L"], [216, "R"]].map(([x, side]) => {
          const x0 = x as number, cx = x0 + 20;
          return (
            <g key={side as string}>
              <path d={`M${x0 + 2} 128 V76 Q${x0} 54 ${cx} 54 Q${x0 + 40} 54 ${x0 + 38} 76 V128 Z`} fill={`url(#${g(`arm${side}`)})`} />
              {/* 前の巻き */}
              <ellipse cx={cx} cy="70" rx="16.5" ry="15" fill={`url(#${g(`scroll${side}`)})`} />
              <path d={`M${cx} 70 m -9 0 a 9 8.5 0 1 1 9 8.5 a 5.5 5 0 1 1 -5.2 -5.6`} stroke="#9C4A37" strokeOpacity="0.4" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              <path d={`M${x0 + 4} 86 V126`} stroke="#FFFFFF" strokeOpacity={side === "L" ? 0.28 : 0.08} strokeWidth="3" strokeLinecap="round" />
              <path d={`M${x0 + 36} 88 V126`} stroke="#5A2418" strokeOpacity="0.18" strokeWidth="3" strokeLinecap="round" />
              {/* ひじかけと座面のあいだのかげ */}
              <path d={side === "L" ? `M${x0 + 38} 86 V116` : `M${x0 + 2} 86 V116`} stroke="#5A2418" strokeOpacity="0.3" strokeWidth="3" />
            </g>
          );
        })}
        {/* 手前のパイピング */}
        <path d="M30 127.5 H230" stroke="#E7957F" strokeOpacity="0.6" strokeWidth="1.2" />
      </g>

      {/* 前の脚（細くとがった木の脚、先に金具） */}
      {[18, 234].map((x) => (
        <g key={x}>
          <path d={`M${x - 4} 127 h8 l-2.2 13 h-3.6 z`} fill={`url(#${g("leg")})`} />
          <rect x={x - 2} y="138" width="4" height="3" rx="1" fill="#D9B062" />
        </g>
      ))}

      {/* クッション（からし色・タッセルつき） */}
      <g transform="rotate(-10 72 74)">
        <path d="M52 56 Q72 52 92 56 Q96 74 92 92 Q72 96 52 92 Q48 74 52 56 Z" fill="#8A5A20" opacity="0.25" transform="translate(2 3)" />
        <path d="M52 56 Q72 52 92 56 Q96 74 92 92 Q72 96 52 92 Q48 74 52 56 Z" fill={`url(#${g("mustard")})`} />
        <path d="M55 74 H89" stroke="#C99A3C" strokeOpacity="0.5" strokeWidth="1.2" strokeDasharray="3 3" />
        <path d="M58 60 q 14 -3 26 0" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="2" fill="none" strokeLinecap="round" />
        {[[52, 56], [92, 56], [52, 92], [92, 92]].map(([x, y]) => (
          <g key={`${x}${y}`} transform={`translate(${x} ${y}) rotate(${x! < 72 ? (y! < 74 ? -45 : 45) : (y! < 74 ? 45 : -45)})`}>
            <circle cx="0" cy="0" r="1.6" fill="#B8862E" />
            <path d={`M0 0 l${x! < 72 ? -6 : 6} -1.6 v3.2 z`} fill="#D9A84A" />
          </g>
        ))}
      </g>
      {/* クッション（クリーム・肉球の刺しゅう） */}
      <g transform="rotate(9 186 76)">
        <path d="M166 58 Q186 54 206 58 Q210 76 206 94 Q186 98 166 94 Q162 76 166 58 Z" fill="#7A3324" opacity="0.2" transform="translate(2 3)" />
        <path d="M166 58 Q186 54 206 58 Q210 76 206 94 Q186 98 166 94 Q162 76 166 58 Z" fill={`url(#${g("cream")})`} />
        <path d="M166 58 Q186 54 206 58 Q210 76 206 94 Q186 98 166 94 Q162 76 166 58 Z" fill="none" stroke="#D9806B" strokeWidth="2" />
        <g transform="translate(186 78)" fill="#D9806B">
          <ellipse cx="0" cy="3" rx="6" ry="5" />
          {[-7, -2.5, 2.5, 7].map((dx, i) => <ellipse key={dx} cx={dx} cy={i === 0 || i === 3 ? -3 : -6} rx="2.3" ry="2.9" />)}
        </g>
      </g>
      {/* ひざかけ（右のひじかけにかけたニット。ひだとフリンジ） */}
      <path d="M212 56 Q232 48 252 58 L249 112 Q233 120 216 112 Z" fill="#4E6F94" opacity="0.25" transform="translate(-2 3)" />
      <path d="M212 56 Q232 48 252 58 L249 112 Q233 120 216 112 Z" fill={`url(#${g("throw")})`} />
      <path d="M212 56 Q232 48 252 58 L249 112 Q233 120 216 112 Z" fill={`url(#${g("knit")})`} />
      <path d="M224 58 Q222 86 226 114 M238 56 Q240 86 236 116" stroke="#4E6F94" strokeOpacity="0.3" strokeWidth="2" fill="none" />
      <path d="M214 58 Q232 51 250 59" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="2" fill="none" strokeLinecap="round" />
      {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={218 + i * 7.5} y1={112 + Math.sin(i) * 2} x2={217.5 + i * 7.5} y2={121 + Math.sin(i) * 2} stroke="#8BB2DA" strokeWidth="2.2" strokeLinecap="round" />)}
    </svg>
  );
}

function DogBed({ u, a11y }: P) {
  const g = (n: string) => `${u}-${n}`;
  return (
    <svg viewBox="0 0 190 110" className={SVG_CLASS} {...a11y}>
      <defs>
        <Blur />
        <linearGradient id={g("rim")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A9C8EC" /><stop offset="0.55" stopColor="#7DA4D6" /><stop offset="1" stopColor="#5C82B8" /></linearGradient>
        <radialGradient id={g("in")} cx="0.5" cy="0.35" r="0.65"><stop offset="0" stopColor="#FFFDF7" /><stop offset="0.7" stopColor="#F2E8D6" /><stop offset="1" stopColor="#D9CBB2" /></radialGradient>
        <pattern id={g("dots")} width="14" height="10" patternUnits="userSpaceOnUse"><circle cx="4" cy="5" r="1.8" fill="#FFFFFF" opacity="0.55" /></pattern>
      </defs>
      <FloorShadow cx={95} cy={98} rx={86} ry={9} />
      <ellipse cx="95" cy="64" rx="88" ry="38" fill={`url(#${g("rim")})`} />
      <ellipse cx="95" cy="64" rx="88" ry="38" fill={`url(#${g("dots")})`} />
      <ellipse cx="95" cy="54" rx="74" ry="26" fill="#6E95CA" />
      <ellipse cx="95" cy="58" rx="64" ry="21" fill={`url(#${g("in")})`} />
      <path d="M36 52 Q95 22 154 52" fill="none" stroke="#C9DCF4" strokeWidth="5" strokeLinecap="round" />
      <path d="M22 60 Q95 18 168 60" fill="none" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2.5" />
      {/* 肉球のししゅう */}
      <g transform="translate(118 62)" fill="#E6C9A8">
        <ellipse cx="0" cy="3" rx="6" ry="4.5" />
        {[-6.5, -2.2, 2.2, 6.5].map((dx, i) => <ellipse key={dx} cx={dx} cy={i === 0 || i === 3 ? -3 : -6} rx="2" ry="2.6" />)}
      </g>
      {/* ほねのおもちゃ */}
      <g transform="translate(58 60) rotate(-14)">
        <rect x="-12" y="-3" width="24" height="6" rx="3" fill="#FFF6E4" />
        {[-12, 12].map((x) => [-3, 3].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="4" fill="#FFF6E4" />))}
        <rect x="-10" y="-1.4" width="20" height="2" rx="1" fill="#E9D9BC" />
      </g>
    </svg>
  );
}

function Plant({ u, a11y }: P) {
  const g = (n: string) => `${u}-${n}`;
  const leaves: [number, number, number, number][] = [[-48, 0, 1.05, 0], [-20, -8, 1.15, 1], [10, -10, 1.2, 0], [38, 0, 1.05, 1], [-34, 22, 0.85, 1], [28, 22, 0.85, 0], [0, 6, 0.9, 1]];
  return (
    <svg viewBox="0 0 120 190" className={SVG_CLASS} {...a11y}>
      <defs>
        <Blur />
        <linearGradient id={g("leafA")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8CCB74" /><stop offset="1" stopColor="#3F8A47" /></linearGradient>
        <linearGradient id={g("leafB")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#74B865" /><stop offset="1" stopColor="#2F7440" /></linearGradient>
        <linearGradient id={g("pot")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#F2EDE4" /><stop offset="0.45" stopColor="#FFFFFF" /><stop offset="1" stopColor="#CFC6B6" /></linearGradient>
      </defs>
      <FloorShadow cx={60} cy={182} rx={34} ry={6} />
      {leaves.map(([rot, dy, sc, k], i) => (
        <g key={i} transform={`translate(60 ${112 + dy}) rotate(${rot}) scale(${sc})`}>
          <path d="M0 0 Q-2 -30 0 -52" stroke="#4A7E3A" strokeWidth="2.4" fill="none" />
          <path d="M0 -40 C -26 -46, -30 -84, 0 -96 C 30 -84, 26 -46, 0 -40 Z" fill={`url(#${g(k ? "leafB" : "leafA")})`} />
          {/* モンステラの切れこみ */}
          <path d="M-20 -62 l10 4 M-22 -76 l12 3 M20 -62 l-10 4 M22 -76 l-12 3" stroke="#F4F8EE" strokeWidth="2.6" strokeLinecap="round" opacity="0.9" />
          <path d="M0 -42 L0 -92" stroke="#D8EFC8" strokeWidth="1.4" opacity="0.8" />
          <path d="M-14 -50 C -8 -60, -6 -78, -2 -88" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="2" fill="none" />
        </g>
      ))}
      {/* はち */}
      <path d="M30 120 L90 120 L83 178 Q60 184 37 178 Z" fill={`url(#${g("pot")})`} />
      <rect x="26" y="114" width="68" height="12" rx="5" fill="#FFFFFF" />
      <rect x="26" y="122" width="68" height="4" fill="#000" opacity="0.06" />
      <ellipse cx="60" cy="116" rx="30" ry="4" fill="#6A4A30" />
      <path d="M35 140 Q60 146 85 140" stroke="#E6A38A" strokeWidth="4" fill="none" />
      <path d="M38 152 Q60 158 82 152" stroke="#9CC4DE" strokeWidth="3" fill="none" />
      <path d="M38 126 L42 172" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Bookshelf({ u, fx, a11y }: P) {
  const g = (n: string) => `${u}-${n}`;
  const books = (y: number, list: [number, number, string][]) => list.map(([x, h, c]) => (
    <g key={`${y}-${x}`}>
      <rect x={x} y={y - h} width="11" height={h} rx="1.2" fill={c} />
      <rect x={x} y={y - h} width="3" height={h} fill="#FFFFFF" opacity="0.2" />
      <rect x={x} y={y - h + 5} width="11" height="2.4" fill="#000" opacity="0.18" />
      <rect x={x} y={y - 9} width="11" height="2.4" fill="#000" opacity="0.18" />
    </g>
  ));
  return (
    <svg viewBox="0 0 150 210" className={SVG_CLASS} {...a11y}>
      <defs>
        <Blur />
        <linearGradient id={g("wood")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#C68D57" /><stop offset="1" stopColor="#8E5A30" /></linearGradient>
        <linearGradient id={g("back")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6E4424" /><stop offset="1" stopColor="#56331A" /></linearGradient>
      </defs>
      <FloorShadow cx={78} cy={204} rx={72} ry={6} />
      {/* 天板と右の側板（奥ゆきを見せる） */}
      <path d="M5.4 13.8 L129.6 13.8 L144 4 L19.8 4 Z" fill="#DDA875" />
      <path d="M5.4 13.8 L129.6 13.8" stroke="#F2CFA2" strokeWidth="1.5" />
      <path d="M129.6 13.8 L144 4 L144 193 L129.6 201.9 Z" fill="#7E4E28" />
      <path d="M129.6 13.8 L144 4 L144 193 L129.6 201.9 Z" fill="#000" opacity="0.12" />
      <g transform="translate(0 8) scale(0.9 0.96)">
      <rect x="6" y="6" width="138" height="196" rx="6" fill={`url(#${g("wood")})`} />
      <path d="M12 20 q4 60 0 120 M136 30 q-4 70 0 150" stroke="#7A4B26" strokeOpacity="0.35" strokeWidth="1.5" fill="none" />
      <rect x="16" y="16" width="118" height="178" fill={`url(#${g("back")})`} />
      {[70, 128, 186].map((y) => (
        <g key={y}>
          <rect x="14" y={y} width="122" height="8" fill="#B07A45" />
          <rect x="14" y={y} width="122" height="2.5" fill="#E2B37E" />
          <rect x="16" y={y - 14} width="118" height="14" fill="#000" opacity="0.12" />
        </g>
      ))}
      {books(70, [[20, 40, "#D9806B"], [32, 34, "#7FA6D6"], [44, 44, "#F2D16B"], [56, 38, "#8CBF7A"], [68, 42, "#B65A7A"]])}
      {fx === "book" ? (
        // 引き出した本（手前にかたむいて、少し飛び出す）
        <g transform="rotate(-22 86 70)">
          <rect x="80" y="30" width="12" height="40" rx="1.2" fill="#B39CCC" />
          <rect x="80" y="30" width="3.5" height="40" fill="#FFFFFF" opacity="0.3" />
          <rect x="80" y="38" width="12" height="2.4" fill="#000" opacity="0.18" />
        </g>
      ) : <g transform="rotate(12 92 70)"><rect x="86" y="32" width="11" height="38" rx="1.2" fill="#C7B4D9" /></g>}
      {/* 写真立て */}
      <rect x="108" y="44" width="22" height="26" rx="2" fill="#F6EFE2" stroke="#C98F5A" strokeWidth="2.5" />
      <rect x="112" y="48" width="14" height="14" fill="#9CC4DE" />
      <circle cx="119" cy="57" r="4" fill="#FFFFFF" />
      {books(128, [[22, 36, "#8DBDE6"], [34, 30, "#F2A7B8"], [46, 40, "#E8C99A"]])}
      {/* 多肉植物 */}
      <path d="M70 128 l4 -16 h18 l4 16 z" fill="#E7DED0" />
      {[-10, -4, 2, 8].map((dx, i) => <ellipse key={dx} cx={83 + dx} cy={108 - (i % 2) * 4} rx="5" ry="9" fill={i % 2 ? "#6FAF68" : "#86C47A"} transform={`rotate(${dx * 2} ${83 + dx} 112)`} />)}
      <rect x="104" y="96" width="24" height="32" rx="12" fill="#F4E3C3" />
      <rect x="108" y="100" width="6" height="22" rx="3" fill="#FFFFFF" opacity="0.5" />
      {books(186, [[22, 40, "#F2D16B"], [34, 36, "#D9806B"], [46, 42, "#7FA6D6"], [58, 34, "#8CBF7A"], [70, 40, "#E8977F"]])}
      {/* 本を横に積んだところ */}
      {[0, 1, 2].map((i) => <rect key={i} x={94 - i * 2} y={180 - i * 7} width={36 + i * 3} height="7" rx="1.5" fill={["#B65A7A", "#7FA6D6", "#F2D16B"][i]} />)}
      <rect x="6" y="6" width="6" height="196" fill="#FFFFFF" opacity="0.14" />
      </g>
    </svg>
  );
}

function Lamp({ u, lit, a11y }: P) {
  const g = (n: string) => `${u}-${n}`;
  return (
    <svg viewBox="0 0 90 220" className={SVG_CLASS} {...a11y}>
      <defs>
        <Blur />
        <linearGradient id={g("shade")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={lit ? "#FFF0C2" : "#F6EAD2"} /><stop offset="0.5" stopColor={lit ? "#FFE19A" : "#EADBBE"} /><stop offset="1" stopColor={lit ? "#F2C86E" : "#CDBB98"} />
        </linearGradient>
        <linearGradient id={g("leg")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#B07A45" /><stop offset="1" stopColor="#7A4B26" /></linearGradient>
        <radialGradient id={g("bulb")} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#FFFBEA" /><stop offset="1" stopColor="#FFE08A" stopOpacity="0" /></radialGradient>
      </defs>
      <FloorShadow cx={45} cy={214} rx={30} ry={5} />
      {/* 三本脚 */}
      <path d="M45 70 L18 212 M45 70 L72 212 M45 70 L45 210" stroke={`url(#${g("leg")})`} strokeWidth="5" strokeLinecap="round" />
      <circle cx="45" cy="70" r="4" fill="#5E3A1E" />
      {/* かさ */}
      {lit ? <ellipse cx="45" cy="64" rx="26" ry="10" fill={`url(#${g("bulb")})`} /> : null}
      <path d="M16 64 L74 64 L64 12 L26 12 Z" fill={`url(#${g("shade")})`} />
      <path d="M26 12 L64 12" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="2" />
      <path d="M16 64 L74 64" stroke={lit ? "#E9B95A" : "#BFAA84"} strokeWidth="3" strokeLinecap="round" />
      {[30, 40, 50, 60].map((x) => <line key={x} x1={x - 2} y1="16" x2={x - 6} y2="60" stroke="#000" strokeOpacity="0.04" strokeWidth="2" />)}
      {lit ? <ellipse cx="45" cy="66" rx="22" ry="4" fill="#FFF6D0" /> : null}
    </svg>
  );
}

function Table({ u, fx, a11y }: P) {
  const g = (n: string) => `${u}-${n}`;
  return (
    <svg viewBox="0 0 200 120" className={SVG_CLASS} {...a11y}>
      <defs>
        <Blur />
        <radialGradient id={g("top")} cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#F2CB97" /><stop offset="1" stopColor="#D49E62" /></radialGradient>
        <linearGradient id={g("edge")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#C08A52" /><stop offset="1" stopColor="#8A5A30" /></linearGradient>
        <linearGradient id={g("leg")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#B07A45" /><stop offset="1" stopColor="#6E4424" /></linearGradient>
        <linearGradient id={g("cup")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#D8D2C8" /></linearGradient>
      </defs>
      <FloorShadow cx={100} cy={112} rx={78} ry={7} />
      {[[40, 52], [160, 52], [100, 60]].map(([x, y]) => <path key={x} d={`M${x! - 5} ${y} L${x! + 5} ${y} L${x! + 3} 110 L${x! - 3} 110 Z`} fill={`url(#${g("leg")})`} />)}
      <ellipse cx="100" cy="44" rx="92" ry="24" fill={`url(#${g("edge")})`} />
      <ellipse cx="100" cy="38" rx="92" ry="24" fill={`url(#${g("top")})`} />
      <path d="M30 34 q40 -14 90 -6 M50 46 q50 8 100 -4" stroke="#B9844D" strokeOpacity="0.35" strokeWidth="1.4" fill="none" />
      <ellipse cx="70" cy="30" rx="40" ry="8" fill="#FFFFFF" opacity="0.18" />
      {/* カップとお皿のクッキー */}
      <ellipse cx="78" cy="38" rx="17" ry="5" fill="#F6F1E8" />
      <path d="M68 20 L88 20 L86 37 Q78 40 70 37 Z" fill={`url(#${g("cup")})`} />
      <ellipse cx="78" cy="20" rx="10" ry="3" fill="#7A4B2A" />
      <path d="M88 24 q9 2 0 9" stroke="#D8D2C8" strokeWidth="3" fill="none" />
      <path d="M74 14 q-4 -6 0 -10 M82 14 q-4 -6 0 -10" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="124" cy="36" rx="18" ry="5.5" fill="#FFFFFF" />
      {(fx === "nibbled" ? [[116, 32], [126, 30]] : [[116, 32], [126, 30], [132, 35]]).map(([x, y]) => (
        <g key={x}><circle cx={x} cy={y} r="5" fill="#D9A36A" /><circle cx={x! - 1.5} cy={y! - 1} r="1" fill="#7A4B2A" /><circle cx={x! + 1.5} cy={y! + 1} r="0.9" fill="#7A4B2A" /></g>
      ))}
    </svg>
  );
}

function DogHouse({ u, fx, a11y }: P) {
  const g = (n: string) => `${u}-${n}`;
  return (
    <svg viewBox="0 0 200 190" className={SVG_CLASS} {...a11y}>
      <defs>
        <Blur />
        <linearGradient id={g("wall")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#F0C08A" /><stop offset="1" stopColor="#C98F5A" /></linearGradient>
        <linearGradient id={g("roofL")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E0574A" /><stop offset="1" stopColor="#B83A30" /></linearGradient>
        <linearGradient id={g("roofR")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C2453A" /><stop offset="1" stopColor="#952C24" /></linearGradient>
        <radialGradient id={g("door")} cx="0.5" cy="0.25" r="0.85"><stop offset="0" stopColor="#5A3A22" /><stop offset="1" stopColor="#24160C" /></radialGradient>
      </defs>
      <FloorShadow cx={100} cy={182} rx={86} ry={8} />
      {/* 右の側面（少し暗い） */}
      <path d="M176 72 L192 60 L192 168 L176 180 Z" fill="#B07A45" />
      <path d="M176 72 L192 60 L192 168 L176 180 Z" fill="#000" opacity="0.1" />
      <rect x="24" y="72" width="152" height="108" fill={`url(#${g("wall")})`} />
      {[86, 102, 118, 134, 150, 166].map((y, i) => <rect key={y} x="24" y={y} width="152" height="2" fill="#A86E3C" opacity={0.25 + (i % 2) * 0.1} />)}
      <rect x="24" y="72" width="152" height="16" fill="#000" opacity="0.14" />
      {/* 屋根（瓦の段） */}
      <path d="M100 10 L4 82 L18 92 L100 30 Z" fill={`url(#${g("roofL")})`} />
      <path d="M100 10 L196 82 L182 92 L100 30 Z" fill={`url(#${g("roofR")})`} />
      {[0, 1, 2, 3].map((i) => <path key={i} d={`M${100 - 22 * (i + 1)} ${26 + 16 * i} L100 ${10 + 0}`} stroke="#8A2A22" strokeOpacity="0.25" strokeWidth="1.4" />)}
      {[0, 1, 2, 3].map((i) => <path key={`r${i}`} d={`M${100 + 22 * (i + 1)} ${26 + 16 * i} L100 10`} stroke="#5E1A14" strokeOpacity="0.2" strokeWidth="1.4" />)}
      <path d="M100 10 L4 82" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="94" y="4" width="12" height="10" rx="3" fill="#952C24" />
      {/* 入り口 */}
      <path d="M68 180 L68 128 Q100 92 132 128 L132 180 Z" fill="#A86E3C" />
      <path d="M74 180 L74 130 Q100 100 126 130 L126 180 Z" fill={`url(#${g("door")})`} />
      {fx === "inside" ? (
        // 中からのぞく目と鼻（ときどきまばたき）
        <g>
          {[88, 112].map((x) => (
            <ellipse key={x} cx={x} cy="146" rx="4.2" ry="5" fill="#FFF8E8">
              <animate attributeName="ry" values="5;5;0.6;5;5" keyTimes="0;0.86;0.9;0.94;1" dur="3.2s" repeatCount="indefinite" />
            </ellipse>
          ))}
          {[88, 112].map((x) => <circle key={`p${x}`} cx={x + 0.8} cy="146.5" r="2.2" fill="#24160C" />)}
          <ellipse cx="100" cy="158" rx="5" ry="3.4" fill="#3A2416" />
          <ellipse cx="99" cy="157" rx="1.6" ry="1" fill="#FFFFFF" opacity="0.6" />
        </g>
      ) : null}
      {fx === "inside-sleep" ? (
        <g fill="#B9C0F0" fontWeight="900">
          <text x="104" y="150" fontSize="14" opacity="0.9">z<animate attributeName="opacity" values="0;1;0" dur="2.4s" repeatCount="indefinite" /></text>
          <text x="114" y="138" fontSize="18" opacity="0.9">Z<animate attributeName="opacity" values="0;0;1;0" dur="2.4s" repeatCount="indefinite" /></text>
        </g>
      ) : null}
      {/* 名ふだ */}
      <rect x="70" y="52" width="60" height="20" rx="5" fill="#FFF6E4" stroke="#A86E3C" strokeWidth="2" />
      <text x="100" y="66.5" textAnchor="middle" fontSize="12" fontWeight="900" fill="#7A4A2E">わんこ</text>
      {/* かざりのほね */}
      <g transform="translate(150 108) rotate(-18)">
        <rect x="-11" y="-3" width="22" height="6" rx="3" fill="#FFFBF0" />
        {[-11, 11].map((x) => [-3, 3].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="3.8" fill="#FFFBF0" />))}
      </g>
      <rect x="24" y="72" width="6" height="108" fill="#FFFFFF" opacity="0.18" />
    </svg>
  );
}

function Bowl({ u, fx, a11y }: P) {
  const g = (n: string) => `${u}-${n}`;
  return (
    <svg viewBox="0 0 100 58" className={SVG_CLASS} {...a11y}>
      <defs>
        <Blur />
        <linearGradient id={g("body")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#9CC0EA" /><stop offset="0.4" stopColor="#C6DCF5" /><stop offset="1" stopColor="#5F86BE" /></linearGradient>
        <radialGradient id={g("food")} cx="0.4" cy="0.3" r="0.8"><stop offset="0" stopColor="#C98A4E" /><stop offset="1" stopColor="#8A5426" /></radialGradient>
      </defs>
      <FloorShadow cx={50} cy={52} rx={42} ry={5} />
      <path d="M8 20 L92 20 L80 50 Q50 56 20 50 Z" fill={`url(#${g("body")})`} />
      <ellipse cx="50" cy="20" rx="42" ry="9" fill="#DCEBFA" />
      <ellipse cx="50" cy="20" rx="35" ry="6.5" fill="#4E6E9C" />
      {fx === "empty" ? (
        // 食べきったお皿（底と、のこったかけらが少し）
        <g>
          <ellipse cx="50" cy="21" rx="31" ry="4.6" fill="#C6DCF5" />
          <ellipse cx="44" cy="21" rx="2" ry="1.4" fill="#A0602C" />
          <ellipse cx="57" cy="22" rx="1.6" ry="1.1" fill="#B5753B" />
        </g>
      ) : <ellipse cx="50" cy="19" rx="33" ry="6" fill={`url(#${g("food")})`} />}
      {(fx === "empty" ? [] : [[36, 17], [44, 15], [52, 17], [60, 15], [66, 19], [40, 21], [56, 21], [48, 19]]).map(([x, y], i) => (
        <g key={i}><ellipse cx={x} cy={y} rx="4" ry="3" fill={i % 2 ? "#B5753B" : "#A0602C"} /><ellipse cx={x! - 1} cy={y! - 1} rx="1.4" ry="0.9" fill="#E9B37A" opacity="0.8" /></g>
      ))}
      {/* 肉球のマーク */}
      <g transform="translate(50 37)" fill="#FFFFFF" opacity="0.9">
        <ellipse cx="0" cy="2.5" rx="5" ry="3.8" />
        {[-5.4, -1.8, 1.8, 5.4].map((dx, i) => <ellipse key={dx} cx={dx} cy={i === 0 || i === 3 ? -2.4 : -5} rx="1.6" ry="2.1" />)}
      </g>
      <path d="M14 24 Q18 38 24 48" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
