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
    // ユーザー提供の完成画像から、ガチャ機をそのまま切り出した素材。
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/gacha/reference/lucky-paws-machine.webp" className={className} alt="" aria-hidden="true" draggable={false} />
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
