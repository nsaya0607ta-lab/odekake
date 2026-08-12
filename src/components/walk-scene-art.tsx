/**
 * ホーム上部「おさんぽ広場」の背景。
 *
 * 淡い水彩・手描き調の一枚絵を、画像ではなく SVG で描いている。カードの横幅は
 * 端末によって変わるので `preserveAspectRatio="xMidYMid slice"` で切り抜き、
 * 犬の足元（草原）と左上の枝が必ず画角に残るように要素を配置してある。
 *
 * 左上の枝は、そこから吊り下げる看板（WalkSigns）の位置に合わせてある。枝を
 * 動かすときは看板の left / width も一緒に見直す。
 */
export function WalkSceneArt() {
  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full select-none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="walk-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cfe6e8" />
          <stop offset="55%" stopColor="#e2f0ea" />
          <stop offset="100%" stopColor="#f2f4e2" />
        </linearGradient>
        <linearGradient id="walk-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c5dd9c" />
          <stop offset="55%" stopColor="#cfe3a4" />
          <stop offset="100%" stopColor="#bdd68d" />
        </linearGradient>
        {/* 水彩のにじみ。輪郭を持たせないための共通ぼかし */}
        <filter id="walk-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>

        {/* 幹 → 葉の順に重ねる。葉をぼかしただけだと幹が棒立ちに見えるので、
            いちばん下の葉のかたまりは輪郭を残しておく */}
        <g id="walk-tree">
          <path d="M-3.5 6 L-2.5 -20 L2.5 -20 L3.5 6 Z" fill="#b08a63" />
          <path d="M-2 -13 L-9 -19" stroke="#b08a63" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="0" cy="-28" rx="26" ry="22" fill="#a8ca86" />
          <ellipse cx="-13" cy="-21" rx="17" ry="15" fill="#9cc17b" filter="url(#walk-soft)" />
          <ellipse cx="13" cy="-23" rx="16" ry="14" fill="#b4d491" filter="url(#walk-soft)" />
          <ellipse cx="2" cy="-40" rx="15" ry="13" fill="#bcda99" filter="url(#walk-soft)" />
        </g>

        <g id="walk-paw">
          <ellipse cx="0" cy="1.6" rx="3.5" ry="2.9" fill="#9a7a52" />
          <ellipse cx="-3.1" cy="-2.2" rx="1.5" ry="1.8" fill="#9a7a52" />
          <ellipse cx="-0.9" cy="-3.4" rx="1.5" ry="1.8" fill="#9a7a52" />
          <ellipse cx="1.4" cy="-3.3" rx="1.5" ry="1.8" fill="#9a7a52" />
          <ellipse cx="3.4" cy="-1.9" rx="1.4" ry="1.7" fill="#9a7a52" />
        </g>

        <g id="walk-flower">
          <circle cx="0" cy="-4.4" r="3.1" fill="#fffdf6" />
          <circle cx="4.2" cy="-1.4" r="3.1" fill="#fffdf6" />
          <circle cx="2.6" cy="3.6" r="3.1" fill="#fffdf6" />
          <circle cx="-2.6" cy="3.6" r="3.1" fill="#fffdf6" />
          <circle cx="-4.2" cy="-1.4" r="3.1" fill="#fffdf6" />
          <circle cx="0" cy="0" r="2.2" fill="#f0c96a" />
        </g>
      </defs>

      {/* 空 */}
      <rect width="400" height="300" fill="url(#walk-sky)" />

      {/* 雲 */}
      <g fill="#fffdf8" opacity="0.92" filter="url(#walk-soft)">
        <ellipse cx="196" cy="41" rx="26" ry="11" />
        <ellipse cx="180" cy="46" rx="18" ry="9" />
        <ellipse cx="212" cy="47" rx="17" ry="8" />
        <ellipse cx="330" cy="28" rx="30" ry="12" />
        <ellipse cx="312" cy="34" rx="19" ry="9" />
        <ellipse cx="352" cy="33" rx="18" ry="8" />
        <ellipse cx="120" cy="24" rx="20" ry="8" opacity="0.75" />
      </g>

      {/* 遠景の山 */}
      <g filter="url(#walk-soft)">
        <path d="M-10 168 L58 104 L104 140 L150 96 L214 168 Z" fill="#b6cfd3" opacity="0.85" />
        <path d="M126 168 L196 92 L246 132 L286 100 L352 168 Z" fill="#a6c4ca" opacity="0.9" />
        <path d="M282 168 L342 106 L398 150 L412 168 Z" fill="#b9d0d2" opacity="0.85" />
        <path d="M196 92 L214 108 L186 120 Z" fill="#cfe1e2" opacity="0.8" />
        <path d="M58 104 L74 122 L44 128 Z" fill="#cfe1e2" opacity="0.7" />
      </g>

      {/* 遠くの林 */}
      <g opacity="0.75" filter="url(#walk-soft)">
        <ellipse cx="30" cy="176" rx="20" ry="13" fill="#a9c98a" />
        <ellipse cx="72" cy="180" rx="16" ry="11" fill="#b6d296" />
        <ellipse cx="118" cy="176" rx="19" ry="12" fill="#a4c586" />
        <ellipse cx="162" cy="181" rx="15" ry="10" fill="#b6d296" />
        <ellipse cx="212" cy="177" rx="18" ry="12" fill="#a9c98a" />
        <ellipse cx="256" cy="181" rx="15" ry="10" fill="#b6d296" />
        <ellipse cx="366" cy="179" rx="18" ry="12" fill="#a9c98a" />
      </g>

      {/* 草原 */}
      <path d="M-10 186 Q120 174 210 184 Q310 194 410 180 L410 310 L-10 310 Z" fill="url(#walk-grass)" />
      <path
        d="M-10 196 Q90 186 200 196 Q320 206 410 192 L410 214 Q300 224 190 212 Q90 202 -10 212 Z"
        fill="#d6e8ae"
        opacity="0.55"
        filter="url(#walk-soft)"
      />

      {/* 中景の木。犬の歩く右側に置いて、左の看板とは重ねない */}
      <g transform="translate(298 204) scale(1.3)">
        <use href="#walk-tree" />
      </g>
      <g transform="translate(360 216) scale(1.05)">
        <use href="#walk-tree" />
      </g>
      <g transform="translate(240 192) scale(0.7)" opacity="0.92">
        <use href="#walk-tree" />
      </g>

      {/* 草の点描 */}
      <g stroke="#9ec179" strokeWidth="1.6" strokeLinecap="round" opacity="0.55">
        <path d="M150 230 l3 -6" />
        <path d="M228 246 l3 -6" />
        <path d="M262 232 l2 -5" />
        <path d="M330 250 l3 -6" />
        <path d="M356 236 l2 -5" />
        <path d="M300 268 l3 -6" />
        <path d="M186 268 l2 -5" />
        <path d="M382 258 l3 -6" />
        <path d="M140 250 l2 -5" />
      </g>

      {/* 足あと。看板のある左 1/3 を避けて、犬が歩く右 2/3 の草原を横切らせる */}
      <g opacity="0.6">
        <use href="#walk-paw" transform="translate(152 286) rotate(-8)" />
        <use href="#walk-paw" transform="translate(174 279) rotate(-6)" />
        <use href="#walk-paw" transform="translate(198 284) rotate(-2)" />
        <use href="#walk-paw" transform="translate(222 276) rotate(2)" />
        <use href="#walk-paw" transform="translate(248 281) rotate(4)" />
        <use href="#walk-paw" transform="translate(274 274) rotate(6)" />
        <use href="#walk-paw" transform="translate(300 279) rotate(8)" />
        <use href="#walk-paw" transform="translate(326 272) rotate(10)" />
        <use href="#walk-paw" transform="translate(352 277) rotate(12)" />
        <use href="#walk-paw" transform="translate(378 270) rotate(14)" />
      </g>

      {/* 花 */}
      <g transform="translate(206 258) scale(0.85)">
        <use href="#walk-flower" />
      </g>
      <g transform="translate(288 292)">
        <use href="#walk-flower" />
      </g>
      <g transform="translate(364 246) scale(0.8)">
        <use href="#walk-flower" />
      </g>
      <g transform="translate(132 268) scale(0.7)" opacity="0.9">
        <use href="#walk-flower" />
      </g>
      <g transform="translate(246 232) scale(0.6)" opacity="0.85">
        <use href="#walk-flower" />
      </g>

      {/* 看板を吊るす枝 */}
      <g>
        <path
          d="M-6 14 Q46 22 96 38 Q126 48 150 44"
          stroke="#b08a63"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M-6 14 Q46 22 96 38 Q126 48 150 44"
          stroke="#c19c74"
          strokeWidth="4.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />
        <path d="M52 26 Q70 12 88 8" stroke="#b08a63" strokeWidth="4" strokeLinecap="round" fill="none" />
        <g fill="#9dc27d">
          <ellipse cx="20" cy="8" rx="9" ry="5.5" transform="rotate(-22 20 8)" />
          <ellipse cx="44" cy="12" rx="8" ry="5" transform="rotate(-12 44 12)" />
          <ellipse cx="70" cy="20" rx="9" ry="5.5" transform="rotate(-16 70 20)" />
          <ellipse cx="88" cy="4" rx="8" ry="5" transform="rotate(-30 88 4)" />
          <ellipse cx="104" cy="34" rx="8.5" ry="5" transform="rotate(-8 104 34)" />
          <ellipse cx="130" cy="40" rx="8" ry="5" transform="rotate(-6 130 40)" />
        </g>
        <g fill="#b3d492" opacity="0.9">
          <ellipse cx="32" cy="18" rx="7" ry="4.5" transform="rotate(-18 32 18)" />
          <ellipse cx="60" cy="8" rx="7" ry="4.5" transform="rotate(-26 60 8)" />
          <ellipse cx="116" cy="28" rx="7" ry="4.5" transform="rotate(-14 116 28)" />
        </g>
      </g>
    </svg>
  );
}
