/**
 * 図鑑アイテムの絵。
 *
 * 写真素材はまだ無いので、そうび（gear-art.tsx）や コイン画面（coin-art.tsx）と
 * 同じように図形で描いている。素材ができたら CollectionItem.image にパスを入れれば
 * そちらが優先される。
 *
 * 未取得のときは同じ絵に brightness(0) をかけて黒いシルエットにする。
 * こうしておくと、絵でも画像ファイルでも「形は同じ・色だけ消える」で揃う。
 */
import type { ItemArtKey } from "@/lib/collection/items";

const OUTLINE = "#8b8175";

const SHAPES: Record<ItemArtKey, React.ReactNode> = {
  // --- おもちゃ ---------------------------------------------------------
  ball: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="#f2a8a2" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="#8fc0e0" />
      <path d="M3.5 12a8.5 8.5 0 0 1 17 0z" fill="#f2d68a" opacity="0.85" />
      <circle cx="12" cy="12" r="2.6" fill="#fffaf0" />
    </>
  ),
  rope: (
    <>
      <path d="M6 12h12" stroke="#e2cfa8" strokeWidth="4.4" strokeLinecap="round" />
      <path d="M8.5 10.4c1.4 1.6 1.4 1.6 0 3.2M15.5 10.4c-1.4 1.6-1.4 1.6 0 3.2" stroke="#c9ad7c" strokeWidth="1.2" fill="none" />
      <path d="M6 12 3 9.4M6 12l-3 2.6M18 12l3-2.6M18 12l3 2.6" stroke="#e2cfa8" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  bone: (
    <>
      <path d="M7.5 10.5h9v3h-9z" fill="#f6eddd" />
      <g fill="#f6eddd" stroke={OUTLINE} strokeWidth="0.9">
        <circle cx="6.4" cy="9.8" r="2.6" />
        <circle cx="6.4" cy="14.2" r="2.6" />
        <circle cx="17.6" cy="9.8" r="2.6" />
        <circle cx="17.6" cy="14.2" r="2.6" />
        <rect x="7" y="10.2" width="10" height="3.6" stroke="none" />
      </g>
    </>
  ),
  duck: (
    <>
      <ellipse cx="11" cy="15.5" rx="7" ry="4.5" fill="#f5d271" />
      <circle cx="15.5" cy="9.5" r="4" fill="#f5d271" />
      <path d="M19 9.2h3.2l-2.2 2.2z" fill="#e8956b" />
      <circle cx="16.4" cy="8.6" r="0.8" fill="#4a443c" />
    </>
  ),
  frisbee: (
    <>
      <ellipse cx="12" cy="13.5" rx="9" ry="4.4" fill="#8fc0e0" />
      <ellipse cx="12" cy="12.2" rx="9" ry="4.4" fill="#a9d3ee" />
      <ellipse cx="12" cy="12" rx="4.6" ry="2.2" fill="#dcebf4" />
    </>
  ),

  // --- 食べもの ---------------------------------------------------------
  jerky: (
    <>
      <path d="M5 15.5 15.5 5l3.5 3.5L8.5 19z" fill="#c98a5c" />
      <path d="M7.6 14.4l6.8-6.8" stroke="#a86d43" strokeWidth="1.1" />
      <path d="M10 16.8l6.8-6.8" stroke="#a86d43" strokeWidth="1.1" />
    </>
  ),
  biscuit: (
    <>
      <path d="M12 4.5c2 0 3 1.4 3 2.6 1.6-.4 3.4.8 3.4 2.7 0 1-.5 1.8-1.2 2.3.9 2.6-1.2 5.4-3.6 5.4-.9 1.6-3.3 1.6-4.2 0-2.4 0-4.5-2.8-3.6-5.4-.7-.5-1.2-1.3-1.2-2.3 0-1.9 1.8-3.1 3.4-2.7C9 5.9 10 4.5 12 4.5Z" fill="#e6c188" />
      <g fill="#a8763f">
        <circle cx="10.2" cy="9.6" r="0.9" />
        <circle cx="14" cy="11.4" r="0.9" />
        <circle cx="11.4" cy="13.6" r="0.9" />
      </g>
    </>
  ),
  bowl: (
    <>
      <ellipse cx="12" cy="11" rx="8.5" ry="3" fill="#8fc0e0" />
      <path d="M3.5 11c0 4.2 3.8 7.5 8.5 7.5s8.5-3.3 8.5-7.5z" fill="#a9d3ee" />
      <ellipse cx="12" cy="11" rx="6.2" ry="2.1" fill="#dcebf4" />
    </>
  ),
  cake: (
    <>
      <path d="M4.5 13h15v5.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5z" fill="#f6eddd" />
      <path d="M4.5 13c0-2 3.4-3.5 7.5-3.5s7.5 1.5 7.5 3.5c-1.6 1.2-3.2.4-4.6 1-1.4.6-2.4-.6-3.8 0-1.4.6-3.8 1-6.6-1z" fill="#f2a8a2" />
      <path d="M12 9.2V6.4" stroke="#c9ad7c" strokeWidth="1.2" strokeLinecap="round" />
      <ellipse cx="12" cy="5.2" rx="1" ry="1.4" fill="#f5d271" />
    </>
  ),
  apple: (
    <>
      <path d="M12 7.5c3.5-2.5 8 .5 7.2 5.2-.6 3.6-3.4 7-5.2 7-.9 0-1.3-.6-2-.6s-1.1.6-2 .6c-1.8 0-4.6-3.4-5.2-7C4 8 8.5 5 12 7.5Z" fill="#dd8a86" />
      <path d="M12 7.5V5" stroke="#8a6a4a" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M12.2 5.6c1.4-1.6 3-1.7 3-1.7s-.2 2-2 2.4z" fill="#8fbf72" />
    </>
  ),

  // --- インテリア -------------------------------------------------------
  pillow: (
    <>
      <path d="M4.5 8.5c5-1.4 10-1.4 15 0 1 3 1 5 0 8-5 1.4-10 1.4-15 0-1-3-1-5 0-8Z" fill="#f6eddd" stroke={OUTLINE} strokeWidth="0.9" />
      <path d="M7 10.4c3.4-.8 6.6-.8 10 0" stroke="#d9c9ac" strokeWidth="1" fill="none" />
    </>
  ),
  blanket: (
    <>
      <path d="M4 7.5c4-1.2 12-1.2 16 0v9c-4 1.6-12 1.6-16 0z" fill="#cfd9ef" />
      <path d="M4 11c4-1.2 12-1.2 16 0" stroke="#a9b6d8" strokeWidth="1.1" fill="none" />
      <path d="M4 14.2c4-1.2 12-1.2 16 0" stroke="#a9b6d8" strokeWidth="1.1" fill="none" />
    </>
  ),
  dogBed: (
    <>
      <ellipse cx="12" cy="14.5" rx="9" ry="5" fill="#e2b193" />
      <ellipse cx="12" cy="13.6" rx="6.2" ry="3.2" fill="#f6e2d2" />
    </>
  ),
  lamp: (
    <>
      <path d="M6.5 13 12 5.5 17.5 13z" fill="#f5d271" />
      <rect x="10.8" y="13" width="2.4" height="4.6" fill="#c9ad7c" />
      <ellipse cx="12" cy="18.4" rx="4.4" ry="1.5" fill="#c9ad7c" />
    </>
  ),
  plant: (
    <>
      <path d="M12 14c0-4-2.5-6.5-5.5-7 .3 3.6 2 6.2 5.5 7Z" fill="#8fbf72" />
      <path d="M12 14c0-4 2.5-6.5 5.5-7-.3 3.6-2 6.2-5.5 7Z" fill="#a9cf8d" />
      <path d="M7.5 14h9l-1 5.5h-7z" fill="#e2a377" />
    </>
  ),

  // --- その他 -----------------------------------------------------------
  medal: (
    <>
      <path d="M8.5 3.5 12 9l3.5-5.5" stroke="#a9b6d8" strokeWidth="2" fill="none" />
      <circle cx="12" cy="14" r="5.6" fill="#f5d271" stroke="#d9a13c" strokeWidth="1.1" />
      <circle cx="12" cy="14" r="3" fill="#f8e6b5" />
    </>
  ),
  ribbon: (
    <>
      <path d="M11 12 4.5 8v8z" fill="#f2a8a2" />
      <path d="M13 12 19.5 8v8z" fill="#f2a8a2" />
      <circle cx="12" cy="12" r="2.2" fill="#e5867f" />
    </>
  ),
  crown: (
    <>
      <path d="M4 17.5 5.5 8l3.7 4.6L12 6l2.8 6.6L18.5 8 20 17.5Z" fill="#f0be55" stroke="#d9a13c" strokeWidth="1.1" />
      <rect x="4" y="17" width="16" height="2.4" rx="1" fill="#e0ab41" />
      <circle cx="12" cy="12.6" r="1.2" fill="#dd9aa6" />
    </>
  ),
  leash: (
    <>
      <path d="M8.6 4.8a3.4 3.4 0 0 1 6.8 0v2.4a3.4 3.4 0 0 1-6.8 0z" fill="none" stroke="#c98a5c" strokeWidth="2.1" />
      <path d="M12 10.6c-3 2.4 3 4.6 0 7 -1.3 1-1.3 1.6 0 2.2" fill="none" stroke="#e2a377" strokeWidth="2.1" strokeLinecap="round" />
      <circle cx="12" cy="20.2" r="1.6" fill="#a9b6d8" />
    </>
  ),
  photoFrame: (
    <>
      <rect x="4" y="5.5" width="16" height="13" rx="2" fill="#e2b193" />
      <rect x="6.2" y="7.7" width="11.6" height="8.6" rx="1" fill="#fffaf0" />
      <circle cx="9.5" cy="10.6" r="1.2" fill="#f5d271" />
      <path d="M6.6 15.8 10 12.4l2.4 2.4L15 12l2.6 3.8z" fill="#a9cf8d" />
    </>
  ),

  // --- 登山シリーズ -----------------------------------------------------
  backpack: (
    <>
      <rect x="5" y="9.5" width="14" height="11" rx="3.5" fill="#8fbf72" />
      <rect x="7.5" y="5.5" width="9" height="5" rx="2.2" fill="#7aa85f" />
      <path d="M9 9V7a3 3 0 0 1 6 0v2" fill="none" stroke="#5d8049" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="8.5" y="13.5" width="7" height="4.6" rx="1.4" fill="#e2cfa8" />
    </>
  ),
  hikingHat: (
    <>
      <ellipse cx="12" cy="15.5" rx="9.5" ry="3" fill="#d9b978" />
      <path d="M6 14.8a6 5.4 0 0 1 12 0z" fill="#e8ce97" stroke="#c9a662" strokeWidth="0.9" />
      <path d="M6.6 14h10.8" stroke="#8a6a4a" strokeWidth="1.4" />
    </>
  ),
  pickaxe: (
    <>
      <path d="M5 19 17 7" stroke="#8a6a4a" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M11 5.5c3.6-1.6 7 1.2 8 5-2.2-2-4.4-2.6-6-2.2-.6-1.6-1.2-2.4-2-2.8Z" fill="#a9b6d8" />
      <circle cx="5.4" cy="18.6" r="1.4" fill="#a9b6d8" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.2" fill="#e2cfa8" stroke="#c9a662" strokeWidth="1.1" />
      <circle cx="12" cy="12" r="5.6" fill="#fffaf0" />
      <path d="m9.6 14.4 5-2.2-2.2 5z" fill="#dd8a86" />
      <path d="m9.6 14.4 2.8-2.2 2.2-2.8-2.2 5z" fill="#8fa8c0" />
    </>
  ),
  carabiner: (
    <>
      <path d="M12 4.2c-4 0-6.8 3.3-6.8 7.6S8 19.4 12 19.4s6.8-3.2 6.8-7.6c0-2.7-1.1-5-2.9-6.4" fill="none" stroke="#a9b6d8" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M15.8 4.8 10.2 7.4" stroke="#8894b8" strokeWidth="1.9" strokeLinecap="round" />
    </>
  ),
  bottle: (
    <>
      <rect x="8.5" y="3.5" width="7" height="3" rx="1.2" fill="#8fa8c0" />
      <path d="M8 6.5h8v11a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3z" fill="#8fc0e0" />
      <rect x="8" y="11" width="8" height="3" fill="#dcebf4" />
    </>
  ),

  // --- 雪国シリーズ -----------------------------------------------------
  knitHat: (
    <>
      <path d="M5.5 16a6.5 7 0 0 1 13 0z" fill="#cfe3f2" />
      <rect x="4.5" y="15.4" width="15" height="3.6" rx="1.8" fill="#eaf3fa" />
      <circle cx="12" cy="5" r="2.2" fill="#eaf3fa" />
    </>
  ),
  scarf: (
    <>
      <g transform="rotate(28 12 12)">
        <rect x="8.6" y="2.5" width="6.8" height="15.5" rx="3.2" fill="#cfd9ef" />
        <path d="M9 7.6h6M9 11h6M9 14.4h6" stroke="#9aa9cd" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M9.6 18v2.6M12 18.2v2.8M14.4 18v2.6" stroke="#cfd9ef" strokeWidth="1.3" strokeLinecap="round" />
      </g>
    </>
  ),
  mittens: (
    <>
      <path d="M4 11.5a3 3 0 0 1 6 0v8H4z" fill="#8fa8c0" />
      <path d="M3.4 10c-1.4.6-1.6 2.6 0 3.2z" fill="#8fa8c0" />
      <path d="M14 11.5a3 3 0 0 1 6 0v8h-6z" fill="#a9c0d4" />
      <path d="M20.6 10c1.4.6 1.6 2.6 0 3.2z" fill="#a9c0d4" />
    </>
  ),
  snowball: (
    <>
      <circle cx="12" cy="12" r="8" fill="#eaf3fa" stroke="#c6d8e6" strokeWidth="1" />
      <circle cx="9.4" cy="9.8" r="2.4" fill="#fffdf8" />
    </>
  ),
  sled: (
    <>
      <path d="M5 8h11a3 3 0 0 1 3 3v3H5z" fill="#c98a5c" />
      <path d="M4 17.5h15c1.4 0 2.2-.8 2.4-2" fill="none" stroke="#8fa8c0" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 14v3.5M16 14v3.5" stroke="#8a6a4a" strokeWidth="1.4" />
    </>
  ),
  snowBoots: (
    <>
      <path d="M8 4.5h5.5v9L19 16v3.5H8z" fill="#8fa8c0" />
      <rect x="7.4" y="4" width="6.8" height="3" rx="1.4" fill="#eaf3fa" />
      <rect x="7.4" y="17.6" width="12.2" height="2.4" rx="1.2" fill="#5f7285" />
    </>
  ),

  // --- 夏シリーズ -------------------------------------------------------
  dogSkin: (
    <>
      <ellipse cx="12" cy="15" rx="6.5" ry="5" fill="#d9c3aa" />
      <path d="M6.5 10.5c-1.6-2.4-1-4.6-1-4.6s2.4.4 3.6 2.4zM17.5 10.5c1.6-2.4 1-4.6 1-4.6s-2.4.4-3.6 2.4z" fill="#b89b7d" />
      <ellipse cx="12" cy="16.5" rx="2.6" ry="2" fill="#fffaf0" />
      <circle cx="9.8" cy="13" r="0.9" fill="#4a443c" />
      <circle cx="14.2" cy="13" r="0.9" fill="#4a443c" />
      <ellipse cx="12" cy="15.4" rx="1.1" ry="0.8" fill="#4a443c" />
    </>
  ),
  strawHat: (
    <>
      <ellipse cx="12" cy="15.5" rx="10" ry="3.4" fill="#e8ce97" />
      <path d="M6.5 15a5.5 5 0 0 1 11 0z" fill="#f2dfad" stroke="#d9b978" strokeWidth="0.9" />
      <path d="M6.8 14.2h10.4" stroke="#8fc0e0" strokeWidth="1.6" />
    </>
  ),
  floatRing: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="#f6eddd" stroke="#d9c9ac" strokeWidth="0.8" />
      <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5H12z" fill="#f2a8a2" />
      <path d="M12 20.5A8.5 8.5 0 0 1 3.5 12H12z" fill="#f2a8a2" />
      <circle cx="12" cy="12" r="4" fill="#a9d3ee" stroke="#d9c9ac" strokeWidth="0.8" />
    </>
  ),
  shavedIce: (
    <>
      <path d="M6.5 9.5h11L12 20.5z" fill="#dcebf4" />
      <path d="M5.5 9.5c0-3 3-5 6.5-5s6.5 2 6.5 5z" fill="#a9d3ee" />
      <path d="M8 6.4c2.4-1.4 5.6-1.4 8 0" stroke="#f2a8a2" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </>
  ),
  sunflower: (
    <>
      <g fill="#f5d271">
        <ellipse cx="12" cy="5.6" rx="2" ry="3" />
        <ellipse cx="12" cy="16.4" rx="2" ry="3" />
        <ellipse cx="6.6" cy="11" rx="3" ry="2" />
        <ellipse cx="17.4" cy="11" rx="3" ry="2" />
        <ellipse cx="8" cy="7" rx="2.6" ry="1.9" transform="rotate(-45 8 7)" />
        <ellipse cx="16" cy="7" rx="2.6" ry="1.9" transform="rotate(45 16 7)" />
        <ellipse cx="8" cy="15" rx="2.6" ry="1.9" transform="rotate(45 8 15)" />
        <ellipse cx="16" cy="15" rx="2.6" ry="1.9" transform="rotate(-45 16 15)" />
      </g>
      <circle cx="12" cy="11" r="3.6" fill="#c9884a" />
    </>
  ),
  watermelon: (
    <>
      <path d="M3.5 6.5h17c0 7.2-3.8 13-8.5 13S3.5 13.7 3.5 6.5Z" fill="#f2a8a2" />
      <path d="M3.5 6.5h17v2.2h-17z" fill="#8fbf72" />
      <g fill="#5a4a3c">
        <ellipse cx="9.5" cy="12" rx="0.8" ry="1.1" />
        <ellipse cx="14.5" cy="12" rx="0.8" ry="1.1" />
        <ellipse cx="12" cy="15.5" rx="0.8" ry="1.1" />
      </g>
    </>
  ),
};

/** 内蔵イラストが無いアイテム向けの汎用の形（プレースホルダー） */
const FALLBACK_SHAPE = (
  <>
    <rect x="4.5" y="6" width="15" height="12.5" rx="3" fill="#e2cfa8" />
    <path d="M4.5 10.5h15" stroke="#c9a662" strokeWidth="1.2" />
    <circle cx="12" cy="14.5" r="2.2" fill="#fffaf0" />
  </>
);

export function ItemArt({
  art,
  image,
  name,
  silhouette,
  className = "",
}: {
  art?: ItemArtKey;
  image: string | null;
  name: string;
  /** 未取得のときに true。同じ形のまま真っ黒にする */
  silhouette: boolean;
  className?: string;
}) {
  // 未取得のときは名前も見せない（読み上げも「？？？」に揃える）
  const label = silhouette ? "未取得のアイテム" : name;
  const toneClass = silhouette ? "[filter:brightness(0)] opacity-80" : "";

  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={label}
        className={`h-full w-full object-contain ${toneClass} ${className}`}
        loading="lazy"
      />
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
      className={`h-full w-full ${toneClass} ${className}`}
    >
      {(art ? SHAPES[art] : null) ?? FALLBACK_SHAPE}
    </svg>
  );
}
