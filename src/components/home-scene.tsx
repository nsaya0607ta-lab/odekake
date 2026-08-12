/**
 * ホーム上部のヒーローカードの一枚絵。
 *
 * 水彩の草原（空・山・木立・芝・足あと）と、左から縄で吊り下がった2枚の木の看板で
 * できている。看板は「板だけ」を描いて中身は空にしてあり、おでかけレベルと歩数は
 * 上から重ねて書き込む（level-tag.tsx / steps-tag.tsx）。文字の位置は下の
 * LEVEL_SIGN / STEPS_SIGN が持つ％で決まっていて、どれも viewBox の座標から
 * 割り出した値なので、絵の座標を動かしたら必ずこちらも合わせ直す。
 *
 * ラスタ画像ではなく SVG なのは、板の面に載せる文字と板の絵が絶対にずれないように
 * するため。拡大しても輪郭が崩れず、端末幅が変わっても同じ場所に文字が乗る。
 */

/** 背景の作画座標。空 0〜330 / 芝 320〜、の縦割りで描いてある */
const SCENE_W = 640;
const SCENE_H = 512;

/**
 * カードの縦横比は端末によって変わり、絵より横長になったぶんは上下が切られる。
 * 削っていいのは空だけなので、手前の草花と足あとを下端に固定して余りは上から詰める。
 */
const SCENE_FIT = "xMidYMax slice";

/** 遠景の木立。[中心x, 中心y, 半径, 濃いほうを使うか] */
const FAR_TREES: readonly [number, number, number, boolean][] = [
  [18, 306, 13, false],
  [46, 300, 16, true],
  [76, 308, 12, false],
  [104, 302, 15, true],
  [140, 309, 11, false],
  [176, 301, 16, true],
  [206, 307, 12, false],
  [238, 303, 14, true],
  [272, 309, 11, false],
  [312, 300, 16, true],
  [346, 307, 12, false],
  [378, 302, 14, true],
  [412, 308, 11, false],
  [452, 301, 15, true],
  [488, 307, 12, false],
  [524, 303, 14, true],
  [560, 308, 11, false],
  [598, 302, 15, true],
  [630, 308, 12, false],
];

/** 足あとの列。paw = 肉球、dash = 間をつなぐ点線 */
const TRAIL: readonly { x: number; y: number; paw: boolean; tilt: number }[] = [
  { x: 118, y: 438, paw: true, tilt: -8 },
  { x: 152, y: 446, paw: false, tilt: -4 },
  { x: 186, y: 434, paw: true, tilt: 6 },
  { x: 220, y: 444, paw: false, tilt: -2 },
  { x: 254, y: 436, paw: true, tilt: -6 },
  { x: 288, y: 445, paw: false, tilt: 3 },
  { x: 322, y: 433, paw: true, tilt: 8 },
  { x: 356, y: 443, paw: false, tilt: -3 },
  { x: 390, y: 437, paw: true, tilt: -7 },
  { x: 424, y: 446, paw: false, tilt: 2 },
  { x: 458, y: 434, paw: true, tilt: 5 },
  { x: 492, y: 444, paw: false, tilt: -4 },
  { x: 526, y: 436, paw: true, tilt: -6 },
  { x: 560, y: 445, paw: false, tilt: 3 },
  { x: 596, y: 435, paw: true, tilt: 7 },
];

/** 芝に散らす草の房 */
const TUFTS: readonly [number, number, number][] = [
  [40, 372, 1],
  [96, 396, 1.2],
  [150, 366, 0.9],
  [214, 404, 1.1],
  [268, 378, 1],
  [330, 410, 1.2],
  [392, 372, 0.95],
  [452, 400, 1.15],
  [512, 374, 1],
  [576, 406, 1.2],
  [612, 366, 0.9],
  [70, 466, 1.3],
  [280, 482, 1.2],
  [500, 470, 1.25],
];

export function HomeScene() {
  return (
    <svg
      viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
      preserveAspectRatio={SCENE_FIT}
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute inset-0 h-full w-full select-none"
    >
      <defs>
        <linearGradient id="hs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d9edea" />
          <stop offset="55%" stopColor="#e8f4ef" />
          <stop offset="100%" stopColor="#f4faf1" />
        </linearGradient>
        <linearGradient id="hs-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c6e284" />
          <stop offset="45%" stopColor="#b4d970" />
          <stop offset="100%" stopColor="#a2cd5c" />
        </linearGradient>

        {/* 肉球。1枚の絵として置いて、向きだけ回転で散らす */}
        <g id="hs-paw">
          <ellipse cx="0" cy="3.4" rx="5.2" ry="4.1" />
          <circle cx="-4.9" cy="-2.4" r="2.2" />
          <circle cx="-1.7" cy="-5.4" r="2.3" />
          <circle cx="1.9" cy="-5.2" r="2.3" />
          <circle cx="4.9" cy="-2.1" r="2.1" />
        </g>

        {/* 白い小花。草むらの手前に置く */}
        <g id="hs-daisy">
          <ellipse cx="0" cy="-6" rx="3.1" ry="4.2" fill="#fffdf6" />
          <ellipse cx="5.7" cy="-1.9" rx="4.2" ry="3.1" fill="#fffdf6" />
          <ellipse cx="3.5" cy="4.9" rx="3.6" ry="3.6" fill="#fffdf6" />
          <ellipse cx="-3.5" cy="4.9" rx="3.6" ry="3.6" fill="#fffdf6" />
          <ellipse cx="-5.7" cy="-1.9" rx="4.2" ry="3.1" fill="#fffdf6" />
          <circle cx="0" cy="0" r="2.5" fill="#f0be4b" />
        </g>
      </defs>

      {/* 空 */}
      <rect x="0" y="0" width={SCENE_W} height="342" fill="url(#hs-sky)" />

      {/* 雲。丸を寄せただけの淡いかたまり */}
      <g fill="#ffffff" opacity="0.88">
        <ellipse cx="118" cy="62" rx="30" ry="15" />
        <ellipse cx="146" cy="56" rx="22" ry="17" />
        <ellipse cx="92" cy="66" rx="18" ry="11" />
        <ellipse cx="392" cy="44" rx="26" ry="13" />
        <ellipse cx="414" cy="39" rx="19" ry="15" />
        <ellipse cx="546" cy="78" rx="34" ry="16" />
        <ellipse cx="576" cy="72" rx="24" ry="18" />
        <ellipse cx="518" cy="82" rx="20" ry="12" />
        <ellipse cx="262" cy="96" rx="22" ry="10" />
      </g>

      {/* 奥の山。薄い青緑を三段に重ねて霞ませる */}
      <g fill="#bdd7d2">
        <path d="M-20 344 L72 236 Q90 216 108 236 L206 344 Z" />
        <path d="M262 344 L360 222 Q378 202 396 222 L500 344 Z" />
        <path d="M520 344 L604 246 Q620 228 636 246 L680 344 Z" />
      </g>
      <g fill="#a6c9c3">
        <path d="M120 344 L212 250 Q228 234 244 250 L336 344 Z" />
        <path d="M430 344 L516 254 Q532 238 548 254 L634 344 Z" />
      </g>
      <g fill="#92bcb5">
        <path d="M-20 344 L40 282 Q54 268 68 282 L138 344 Z" />
        <path d="M330 344 L406 268 Q420 254 434 268 L508 344 Z" />
      </g>

      {/* 遠景の木立。山裾を隠すように横一列 */}
      <g>
        {FAR_TREES.map(([cx, cy, r, deep], index) => (
          <g key={`far-${index}`} fill={deep ? "#82b478" : "#96c58a"}>
            <circle cx={cx} cy={cy} r={r} />
            <circle cx={cx - r * 0.6} cy={cy + r * 0.4} r={r * 0.72} />
            <circle cx={cx + r * 0.62} cy={cy + r * 0.42} r={r * 0.7} />
          </g>
        ))}
      </g>

      {/* 芝。上端をゆるく波打たせて、奥の木立の足元を隠す */}
      <path
        d={`M-20 322 C 80 308, 168 326, 262 318 C 372 309, 486 328, 660 312 L 660 ${SCENE_H + 20} L -20 ${
          SCENE_H + 20
        } Z`}
        fill="url(#hs-grass)"
      />
      {/* 芝の起伏。手前ほど明るくして奥行きを出す */}
      <path
        d="M-20 356 C 90 340, 190 362, 300 352 C 420 341, 540 360, 660 346 L 660 396 C 520 408, 380 388, 250 398 C 140 406, 50 392, -20 400 Z"
        fill="#cbe790"
        opacity="0.55"
      />
      <path
        d="M-20 452 C 120 438, 250 460, 380 450 C 500 441, 590 458, 660 448 L 660 532 L -20 532 Z"
        fill="#a9d266"
        opacity="0.45"
      />

      {/* 右手の大きな木。幹を芝の上まで下ろして、根元に茂みを置く */}
      <g>
        <path d="M470 268 L470 350" stroke="#b08558" strokeWidth="11" strokeLinecap="round" fill="none" />
        <path d="M470 296 L452 278 M470 306 L490 288" stroke="#b08558" strokeWidth="7" strokeLinecap="round" fill="none" />
        <g fill="#7fb96a">
          <circle cx="470" cy="248" r="40" />
          <circle cx="436" cy="264" r="27" />
          <circle cx="504" cy="264" r="27" />
          <circle cx="470" cy="216" r="26" />
        </g>
        <g fill="#93c97e" opacity="0.85">
          <circle cx="454" cy="230" r="18" />
          <circle cx="488" cy="242" r="14" />
        </g>
      </g>
      <g>
        <path d="M584 250 L584 344" stroke="#a97c4f" strokeWidth="13" strokeLinecap="round" fill="none" />
        <path d="M584 284 L562 264 M584 296 L608 274" stroke="#a97c4f" strokeWidth="8" strokeLinecap="round" fill="none" />
        <g fill="#78b263">
          <circle cx="584" cy="222" r="46" />
          <circle cx="544" cy="242" r="30" />
          <circle cx="624" cy="242" r="30" />
          <circle cx="584" cy="186" r="29" />
        </g>
        <g fill="#8dc477" opacity="0.85">
          <circle cx="564" cy="200" r="20" />
          <circle cx="606" cy="214" r="16" />
        </g>
      </g>
      <g fill="#8bc26e">
        <ellipse cx="470" cy="350" rx="30" ry="12" />
        <ellipse cx="584" cy="346" rx="38" ry="14" />
        <ellipse cx="42" cy="340" rx="34" ry="13" />
        <ellipse cx="196" cy="346" rx="26" ry="11" />
      </g>

      {/* 草の房。単色の芝に見えないように散らす */}
      <g stroke="#96c65b" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.45">
        {TUFTS.map(([x, y, scale], index) => (
          <g key={`tuft-${index}`} transform={`translate(${x} ${y}) scale(${scale * 0.7})`}>
            <path d="M0 0 C -2 -5, -4 -7, -7 -9" />
            <path d="M0 0 C 0 -6, 0 -8, 1 -11" />
            <path d="M0 0 C 2 -5, 4 -7, 7 -9" />
          </g>
        ))}
      </g>

      {/* 足あと。手前の芝を横切らせる */}
      <g>
        {TRAIL.map((mark, index) =>
          mark.paw ? (
            <use
              key={`trail-${index}`}
              href="#hs-paw"
              transform={`translate(${mark.x} ${mark.y}) rotate(${mark.tilt})`}
              fill="#bb8f66"
              opacity="0.55"
            />
          ) : (
            <rect
              key={`trail-${index}`}
              x={mark.x - 7}
              y={mark.y - 2}
              width="14"
              height="4"
              rx="2"
              transform={`rotate(${mark.tilt} ${mark.x} ${mark.y})`}
              fill="#cf9c86"
              opacity="0.5"
            />
          ),
        )}
      </g>

      {/* 手前の草むらと小花 */}
      <g>
        <g stroke="#6ba851" strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M26 512 C 20 486, 14 474, 4 464" />
          <path d="M34 512 C 34 484, 36 470, 40 458" />
          <path d="M44 512 C 50 488, 58 476, 68 468" />
        </g>
        <use href="#hs-daisy" transform="translate(6 458) scale(1.15)" />
        <use href="#hs-daisy" transform="translate(42 450) scale(0.95)" />
        <use href="#hs-daisy" transform="translate(70 466) scale(0.8)" />
      </g>
      <g>
        <g stroke="#6ba851" strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M596 512 C 590 488, 584 476, 574 468" />
          <path d="M606 512 C 606 486, 608 472, 612 460" />
          <path d="M618 512 C 624 490, 632 478, 640 472" />
        </g>
        <use href="#hs-daisy" transform="translate(576 466) scale(0.9)" />
        <use href="#hs-daisy" transform="translate(612 452) scale(1.1)" />
      </g>
    </svg>
  );
}

/**
 * 看板の縦横比と、板の上に文字を置ける範囲（どれも viewBox に対する％）。
 * LevelSignArt / StepsSignArt の座標から割り出してある。
 */
export const LEVEL_SIGN = {
  ratio: "340 / 360",
  /** 緑のリボン（見出し帯）の内側 */
  banner: { left: "19.5%", right: "19.5%", top: "27.2%", height: "9.5%" },
  /** リボンの下に残る板の面 */
  panel: { left: "13.5%", right: "13.5%", top: "39.5%", bottom: "13.5%" },
} as const;

export const STEPS_SIGN = {
  ratio: "340 / 210",
  banner: { left: "19%", right: "19%", top: "27.6%", height: "15.2%" },
  panel: { left: "13%", right: "13%", top: "47.5%", bottom: "14.5%" },
} as const;

/** 枝から下がった上の板。角の飾りと縄はここだけが持つ */
export function LevelSignArt() {
  return (
    <svg
      viewBox="0 0 340 360"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute inset-0 h-full w-full select-none"
    >
      <defs>
        <g id="hs-branch-leaf">
          <path d="M0 0 C 6 -8, 17 -8, 22 0 C 17 8, 6 8, 0 0 Z" fill="#8cc077" />
          <path d="M2 0 L20 0" stroke="#6fa95c" strokeWidth="1.2" fill="none" />
        </g>
      </defs>

      {/* 左上から伸びる枝 */}
      <path
        d="M-16 8 C 46 26, 118 14, 196 28 C 244 37, 292 32, 348 20"
        stroke="#ab7f4e"
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M56 20 C 66 8, 78 2, 92 0" stroke="#ab7f4e" strokeWidth="6" strokeLinecap="round" fill="none" />
      <g>
        <use href="#hs-branch-leaf" transform="translate(20 12) rotate(-28) scale(0.85)" />
        <use href="#hs-branch-leaf" transform="translate(4 22) rotate(26) scale(0.7)" />
        <use href="#hs-branch-leaf" transform="translate(56 18) rotate(30) scale(0.72)" />
        <use href="#hs-branch-leaf" transform="translate(88 2) rotate(-8) scale(0.8)" />
        <use href="#hs-branch-leaf" transform="translate(132 14) rotate(18) scale(0.9)" />
        <use href="#hs-branch-leaf" transform="translate(168 8) rotate(-24) scale(0.7)" />
        <use href="#hs-branch-leaf" transform="translate(196 24) rotate(-16) scale(0.8)" />
        <use href="#hs-branch-leaf" transform="translate(238 32) rotate(22) scale(0.68)" />
        <use href="#hs-branch-leaf" transform="translate(268 22) rotate(24) scale(0.85)" />
        <use href="#hs-branch-leaf" transform="translate(306 16) rotate(-18) scale(0.75)" />
      </g>

      {/* 吊り縄 */}
      <g stroke="#c9a97c" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M96 22 L96 82" />
        <path d="M244 26 L244 82" />
      </g>
      <g stroke="#e0c79f" strokeWidth="1.6" strokeDasharray="4 5" strokeLinecap="round" fill="none">
        <path d="M96 22 L96 82" />
        <path d="M244 26 L244 82" />
      </g>
      <g fill="#e3c692" stroke="#b18f5f" strokeWidth="2.5">
        <circle cx="96" cy="84" r="6" />
        <circle cx="244" cy="84" r="6" />
      </g>

      {/* 板 */}
      <rect x="22" y="76" width="296" height="252" rx="24" fill="#f2dfbe" stroke="#d6b083" strokeWidth="4" />
      <rect x="34" y="88" width="272" height="228" rx="17" fill="#fbf1dc" stroke="#e3c69c" strokeWidth="2.5" />
      {/* 木目。文字に重ならないよう、板の縁のところだけに引く */}
      <g stroke="#e8d3ad" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7">
        <path d="M40 168 C 44 210, 44 240, 40 268" />
        <path d="M300 176 C 304 214, 304 244, 300 272" />
      </g>

      {/* 見出しのリボン */}
      <path d="M44 96 L296 96 L281 116 L296 136 L44 136 L59 116 Z" fill="#7ba463" />
      <path d="M44 132 L296 132 L296 136 L44 136 Z" fill="#000000" opacity="0.08" />

      {/* 角の草花 */}
      <g>
        <use href="#hs-branch-leaf" transform="translate(300 96) rotate(-34) scale(0.72)" />
        <use href="#hs-branch-leaf" transform="translate(296 116) rotate(16) scale(0.6)" />
        <use href="#hs-branch-leaf" transform="translate(4 268) rotate(-150) scale(0.7)" />
        <use href="#hs-branch-leaf" transform="translate(14 292) rotate(160) scale(0.6)" />
      </g>
      <g>
        <ellipse cx="308" cy="146" rx="3.4" ry="4.6" fill="#fffdf6" />
        <ellipse cx="314" cy="152" rx="4.6" ry="3.4" fill="#fffdf6" />
        <ellipse cx="308" cy="158" rx="3.6" ry="3.6" fill="#fffdf6" />
        <ellipse cx="302" cy="152" rx="4.6" ry="3.4" fill="#fffdf6" />
        <circle cx="308" cy="152" r="2.4" fill="#f0be4b" />
      </g>

      {/* 下の板へ続く縄 */}
      <g stroke="#c9a97c" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M96 328 L96 362" />
        <path d="M244 328 L244 362" />
      </g>
    </svg>
  );
}

/** 上の板からぶら下がる下の板 */
export function StepsSignArt() {
  return (
    <svg
      viewBox="0 0 340 210"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute inset-0 h-full w-full select-none"
    >
      <g stroke="#c9a97c" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M96 -4 L96 40" />
        <path d="M244 -4 L244 40" />
      </g>
      <g stroke="#e0c79f" strokeWidth="1.6" strokeDasharray="4 5" strokeLinecap="round" fill="none">
        <path d="M96 0 L96 40" />
        <path d="M244 0 L244 40" />
      </g>
      <g fill="#e3c692" stroke="#b18f5f" strokeWidth="2.5">
        <circle cx="96" cy="42" r="6" />
        <circle cx="244" cy="42" r="6" />
      </g>

      <rect x="18" y="36" width="304" height="162" rx="22" fill="#f3e0c4" stroke="#deb0ac" strokeWidth="4" />
      <rect x="30" y="48" width="280" height="138" rx="16" fill="#fdf3e2" stroke="#eecac2" strokeWidth="2.5" />

      <path d="M42 56 L298 56 L283 75 L298 94 L42 94 L57 75 Z" fill="#dd9aa6" />
      <path d="M42 90 L298 90 L298 94 L42 94 Z" fill="#000000" opacity="0.08" />

      <g>
        <path d="M304 56 C 312 48, 322 46, 330 48 C 326 58, 316 62, 306 60 Z" fill="#8cc077" />
        <path d="M10 150 C 2 142, 0 132, 2 124 C 12 128, 16 138, 14 148 Z" fill="#8cc077" />
      </g>
      <g>
        <ellipse cx="314" cy="102" rx="3.4" ry="4.6" fill="#fffdf6" />
        <ellipse cx="320" cy="108" rx="4.6" ry="3.4" fill="#fffdf6" />
        <ellipse cx="314" cy="114" rx="3.6" ry="3.6" fill="#fffdf6" />
        <ellipse cx="308" cy="108" rx="4.6" ry="3.4" fill="#fffdf6" />
        <circle cx="314" cy="108" r="2.4" fill="#f0be4b" />
      </g>
    </svg>
  );
}
