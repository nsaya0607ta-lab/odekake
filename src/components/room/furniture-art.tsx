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

type Art = { u: string; lit: boolean };

export function FurnitureArt({ id, label, lit }: { id: FurnitureId; label?: string; lit: boolean }) {
  const u = `fa${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const a11y = label ? { role: "img" as const, "aria-label": label } : {};
  const art: Art = { u, lit };
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

function Sofa({ u, a11y }: P) {
  const g = (n: string) => `${u}-${n}`;
  return (
    <svg viewBox="0 0 260 150" className={SVG_CLASS} {...a11y}>
      <defs>
        <Blur />
        <linearGradient id={g("back")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E9A089" /><stop offset="1" stopColor="#C46A55" /></linearGradient>
        <linearGradient id={g("cush")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F3B39C" /><stop offset="0.6" stopColor="#E28F77" /><stop offset="1" stopColor="#CF755F" /></linearGradient>
        <linearGradient id={g("seat")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F6BBA4" /><stop offset="1" stopColor="#E5927A" /></linearGradient>
        <linearGradient id={g("front")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#D47A63" /><stop offset="1" stopColor="#A9533F" /></linearGradient>
        <linearGradient id={g("arm")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#E59A82" /><stop offset="1" stopColor="#B65B46" /></linearGradient>
        <linearGradient id={g("leg")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#9A6338" /><stop offset="1" stopColor="#5E3A1E" /></linearGradient>
        <linearGradient id={g("pil")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FBE2A2" /><stop offset="1" stopColor="#E3B85A" /></linearGradient>
        <pattern id={g("knit")} width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 4 q2 -3 4 0 t4 0" stroke="#FFFFFF" strokeOpacity="0.35" fill="none" strokeWidth="1.2" /></pattern>
      </defs>
      <FloorShadow cx={130} cy={140} rx={118} ry={9} />
      {/* 脚 */}
      {[30, 222].map((x) => <path key={x} d={`M${x} 124 l8 0 l-2 18 l-4 0 z`} fill={`url(#${g("leg")})`} />)}
      {/* 背もたれ */}
      <path d="M26 30 q0 -20 22 -20 h164 q22 0 22 20 v66 h-208 z" fill={`url(#${g("back")})`} />
      <path d="M40 16 h180" stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="4" strokeLinecap="round" />
      {/* 背もたれのクッション（ボタンどめ） */}
      {[40, 132].map((x) => (
        <g key={x}>
          <rect x={x} y="22" width="88" height="62" rx="18" fill={`url(#${g("cush")})`} />
          <path d={`M${x + 10} 30 q34 -6 68 0`} stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="3" fill="none" strokeLinecap="round" />
          {[[x + 26, 44], [x + 62, 44], [x + 44, 62]].map(([bx, by]) => (
            <g key={`${bx}-${by}`}>
              <ellipse cx={bx} cy={by! + 1} rx="6" ry="4" fill="#C46A55" opacity="0.35" />
              <circle cx={bx} cy={by} r="2.4" fill="#A9533F" />
              <circle cx={bx! - 0.8} cy={by! - 0.8} r="0.9" fill="#F6C2AE" />
            </g>
          ))}
        </g>
      ))}
      {/* 座面 */}
      <rect x="30" y="80" width="200" height="22" rx="10" fill={`url(#${g("seat")})`} />
      <line x1="130" y1="82" x2="130" y2="101" stroke="#C46A55" strokeWidth="1.6" />
      <path d="M36 84 h188" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="28" y="98" width="204" height="28" rx="8" fill={`url(#${g("front")})`} />
      <path d="M30 100 h200" stroke="#F6C2AE" strokeOpacity="0.6" strokeWidth="1.8" />
      {/* ひじかけ（巻いたかたち） */}
      {[[6, false], [214, true]].map(([x, right]) => (
        <g key={String(x)}>
          <rect x={x as number} y="52" width="40" height="76" rx="14" fill={`url(#${g("arm")})`} />
          <ellipse cx={(x as number) + 20} cy="56" rx="20" ry="11" fill={right ? "#D8826B" : "#F0AA92"} />
          <ellipse cx={(x as number) + 20} cy="56" rx="11" ry="5.5" fill={right ? "#C46A55" : "#DE8F77"} />
          <path d={`M${(x as number) + 6} 72 v48`} stroke="#FFFFFF" strokeOpacity={right ? 0.08 : 0.25} strokeWidth="3" strokeLinecap="round" />
        </g>
      ))}
      {/* ひざかけ（ひじかけにかけたニット） */}
      <path d="M206 50 q14 -4 34 2 l-4 50 q-14 6 -30 0 z" fill="#8FB6DE" />
      <path d="M206 50 q14 -4 34 2 l-4 50 q-14 6 -30 0 z" fill={`url(#${g("knit")})`} />
      {[0, 1, 2, 3].map((i) => <line key={i} x1={210 + i * 7} y1="101" x2={209 + i * 7} y2="110" stroke="#8FB6DE" strokeWidth="2.4" strokeLinecap="round" />)}
      {/* クッション */}
      <g transform="rotate(-12 170 70)">
        <rect x="150" y="54" width="42" height="34" rx="10" fill={`url(#${g("pil")})`} />
        <path d="M171 60 l3 6 6 1 -4.5 4 1.2 6 -5.7 -3 -5.7 3 1.2 -6 -4.5 -4 6 -1 z" fill="#FFFFFF" opacity="0.75" />
      </g>
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

function Bookshelf({ u, a11y }: P) {
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
      <FloorShadow cx={75} cy={204} rx={70} ry={6} />
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
      <g transform="rotate(12 92 70)"><rect x="86" y="32" width="11" height="38" rx="1.2" fill="#C7B4D9" /></g>
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

function Table({ u, a11y }: P) {
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
      {[[116, 32], [126, 30], [132, 35]].map(([x, y]) => (
        <g key={x}><circle cx={x} cy={y} r="5" fill="#D9A36A" /><circle cx={x! - 1.5} cy={y! - 1} r="1" fill="#7A4B2A" /><circle cx={x! + 1.5} cy={y! + 1} r="0.9" fill="#7A4B2A" /></g>
      ))}
    </svg>
  );
}

function DogHouse({ u, a11y }: P) {
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

function Bowl({ u, a11y }: P) {
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
      <ellipse cx="50" cy="19" rx="33" ry="6" fill={`url(#${g("food")})`} />
      {[[36, 17], [44, 15], [52, 17], [60, 15], [66, 19], [40, 21], [56, 21], [48, 19]].map(([x, y], i) => (
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
