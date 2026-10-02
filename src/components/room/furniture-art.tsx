"use client";

/**
 * わんこのおへやの家具の絵（SVG）。
 * 光は左上（窓のほう）から当たる前提で、上面と左をあかるく、右下をくらく塗り、
 * 布・木・陶器それぞれの質感（ぬいめ・木目・つや）を描きこむ。
 * 同じ家具を2つ置いてもグラデーションの id がぶつからないよう、useId で id を分ける。
 */
import { useContext, useId } from "react";
import type { FurnitureId } from "@/lib/room/types";
import { PlantContext, WhiteboardDoodles } from "./room-gimmicks";

const SVG_CLASS = "pointer-events-none block h-auto w-full";

/**
 * 犬が遊んでいるあいだの家具の動き。
 * wobble ゆれる / sway 葉がゆれる / squish 乗られて沈む / clatter お皿がかたかた / on 明かりがつく /
 * inside ハウスの中からのぞく / inside-sleep ハウスの中で寝ている / nibbled クッキーを1まいもらった /
 * book 本を1さつ引き出した / empty ごはんを食べきった / drawing ホワイトボードにらくがきしている
 */
export type FurnitureFx = "wobble" | "sway" | "squish" | "clatter" | "on" | "inside" | "inside-sleep" | "nibbled" | "book" | "empty" | "drawing";

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
    case "whiteboard": return <Whiteboard {...art} a11y={a11y} />;
    case "kotatsu": return <Kotatsu {...art} a11y={a11y} />;
    case "fishbowl": return <Fishbowl {...art} a11y={a11y} />;
    case "tv": return <Tv {...art} a11y={a11y} />;
    case "piano": return <Piano {...art} a11y={a11y} />;
    case "rocking-chair": return <RockingChair {...art} a11y={a11y} />;
    case "toybox": return <Toybox {...art} a11y={a11y} />;
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
  // 水やりの育ちぐあい（つぼみ → 花 → 満開。あげないと しおれる）
  const care = useContext(PlantContext);
  const wilted = care?.wilted ?? false, stage = wilted ? 0 : care?.stage ?? 0;
  const droop = wilted ? 1.35 : 1;
  const leaves: [number, number, number, number][] = [[-48, 0, 1.05, 0], [-20, -8, 1.15, 1], [10, -10, 1.2, 0], [38, 0, 1.05, 1], [-34, 22, 0.85, 1], [28, 22, 0.85, 0], [0, 6, 0.9, 1]];
  const flowers: [number, number][] = [[46, 30], [76, 22], [60, 12], [32, 48], [88, 44]];
  return (
    <svg viewBox="0 0 120 190" className={SVG_CLASS} style={wilted ? { filter: "saturate(.45) sepia(.35) brightness(.95)" } : undefined} {...a11y}>
      <defs>
        <Blur />
        <linearGradient id={g("leafA")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8CCB74" /><stop offset="1" stopColor="#3F8A47" /></linearGradient>
        <linearGradient id={g("leafB")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#74B865" /><stop offset="1" stopColor="#2F7440" /></linearGradient>
        <linearGradient id={g("pot")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#F2EDE4" /><stop offset="0.45" stopColor="#FFFFFF" /><stop offset="1" stopColor="#CFC6B6" /></linearGradient>
      </defs>
      <FloorShadow cx={60} cy={182} rx={34} ry={6} />
      {leaves.map(([rot, dy, sc, k], i) => (
        <g key={i} transform={`translate(60 ${112 + dy}) rotate(${rot * droop + (wilted ? (rot < 0 ? -18 : 18) : 0)}) scale(${sc * (wilted ? 0.92 : 1)})`}>
          <path d="M0 0 Q-2 -30 0 -52" stroke="#4A7E3A" strokeWidth="2.4" fill="none" />
          <path d="M0 -40 C -26 -46, -30 -84, 0 -96 C 30 -84, 26 -46, 0 -40 Z" fill={`url(#${g(k ? "leafB" : "leafA")})`} />
          {/* モンステラの切れこみ */}
          <path d="M-20 -62 l10 4 M-22 -76 l12 3 M20 -62 l-10 4 M22 -76 l-12 3" stroke="#F4F8EE" strokeWidth="2.6" strokeLinecap="round" opacity="0.9" />
          <path d="M0 -42 L0 -92" stroke="#D8EFC8" strokeWidth="1.4" opacity="0.8" />
          <path d="M-14 -50 C -8 -60, -6 -78, -2 -88" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="2" fill="none" />
        </g>
      ))}
      {/* つぼみ・花（水やりの日数で ふえる） */}
      {stage > 0 ? flowers.slice(0, stage === 1 ? 3 : 5).map(([fx, fy], i) => (
        stage === 1 ? (
          <g key={i}><path d={`M${fx} ${fy + 10} q-1 -6 0 -10`} stroke="#4A7E3A" strokeWidth="1.6" fill="none" /><ellipse cx={fx} cy={fy} rx="3.6" ry="5" fill="#F7A8C0" stroke="#D97894" strokeWidth="0.8" /></g>
        ) : (
          <g key={i} transform={`translate(${fx} ${fy}) scale(${stage === 3 ? 1.15 : 0.85})`}>
            {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-5.5" rx="3.6" ry="5.4" fill={i % 2 ? "#FFD6E2" : "#FFC1D3"} stroke="#E68AA6" strokeWidth="0.6" transform={`rotate(${a})`} />)}
            <circle r="2.8" fill="#FFD25A" />
          </g>
        )
      )) : null}
      {/* しおれた葉が、はちのまわりに落ちている */}
      {wilted ? <g fill="#B49A5E"><ellipse cx="22" cy="180" rx="7" ry="2.4" transform="rotate(-12 22 180)" /><ellipse cx="98" cy="181" rx="6" ry="2.2" transform="rotate(10 98 181)" /></g> : null}
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

/** キャスターつきのホワイトボード（アルミのわく・ペン置き・脚）。面には、わんこのらくがき */
function Whiteboard({ u, fx, a11y }: P) {
  const g = (n: string) => `${u}-${n}`;
  const leg = (x0: number, x1: number, back = false) => (
    <g opacity={back ? 0.75 : 1}>
      <path d={`M${x0 - 2.6} 116 L${x0 + 2.6} 116 L${x1 + 2.4} 188 L${x1 - 2.4} 188 Z`} fill={`url(#${g("alu")})`} />
      <path d={`M${x0 - 1.2} 116 L${x1 - 1.1} 188`} stroke="#FFFFFF" strokeWidth="0.9" opacity="0.8" />
      {/* キャスター */}
      <rect x={x1 - 6} y="186" width="12" height="4" rx="1.5" fill="#4A4F57" />
      <circle cx={x1} cy="193" r="4.4" fill="#2A2D33" />
      <circle cx={x1 - 1.2} cy="191.8" r="1.4" fill="#8A909A" />
    </g>
  );
  return (
    <svg viewBox="0 0 160 200" className={SVG_CLASS} {...a11y}>
      <defs>
        <Blur />
        <linearGradient id={g("alu")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#E8ECF0" /><stop offset="0.5" stopColor="#C2C8D0" /><stop offset="1" stopColor="#8E959F" /></linearGradient>
        <linearGradient id={g("frame")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FBFCFD" /><stop offset="0.45" stopColor="#CDD3DA" /><stop offset="1" stopColor="#959CA6" /></linearGradient>
        <linearGradient id={g("face")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#EEF1F4" /></linearGradient>
      </defs>
      <FloorShadow cx={80} cy={194} rx={70} ry={6} o={0.2} />
      {/* うしろの脚（少し奥） */}
      {leg(44, 50, true)}{leg(116, 110, true)}
      {/* 横の補強の棒 */}
      <rect x="28" y="158" width="104" height="4" rx="2" fill={`url(#${g("alu")})`} />
      {/* 前の脚 */}
      {leg(26, 18)}{leg(134, 142)}
      {/* ボードの厚み（上のはし）と、わく */}
      <path d="M8 8 L152 8 L148 4 L12 4 Z" fill="#B8BEC7" />
      <rect x="6" y="7" width="148" height="110" rx="4" fill={`url(#${g("frame")})`} />
      <rect x="12" y="13" width="136" height="98" rx="1.5" fill={`url(#${g("face")})`} />
      <rect x="12" y="13" width="136" height="98" rx="1.5" fill="none" stroke="#7E858F" strokeWidth="0.8" />
      {/* うすく消しのこしたあと */}
      <path d="M30 40 q20 -6 40 2 M96 86 q16 4 30 -2" stroke="#9AA6B4" strokeOpacity="0.12" strokeWidth="5" strokeLinecap="round" fill="none" />
      <WhiteboardDoodles x={18} y={17} w={124} h={90} drawing={fx === "drawing"} />
      {/* つや（ななめの映りこみ） */}
      <path d="M40 13 L66 13 L36 111 L10 111 Z" fill="#FFFFFF" opacity="0.28" />
      {/* すみの樹脂キャップ */}
      {[[6, 7], [154, 7], [154, 117], [6, 117]].map(([x, y], i) => <rect key={i} x={x! - 4} y={y! - 4} width="8" height="8" rx="2.5" fill="#474C54" />)}
      {/* ペン置きと、マーカー・イレーサー */}
      <rect x="22" y="116" width="116" height="6" rx="2" fill={`url(#${g("alu")})`} />
      <rect x="22" y="116" width="116" height="1.6" fill="#FFFFFF" opacity="0.8" />
      {fx === "drawing" ? null : <g><rect x="36" y="111" width="24" height="5" rx="2.5" fill="#F4F6F8" stroke="#9AA1AB" strokeWidth="0.5" /><rect x="34" y="111" width="6" height="5" rx="2" fill="#2F6FC2" /></g>}
      <g><rect x="64" y="111" width="22" height="5" rx="2.5" fill="#F4F6F8" stroke="#9AA1AB" strokeWidth="0.5" /><rect x="62" y="111" width="6" height="5" rx="2" fill="#D9402E" /></g>
      <g><rect x="104" y="109" width="26" height="7" rx="1.5" fill="#33373E" /><rect x="104" y="114" width="26" height="2.4" fill="#E6DCC8" /></g>
    </svg>
  );
}

/** 布のけばだち（細かいざらつき）。g は id の頭 */
function FabricFilter({ id, tone = "0.25 0 0 0 0  0 0.12 0 0 0  0 0 0.08 0 0", alpha = 0.2 }: { id: string; tone?: string; alpha?: number }) {
  return (
    <filter id={id} x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="2" seed="7" result="n" />
      <feColorMatrix in="n" type="matrix" values={`${tone}  0 0 0 ${alpha} 0`} result="a" />
      <feComposite in="a" in2="SourceAlpha" operator="in" result="t" />
      <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="t" /></feMerge>
    </filter>
  );
}
/** 木目（横にのばしたノイズ）。形の上に重ねる */
function GrainFilter({ id, freq = "0.012 0.32", alpha = 0.32 }: { id: string; freq?: string; alpha?: number }) {
  return (
    <filter id={id} x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves="3" seed="11" result="n" />
      <feColorMatrix in="n" type="matrix" values={`0 0 0 0 0.24  0 0 0 0 0.12  0 0 0 0 0.04  0 0 0 ${alpha * 3} ${-alpha * 1.2}`} result="a" />
      <feComposite in="a" in2="SourceAlpha" operator="in" result="t" />
      <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="t" /></feMerge>
    </filter>
  );
}

/**
 * こたつ：けやき色の天板（上の面と厚み・木目・つや）と、ふっくらしたチェックのこたつ布団（たれ・ひだ・ふさ）。
 * 天板には、編みかごのみかん・湯気の立つ湯のみ・読みかけの本。
 */
function Kotatsu({ u, a11y }: P) {
  const g = (n: string) => `${u}-${n}`;
  return (
    <svg viewBox="0 0 240 158" className={SVG_CLASS} {...a11y}>
      <defs>
        <Blur />
        <FabricFilter id={g("cloth")} />
        <GrainFilter id={g("grain")} />
        <linearGradient id={g("futon")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E98A62" /><stop offset="0.6" stopColor="#D46A45" /><stop offset="1" stopColor="#B4512F" /></linearGradient>
        <linearGradient id={g("fold")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#7A2A14" stopOpacity="0" /><stop offset="0.5" stopColor="#7A2A14" stopOpacity="0.28" /><stop offset="1" stopColor="#7A2A14" stopOpacity="0" /></linearGradient>
        <linearGradient id={g("foldHi")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0" /><stop offset="0.5" stopColor="#FFE9D8" stopOpacity="0.32" /><stop offset="1" stopColor="#FFFFFF" stopOpacity="0" /></linearGradient>
        <pattern id={g("tartan")} width="26" height="26" patternUnits="userSpaceOnUse">
          <rect width="26" height="26" fill="none" />
          <rect x="0" y="9" width="26" height="8" fill="#8A2E1A" opacity="0.22" />
          <rect x="9" y="0" width="8" height="26" fill="#8A2E1A" opacity="0.22" />
          <path d="M0 3 H26 M3 0 V26" stroke="#FFE6CC" strokeOpacity="0.55" strokeWidth="1.2" />
          <path d="M0 22 H26 M22 0 V26" stroke="#F6C04A" strokeOpacity="0.5" strokeWidth="1" />
        </pattern>
        <linearGradient id={g("topFace")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E8B47C" /><stop offset="0.55" stopColor="#D49A60" /><stop offset="1" stopColor="#B87C45" /></linearGradient>
        <linearGradient id={g("topEdge")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#B57A42" /><stop offset="1" stopColor="#7E4C24" /></linearGradient>
        <linearGradient id={g("gloss")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0" /><stop offset="0.35" stopColor="#FFFFFF" stopOpacity="0.35" /><stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" /></linearGradient>
        <linearGradient id={g("ao")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4A1A0A" stopOpacity="0.45" /><stop offset="1" stopColor="#4A1A0A" stopOpacity="0" /></linearGradient>
        <radialGradient id={g("mikan")} cx="0.35" cy="0.3" r="0.75"><stop offset="0" stopColor="#FFD18A" /><stop offset="0.45" stopColor="#F79A2C" /><stop offset="1" stopColor="#D8701A" /></radialGradient>
        <linearGradient id={g("basket")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#D8A866" /><stop offset="1" stopColor="#9E6C34" /></linearGradient>
        <linearGradient id={g("cup")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#9DBFA4" /><stop offset="0.5" stopColor="#7FA38A" /><stop offset="1" stopColor="#5C8068" /></linearGradient>
        {/* こたつの中のヒーターが、すそから床にもれる光 */}
        <radialGradient id={g("heat")} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#FF9A4A" stopOpacity="0.55" /><stop offset="0.6" stopColor="#FFB070" stopOpacity="0.18" /><stop offset="1" stopColor="#FFB070" stopOpacity="0" /></radialGradient>
        {/* 布団のたれ：上は天板の下で暗く、まんなかはふくらみで明るく、すそはまた暗く */}
        <linearGradient id={g("drape")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3A1206" stopOpacity="0.38" /><stop offset="0.22" stopColor="#3A1206" stopOpacity="0" /><stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.08" /><stop offset="1" stopColor="#3A1206" stopOpacity="0.22" /></linearGradient>
        {/* 左上からの光（左は明るく、右は暗く） */}
        <linearGradient id={g("side")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0.12" /><stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" /><stop offset="1" stopColor="#3A1206" stopOpacity="0.22" /></linearGradient>
        <radialGradient id={g("puff")} cx="0.5" cy="0.45" r="0.55"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0.16" /><stop offset="1" stopColor="#FFFFFF" stopOpacity="0" /></radialGradient>
        <radialGradient id={g("refl")} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#F79A2C" stopOpacity="0.35" /><stop offset="1" stopColor="#F79A2C" stopOpacity="0" /></radialGradient>
      </defs>
      <FloorShadow cx={120} cy={150} rx={116} ry={8} o={0.28} />
      <ellipse cx="120" cy="146" rx="104" ry="11" fill={`url(#${g("heat")})`} />
      {/* こたつ布団：うしろのたれ（奥）と、手前に広がるたれ */}
      <g filter={`url(#${g("cloth")})`}>
        <path d="M30 52 Q120 44 210 52 L214 64 Q120 58 26 64 Z" fill="#A9472A" />
        <path d="M24 60 Q120 52 216 60 Q232 92 230 128 Q226 136 214 134 Q206 142 192 136 Q182 146 166 138 Q150 148 134 140 Q120 148 106 140 Q90 148 74 138 Q58 146 48 136 Q34 142 26 134 Q14 136 10 128 Q8 92 24 60 Z" fill={`url(#${g("futon")})`} />
        <path d="M24 60 Q120 52 216 60 Q232 92 230 128 Q226 136 214 134 Q206 142 192 136 Q182 146 166 138 Q150 148 134 140 Q120 148 106 140 Q90 148 74 138 Q58 146 48 136 Q34 142 26 134 Q14 136 10 128 Q8 92 24 60 Z" fill={`url(#${g("tartan")})`} />
        {/* ふくらみ（ひだのあいだが ふっくら） */}
        {([[56, 100], [96, 102], [138, 102], [178, 100]] as const).map(([x, y], i) => <ellipse key={`p${i}`} cx={x} cy={y} rx="20" ry="34" fill={`url(#${g("puff")})`} />)}
        <path d="M24 60 Q120 52 216 60 Q232 92 230 128 Q226 136 214 134 Q206 142 192 136 Q182 146 166 138 Q150 148 134 140 Q120 148 106 140 Q90 148 74 138 Q58 146 48 136 Q34 142 26 134 Q14 136 10 128 Q8 92 24 60 Z" fill={`url(#${g("drape")})`} />
        <path d="M24 60 Q120 52 216 60 Q232 92 230 128 Q226 136 214 134 Q206 142 192 136 Q182 146 166 138 Q150 148 134 140 Q120 148 106 140 Q90 148 74 138 Q58 146 48 136 Q34 142 26 134 Q14 136 10 128 Q8 92 24 60 Z" fill={`url(#${g("side")})`} />
        {/* ひだ（暗いみぞと、ふくらみの光） */}
        {([[40, 18], [74, 14], [118, 16], [160, 14], [196, 18]] as const).map(([x, w], i) => (
          <g key={i}>
            <path d={`M${x} 66 Q${x - 2} 100 ${x + (i % 2 ? 4 : -4)} 140`} stroke={`url(#${g("fold")})`} strokeWidth={w} fill="none" />
            <path d={`M${x + w * 0.9} 68 Q${x + w * 0.9 - 1} 100 ${x + w * 0.9 + (i % 2 ? 3 : -3)} 136`} stroke={`url(#${g("foldHi")})`} strokeWidth={w * 0.7} fill="none" />
          </g>
        ))}
        {/* すその波のふくらみに当たる光 */}
        <path d="M14 126 Q16 132 26 131 M38 136 Q46 140 56 136 M80 138 Q92 143 104 138 M136 138 Q148 143 160 137 M184 134 Q194 138 206 133 M216 130 Q224 132 228 126" stroke="#FFD6BC" strokeOpacity="0.55" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        {/* すそのパイピングと、角のふさ */}
        <path d="M10 128 Q14 136 26 134 Q34 142 48 136 Q58 146 74 138 Q90 148 106 140 Q120 148 134 140 Q150 148 166 138 Q182 146 192 136 Q206 142 214 134 Q226 136 230 128" stroke="#8E3A20" strokeWidth="2.4" fill="none" />
        {([[12, 128], [228, 128]] as const).map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="4.6" fill="#F6C04A" /><path d={`M${x - 3} ${y + 3} l-1 8 M${x} ${y + 4} v8 M${x + 3} ${y + 3} l1 8`} stroke="#E0A62E" strokeWidth="1.4" strokeLinecap="round" /></g>)}
      </g>
      {/* 天板のかげ（布団に落ちる） */}
      <path d="M22 62 Q120 54 218 62 L218 76 Q120 70 22 76 Z" fill={`url(#${g("ao")})`} />
      {/* 天板：厚み → 上の面 → 木目 → つや */}
      <path d="M14 47 Q12 46 14 45 L226 45 Q228 46 226 47 L222 58 Q221 60 218 60.4 Q120 64 22 60.4 Q19 60 18 58 Z" fill={`url(#${g("topEdge")})`} filter={`url(#${g("grain")})`} />
      <path d="M18 58 Q120 62 222 58" stroke="#4E2A10" strokeOpacity="0.5" strokeWidth="1.2" fill="none" />
      <path d="M40 22 Q38 22 37 23 L13 44 Q12 46 15 46 L225 46 Q228 46 227 44 L203 23 Q202 22 200 22 Z" fill={`url(#${g("topFace")})`} filter={`url(#${g("grain")})`} />
      <path d="M40 22 Q38 22 37 23 L13 44 Q12 46 15 46 L225 46 Q228 46 227 44 L203 23 Q202 22 200 22 Z" fill={`url(#${g("gloss")})`} />
      {/* 天板にうつる、みかんの色 */}
      <ellipse cx="86" cy="42" rx="26" ry="3" fill={`url(#${g("refl")})`} />
      <path d="M15 46 L225 46" stroke="#FBDDB2" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M40 22.6 L200 22.6" stroke="#F8DCB4" strokeWidth="1.2" opacity="0.9" />
      {/* 読みかけの本 */}
      <g transform="translate(150 30) rotate(-8)">
        <path d="M0 6 L30 0 L36 9 L6 15 Z" fill="#6E8FC4" />
        <path d="M0 6 L6 15 L6 18 L0 9 Z" fill="#4E6E9E" />
        <path d="M6 15 L36 9 L36 12 L6 18 Z" fill="#F4EFE4" />
        <path d="M8 13 L32 8" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="1" />
      </g>
      {/* 編みかごと、みかん */}
      <ellipse cx="86" cy="38" rx="30" ry="7.5" fill="#6E4A22" opacity="0.35" />
      <path d="M56 32 Q86 44 116 32 L112 40 Q86 50 60 40 Z" fill={`url(#${g("basket")})`} />
      {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${60 + i * 6.4} ${34 + Math.sin(i) * 0.6} q2 4 0 8`} stroke="#8A5A28" strokeWidth="1" opacity="0.6" fill="none" />)}
      {([[70, 27, 8.5], [86, 24, 9], [102, 28, 8.5], [78, 16, 8], [95, 15, 8]] as const).map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r} fill={`url(#${g("mikan")})`} />
          {Array.from({ length: 5 }, (_, k) => <circle key={k} cx={x! - 3 + ((k * 7) % 7)} cy={y! - 2 + ((k * 5) % 6)} r="0.6" fill="#C8601A" opacity="0.5" />)}
          <ellipse cx={x! - r! * 0.35} cy={y! - r! * 0.4} rx={r! * 0.32} ry={r! * 0.2} fill="#FFFFFF" opacity="0.5" />
          {i === 4 ? <path d={`M${x} ${y! - r!} q3 -5 8 -4 q-3 4 -8 4 z`} fill="#5E9A4A" /> : <circle cx={x} cy={y! - r! + 1} r="1.2" fill="#6A8A3A" />}
        </g>
      ))}
      {/* 湯のみと湯気 */}
      <ellipse cx="132" cy="34" rx="9" ry="2.6" fill="#5A3A1A" opacity="0.3" />
      <path d="M123 18 L141 18 L139 33 Q132 36 125 33 Z" fill={`url(#${g("cup")})`} />
      <ellipse cx="132" cy="18" rx="9" ry="2.6" fill="#4E6E56" />
      <ellipse cx="132" cy="18.6" rx="7.2" ry="1.8" fill="#9DBE6A" />
      <path d="M125 22 Q126 28 127 32" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="1.6" />
      <path d="M129 13 q-3 -4 0 -8 q3 -4 0 -8 M135 13 q-3 -4 0 -8" stroke="#FFFFFF" strokeOpacity="0.75" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 金魚ばち：ふちが波うつガラスの鉢（厚みのあるふち・映りこみ・水面のゆらぎ）。
 * 中に琉金2ひき（ひれは半透明）、水草、色とりどりの小石、泡。木のスツールの上に置く。
 */
function Fishbowl({ u, a11y }: P) {
  const g = (n: string) => `${u}-${n}`;
  const fish = (x: number, y: number, s: number, flip: boolean, hue: [string, string]) => (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      {/* 尾びれ（半透明・すじ） */}
      <path d="M-8 0 C-16 -10 -26 -12 -28 -4 C-24 -1 -24 2 -28 6 C-26 13 -16 10 -8 2 Z" fill={hue[0]} opacity="0.55" />
      <path d="M-10 0 L-26 -6 M-10 1 L-26 2 M-10 2 L-25 9" stroke={hue[1]} strokeOpacity="0.5" strokeWidth="0.7" />
      {/* からだ */}
      <ellipse cx="0" cy="0" rx="11" ry="8" fill={`url(#${g(flip ? "fishB" : "fishA")})`} />
      {/* うろこ */}
      {([[-3, -2], [1, -3], [-1, 1], [3, 0], [-5, 2]] as const).map(([a, b], i) => <path key={i} d={`M${a} ${b} q1.6 1.6 0 3.2`} stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="0.6" fill="none" />)}
      {/* 背びれ・胸びれ */}
      <path d="M-4 -7 Q0 -14 6 -7 Z" fill={hue[0]} opacity="0.6" />
      <path d="M2 4 Q4 10 0 11 Q-1 7 2 4 Z" fill={hue[0]} opacity="0.55" />
      {/* 目 */}
      <circle cx="6.5" cy="-1.6" r="2" fill="#FFFFFF" /><circle cx="7" cy="-1.6" r="1.2" fill="#1A0F08" /><circle cx="7.4" cy="-2.1" r="0.45" fill="#FFFFFF" />
      <path d="M10.4 1.2 q-1 1 -2 0.4" stroke="#7A2A10" strokeWidth="0.6" fill="none" />
    </g>
  );
  return (
    <svg viewBox="0 0 110 168" className={SVG_CLASS} {...a11y}>
      <defs>
        <Blur />
        <GrainFilter id={g("grain")} freq="0.02 0.4" />
        <radialGradient id={g("glass")} cx="0.35" cy="0.3" r="0.75"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0.05" /><stop offset="0.8" stopColor="#DDF2FB" stopOpacity="0.25" /><stop offset="1" stopColor="#A8D8EC" stopOpacity="0.55" /></radialGradient>
        <linearGradient id={g("water")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#BFE6F6" /><stop offset="0.6" stopColor="#7EC2E2" /><stop offset="1" stopColor="#5AA4C8" /></linearGradient>
        <radialGradient id={g("fishA")} cx="0.6" cy="0.35" r="0.8"><stop offset="0" stopColor="#FFB07A" /><stop offset="0.5" stopColor="#F2622E" /><stop offset="1" stopColor="#C23A16" /></radialGradient>
        <radialGradient id={g("fishB")} cx="0.6" cy="0.35" r="0.8"><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.45" stopColor="#FFD2B8" /><stop offset="1" stopColor="#F2622E" /></radialGradient>
        <linearGradient id={g("leaf")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8ED07A" /><stop offset="1" stopColor="#2F7A40" /></linearGradient>
        <linearGradient id={g("stool")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#D7A06A" /><stop offset="1" stopColor="#8E5A30" /></linearGradient>
        <linearGradient id={g("stoolTop")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E9BA86" /><stop offset="1" stopColor="#C88C54" /></linearGradient>
        <radialGradient id={g("caustic")} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0.5" /><stop offset="1" stopColor="#FFFFFF" stopOpacity="0" /></radialGradient>
        {/* 水のふちほど青く濃い（ガラスの厚みと屈折） */}
        <radialGradient id={g("edge")} cx="0.5" cy="0.45" r="0.55"><stop offset="0.7" stopColor="#2E7EA8" stopOpacity="0" /><stop offset="1" stopColor="#2E7EA8" stopOpacity="0.32" /></radialGradient>
        <linearGradient id={g("stone")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E6E0D4" /><stop offset="1" stopColor="#9C9486" /></linearGradient>
        <clipPath id={g("inside")}><path d="M30 34 Q14 40 10 68 Q8 98 30 112 Q55 124 80 112 Q102 98 100 68 Q96 40 80 34 Z" /></clipPath>
      </defs>
      <FloorShadow cx={55} cy={162} rx={36} ry={5} />
      {/* 木のスツール */}
      <path d="M26 122 L22 160 M84 122 L88 160" stroke={`url(#${g("stool")})`} strokeWidth="6" strokeLinecap="round" />
      <path d="M44 124 L42 158 M66 124 L68 158" stroke="#7A4B26" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M24 144 H86" stroke="#8E5A30" strokeWidth="3.4" strokeLinecap="round" />
      <ellipse cx="55" cy="122" rx="38" ry="8" fill="#9E6634" filter={`url(#${g("grain")})`} />
      <ellipse cx="55" cy="119" rx="38" ry="8" fill={`url(#${g("stoolTop")})`} filter={`url(#${g("grain")})`} />
      <path d="M22 117 Q55 110 88 117" stroke="#FBE0B8" strokeWidth="1.2" fill="none" opacity="0.8" />
      {/* 鉢の影と、鉢を通った青い光（スツールの上） */}
      <ellipse cx="57" cy="119" rx="26" ry="4.4" fill="#4A2A10" opacity="0.28" />
      <ellipse cx="66" cy="121" rx="16" ry="2.8" fill="#9ED8F2" opacity="0.45" />
      {/* 水と中のもの */}
      <g clipPath={`url(#${g("inside")})`}>
        <rect x="0" y="48" width="110" height="80" fill={`url(#${g("water")})`} />
        {/* 水面のゆらぎ */}
        <path d="M8 50 Q22 46 36 50 T64 50 T92 50 T120 50" stroke="#FFFFFF" strokeWidth="1.6" fill="none" opacity="0.85" />
        <path d="M8 53 Q24 50 40 53 T72 53 T104 53" stroke="#E6F7FF" strokeWidth="1" fill="none" opacity="0.6" />
        {/* 底の光のゆらめき */}
        {([[34, 98, 14], [70, 92, 12], [52, 80, 10]] as const).map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx={r} ry={r! * 0.4} fill={`url(#${g("caustic")})`} />)}
        {/* 小石 */}
        {([[22, 110, "#E8C9A0"], [32, 112, "#9DB8D0"], [42, 110, "#F2D7B8"], [52, 113, "#C9B4A2"], [62, 110, "#E8A0A0"], [72, 112, "#B0C89A"], [82, 110, "#E8C9A0"], [28, 106, "#F6E6CC"], [48, 107, "#D8C0E0"], [68, 107, "#9DB8D0"], [86, 106, "#F2D7B8"]] as const).map(([x, y, c], i) => (
          <g key={i}><ellipse cx={x as number} cy={y as number} rx="5.2" ry="3.4" fill={c as string} /><ellipse cx={(x as number) - 1.4} cy={(y as number) - 1.2} rx="1.8" ry="1" fill="#FFFFFF" opacity="0.6" /></g>
        ))}
        {/* 小さなお城の置きもの */}
        <g transform="translate(22 86)">
          <path d="M0 26 V8 h4 v-4 h3 v4 h4 v-4 h3 v4 h4 v18 Z" fill={`url(#${g("stone")})`} />
          <path d="M6 26 v-7 a3 3 0 0 1 6 0 v7 Z" fill="#4A4038" />
          <path d="M4 4 l3.6 -7 l3.6 7 Z" fill="#C86A5A" />
          <path d="M7.6 -3 v-6 l5 2 l-5 2" fill="#E04A3A" stroke="#7A6A5A" strokeWidth="0.5" />
          {([[2, 12], [14, 12], [2, 18], [14, 18]] as const).map(([x, y], i) => <rect key={i} x={x} y={y} width="2.4" height="3" fill="#6A5E52" />)}
          <path d="M1 8 h16" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="0.8" />
        </g>
        {/* 水草 */}
        {([[76, 108, -6], [82, 108, 4], [86, 108, 12], [26, 108, -10]] as const).map(([x, y, r], i) => (
          <path key={i} d={`M${x} ${y} C${x! - 4} ${y! - 18} ${x! + 6} ${y! - 28} ${x! + r! * 0.3} ${y! - (40 - i * 4)}`} stroke={`url(#${g("leaf")})`} strokeWidth="3.4" fill="none" strokeLinecap="round" />
        ))}
        {fish(40, 74, 1, false, ["#FF8A5E", "#C23A16"])}
        {fish(68, 90, 0.82, true, ["#FFD2B8", "#E26A3A"])}
        <rect x="0" y="40" width="110" height="90" fill={`url(#${g("edge")})`} />
        {/* 泡 */}
        {([[50, 62, 1.8], [52, 56, 1.3], [49, 51, 1]] as const).map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="none" stroke="#FFFFFF" strokeWidth="0.8" />)}
      </g>
      {/* ガラスの鉢：うすい色・ふち（波うつ）・映りこみ */}
      <path d="M30 34 Q14 40 10 68 Q8 98 30 112 Q55 124 80 112 Q102 98 100 68 Q96 40 80 34 Z" fill={`url(#${g("glass")})`} stroke="#BFE3F2" strokeWidth="1.6" />
      <path d="M26 30 Q34 26 42 31 Q50 26 58 31 Q66 26 74 31 Q82 26 86 31 Q84 37 76 35 Q55 39 34 35 Q26 37 26 30 Z" fill="#E6F6FD" stroke="#A8D8EC" strokeWidth="1.2" />
      <path d="M34 35 Q55 39 76 35" stroke="#7FBAD6" strokeWidth="1" fill="none" />
      <path d="M20 52 Q14 72 20 94" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.8" />
      <path d="M27 46 Q24 52 24 58" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M88 82 Q92 92 86 102" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.45" />
      {/* ガラスにうつる窓（十字の桟） */}
      <g opacity="0.5" transform="translate(70 44) skewY(8)">
        <rect width="15" height="19" rx="2" fill="#FFFFFF" opacity="0.55" />
        <path d="M7.5 0 V19 M0 9.5 H15" stroke="#BFE3F2" strokeWidth="1.4" />
      </g>
      {/* ガラスの底の厚み */}
      <path d="M30 112 Q55 124 80 112" stroke="#8CC6DE" strokeWidth="2.4" fill="none" opacity="0.7" />
      <path d="M34 114 Q55 123 76 114" stroke="#FFFFFF" strokeWidth="1" fill="none" opacity="0.6" />
    </svg>
  );
}

/**
 * テレビ：うすい黒ふちの液晶（つやのある映りこみ・スタンド）と、くるみ材のテレビ台（上の面・引き出し・細い脚）。
 * 画面には、わんこ番組（青空・丘・走るフレンチー・ボール・字幕）。台の上に小さな植物とスピーカー。
 */
function Tv({ u, lit, a11y }: P) {
  const g = (n: string) => `${u}-${n}`;
  return (
    <svg viewBox="0 0 230 180" className={SVG_CLASS} {...a11y}>
      <defs>
        <Blur />
        <GrainFilter id={g("grain")} freq="0.01 0.35" />
        <linearGradient id={g("cab")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#B07A48" /><stop offset="1" stopColor="#7A4C26" /></linearGradient>
        <linearGradient id={g("cabTop")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#D49C66" /><stop offset="1" stopColor="#B88048" /></linearGradient>
        <linearGradient id={g("drawer")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C18A54" /><stop offset="1" stopColor="#966234" /></linearGradient>
        <linearGradient id={g("bezel")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3A3E46" /><stop offset="0.5" stopColor="#1E2126" /><stop offset="1" stopColor="#0E1013" /></linearGradient>
        <linearGradient id={g("sky")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6FB4EE" /><stop offset="1" stopColor="#CDEBFF" /></linearGradient>
        <linearGradient id={g("hill")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8FD06E" /><stop offset="1" stopColor="#4F9A46" /></linearGradient>
        <linearGradient id={g("hill2")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#B5DF8E" /><stop offset="1" stopColor="#7DBE62" /></linearGradient>
        <linearGradient id={g("glare")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0.22" /><stop offset="0.4" stopColor="#FFFFFF" stopOpacity="0.04" /><stop offset="0.41" stopColor="#FFFFFF" stopOpacity="0" /></linearGradient>
        <radialGradient id={g("sun")} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#FFF4B8" /><stop offset="0.6" stopColor="#FFE07A" /><stop offset="1" stopColor="#FFE07A" stopOpacity="0" /></radialGradient>
        <radialGradient id={g("cone")} cx="0.4" cy="0.35" r="0.7"><stop offset="0" stopColor="#5A5E66" /><stop offset="1" stopColor="#1E2024" /></radialGradient>
        <linearGradient id={g("cubby")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2A1708" /><stop offset="1" stopColor="#5A3618" /></linearGradient>
        <linearGradient id={g("rim")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6A707A" /><stop offset="0.08" stopColor="#2A2D33" /><stop offset="1" stopColor="#14161A" /></linearGradient>
        <pattern id={g("mesh")} width="2.6" height="2.6" patternUnits="userSpaceOnUse"><circle cx="1.3" cy="1.3" r="0.55" fill="#000" opacity="0.55" /></pattern>
        <clipPath id={g("screen")}><rect x="31" y="18" width="168" height="94" rx="2" /></clipPath>
      </defs>
      <FloorShadow cx={115} cy={174} rx={108} ry={6} />
      {/* テレビ台：細い脚 → 本体（前の面・上の面） → 引き出し */}
      {[22, 208].map((x) => <path key={x} d={`M${x} 156 L${x + (x < 100 ? -3 : 3)} 172`} stroke="#5E3A1E" strokeWidth="4" strokeLinecap="round" />)}
      <rect x="14" y="128" width="202" height="30" rx="3" fill={`url(#${g("cab")})`} filter={`url(#${g("grain")})`} />
      <path d="M18 120 L212 120 L216 128 L14 128 Z" fill={`url(#${g("cabTop")})`} filter={`url(#${g("grain")})`} />
      <path d="M14 128 H216" stroke="#E9BC88" strokeWidth="1.2" />
      {/* まん中は棚：ゲーム機（青いランプ）とソフト */}
      <rect x="88" y="133" width="54" height="20" rx="2" fill={`url(#${g("cubby")})`} />
      <path d="M88 135 H142" stroke="#000" strokeOpacity="0.35" strokeWidth="2" />
      <rect x="94" y="142" width="28" height="10" rx="1.6" fill="#E9ECEF" /><rect x="94" y="142" width="28" height="2" rx="1" fill="#FFFFFF" />
      <path d="M96 148 H112" stroke="#B8BEC6" strokeWidth="0.8" /><circle cx="118" cy="148" r="1.1" fill="#4FB6FF" /><circle cx="118" cy="148" r="2.6" fill="#4FB6FF" opacity="0.25" />
      {[126, 130, 134].map((x, i) => <rect key={x} x={x} y={139 + (i % 2)} width="3.2" height={13 - (i % 2)} rx="0.6" fill={["#E04A3A", "#3D6FB0", "#F2B13A"][i]} />)}
      <path d="M88 152.4 H142" stroke="#E9BC88" strokeOpacity="0.5" strokeWidth="0.8" />
      {[20, 156].map((x) => (
        <g key={x}>
          <rect x={x} y="133" width="54" height="20" rx="2" fill={`url(#${g("drawer")})`} filter={`url(#${g("grain")})`} />
          <rect x={x} y="133" width="54" height="20" rx="2" fill="none" stroke="#5E3A1E" strokeOpacity="0.35" />
          <rect x={x + 19} y="141" width="16" height="3" rx="1.5" fill="#E2C08A" />
          <rect x={x + 19} y="141" width="16" height="1.2" rx="0.6" fill="#FFF0D0" />
        </g>
      ))}
      {/* 台の上：スピーカーと小さな植物 */}
      <g>
        <rect x="18" y="98" width="16" height="22" rx="2" fill="#2A2D33" />
        <rect x="18" y="98" width="16" height="22" rx="2" fill={`url(#${g("mesh")})`} />
        <path d="M19 99 H33" stroke="#5A5E66" strokeWidth="0.8" />
        <circle cx="26" cy="104" r="3.4" fill={`url(#${g("cone")})`} /><circle cx="26" cy="113" r="4.6" fill={`url(#${g("cone")})`} />
        <circle cx="25" cy="112" r="1.2" fill="#8A8E96" opacity="0.6" />
        <path d="M209 120 l2.4 -11 h10.4 l2.4 11 z" fill="#E9E2D6" />
        <path d="M216.5 109 q-8 -10 -4 -20 M216.5 109 q2 -12 9 -16 M216.5 109 q-2 -8 -10 -10" stroke="#4E9A4A" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        {([[212.5, 89], [225.5, 93], [206.5, 99]] as const).map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="3.6" ry="2.2" fill="#6CB860" transform={`rotate(${i * 50 - 30} ${x} ${y})`} />)}
      </g>
      {/* スタンド */}
      <path d="M100 110 L94 120 L136 120 L130 110 Z" fill="#1E2126" />
      <rect x="92" y="118" width="46" height="3" rx="1.5" fill="#3A3E46" />
      {/* テレビの奥ゆき（右がわの厚み）と、うしろへ回るコード */}
      <path d="M204 15 L211 19 L211 111 L204 116 Z" fill="#0A0B0D" />
      <path d="M211 104 q6 6 2 14 q-2 4 3 8" stroke="#1A1C20" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* テレビ本体（うすいふち・上のふちに光） */}
      <rect x="24" y="12" width="182" height="106" rx="5" fill={`url(#${g("bezel")})`} />
      <rect x="24" y="12" width="182" height="106" rx="5" fill="none" stroke={`url(#${g("rim")})`} strokeWidth="1.4" />
      <path d="M30 12.8 H200" stroke="#9AA0AA" strokeWidth="0.7" strokeLinecap="round" opacity="0.8" />
      <text x="115" y="116.6" textAnchor="middle" fontSize="3.4" fontWeight="800" letterSpacing="0.8" fill="#8A8E96">FRENCHIE</text>
      {/* 画面：わんこ番組 */}
      <g clipPath={`url(#${g("screen")})`}>
        <rect x="31" y="18" width="168" height="94" fill={`url(#${g("sky")})`} />
        <circle cx="168" cy="38" r="16" fill={`url(#${g("sun")})`} />
        <circle cx="168" cy="38" r="7" fill="#FFF4B8" />
        {([[66, 34, 1], [118, 28, 0.8]] as const).map(([x, y, sc], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${sc})`} fill="#FFFFFF"><ellipse cx="0" cy="4" rx="16" ry="6" /><circle cx="-6" cy="0" r="7" /><circle cx="5" cy="-2" r="8" /></g>
        ))}
        <path d="M31 84 Q70 64 112 76 T199 70 L199 112 L31 112 Z" fill={`url(#${g("hill2")})`} />
        <path d="M31 94 Q80 80 130 90 T199 86 L199 112 L31 112 Z" fill={`url(#${g("hill")})`} />
        {/* 走るフレンチー */}
        <g transform="translate(92 86)">
          <ellipse cx="0" cy="10" rx="18" ry="2.6" fill="#2E6A2A" opacity="0.35" />
          <path d="M-14 6 l-6 7 M-6 8 l-3 8 M6 8 l4 8 M13 5 l7 6" stroke="#E2D6C4" strokeWidth="3.6" strokeLinecap="round" />
          <ellipse cx="0" cy="0" rx="17" ry="9.5" fill="#F7F1E6" />
          <ellipse cx="-4" cy="-2" rx="7" ry="5" fill="#C8B8A4" opacity="0.7" />
          <circle cx="17" cy="-8" r="9" fill="#F7F1E6" />
          <path d="M11 -14 L10 -25 L17 -16 Z M20 -16 L26 -25 L25 -13 Z" fill="#E8DCCA" />
          <path d="M12 -16 L11 -22 L15 -16 Z M21 -16 L24 -22 L24 -15 Z" fill="#F2B8B8" />
          <circle cx="20" cy="-9" r="1.6" fill="#1A0F08" /><circle cx="20.5" cy="-9.6" r="0.5" fill="#FFFFFF" />
          <ellipse cx="25" cy="-5" rx="2.6" ry="2" fill="#3A2A20" />
          <path d="M23 -2 q2 3 4 0" stroke="#3A2A20" strokeWidth="0.9" fill="none" />
          <path d="M-18 -2 q-4 -4 -2 -7" stroke="#E2D6C4" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </g>
        <g transform="translate(140 92)"><circle r="6" fill="#E04A3A" /><path d="M-6 0 A6 6 0 0 0 6 0 Z" fill="#FFFFFF" /></g>
        {/* 字幕と LIVE */}
        <rect x="36" y="22" width="26" height="9" rx="2" fill="#E04A3A" />
        <text x="49" y="29" textAnchor="middle" fontSize="6.4" fontWeight="900" fill="#FFFFFF">LIVE</text>
        <rect x="64" y="98" width="102" height="11" rx="2" fill="#000" opacity="0.45" />
        <text x="115" y="106" textAnchor="middle" fontSize="7" fontWeight="800" fill="#FFFFFF">わんこ大集合！</text>
        {/* 走査のうすい線 */}
        {Array.from({ length: 24 }, (_, i) => <rect key={i} x="31" y={18 + i * 4} width="168" height="1" fill="#000" opacity="0.035" />)}
      </g>
      {/* 映りこみ（へやの窓）・夜は画面の光 */}
      <rect x="31" y="18" width="168" height="94" rx="2" fill={`url(#${g("glare")})`} />
      <g opacity="0.07" fill="#FFFFFF"><rect x="40" y="24" width="18" height="24" rx="1" /><rect x="60" y="24" width="18" height="24" rx="1" /></g>
      {/* 台の上のリモコン */}
      <g transform="translate(166 124) rotate(-10)">
        <ellipse cx="1" cy="2.4" rx="12" ry="1.6" fill="#3A2614" opacity="0.3" />
        <rect x="-11" y="-2.2" width="22" height="4.4" rx="2" fill="#2A2D33" />
        <rect x="-10" y="-2" width="20" height="1.2" rx="0.6" fill="#5A5E66" />
        <circle cx="-7" cy="0.4" r="1" fill="#E04A3A" />
        {[-3, 0, 3, 6].map((x) => <circle key={x} cx={x} cy="0.6" r="0.6" fill="#8A8E96" />)}
      </g>
      {lit ? <rect x="24" y="12" width="182" height="106" rx="5" fill="#CFE8FF" opacity="0.12" /> : null}
      <circle cx="198" cy="114" r="1.4" fill="#7BE07B" />
    </svg>
  );
}

/**
 * アップライトピアノ：つやのある黒い塗り（強い映りこみ・右の側板で奥ゆき）・ふたを開けた鍵盤（白鍵の厚み・黒鍵のつや）。
 * 譜面台に楽譜、上にメトロノームと一輪ざし。彫りのある脚と金のペダル。
 */
function Piano({ u, a11y }: P) {
  const g = (n: string) => `${u}-${n}`;
  const W = 21;
  return (
    <svg viewBox="0 -24 240 230" className={SVG_CLASS} {...a11y}>
      <defs>
        <Blur />
        <linearGradient id={g("lacq")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#3A2A26" /><stop offset="0.25" stopColor="#1C1412" /><stop offset="0.7" stopColor="#120C0A" /><stop offset="1" stopColor="#24180F" /></linearGradient>
        <linearGradient id={g("side")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#1A100C" /><stop offset="1" stopColor="#0A0605" /></linearGradient>
        <linearGradient id={g("topF")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4A3630" /><stop offset="1" stopColor="#24180F" /></linearGradient>
        <linearGradient id={g("streak")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0" /><stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.22" /><stop offset="1" stopColor="#FFFFFF" stopOpacity="0" /></linearGradient>
        <linearGradient id={g("white")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#E6E2DA" /></linearGradient>
        <linearGradient id={g("black")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4A4A50" /><stop offset="0.2" stopColor="#141416" /><stop offset="1" stopColor="#060607" /></linearGradient>
        <linearGradient id={g("brass")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFE8A0" /><stop offset="0.5" stopColor="#D4A84A" /><stop offset="1" stopColor="#9A7426" /></linearGradient>
        <linearGradient id={g("felt")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A82A2A" /><stop offset="1" stopColor="#701414" /></linearGradient>
        <radialGradient id={g("flame")} cx="0.5" cy="0.6" r="0.5"><stop offset="0" stopColor="#FFFBE0" /><stop offset="0.5" stopColor="#FFD25A" /><stop offset="1" stopColor="#FF9A2A" stopOpacity="0" /></radialGradient>
      </defs>
      <FloorShadow cx={120} cy={200} rx={112} ry={7} o={0.32} />
      {/* 右の側板（奥ゆき） */}
      <path d="M210 14 L222 6 L222 170 L210 184 Z" fill={`url(#${g("side")})`} />
      {/* 上の面 */}
      <path d="M16 14 L210 14 L222 6 L28 6 Z" fill={`url(#${g("topF")})`} />
      <path d="M28 6 L222 6" stroke="#6A5048" strokeWidth="1" />
      <path d="M17 14.6 L209 14.6" stroke="#8A6A60" strokeWidth="0.8" opacity="0.8" />
      {/* 本体（上の箱） */}
      <rect x="16" y="14" width="194" height="94" fill={`url(#${g("lacq")})`} />
      <rect x="28" y="24" width="170" height="62" rx="3" fill="#0C0806" opacity="0.65" />
      <rect x="28" y="24" width="170" height="62" rx="3" fill="none" stroke="#3E2E28" strokeWidth="1.2" />
      <path d="M40 14 L72 14 L46 108 L16 108 Z" fill={`url(#${g("streak")})`} opacity="0.8" />
      <path d="M150 14 L160 14 L134 108 L124 108 Z" fill={`url(#${g("streak")})`} opacity="0.5" />
      {/* 譜面台と楽譜 */}
      <rect x="64" y="34" width="98" height="5" rx="1" fill="#2A1C16" />
      <g transform="translate(70 40)">
        <path d="M0 0 H42 V36 H0 Z" fill="#FFFDF6" /><path d="M44 0 H86 V36 H44 Z" fill="#FBF7EC" />
        <path d="M42 0 L44 0 L44 36 L42 36 Z" fill="#D8D0C0" />
        {([[2, 0], [46, 44]] as const).map(([x0], k) => [7, 17, 27].map((y) => (
          <g key={`${k}-${y}`}>{[0, 2, 4, 6, 8].map((d) => <path key={d} d={`M${x0! + 2} ${y + d * 0.7} H${x0! + 38}`} stroke="#B8BEC6" strokeWidth="0.4" />)}</g>
        )))}
        {([[8, 9], [14, 11], [20, 8], [26, 12], [32, 10], [52, 19], [58, 21], [64, 18], [70, 20], [78, 17], [10, 29], [22, 31], [56, 29], [72, 31]] as const).map(([x, y], i) => (
          <g key={i}><ellipse cx={x} cy={y} rx="1.6" ry="1.1" fill="#1E1E22" transform={`rotate(-20 ${x} ${y})`} /><path d={`M${x! + 1.4} ${y} v-5`} stroke="#1E1E22" strokeWidth="0.5" /></g>
        ))}
      </g>
      {/* 上：メトロノームと一輪ざし */}
      <g transform="translate(46 -6)">
        <path d="M0 20 L6 -2 L12 20 Z" fill="#7A4B26" /><path d="M6 -2 L12 20 L8 20 Z" fill="#5E3A1E" />
        <path d="M6 16 L9 0" stroke="#D4A84A" strokeWidth="1" /><rect x="7.2" y="5" width="3" height="3" fill="#D4A84A" />
      </g>
      <g transform="translate(176 -10)">
        <path d="M0 24 q-2 -10 4 -14 q6 4 4 14 z" fill="#BFE3F2" opacity="0.85" /><path d="M2 12 Q3 22 2 24" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="1" />
        <path d="M4 10 C2 4 6 -2 8 -8" stroke="#4E9A4A" strokeWidth="1.4" fill="none" />
        <g transform="translate(8 -10)">{[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-3" rx="2.4" ry="3.4" fill="#FF9FB8" transform={`rotate(${a})`} />)}<circle r="1.6" fill="#FFD25A" /></g>
      </g>
      {/* 金の燭台（左右） */}
      {([[16, -1], [210, 1]] as const).map(([x, d]) => (
        <g key={x}>
          <path d={`M${x} 52 q${8 * d} 0 ${10 * d} -8`} stroke={`url(#${g("brass")})`} strokeWidth="2" fill="none" strokeLinecap="round" />
          <ellipse cx={x} cy="52" rx="2.2" ry="3.4" fill={`url(#${g("brass")})`} />
          <ellipse cx={x + 10 * d} cy="44" rx="4" ry="1.4" fill={`url(#${g("brass")})`} />
          <rect x={x + 10 * d - 1.8} y="33" width="3.6" height="11" rx="0.8" fill="#FFF8EA" />
          <path d={`M${x + 10 * d - 1.2} 34 v9`} stroke="#E6DCC6" strokeWidth="0.8" />
          <ellipse cx={x + 10 * d} cy="28" rx="3.2" ry="5" fill={`url(#${g("flame")})`} />
          <path d={`M${x + 10 * d} 33 v-1.6`} stroke="#3A2A20" strokeWidth="0.6" />
        </g>
      ))}
      {/* 鍵盤のふた（開いて奥にある）・鍵盤の映りこみ・赤いフェルト */}
      <path d="M12 108 L214 108 L210 116 L16 116 Z" fill="#2A1C16" />
      {Array.from({ length: W }, (_, i) => <rect key={`r${i}`} x={18 + i * (188 / W)} y="110" width={188 / W - 1.2} height="3.6" fill="#FFFFFF" opacity="0.07" />)}
      <rect x="18" y="114" width="190" height="3" fill={`url(#${g("felt")})`} />
      {/* 鍵盤：白鍵の上の面と前の厚み → 黒鍵 */}
      <path d="M14 117 L212 117 L214 132 L12 132 Z" fill="#0E0908" />
      {Array.from({ length: W }, (_, i) => {
        const x0 = 18 + i * (188 / W), x1 = x0 + 188 / W - 0.8;
        return (
          <g key={i}>
            <path d={`M${x0} 118 L${x1} 118 L${x1 + 0.3} 129 L${x0 - 0.3} 129 Z`} fill={`url(#${g("white")})`} />
            <path d={`M${x0 - 0.3} 129 L${x1 + 0.3} 129 L${x1 + 0.3} 132 L${x0 - 0.3} 132 Z`} fill="#C9C4BA" />
          </g>
        );
      })}
      {Array.from({ length: W }, (_, i) => ([0, 1, 3, 4, 5].includes(i % 7) && i < W - 1 ? (
        <g key={`b${i}`}>
          <rect x={18 + (i + 1) * (188 / W) - 2.8} y="118" width="5.6" height="7.6" rx="0.8" fill={`url(#${g("black")})`} />
          <rect x={18 + (i + 1) * (188 / W) - 2} y="118.6" width="1.4" height="5" fill="#8A8A92" opacity="0.6" />
        </g>
      ) : null))}
      {/* 下の箱・脚・ペダル */}
      <rect x="20" y="132" width="186" height="52" fill={`url(#${g("lacq")})`} />
      <rect x="36" y="140" width="154" height="36" rx="3" fill="#0C0806" opacity="0.55" />
      {/* 下の板の彫り（ふちどりと、まん中の飾り） */}
      <rect x="40" y="144" width="146" height="28" rx="2" fill="none" stroke="#3E2E28" strokeWidth="1" />
      <rect x="40.8" y="144.8" width="144.4" height="26.4" rx="2" fill="none" stroke="#000" strokeOpacity="0.5" strokeWidth="0.6" />
      <path d="M113 150 q-10 0 -14 8 q4 8 14 8 q10 0 14 -8 q-4 -8 -14 -8 Z M95 158 h-30 M131 158 h30" stroke="#4A3630" strokeWidth="1" fill="none" />
      <path d="M20 132.6 H206" stroke="#6A5048" strokeWidth="0.8" />
      <path d="M48 132 L66 132 L50 184 L32 184 Z" fill={`url(#${g("streak")})`} opacity="0.5" />
      {([[14, -1], [212, 1]] as const).map(([x, d], i) => (
        <g key={i}>
          <path d={`M${x} 132 h${8 * (d as number)} v40 q${2 * (d as number)} 6 ${-2 * (d as number)} 10 h${-6 * (d as number)} z`} fill="#160E0B" />
          <path d={`M${(x as number) + 2 * (d as number)} 138 v34`} stroke="#4A3630" strokeWidth="1.2" />
        </g>
      ))}
      <rect x="20" y="184" width="186" height="6" fill="#0A0605" />
      {[104, 118, 132].map((x) => <g key={x}><path d={`M${x - 4} 186 h8 l2 6 h-12 z`} fill={`url(#${g("brass")})`} /><path d={`M${x - 3} 186.6 h6`} stroke="#FFF6D0" strokeWidth="0.6" /></g>)}
      {/* ロゴの金の文字 */}
      <text x="113" y="106" textAnchor="middle" fontSize="5.6" fontWeight="700" letterSpacing="1.4" fill={`url(#${g("brass")})`}>WANKO</text>
    </svg>
  );
}

/**
 * ゆりいす：まるみのある木（部材ごとの光と影）・ろくろ挽きの背の柱・弓なりの脚。
 * ボタンどめのクッションと、背にかけた手編みのブランケット（ふさつき）。
 */
function RockingChair({ u, a11y }: P) {
  const g = (n: string) => `${u}-${n}`;
  return (
    <svg viewBox="0 0 160 210" className={SVG_CLASS} {...a11y}>
      <defs>
        <Blur />
        <FabricFilter id={g("cloth")} />
        <GrainFilter id={g("grain")} freq="0.3 0.015" />
        <linearGradient id={g("wood")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#E0A86E" /><stop offset="0.45" stopColor="#C2864E" /><stop offset="1" stopColor="#8E5A30" /></linearGradient>
        <linearGradient id={g("woodH")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E7B47A" /><stop offset="1" stopColor="#A86E3A" /></linearGradient>
        <linearGradient id={g("rocker")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C58A52" /><stop offset="1" stopColor="#7A4B26" /></linearGradient>
        <radialGradient id={g("cushion")} cx="0.4" cy="0.3" r="0.8"><stop offset="0" stopColor="#C9E0F2" /><stop offset="0.6" stopColor="#8FB8DA" /><stop offset="1" stopColor="#5E88B2" /></radialGradient>
        <linearGradient id={g("blanket")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F7E6C8" /><stop offset="1" stopColor="#E2C496" /></linearGradient>
        <pattern id={g("knit")} width="7" height="9" patternUnits="userSpaceOnUse"><path d="M0 0 l3.5 4.5 l3.5 -4.5 M0 4.5 l3.5 4.5 l3.5 -4.5" stroke="#B88E5A" strokeOpacity="0.55" fill="none" strokeWidth="1.1" /></pattern>
      </defs>
      <FloorShadow cx={80} cy={202} rx={72} ry={6} />
      {/* 弓なりの脚（奥 → 手前） */}
      <path d="M22 178 Q80 200 146 172" stroke="#5E3A1E" strokeWidth="7" fill="none" strokeLinecap="round" opacity="0.8" />
      <path d="M8 182 Q76 212 154 176" stroke={`url(#${g("rocker")})`} strokeWidth="8" fill="none" strokeLinecap="round" />
      <path d="M10 180 Q76 208 152 174" stroke="#F2CC98" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.8" />
      {/* 脚（奥は暗く） */}
      <path d="M52 186 L54 128 M108 182 L106 128" stroke="#6E4422" strokeWidth="6" strokeLinecap="round" />
      <path d="M34 190 L38 126 M126 186 L122 126" stroke={`url(#${g("wood")})`} strokeWidth="7.5" strokeLinecap="round" />
      <path d="M36 160 H124" stroke="#8E5A30" strokeWidth="4" strokeLinecap="round" />
      {/* 背もたれ：ろくろ挽きの柱と、上の笠木 */}
      {[50, 64, 78, 92, 106].map((x) => (
        <g key={x}>
          {/* まっすぐ縦の線はグラデーションの幅が0になって消えるので、単色＋光の線で描く */}
          <path d={`M${x} 118 L${x + (x - 78) * 0.1} 34`} stroke="#B97E48" strokeWidth="4.6" strokeLinecap="round" />
          <path d={`M${x - 0.9} 116 L${x - 0.9 + (x - 78) * 0.1} 36`} stroke="#F0C48E" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
          {/* ろくろ挽きの玉 */}
          {[54, 86].map((y) => {
            const cx = x + (x - 78) * 0.1 * ((118 - y) / 84);
            return <g key={y}><ellipse cx={cx} cy={y} rx="3.8" ry="2.6" fill={`url(#${g("wood")})`} /><ellipse cx={cx - 1} cy={y - 0.8} rx="1.4" ry="0.8" fill="#F2CC98" opacity="0.8" /></g>;
          })}
        </g>
      ))}
      <path d="M36 122 L30 30 Q80 10 130 30 L124 122" stroke={`url(#${g("wood")})`} strokeWidth="8" fill="none" strokeLinejoin="round" strokeLinecap="round" filter={`url(#${g("grain")})`} />
      <path d="M30 30 Q80 10 130 30" stroke="#F2CC98" strokeWidth="2" fill="none" />
      <path d="M28 26 Q80 4 132 26 Q134 34 128 36 Q80 18 32 36 Q26 34 28 26 Z" fill={`url(#${g("woodH")})`} filter={`url(#${g("grain")})`} />
      {/* ひじかけ */}
      {([[20, 44, -1], [140, 116, 1]] as const).map(([xo, xi, d], i) => (
        <g key={i}>
          <path d={`M${xi} 84 L${xo} 84 Q${(xo as number) - 6 * (d as number)} 86 ${(xo as number) - 4 * (d as number)} 92 L${xi} 92 Z`} fill={`url(#${g("woodH")})`} />
          <path d={`M${(xo as number) + 6 * (d as number) * -1} 92 L${(xo as number) + 6 * (d as number) * -1} 124`} stroke={`url(#${g("wood")})`} strokeWidth="5.5" strokeLinecap="round" />
          <circle cx={(xo as number) - 1 * (d as number)} cy="88" r="4.6" fill="#D49A62" />
        </g>
      ))}
      {/* 座面とクッション（ボタンどめ） */}
      <path d="M30 118 L130 118 L126 132 L34 132 Z" fill={`url(#${g("woodH")})`} filter={`url(#${g("grain")})`} />
      <g filter={`url(#${g("cloth")})`}>
        <path d="M36 104 Q80 94 124 104 Q132 116 124 122 Q80 130 36 122 Q28 116 36 104 Z" fill={`url(#${g("cushion")})`} />
        <path d="M36 104 Q80 94 124 104 Q132 116 124 122 Q80 130 36 122 Q28 116 36 104 Z" fill="none" stroke="#4A7098" strokeWidth="1.6" strokeDasharray="0.1 2.6" strokeLinecap="round" />
        <path d="M38 121 Q80 129 122 121" stroke="#4A7098" strokeOpacity="0.5" strokeWidth="1.2" fill="none" />
        <path d="M42 106 Q80 98 118 106" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="2.2" fill="none" />
        {/* ボタンどめのくぼみ */}
        {[62, 80, 98].map((x) => <g key={x}><ellipse cx={x} cy="112" rx="5" ry="2.4" fill="#5E88B2" opacity="0.35" /><circle cx={x} cy="112" r="1.6" fill="#3E6890" /></g>)}
      </g>
      {/* 背にかけたブランケット（手編み・ふさ） */}
      <g filter={`url(#${g("cloth")})`}>
        <path d="M84 22 Q112 18 128 26 L130 70 Q120 82 104 76 Q94 86 82 78 Z" fill={`url(#${g("blanket")})`} />
        <path d="M84 22 Q112 18 128 26 L130 70 Q120 82 104 76 Q94 86 82 78 Z" fill={`url(#${g("knit")})`} />
        {/* 2本のしま（ブランケットのふちに合わせて曲げる） */}
        <path d="M83 50 Q106 44 129 50 L129 56 Q106 50 83 56 Z" fill="#D9675A" opacity="0.85" />
        <path d="M83 60 Q106 54 129 60 L129 63 Q106 57 83 63 Z" fill="#5E88B2" opacity="0.8" />
        <path d="M96 24 Q98 52 94 80 M114 24 Q118 50 116 78" stroke="#C9A06A" strokeWidth="2.4" fill="none" opacity="0.55" />
        <path d="M84 22 Q86 50 82 78" stroke="#000" strokeOpacity="0.12" strokeWidth="3" fill="none" />
        <path d="M86 26 Q108 20 126 28" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="2" fill="none" />
        {[86, 92, 98, 104, 110, 116, 122].map((x, i) => <path key={x} d={`M${x} ${78 + (i % 2) * 2 - (x > 100 ? 2 : 0)} l${i % 2 ? 1 : -1} 7`} stroke="#D8B47E" strokeWidth="1.6" strokeLinecap="round" />)}
      </g>
    </svg>
  );
}

/**
 * おもちゃ箱：板を組んだ木の箱（板目・金具の角・ペンキの肉球）。ふたは開いて、うしろに立てかけてある。
 * 中から、ボール・ロープのおもちゃ・あひる・ほね・にんじんのぬいぐるみがのぞき、ボールが1つ床に転がる。
 */
function Toybox({ u, a11y }: P) {
  const g = (n: string) => `${u}-${n}`;
  return (
    <svg viewBox="0 0 180 146" className={SVG_CLASS} {...a11y}>
      <defs>
        <Blur />
        <GrainFilter id={g("grain")} freq="0.01 0.3" alpha={0.38} />
        <FabricFilter id={g("cloth")} />
        <linearGradient id={g("front")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E9B978" /><stop offset="1" stopColor="#B57E40" /></linearGradient>
        <linearGradient id={g("side")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#B57E40" /><stop offset="1" stopColor="#8A5A2A" /></linearGradient>
        <linearGradient id={g("lid")} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#C88E4E" /><stop offset="1" stopColor="#E6B474" /></linearGradient>
        <linearGradient id={g("inner")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5A3618" /><stop offset="1" stopColor="#8A5A2A" /></linearGradient>
        <linearGradient id={g("metal")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E8EBEE" /><stop offset="0.5" stopColor="#A7AEB8" /><stop offset="1" stopColor="#6E757F" /></linearGradient>
        <radialGradient id={g("ball")} cx="0.35" cy="0.3" r="0.75"><stop offset="0" stopColor="#FF9A8A" /><stop offset="0.5" stopColor="#E04A3A" /><stop offset="1" stopColor="#A82418" /></radialGradient>
        <radialGradient id={g("ball2")} cx="0.35" cy="0.3" r="0.75"><stop offset="0" stopColor="#B8F07A" /><stop offset="0.5" stopColor="#7CC63A" /><stop offset="1" stopColor="#4E8A1E" /></radialGradient>
        <radialGradient id={g("duck")} cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#FFF2A8" /><stop offset="0.5" stopColor="#FFD84A" /><stop offset="1" stopColor="#E0A820" /></radialGradient>
        <linearGradient id={g("bone")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFDF6" /><stop offset="1" stopColor="#E6D6B8" /></linearGradient>
      </defs>
      <FloorShadow cx={88} cy={140} rx={80} ry={6} />
      {/* うしろに立てかけたふた（内がわが見える） */}
      <path d="M22 54 L36 10 L150 10 L160 54 Z" fill={`url(#${g("lid")})`} filter={`url(#${g("grain")})`} />
      <path d="M30 46 L41 16 L146 16 L153 46 Z" fill="#000" opacity="0.08" />
      {[24, 34].map((y) => <path key={y} d={`M${32 + (54 - y) * 0.3} ${y} L${154 - (54 - y) * 0.2} ${y}`} stroke="#9E6B30" strokeOpacity="0.35" strokeWidth="1.2" />)}
      <path d="M36 10 L150 10" stroke="#F8D8A8" strokeWidth="1.6" />
      {/* 箱の中（奥の暗がり・左右の内がわの壁） */}
      <path d="M20 54 L158 54 L150 64 L28 64 Z" fill={`url(#${g("inner")})`} />
      <path d="M20 54 L28 64 L28 72 L20 72 Z" fill="#6E4420" />
      <path d="M158 54 L150 64 L150 72 L158 72 Z" fill="#4A2A10" />
      {/* ちょうつがい */}
      {[52, 124].map((x) => <g key={x}><rect x={x} y="51" width="12" height="6" rx="1" fill={`url(#${g("metal")})`} /><path d={`M${x} 54 H${x + 12}`} stroke="#5A6068" strokeWidth="0.6" /></g>)}
      {/* 中のおもちゃ */}
      <g filter={`url(#${g("cloth")})`}>
        {/* にんじんのぬいぐるみ */}
        <g transform="translate(36 34) rotate(-28)"><path d="M0 0 Q6 -2 10 0 L6 30 Q5 33 4 30 Z" fill="#F59A3A" /><path d="M1 8 h7 M2 16 h5 M3 23 h3" stroke="#D8701A" strokeWidth="1" /><path d="M5 0 q-6 -8 -2 -12 M5 0 q2 -9 7 -10 M5 0 q-1 -10 3 -14" stroke="#4E9A4A" strokeWidth="2.4" fill="none" strokeLinecap="round" /></g>
        {/* ロープのおもちゃ（ねじり） */}
        <path d="M60 58 C62 36 86 28 96 44" stroke="#E6E0D4" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M60 58 C62 36 86 28 96 44" stroke="#5E8FC4" strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray="4 5" />
        {([[60, 58], [96, 44]] as const).map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="5.6" fill="#E6E0D4" /><path d={`M${x! - 3} ${y! + 4} l-1 6 M${x} ${y! + 5} v6 M${x! + 3} ${y! + 4} l1 6`} stroke="#D6CEC0" strokeWidth="1.4" strokeLinecap="round" /></g>)}
      </g>
      {/* あひる */}
      <g transform="translate(124 40)">
        <ellipse cx="0" cy="8" rx="14" ry="10" fill={`url(#${g("duck")})`} />
        <circle cx="7" cy="-5" r="8.5" fill={`url(#${g("duck")})`} />
        <path d="M14 -5 q7 0 8 2.4 q-4 2 -8 1 z" fill="#F58A1C" />
        <circle cx="9" cy="-7" r="1.5" fill="#1A0F08" /><circle cx="9.5" cy="-7.6" r="0.5" fill="#FFFFFF" />
        <path d="M-10 6 q6 -6 12 0" stroke="#E0A820" strokeWidth="1.4" fill="none" />
        <ellipse cx="3" cy="-9" rx="2.8" ry="1.6" fill="#FFFFFF" opacity="0.6" />
      </g>
      {/* ほね */}
      <g transform="translate(104 50) rotate(14)">
        <path d="M-16 -3 a4.6 4.6 0 1 1 5.6 -3 h20.8 a4.6 4.6 0 1 1 5.6 3 a4.6 4.6 0 1 1 -5.6 3 h-20.8 a4.6 4.6 0 1 1 -5.6 -3 z" fill={`url(#${g("bone")})`} stroke="#D8C8A8" strokeWidth="0.8" />
        <path d="M-10 -4 h20" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.8" />
      </g>
      {/* ボール（中のと、床に転がったの） */}
      <g transform="translate(78 50)"><circle r="11" fill={`url(#${g("ball2")})`} /><path d="M-10 -4 Q0 4 10 -4 M-10 4 Q0 -4 10 4" stroke="#FFFFFF" strokeWidth="1.6" fill="none" opacity="0.85" /></g>
      {/* 箱：右の側面 → 前の面（板目・板のつなぎ） → 金具 */}
      <path d="M158 54 L170 46 L170 116 L158 130 Z" fill={`url(#${g("side")})`} filter={`url(#${g("grain")})`} />
      <rect x="18" y="54" width="140" height="76" rx="3" fill={`url(#${g("front")})`} filter={`url(#${g("grain")})`} />
      {[79, 104].map((y) => <path key={y} d={`M18 ${y} H158`} stroke="#8A5A2A" strokeOpacity="0.45" strokeWidth="1.6" />)}
      <path d="M18 56 H158" stroke="#F8D8A8" strokeWidth="2" />
      {([[18, 54, 1, 1], [158, 54, -1, 1], [18, 130, 1, -1], [158, 130, -1, -1]] as const).map(([x, y, sx, sy], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${sx} ${sy})`}>
          <path d="M0 0 H14 V4 H4 V14 H0 Z" fill={`url(#${g("metal")})`} />
          <circle cx="8" cy="2" r="1" fill="#5A6068" /><circle cx="2" cy="8" r="1" fill="#5A6068" />
        </g>
      ))}
      {/* 右の側面のロープの取っ手 */}
      <path d="M161 74 q4 14 6 0" stroke="#4A2A10" strokeWidth="2.6" fill="none" opacity="0.4" />
      <path d="M161 72 q4 15 6 0" stroke="#E6D3A8" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M161 72 q4 15 6 0" stroke="#B8955A" strokeWidth="2.6" fill="none" strokeDasharray="1.2 1.6" />
      {[161, 167].map((x) => <circle key={x} cx={x} cy="72" r="1.8" fill={`url(#${g("metal")})`} />)}
      {/* 名札（ひもでかけた木の札） */}
      <path d="M128 60 L134 66 L140 60" stroke="#C9A06A" strokeWidth="0.9" fill="none" />
      <g transform="rotate(4 134 72)">
        <rect x="122" y="65" width="24" height="12" rx="2.4" fill="#FFF8EA" stroke="#C9A06A" strokeWidth="0.8" />
        <circle cx="134" cy="67.4" r="0.9" fill="#C9A06A" />
        <path d="M128 72 q1.4 -2 2.8 0 q1.4 2 2.8 0 q1.4 -2 2.8 0 q1.4 2 2.8 0" stroke="#E07A8A" strokeWidth="1" fill="none" />
      </g>
      {/* ペンキの肉球（少しかすれ） */}
      <g transform="translate(88 98)" fill="#FFF4E0" opacity="0.92">
        <ellipse cx="0" cy="4" rx="10" ry="8" /><circle cx="-10" cy="-7" r="3.8" /><circle cx="-3.6" cy="-12.4" r="3.8" /><circle cx="3.6" cy="-12.4" r="3.8" /><circle cx="10" cy="-7" r="3.8" />
      </g>
      <text x="88" y="124" textAnchor="middle" fontSize="7" fontWeight="900" letterSpacing="1.5" fill="#FFF4E0" opacity="0.9">TOYS</text>
      {/* 床に転がったボール */}
      <g transform="translate(166 132)"><ellipse cx="2" cy="7" rx="9" ry="2.4" fill="#3A2614" opacity="0.25" /><circle r="8" fill={`url(#${g("ball")})`} /><path d="M-8 0 A8 8 0 0 0 8 0" stroke="#FFFFFF" strokeWidth="2" fill="none" /><ellipse cx="-2.6" cy="-3" rx="2.4" ry="1.4" fill="#FFFFFF" opacity="0.6" /></g>
    </svg>
  );
}
