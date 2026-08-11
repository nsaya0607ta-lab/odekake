/**
 * コイン画面の飾り絵。
 *
 * 写真やイラスト素材は持たないので、ホームの草原と同じように図形で描いている。
 * どれも装飾なので、読み上げの対象からは外している。
 */

type ArtProps = { className?: string };

/** 金貨（肉球入り）。枚数の横に置く小さいものから、宝箱まわりの大きいものまで同じ絵 */
export function CoinArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <ellipse cx="12" cy="12" rx="10" ry="10" fill="#f0be55" />
      <ellipse cx="12" cy="11.2" rx="10" ry="9.6" fill="#f7d380" />
      <ellipse cx="12" cy="11.2" rx="7.2" ry="6.9" fill="#f0be55" opacity="0.55" />
      <g fill="#fffaf0">
        <ellipse cx="12" cy="13.4" rx="3" ry="2.4" />
        <circle cx="8.3" cy="10.4" r="1.25" />
        <circle cx="10.6" cy="8.5" r="1.35" />
        <circle cx="13.4" cy="8.5" r="1.35" />
        <circle cx="15.7" cy="10.4" r="1.25" />
      </g>
    </svg>
  );
}

/** 宝箱。ふたを開けて金貨があふれている */
export function TreasureChestArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 96 80" className={className} aria-hidden="true">
      {/* ふた */}
      <path d="M10 34a38 20 0 0 1 76 0v4H10z" fill="#c08b52" stroke="#96682f" strokeWidth="2.4" />
      <path d="M10 30h76" stroke="#96682f" strokeWidth="2.2" />
      {/* 箱 */}
      <rect x="10" y="40" width="76" height="34" rx="5" fill="#c08b52" stroke="#96682f" strokeWidth="2.4" />
      <rect x="10" y="48" width="76" height="8" fill="#e0b862" opacity="0.8" />
      <rect x="42" y="44" width="12" height="16" rx="2.5" fill="#f0be55" stroke="#96682f" strokeWidth="1.8" />
      {/* あふれる金貨 */}
      <g>
        <ellipse cx="26" cy="38" rx="9" ry="8.4" fill="#f7d380" stroke="#dda93f" strokeWidth="1.6" />
        <ellipse cx="45" cy="34" rx="8" ry="7.6" fill="#f7d380" stroke="#dda93f" strokeWidth="1.6" />
        <ellipse cx="65" cy="38" rx="9" ry="8.4" fill="#f7d380" stroke="#dda93f" strokeWidth="1.6" />
      </g>
    </svg>
  );
}

/** ガチャ（カプセルトイの機械） */
export function GachaMachineArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 150 184" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="gacha-dome" x1="25" y1="30" x2="124" y2="121" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbffff" stopOpacity=".9" />
          <stop offset=".55" stopColor="#eaf2f2" stopOpacity=".72" />
          <stop offset="1" stopColor="#dce9e8" stopOpacity=".86" />
        </linearGradient>
        <linearGradient id="gacha-body" x1="28" y1="109" x2="121" y2="174" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff8e9" />
          <stop offset="1" stopColor="#f1dfbd" />
        </linearGradient>
      </defs>

      {/* ガラスドームと中のカプセル */}
      <path d="M24 39c4-17 16-27 32-29h38c17 2 29 12 33 29l8 57c2 17-9 29-27 29H42c-18 0-29-12-27-29Z" fill="url(#gacha-dome)" stroke="#88927c" strokeWidth="3" />
      <g stroke="#fff" strokeWidth="2" opacity=".94">
        <circle cx="43" cy="88" r="16" fill="#efb7bf" />
        <circle cx="69" cy="94" r="17" fill="#b9d3a1" />
        <circle cx="103" cy="92" r="17" fill="#eec9d9" />
        <circle cx="52" cy="63" r="16" fill="#b9d6eb" />
        <circle cx="81" cy="58" r="18" fill="#f4cf7c" />
        <circle cx="108" cy="64" r="15" fill="#c9d9bb" />
        <circle cx="78" cy="84" r="17" fill="#c4d9e9" />
      </g>
      <g fill="none" stroke="#fff" strokeLinecap="round" opacity=".7">
        <path d="M25 67c3-20 11-33 24-41" strokeWidth="7" />
        <path d="M112 30c8 8 11 17 12 28" strokeWidth="5" />
      </g>

      {/* 丸いふたとロゴ */}
      <path d="M20 34c0-17 13-29 31-31h48c18 2 31 14 31 31 0 7-5 11-12 11H32c-7 0-12-4-12-11Z" fill="#b9c78f" stroke="#78825f" strokeWidth="3" />
      <rect x="47" y="15" width="57" height="19" rx="9.5" fill="#fff7e8" stroke="#d9c7a0" strokeWidth="1.5" />
      <text x="75.5" y="28" textAnchor="middle" fill="#8d6846" fontSize="8" fontWeight="700">Lucky Paws</text>
      <path d="M31 17c16-9 54-10 78-2" fill="none" stroke="#e8efce" strokeWidth="5" strokeLinecap="round" opacity=".75" />

      {/* クリーム色の本体 */}
      <path d="M22 117h106l9 59H13Z" fill="url(#gacha-body)" stroke="#8f8268" strokeWidth="3" />
      <rect x="17" y="111" width="116" height="12" rx="6" fill="#b6c889" stroke="#78825f" strokeWidth="2.5" />
      <path d="M10 174h130v8H10Z" fill="#aebe7f" stroke="#78825f" strokeWidth="3" strokeLinejoin="round" />

      {/* 肉球・つまみ・取り出し口 */}
      <g fill="#efaaa7">
        <ellipse cx="35" cy="150" rx="5" ry="4" />
        <circle cx="29" cy="144" r="2.2" />
        <circle cx="34" cy="141.5" r="2.3" />
        <circle cx="39" cy="144" r="2.2" />
      </g>
      <circle cx="73" cy="143" r="18" fill="#b7c88b" stroke="#78825f" strokeWidth="2.5" />
      <rect x="59" y="139" width="28" height="8" rx="4" fill="#e8edcf" stroke="#78825f" strokeWidth="2" />
      <path d="M59 134c6-5 22-5 28 0" fill="none" stroke="#fff" strokeWidth="2" opacity=".7" />
      <path d="M103 139h19a7 7 0 0 1 7 7v26h-34v-25a8 8 0 0 1 8-8Z" fill="#5f674d" stroke="#78825f" strokeWidth="2.5" />
      <path d="M99 163h26v10H99Z" fill="#e7e8c7" stroke="#78825f" strokeWidth="2" />
    </svg>
  );
}

/** ショップのかご。かわいい小物が入っている */
export function ShopBasketArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 140 120" className={className} aria-hidden="true">
      {/* 中身 */}
      <g>
        {/* あひる */}
        <ellipse cx="46" cy="56" rx="15" ry="12" fill="#f7d795" stroke="#e0b862" strokeWidth="2" />
        <circle cx="36" cy="46" r="8.5" fill="#f7d795" stroke="#e0b862" strokeWidth="2" />
        <path d="M28 46h-7l4 4z" fill="#e2a377" />
        <circle cx="34" cy="44.5" r="1.3" fill="#6d675d" />
        {/* ドーナツ */}
        <circle cx="76" cy="54" r="15" fill="#f7e0e3" stroke="#dd9aa6" strokeWidth="2" />
        <circle cx="76" cy="54" r="5" fill="#fffdf8" stroke="#dd9aa6" strokeWidth="1.8" />
        <g fill="#a99bcb">
          <circle cx="70" cy="47" r="1.4" />
          <circle cx="82" cy="49" r="1.4" />
          <circle cx="80" cy="61" r="1.4" />
          <circle cx="69" cy="59" r="1.4" />
        </g>
        {/* おでかけバッグ */}
        <rect x="94" y="44" width="26" height="22" rx="5" fill="#cfe0bd" stroke="#a3bf8c" strokeWidth="2" />
        <path d="M100 44v-4a7 7 0 0 1 14 0v4" stroke="#a3bf8c" strokeWidth="2" fill="none" />
        {/* タオル */}
        <rect x="18" y="60" width="22" height="12" rx="4" fill="#dcebf4" stroke="#7fa8c9" strokeWidth="1.8" />
      </g>
      {/* かご */}
      <path d="M12 68h116l-10 42a6 6 0 0 1-6 5H28a6 6 0 0 1-6-5z" fill="#f0dfbe" stroke="#c9a870" strokeWidth="2.6" />
      <path d="M12 68h116" stroke="#c9a870" strokeWidth="2.6" />
      <g stroke="#c9a870" strokeWidth="1.6" opacity="0.75">
        <path d="M40 74l-4 39M68 74v39M96 74l4 39" />
        <path d="M18 88h104M22 102h96" />
      </g>
    </svg>
  );
}

/** きらきら */
export function SparkleArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 2.5c.9 5.4 1.7 6.2 7.1 7.1-5.4.9-6.2 1.7-7.1 7.1-.9-5.4-1.7-6.2-7.1-7.1 5.4-.9 6.2-1.7 7.1-7.1Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** 音符 */
export function NoteArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M9 18.2a2.8 2.8 0 1 1-2-2.7V5.5l10-2.2v3.4l-8 1.8v9.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** 葉っぱ */
export function LeafArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M4 19c0-7 4.5-12 15-12 0 9-5.5 13-11.5 13" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

/** 草原の背景（空・雲・丘・お花）。ホームの草原と同じ配色 */
export function MeadowSceneArt() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-gradient-to-b from-[#dcebf4] via-[#e7f0ee] to-[#eaf2df]" />
      {/* 丘 */}
      <div className="absolute -left-16 bottom-[-38px] h-32 w-72 rounded-[50%] bg-[#cfe3b8]" />
      <div className="absolute right-[-52px] bottom-[-48px] h-36 w-80 rounded-[50%] bg-[#c2dba7]" />
      <div className="absolute inset-x-0 bottom-0 h-14 bg-[#d5e7bd]" />
      {/* 雲 */}
      <div className="absolute left-[6%] top-[10%] h-3.5 w-12 rounded-full bg-white/80" />
      <div className="absolute left-[14%] top-[6%] h-3 w-8 rounded-full bg-white/65" />
      <div className="absolute right-[26%] top-[7%] h-3 w-10 rounded-full bg-white/70" />
      {/* お花（左側は所持コインの札が乗るので、犬の足元あたりに小さくまとめる） */}
      <div className="absolute bottom-2 right-[31%] flex h-2 w-2 items-center justify-center rounded-full bg-white/90">
        <span className="h-[3px] w-[3px] rounded-full bg-[#e0b862]" />
      </div>
      <div className="absolute bottom-3.5 right-[27%] flex h-1.5 w-1.5 items-center justify-center rounded-full bg-white/80">
        <span className="h-[2px] w-[2px] rounded-full bg-[#e0b862]" />
      </div>
    </div>
  );
}
