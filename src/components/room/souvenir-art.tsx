"use client";

/**
 * おさんぽのおみやげの絵（SVG）。家具と同じく、光は左上から当たる前提で、上と左をあかるく・右下をくらく塗る。
 * どれも viewBox 0 0 100 100 で、足もと（y=92 あたり）に置いた形に描く（棚や床にそのまま乗る）。
 * 花ものは小さなガラスびんに挿し、花びらは小皿に乗せて「飾るもの」にする。レアは光の輪ときらめきをまとう。
 * 同じおみやげを2つ置いてもグラデーションの id がぶつからないよう、useId で id を分ける。
 */
import { useId, type ReactNode } from "react";
import { SHINY_FILTER, type SouvenirId } from "@/lib/room/souvenirs";

const SVG_CLASS = "pointer-events-none block h-auto w-full";
/** 三角関数で出した座標は、サーバーと端末で最後の桁がずれることがある（表示の食いちがい）。小数2けたにそろえる */
const r2 = (n: number) => Math.round(n * 100) / 100;

/** 置いたところの影（ふんわり広い影と、接地点の濃い影） */
function Shadow({ cx = 50, rx = 30 }: { cx?: number; rx?: number }) {
  return (
    <g>
      <ellipse cx={cx} cy="93" rx={rx} ry="5" fill="#3A2614" opacity="0.12" />
      <ellipse cx={cx} cy="92.4" rx={rx * 0.62} ry="2.6" fill="#3A2614" opacity="0.2" />
    </g>
  );
}

/** 4本の光のきらめき */
function Sparkle({ x, y, s = 1, delay = 0 }: { x: number; y: number; s?: number; delay?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="room-sv-twinkle" style={{ animationDelay: `${delay}s` }}>
        <path d="M0 -7 C 0.8 -1.6 1.6 -0.8 7 0 C 1.6 0.8 0.8 1.6 0 7 C -0.8 1.6 -1.6 0.8 -7 0 C -1.6 -0.8 -0.8 -1.6 0 -7 Z" fill="#FFF6C8" />
        <circle r="1.4" fill="#FFFFFF" />
      </g>
    </g>
  );
}

/** レアのおみやげの後ろの光の輪 */
function Aura({ g, cx = 50, cy = 58, r = 40, color = "#FFE58A" }: { g: (n: string) => string; cx?: number; cy?: number; r?: number; color?: string }) {
  return (
    <g>
      <defs>
        <radialGradient id={g("aura")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={color} stopOpacity="0.75" />
          <stop offset="0.55" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle className="room-sv-aura" cx={cx} cy={cy} r={r} fill={`url(#${g("aura")})`} />
    </g>
  );
}

/** 花を挿す小さなガラスびん（水が入っていて、茎が透けて見える）。children は びんに挿すもの */
function Bottle({ g, children, tint = "#CFEAF2" }: { g: (n: string) => string; children: ReactNode; tint?: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={g("glass")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.75" />
          <stop offset="0.25" stopColor={tint} stopOpacity="0.35" />
          <stop offset="0.75" stopColor={tint} stopOpacity="0.4" />
          <stop offset="1" stopColor="#7FA8B8" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id={g("water")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A9DCEB" stopOpacity="0.55" /><stop offset="1" stopColor="#6FB4CC" stopOpacity="0.7" /></linearGradient>
      </defs>
      <Shadow rx={16} />
      {/* 挿したもの（びんの中の茎は、水と ガラスの下に透けて見える） */}
      {children}
      {/* びん：まるい胴・細い首・あついふち */}
      <path d="M43 62 L43 67 C 35 70 34 76 34 82 C 34 90 40 93 50 93 C 60 93 66 90 66 82 C 66 76 65 70 57 67 L57 62 Z" fill={`url(#${g("glass")})`} stroke="#9CC2CF" strokeWidth="0.9" />
      <path d="M36 78 C 36 75 40 73 50 73 C 60 73 64 75 64 78 L 64 82 C 64 89 59 91.6 50 91.6 C 41 91.6 36 89 36 82 Z" fill={`url(#${g("water")})`} />
      <path d="M36.5 78 C 40 79.6 60 79.6 63.5 78" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="0.9" fill="none" />
      <rect x="41.5" y="59.6" width="17" height="3.6" rx="1.8" fill="#E8F4F8" stroke="#9CC2CF" strokeWidth="0.8" />
      {/* 首に巻いた麻ひも */}
      <path d="M43 65 Q50 67.4 57 65" stroke="#C9A06A" strokeWidth="1.8" fill="none" />
      <path d="M50 66.4 l-3 5 M50 66.4 l2.6 5.4" stroke="#C9A06A" strokeWidth="1.2" strokeLinecap="round" />
      {/* ガラスの光 */}
      <path d="M39 76 C 38 80 38.6 85 41 88" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="2" strokeLinecap="round" fill="none" />
      <ellipse cx="45" cy="62" rx="1.2" ry="0.8" fill="#FFFFFF" opacity="0.9" />
    </g>
  );
}

/** 小皿（花びら・貝がらを乗せる。白い磁器に藍のふち） */
function Dish({ g }: { g: (n: string) => string }) {
  return (
    <g>
      <defs><radialGradient id={g("dish")} cx="0.4" cy="0.35" r="0.8"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#E6E0D6" /></radialGradient></defs>
      <Shadow rx={34} />
      <ellipse cx="50" cy="86" rx="36" ry="9" fill="#C9C1B2" />
      <ellipse cx="50" cy="83" rx="37" ry="10" fill={`url(#${g("dish")})`} stroke="#3F5E9A" strokeWidth="1.6" />
      <ellipse cx="50" cy="83" rx="31" ry="7.4" fill="none" stroke="#3F5E9A" strokeWidth="0.6" strokeDasharray="2 2.4" opacity="0.7" />
      <ellipse cx="38" cy="80" rx="8" ry="2" fill="#FFFFFF" opacity="0.8" />
    </g>
  );
}

/**
 * shiny（色ちがい）は、絵の色をまるごと変え（iPhone の Safari でも効くよう、svg 要素そのものに CSS の filter をかける）、
 * 上に虹色のきらめきを重ねる
 */
export function SouvenirArt({ id, label, shiny = false }: { id: SouvenirId; label?: string; shiny?: boolean }) {
  const u = `sv${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const g = (n: string) => `${u}-${n}`;
  const a11y = label ? { role: "img" as const, "aria-label": label } : {};
  const body = ((): ReactNode => {
    switch (id) {
      case "pebble":
        // 川原のまるい石：ひらたくて すべすべ。白いすじと、細かい斑点
        return (
          <>
            <defs>
              <radialGradient id={g("s")} cx="0.36" cy="0.28" r="0.85"><stop offset="0" stopColor="#ECE8E1" /><stop offset="0.55" stopColor="#B9B2A6" /><stop offset="1" stopColor="#7E776C" /></radialGradient>
              <radialGradient id={g("s2")} cx="0.4" cy="0.3" r="0.85"><stop offset="0" stopColor="#D9CBB8" /><stop offset="1" stopColor="#8C7A64" /></radialGradient>
              <clipPath id={g("c")}><path d="M18 78 C 18 64 36 58 54 59 C 74 60 86 68 84 79 C 82 89 66 92 50 92 C 32 92 18 88 18 78 Z" /></clipPath>
            </defs>
            <Shadow rx={34} />
            {/* うしろの小さい石 */}
            <ellipse cx="78" cy="86" rx="11" ry="7" fill={`url(#${g("s2")})`} />
            <ellipse cx="75" cy="83" rx="4" ry="1.6" fill="#FFFFFF" opacity="0.5" />
            <path d="M18 78 C 18 64 36 58 54 59 C 74 60 86 68 84 79 C 82 89 66 92 50 92 C 32 92 18 88 18 78 Z" fill={`url(#${g("s")})`} />
            <g clipPath={`url(#${g("c")})`}>
              <path d="M14 82 C 34 74 60 72 90 74" stroke="#F4F1EC" strokeWidth="3" fill="none" opacity="0.8" />
              <path d="M14 86 C 36 80 62 78 90 80" stroke="#F4F1EC" strokeWidth="1" fill="none" opacity="0.5" />
              {[[30, 70], [44, 66], [62, 68], [70, 84], [38, 86], [56, 88], [74, 72]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={0.9 + (i % 3) * 0.3} fill="#6E675C" opacity="0.45" />)}
              <ellipse cx="50" cy="92" rx="40" ry="8" fill="#000" opacity="0.12" />
            </g>
            <ellipse cx="37" cy="66" rx="12" ry="3.6" fill="#FFFFFF" opacity="0.55" transform="rotate(-8 37 66)" />
          </>
        );
      case "heart-stone":
        // ハートの形のローズクォーツ：すきとおった桃色、中が光る、面のきらめき
        return (
          <>
            <Aura g={g} cy={62} r={42} color="#FFC4D6" />
            <defs>
              <radialGradient id={g("q")} cx="0.38" cy="0.32" r="0.85"><stop offset="0" stopColor="#FFF0F4" /><stop offset="0.45" stopColor="#F7B3C6" /><stop offset="1" stopColor="#C9668A" /></radialGradient>
              <radialGradient id={g("in")} cx="0.5" cy="0.6" r="0.5"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" /><stop offset="1" stopColor="#FFFFFF" stopOpacity="0" /></radialGradient>
            </defs>
            <Shadow rx={26} />
            <path d="M50 91 C 26 79 15 64 21 51 C 27 39 43 39 50 50 C 57 39 73 39 79 51 C 85 64 74 79 50 91 Z" fill={`url(#${g("q")})`} stroke="#B9577A" strokeWidth="1" />
            {/* 面（カット）の線 */}
            <path d="M50 50 L50 91 M29 46 L42 64 L50 91 M71 46 L58 64 L50 91 M42 64 L58 64 M21 56 L42 64 M79 56 L58 64" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="0.8" fill="none" />
            <ellipse cx="50" cy="70" rx="16" ry="12" fill={`url(#${g("in")})`} />
            <path d="M28 52 C 30 46 36 44 41 47" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.85" />
            <circle cx="64" cy="53" r="1.8" fill="#FFFFFF" opacity="0.9" />
            <Sparkle x={80} y={34} s={1.2} />
            <Sparkle x={20} y={40} s={0.8} delay={0.6} />
            <Sparkle x={70} y={80} s={0.6} delay={1.1} />
          </>
        );
      case "feather":
        // 鳥のはね：ゆるくカーブした羽根。羽軸と、ところどころ割れた羽枝。すこし浮いて影が落ちる
        return (
          <>
            <defs>
              <linearGradient id={g("f")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.5" stopColor="#E3EAF2" /><stop offset="1" stopColor="#9BB0C8" /></linearGradient>
              <linearGradient id={g("tip")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5E7FA8" stopOpacity="0.85" /><stop offset="1" stopColor="#5E7FA8" stopOpacity="0" /></linearGradient>
            </defs>
            <ellipse cx="54" cy="91" rx="34" ry="4" fill="#3A2614" opacity="0.13" />
            <g transform="rotate(-62 52 72)">
              <path d="M52 22 C 64 32 68 54 64 74 L 61 92 L 55 92 L 56 80 C 50 82 44 80 40 76 C 44 74 46 72 45 70 C 40 66 38 54 42 42 C 44 34 48 27 52 22 Z" fill={`url(#${g("f")})`} />
              <path d="M52 22 C 60 28 64 36 64 44 C 58 40 50 38 43 41 C 45 33 48 27 52 22 Z" fill={`url(#${g("tip")})`} />
              {/* 羽枝 */}
              {[34, 42, 50, 58, 66].map((y) => <path key={y} d={`M54 ${y} q-6 2 -11 0 M54 ${y} q6 1 9 -2`} stroke="#B4C3D6" strokeWidth="0.7" fill="none" />)}
              {/* 割れ目 */}
              <path d="M45 70 L52 64" stroke="#F4F7FA" strokeWidth="1.6" />
              {/* 羽軸 */}
              <path d="M52 24 C 55 44 57 64 58 96" stroke="#8C7A64" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <path d="M52 24 C 55 44 57 64 58 80" stroke="#F4EBDD" strokeWidth="0.7" fill="none" />
              {/* 根もとの ふわ毛 */}
              {[0, 1, 2].map((i) => <path key={i} d={`M57 ${84 + i * 2} q-6 -1 -9 3`} stroke="#E3EAF2" strokeWidth="1.2" fill="none" strokeLinecap="round" />)}
            </g>
          </>
        );
      case "twig":
        // いい感じの小えだ：Y字の枝。木の皮のすじ、折れたところは明るい木口、新芽の葉2枚
        return (
          <>
            <defs><linearGradient id={g("b")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A87A4E" /><stop offset="1" stopColor="#5E3C20" /></linearGradient></defs>
            <Shadow rx={38} />
            <path d="M10 86 C 30 82 56 76 78 64 L 88 58" stroke={`url(#${g("b")})`} strokeWidth="7" strokeLinecap="round" fill="none" />
            <path d="M48 77 C 52 66 58 58 66 52 L 70 48" stroke={`url(#${g("b")})`} strokeWidth="4.4" strokeLinecap="round" fill="none" />
            {/* 皮のすじ・ふし */}
            <path d="M20 82 l8 -1.6 M36 79 l7 -1.8 M60 71 l6 -3 M74 64 l4 -2.4" stroke="#3E2814" strokeWidth="0.9" opacity="0.6" />
            <ellipse cx="52" cy="74.6" rx="2.4" ry="1.6" fill="#4A2E16" />
            <path d="M12 84 C 32 79 58 73 80 61" stroke="#D9B48A" strokeWidth="1.2" fill="none" opacity="0.6" />
            {/* 折れた木口 */}
            <ellipse cx="10.4" cy="86" rx="2.6" ry="3.4" fill="#E8CBA0" stroke="#8A5E36" strokeWidth="0.8" />
            <circle cx="10.4" cy="86" r="1" fill="none" stroke="#B88A5A" strokeWidth="0.5" />
            {/* 新芽 */}
            <g transform="translate(70 48)">
              <path d="M0 0 C -4 -8 -2 -14 6 -16 C 8 -8 6 -3 0 0 Z" fill="#7CC05A" />
              <path d="M0 0 C 6 -3 12 -2 15 3 C 9 7 3 5 0 0 Z" fill="#5EA444" />
              <path d="M0 0 L5 -12 M0 0 L11 2" stroke="#3F7A2E" strokeWidth="0.7" />
            </g>
          </>
        );
      case "sakura":
        // 小皿に乗せた桜の花びら：切れこみのある花びら、先がこい桃色、すじ
        return (
          <>
            <Dish g={g} />
            <defs><linearGradient id={g("p")} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#FFF4F7" /><stop offset="1" stopColor="#F6A6BE" /></linearGradient></defs>
            {([[34, 80, -30, 1], [52, 77, 12, 1.1], [66, 82, 50, 0.95], [44, 86, 80, 0.9], [60, 72, -60, 0.8]] as const).map(([x, y, r, s], i) => (
              <g key={i} transform={`translate(${x} ${y}) rotate(${r}) scale(${s} ${s * 0.62})`}>
                <path d="M0 10 C -9 4 -10 -6 -4 -11 L -1 -7 L 0 -11 L 1 -7 L 4 -11 C 10 -6 9 4 0 10 Z" fill={`url(#${g("p")})`} stroke="#E88AA8" strokeWidth="0.7" />
                <path d="M0 8 L0 -6 M0 6 L-3 -4 M0 6 L3 -4" stroke="#F4A0B8" strokeWidth="0.5" />
              </g>
            ))}
          </>
        );
      case "dandelion":
        // たんぽぽ：黄色い花と、白いわた毛を1本ずつ。びんに挿して
        return (
          <Bottle g={g}>
            <path d="M48 80 C 47 62 44 46 40 30" stroke="#5E9A44" strokeWidth="2.2" fill="none" />
            <path d="M52 80 C 54 60 58 46 62 36" stroke="#6CAE4E" strokeWidth="2" fill="none" />
            {/* わた毛 */}
            <g transform="translate(62 30)">
              {/* わたの玉（明るい背景でも見えるよう、うすい灰色のふちと影） */}
              <circle r="13.5" fill="#EEF2F4" opacity="0.7" />
              <circle r="13.5" fill="none" stroke="#C8D0D6" strokeWidth="0.6" opacity="0.9" />
              {Array.from({ length: 26 }, (_, i) => {
                const a = (i / 26) * Math.PI * 2, x = r2(Math.cos(a) * 12), y = r2(Math.sin(a) * 12);
                return <g key={i}><path d={`M0 0 L${r2(x * 0.85)} ${r2(y * 0.85)}`} stroke="#B9C2C8" strokeWidth="0.45" /><circle cx={x} cy={y} r="1.7" fill="#FFFFFF" stroke="#C8D0D6" strokeWidth="0.4" /></g>;
              })}
              <circle r="2.8" fill="#A8946A" />
            </g>
            {/* 黄色い花（外がわの花びら → 内がわ） */}
            <g transform="translate(40 30)">
              {Array.from({ length: 18 }, (_, i) => <ellipse key={`o${i}`} cx="0" cy="-9.5" rx="2.4" ry="6" fill="#FFC21A" stroke="#E89E0A" strokeWidth="0.4" transform={`rotate(${i * 20})`} />)}
              {Array.from({ length: 14 }, (_, i) => <ellipse key={`i${i}`} cx="0" cy="-6" rx="2" ry="4.4" fill="#FFD84A" transform={`rotate(${i * 25.7 + 10})`} />)}
              <circle r="3.6" fill="#F2B21A" />
              <circle cx="-1.2" cy="-1.2" r="1.4" fill="#FFF0A0" />
            </g>
            <path d="M44 56 C 36 52 32 46 30 40 C 36 42 42 48 44 56 Z" fill="#6CAE4E" />
          </Bottle>
        );
      case "clover":
        // よつばのクローバー（レア）：びんに挿して、光の輪
        return (
          <>
            <Aura g={g} cy={46} r={36} color="#C8F5A8" />
            <Bottle g={g} tint="#D6F2D0">
              <path d="M50 80 C 50 66 49 56 50 42" stroke="#4E8A3A" strokeWidth="2" fill="none" />
              <defs><radialGradient id={g("l")} cx="0.5" cy="0.8" r="0.9"><stop offset="0" stopColor="#3F8A3A" /><stop offset="1" stopColor="#8AD66A" /></radialGradient></defs>
              <g transform="translate(50 36)">
                {[0, 90, 180, 270].map((r) => (
                  <g key={r} transform={`rotate(${r + 45})`}>
                    <path d="M0 0 C -10 -6 -12 -18 -5 -20 C -2 -21 0 -18 0 -16 C 0 -18 2 -21 5 -20 C 12 -18 10 -6 0 0 Z" fill={`url(#${g("l")})`} stroke="#2F6A2A" strokeWidth="0.7" />
                    <path d="M0 -2 L0 -15" stroke="#D6F2C0" strokeWidth="0.8" />
                    <path d="M-4 -11 C -2 -12 2 -12 4 -11" stroke="#E6FAD8" strokeWidth="0.9" fill="none" opacity="0.8" />
                  </g>
                ))}
                <circle r="1.6" fill="#2F6A2A" />
              </g>
            </Bottle>
            <Sparkle x={76} y={22} s={1.1} />
            <Sparkle x={24} y={28} s={0.8} delay={0.7} />
          </>
        );
      case "shell":
        // 貝がら：ホタテのような扇形（放射のすじ・耳）と、小さな巻き貝
        return (
          <>
            <defs>
              <linearGradient id={g("s")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF6EC" /><stop offset="0.6" stopColor="#F2CFA8" /><stop offset="1" stopColor="#D49A6E" /></linearGradient>
              <linearGradient id={g("sp")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFF4E0" /><stop offset="1" stopColor="#C9926A" /></linearGradient>
            </defs>
            <Shadow rx={36} />
            {/* 巻き貝 */}
            <g transform="translate(76 80) rotate(20)">
              <path d="M-10 6 C -12 -4 -4 -12 4 -10 C 10 -8 12 0 8 6 C 4 10 -6 10 -10 6 Z" fill={`url(#${g("sp")})`} stroke="#B07A50" strokeWidth="0.7" />
              <path d="M-6 4 C -6 -2 0 -6 4 -4 C 6 -2 6 2 2 3 C 0 3 -1 1 0 0" stroke="#B07A50" strokeWidth="0.9" fill="none" />
              <path d="M8 6 L13 10" stroke="#C9926A" strokeWidth="3" strokeLinecap="round" />
            </g>
            {/* ホタテ */}
            <g transform="rotate(-8 44 70)">
              <path d="M44 88 C 22 88 14 66 20 54 C 26 42 62 42 68 54 C 74 66 66 88 44 88 Z" fill={`url(#${g("s")})`} stroke="#C08A60" strokeWidth="1" />
              {[-20, -13, -6.5, 0, 6.5, 13, 20].map((dx, i) => (
                <g key={dx}>
                  <path d={`M44 87 Q ${44 + dx * 0.55} 66 ${44 + dx} 47`} stroke="#D49A6E" strokeWidth="2.2" fill="none" opacity="0.55" />
                  <path d={`M44 87 Q ${44 + dx * 0.55 - 1} 66 ${44 + dx - 1.2} 47`} stroke="#FFFFFF" strokeWidth="0.8" fill="none" opacity={i % 2 ? 0.5 : 0.3} />
                </g>
              ))}
              {/* 成長線 */}
              {[60, 70, 78].map((y) => <path key={y} d={`M${24 + (y - 60) * 0.5} ${y} Q44 ${y + 3} ${64 - (y - 60) * 0.5} ${y}`} stroke="#C08A60" strokeWidth="0.5" fill="none" opacity="0.6" />)}
              {/* 耳（ちょうつがい） */}
              <path d="M34 86 L 30 92 L 58 92 L 54 86 Z" fill="#E8B88A" stroke="#C08A60" strokeWidth="0.8" />
              <path d="M26 54 C 30 48 38 46 44 46" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.8" />
            </g>
          </>
        );
      case "sakura-shell":
        // さくら貝（レア）：うすくて すきとおった桃色の貝が2まい、真珠のような照り
        return (
          <>
            <Aura g={g} cy={68} r={38} color="#FFD0E0" />
            <Dish g={g} />
            <defs>
              <linearGradient id={g("s")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFF0F5" stopOpacity="0.95" /><stop offset="0.5" stopColor="#F9B8CC" stopOpacity="0.9" /><stop offset="1" stopColor="#E07FA0" stopOpacity="0.9" /></linearGradient>
              <linearGradient id={g("pearl")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#CDE8FF" stopOpacity="0" /><stop offset="0.5" stopColor="#E8DCFF" stopOpacity="0.6" /><stop offset="1" stopColor="#FFF2CC" stopOpacity="0" /></linearGradient>
            </defs>
            {([[38, 80, -20, 1], [62, 78, 24, 0.9]] as const).map(([x, y, r, s], i) => (
              <g key={i} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
                <path d="M-15 4 C -16 -8 -4 -15 6 -12 C 15 -9 18 2 12 8 C 6 12 -12 12 -15 4 Z" fill={`url(#${g("s")})`} stroke="#D86F92" strokeWidth="0.8" />
                <path d="M-12 2 C -6 -6 6 -8 12 -2" stroke={`url(#${g("pearl")})`} strokeWidth="4" fill="none" />
                {[-6, 0, 6].map((d) => <path key={d} d={`M-13 6 Q ${d} ${-2 + Math.abs(d) * 0.3} ${12} ${4}`} stroke="#E890AE" strokeWidth="0.4" fill="none" opacity="0.6" />)}
                <path d="M-10 -2 C -6 -8 0 -10 5 -9" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.9" />
              </g>
            ))}
            <Sparkle x={74} y={52} s={1.1} />
            <Sparkle x={26} y={60} s={0.7} delay={0.8} />
          </>
        );
      case "sunflower":
        // ひまわり：2重の花びら・種の模様のある まん中。大きな葉。びんに挿して
        return (
          <Bottle g={g}>
            <defs>
              <radialGradient id={g("c")} cx="0.4" cy="0.35" r="0.7"><stop offset="0" stopColor="#8A5A2A" /><stop offset="1" stopColor="#3E2410" /></radialGradient>
              <linearGradient id={g("pt")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE04A" /><stop offset="1" stopColor="#F2A81A" /></linearGradient>
            </defs>
            <path d="M50 80 C 50 64 49 50 50 36" stroke="#5E9A44" strokeWidth="2.6" fill="none" />
            <path d="M50 58 C 40 56 32 50 30 42 C 38 42 46 48 50 58 Z" fill="#5EA444" />
            <path d="M50 58 C 42 54 36 48 31 43" stroke="#3F7A2E" strokeWidth="0.6" fill="none" />
            <path d="M50 64 C 58 60 66 60 72 54 C 64 52 54 56 50 64 Z" fill="#6CB850" />
            <g transform="translate(50 28)">
              {Array.from({ length: 16 }, (_, i) => <ellipse key={`b${i}`} cx="0" cy="-15" rx="4.2" ry="8.4" fill="#F2A81A" transform={`rotate(${i * 22.5 + 11})`} />)}
              {Array.from({ length: 16 }, (_, i) => <ellipse key={`f${i}`} cx="0" cy="-14" rx="4" ry="8" fill={`url(#${g("pt")})`} stroke="#E8961A" strokeWidth="0.4" transform={`rotate(${i * 22.5})`} />)}
              <circle r="9" fill={`url(#${g("c")})`} />
              {Array.from({ length: 30 }, (_, i) => { const a = i * 2.4, r = Math.sqrt(i) * 1.5; return <circle key={i} cx={r2(Math.cos(a) * r)} cy={r2(Math.sin(a) * r)} r="0.7" fill="#C9A060" opacity="0.7" />; })}
              <path d="M-6 -5 C -4 -7 -1 -8 2 -7.6" stroke="#B88A50" strokeWidth="0.9" fill="none" />
            </g>
          </Bottle>
        );
      case "acorn":
      case "gold-acorn": {
        // どんぐり：ぼうしをかぶったのと、ころんと転がったのを2つ（ぴかぴかどんぐりは金色で1つ、光の輪つき）
        const gold = id === "gold-acorn";
        const nut = gold ? ["#FFF6C0", "#F2C640", "#B07A0A"] : ["#E8B07A", "#B8682E", "#6E3A16"];
        const cap = gold ? ["#E0A824", "#8A5E0A"] : ["#9C7A50", "#5E4428"];
        const acornShape = (k: string, tf: string, scale = 1) => (
          <g transform={tf}>
            <g transform={`scale(${scale})`}>
              <path d="M-15 0 C -15 18 -7 28 0 30 C 7 28 15 18 15 0 Z" fill={`url(#${g(`n${k}`)})`} />
              <path d="M-15 0 C -15 18 -7 28 0 30 C 7 28 15 18 15 0 Z" fill="none" stroke={nut[2]} strokeWidth="0.6" opacity="0.6" />
              {/* たてのすじ */}
              <path d="M-6 4 C -6 16 -3 24 0 28 M6 4 C 6 16 3 24 0 28" stroke={nut[2]} strokeWidth="0.5" fill="none" opacity="0.35" />
              <ellipse cx="-6" cy="11" rx="3.4" ry="7" fill="#FFFFFF" opacity={gold ? 0.7 : 0.35} />
              <circle cx="0" cy="29" r="1.4" fill={nut[2]} />
              {/* ぼうし：うろこ模様 */}
              <path d="M-18 1 C -18 -12 18 -12 18 1 C 10 5 -10 5 -18 1 Z" fill={`url(#${g(`c${k}`)})`} />
              {[-12, -6, 0, 6, 12].map((x) => [-6, -1].map((y) => <path key={`${x}${y}`} d={`M${x - 3} ${y} q3 3 6 0`} stroke={cap[1]} strokeWidth="0.8" fill="none" opacity="0.7" />))}
              <path d="M-16 -3 C -10 -9 0 -10 8 -8" stroke="#FFFFFF" strokeWidth="1.2" fill="none" opacity="0.35" />
              <path d="M0 -8 C 0 -13 2 -16 5 -17" stroke={cap[1]} strokeWidth="2.6" strokeLinecap="round" fill="none" />
            </g>
          </g>
        );
        return (
          <>
            {gold ? <Aura g={g} cy={62} r={40} color="#FFE07A" /> : null}
            <defs>
              {["a", "b"].map((k) => (
                <g key={k}>
                  <radialGradient id={g(`n${k}`)} cx="0.35" cy="0.3" r="0.85"><stop offset="0" stopColor={nut[0]} /><stop offset="0.55" stopColor={nut[1]} /><stop offset="1" stopColor={nut[2]} /></radialGradient>
                  <linearGradient id={g(`c${k}`)} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={cap[0]} /><stop offset="1" stopColor={cap[1]} /></linearGradient>
                </g>
              ))}
            </defs>
            <Shadow rx={gold ? 22 : 34} />
            {gold ? (
              acornShape("a", "translate(50 58)", 1.15)
            ) : (
              <>
                {acornShape("b", "translate(70 72) rotate(-78)", 0.82)}
                {acornShape("a", "translate(40 58)")}
              </>
            )}
            {gold ? (<><Sparkle x={76} y={36} s={1.2} /><Sparkle x={26} y={46} s={0.8} delay={0.5} /><Sparkle x={66} y={84} s={0.6} delay={1} /></>) : null}
          </>
        );
      }
      case "maple":
        // もみじ：赤から橙へのグラデーション、葉脈。うしろに黄色い小さいもみじ
        return (
          <>
            <defs>
              <radialGradient id={g("m")} cx="0.5" cy="0.6" r="0.7"><stop offset="0" stopColor="#F2902E" /><stop offset="0.6" stopColor="#E0461E" /><stop offset="1" stopColor="#A8241A" /></radialGradient>
              <radialGradient id={g("y")} cx="0.5" cy="0.6" r="0.7"><stop offset="0" stopColor="#FFE07A" /><stop offset="1" stopColor="#E8A21A" /></radialGradient>
            </defs>
            <Shadow rx={34} />
            {(["y", "m"] as const).map((k) => (
              <g key={k} transform={k === "y" ? "translate(70 72) rotate(30) scale(0.55)" : "translate(44 64) rotate(-14)"}>
                <path d="M0 -40 L6 -18 L24 -28 L18 -8 L38 -6 L20 4 L28 20 L8 12 L0 30 L-8 12 L-28 20 L-20 4 L-38 -6 L-18 -8 L-24 -28 L-6 -18 Z" fill={`url(#${g(k)})`} stroke={k === "m" ? "#8A1E14" : "#C08010"} strokeWidth="0.9" strokeLinejoin="round" />
                <path d="M0 30 L0 -36 M0 6 L-30 -4 M0 6 L30 -4 M0 4 L-20 -24 M0 4 L20 -24 M0 10 L-22 16 M0 10 L22 16" stroke={k === "m" ? "#B02A1A" : "#C8901A"} strokeWidth="0.9" fill="none" opacity="0.8" />
                <path d="M0 30 C 1 36 3 40 6 42" stroke={k === "m" ? "#8A1E14" : "#C08010"} strokeWidth="1.6" fill="none" strokeLinecap="round" />
                <path d="M-6 -20 L-2 -32" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" opacity="0.4" />
              </g>
            ))}
          </>
        );
      case "pinecone":
        // まつぼっくり：らせんに重なるかさ（1枚ずつ明暗）。すこしかたむけて置く
        return (
          <>
            <defs><linearGradient id={g("sc")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C08A52" /><stop offset="1" stopColor="#6E4422" /></linearGradient></defs>
            <Shadow rx={30} />
            <g transform="rotate(-24 50 62)">
              <ellipse cx="50" cy="60" rx="20" ry="30" fill="#4A2C14" />
              {Array.from({ length: 7 }, (_, row) => {
                const y = 36 + row * 7.4, w = r2(14 + Math.sin((row / 6) * Math.PI) * 8), n = row % 2 ? 4 : 3;
                return Array.from({ length: n }, (_, i) => {
                  const x = 50 + (i - (n - 1) / 2) * (w * 2 / n);
                  return (
                    <g key={`${row}-${i}`}>
                      <path d={`M${x - 6} ${y} Q ${x} ${y + 9} ${x + 6} ${y} Q ${x} ${y - 2.6} ${x - 6} ${y} Z`} fill={`url(#${g("sc")})`} stroke="#3E2410" strokeWidth="0.7" />
                      <path d={`M${x - 3} ${y + 2} Q ${x} ${y + 4.6} ${x + 3} ${y + 2}`} stroke="#E0B47A" strokeWidth="0.7" fill="none" opacity="0.7" />
                    </g>
                  );
                });
              })}
              <path d="M50 30 L50 23" stroke="#5E3818" strokeWidth="3.4" strokeLinecap="round" />
              <path d="M36 44 C 38 38 42 34 46 33" stroke="#FFFFFF" strokeWidth="1.4" fill="none" opacity="0.3" />
            </g>
          </>
        );
      case "camellia":
        // つばき：まっかな花びらが重なり、黄色いしべ。つやのある濃い緑の葉。びんに挿して
        return (
          <Bottle g={g}>
            <defs>
              <radialGradient id={g("p")} cx="0.4" cy="0.3" r="0.8"><stop offset="0" stopColor="#FF6A7A" /><stop offset="0.6" stopColor="#D8202E" /><stop offset="1" stopColor="#8A101C" /></radialGradient>
              <linearGradient id={g("lf")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4E9A4E" /><stop offset="1" stopColor="#1E5028" /></linearGradient>
            </defs>
            <path d="M50 80 C 50 66 48 54 50 42" stroke="#5A4028" strokeWidth="2.4" fill="none" />
            {([[38, 50, -40], [62, 54, 36], [42, 62, -20]] as const).map(([x, y, r], i) => (
              <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
                <path d="M0 -12 C 8 -8 8 6 0 12 C -8 6 -8 -8 0 -12 Z" fill={`url(#${g("lf")})`} />
                <path d="M0 -10 L0 10" stroke="#A8D8A0" strokeWidth="0.6" />
                <path d="M-3 -6 C -2 -8 0 -9 2 -9" stroke="#FFFFFF" strokeWidth="1" opacity="0.5" fill="none" />
              </g>
            ))}
            <g transform="translate(50 32)">
              {[0, 72, 144, 216, 288].map((r) => <path key={`o${r}`} d="M0 0 C -10 -4 -12 -18 0 -20 C 12 -18 10 -4 0 0 Z" fill={`url(#${g("p")})`} stroke="#8A101C" strokeWidth="0.6" transform={`rotate(${r + 36})`} />)}
              {[0, 72, 144, 216, 288].map((r) => <path key={`i${r}`} d="M0 0 C -7 -3 -8 -13 0 -14 C 8 -13 7 -3 0 0 Z" fill={`url(#${g("p")})`} stroke="#8A101C" strokeWidth="0.5" transform={`rotate(${r})`} />)}
              <circle r="5" fill="#FFE07A" />
              {Array.from({ length: 10 }, (_, i) => <circle key={i} cx={r2(Math.cos(i * 0.63) * 4)} cy={r2(Math.sin(i * 0.63) * 4)} r="1.1" fill="#F2A81A" />)}
              <path d="M-12 -12 C -9 -16 -4 -18 0 -18" stroke="#FFFFFF" strokeWidth="1.4" fill="none" opacity="0.45" />
            </g>
          </Bottle>
        );
      case "nanten":
        // なんてんの実：赤い実のふさ（1つずつ つや）と、細い葉。びんに挿して
        return (
          <Bottle g={g}>
            <defs><radialGradient id={g("r")} cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#FF6A5A" /><stop offset="0.6" stopColor="#D8202A" /><stop offset="1" stopColor="#8A0E18" /></radialGradient></defs>
            <path d="M50 80 C 49 64 47 52 44 40 M48 60 C 54 52 58 44 60 34" stroke="#6A4A2A" strokeWidth="1.8" fill="none" />
            {([[34, 52, -50], [30, 44, -70], [66, 46, 40], [70, 38, 60], [58, 58, 20]] as const).map(([x, y, r], i) => (
              <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
                <path d="M0 -9 C 4 -4 4 4 0 9 C -4 4 -4 -4 0 -9 Z" fill={i % 2 ? "#3F7A3A" : "#5E9A44"} />
                <path d="M0 -8 L0 8" stroke="#A8D8A0" strokeWidth="0.5" />
              </g>
            ))}
            {([[42, 34], [47, 31], [38, 30], [44, 27], [49, 25], [40, 23], [58, 30], [63, 28], [60, 23], [55, 25], [65, 22], [52, 20]] as const).map(([x, y], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r="3.6" fill={`url(#${g("r")})`} />
                <circle cx={x - 1.2} cy={y - 1.3} r="1" fill="#FFFFFF" opacity="0.85" />
              </g>
            ))}
          </Bottle>
        );
      case "snow-crystal":
        // とけない雪のけっしょう（レア）：木の台にガラスのドーム。中で青白く光る雪のけっしょう
        return (
          <>
            <Aura g={g} cy={52} r={40} color="#BFE6FF" />
            <defs>
              <linearGradient id={g("dome")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" /><stop offset="0.3" stopColor="#DFF2FF" stopOpacity="0.18" /><stop offset="0.8" stopColor="#BFE0F2" stopOpacity="0.22" /><stop offset="1" stopColor="#8FB8D0" stopOpacity="0.5" /></linearGradient>
              <linearGradient id={g("wood")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C08A52" /><stop offset="1" stopColor="#6E4422" /></linearGradient>
              <radialGradient id={g("glow")} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" /><stop offset="1" stopColor="#BFE6FF" stopOpacity="0" /></radialGradient>
            </defs>
            <Shadow rx={30} />
            {/* 台 */}
            <path d="M22 84 L78 84 L80 91 L20 91 Z" fill={`url(#${g("wood")})`} />
            <ellipse cx="50" cy="84" rx="28" ry="4" fill="#D9A870" />
            <path d="M24 88 h52" stroke="#4A2C14" strokeWidth="0.6" opacity="0.4" />
            {/* 中の光と雪のけっしょう */}
            <circle cx="50" cy="56" r="18" fill={`url(#${g("glow")})`} />
            <g transform="translate(50 56)"><g className="room-sv-spin">
              {[0, 60, 120].map((r) => (
                <g key={r} transform={`rotate(${r})`}>
                  <path d="M0 -15 L0 15" stroke="#8FD0F2" strokeWidth="2.4" strokeLinecap="round" />
                  <path d="M0 -15 L0 15" stroke="#FFFFFF" strokeWidth="0.9" strokeLinecap="round" />
                  <path d="M0 -9 l-4.4 -4.4 M0 -9 l4.4 -4.4 M0 9 l-4.4 4.4 M0 9 l4.4 4.4" stroke="#BFE6FA" strokeWidth="1.6" strokeLinecap="round" />
                </g>
              ))}
              <path d="M0 -5 L4.3 -2.5 L4.3 2.5 L0 5 L-4.3 2.5 L-4.3 -2.5 Z" fill="#E6F6FF" stroke="#8FD0F2" strokeWidth="0.8" />
            </g></g>
            {/* ちらちら舞う雪 */}
            {([[38, 70], [62, 66], [44, 44], [58, 74], [36, 56]] as const).map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.9" fill="#FFFFFF" opacity="0.9" />)}
            {/* ガラスのドーム */}
            <path d="M24 84 L24 52 C 24 34 36 26 50 26 C 64 26 76 34 76 52 L76 84 Z" fill={`url(#${g("dome")})`} stroke="#A8CDE0" strokeWidth="0.9" />
            <circle cx="50" cy="24" r="3" fill="#E8F4FA" stroke="#A8CDE0" strokeWidth="0.8" />
            <path d="M30 76 L30 52 C 30 42 34 36 40 32" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.75" />
            <path d="M70 60 L70 74" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
            <Sparkle x={80} y={24} s={1.1} />
            <Sparkle x={18} y={40} s={0.7} delay={0.7} />
          </>
        );
    }
  })();
  const art = <svg viewBox="0 0 100 100" overflow="visible" className={SVG_CLASS} style={shiny ? { filter: SHINY_FILTER[id] } : undefined} {...a11y}>{body}</svg>;
  if (!shiny) return art;
  return (
    <span className="pointer-events-none relative block">
      {art}
      {/* 色ちがいのしるし：虹色のきらめき */}
      <svg viewBox="0 0 100 100" overflow="visible" className="pointer-events-none absolute inset-0 block h-full w-full" aria-hidden>
        {([[16, 26, 0.9, "#FF9AC8", 0], [84, 20, 1.1, "#9AD8FF", 0.4], [88, 66, 0.7, "#C8FF9A", 0.9], [12, 70, 0.75, "#FFE07A", 1.3]] as const).map(([x, y, s, c, d], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
            <g className="room-sv-twinkle" style={{ animationDelay: `${d}s` }}>
              <path d="M0 -8 C 0.9 -1.8 1.8 -0.9 8 0 C 1.8 0.9 0.9 1.8 0 8 C -0.9 1.8 -1.8 0.9 -8 0 C -1.8 -0.9 -0.9 -1.8 0 -8 Z" fill={c} />
              <circle r="1.6" fill="#FFFFFF" />
            </g>
          </g>
        ))}
      </svg>
    </span>
  );
}
