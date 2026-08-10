/**
 * 図鑑アイテムの絵。
 *
 * 写真素材はまだ無いので、そうび（gear-art.tsx）や コイン画面（coin-art.tsx）と
 * 同じように図形で描いている。素材ができたら CollectionItem.image にパスを入れれば
 * そちらが優先される。
 *
 * 未取得のときは同じ絵に brightness(0) をかけて黒いシルエットにする。
 * こうしておくと、絵でも画像ファイルでも「形は同じ・色だけ消える」で揃う。
 *
 * アイテムを足すときは ItemArtKey（src/lib/collection/items.ts）にキーを足して、
 * 下の SHAPES に絵を1つ書く。絵が無いキーは FALLBACK_SHAPE になる。
 */
import type { ItemArtKey } from "@/lib/collection/items";

/** フレブルの顔。かぶりものだけシリーズごとに差し替える */
function Frenchie({ accessory }: { accessory: React.ReactNode }) {
  return (
    <>
      {/* 耳 */}
      <path d="M6.6 10.2c-1-2.8-.4-5.2-.4-5.2s2.6 1.2 3.8 3.4z" fill="#b89b7d" />
      <path d="M17.4 10.2c1-2.8.4-5.2.4-5.2s-2.6 1.2-3.8 3.4z" fill="#b89b7d" />
      {/* 顔 */}
      <ellipse cx="12" cy="13.6" rx="6.4" ry="5.8" fill="#d9c3aa" />
      <ellipse cx="12" cy="16.2" rx="3.4" ry="2.6" fill="#fffaf0" />
      <circle cx="9.5" cy="12.9" r="0.95" fill="#4a443c" />
      <circle cx="14.5" cy="12.9" r="0.95" fill="#4a443c" />
      <ellipse cx="12" cy="14.9" rx="1.15" ry="0.9" fill="#4a443c" />
      <path d="M10.6 17.2c.9.7 1.9.7 2.8 0" fill="none" stroke="#a98d6d" strokeWidth="0.8" strokeLinecap="round" />
      {accessory}
    </>
  );
}

const SHAPES: Record<ItemArtKey, React.ReactNode> = {
  /** 登山シリーズ：緑の登山ハット */
  dogHiking: (
    <Frenchie
      accessory={
        <>
          <ellipse cx="12" cy="8.6" rx="7.2" ry="1.9" fill="#7aa85f" />
          <path d="M8.4 8.4a3.7 3.2 0 0 1 7.2 0z" fill="#8fbf72" />
          <path d="M8.8 8.2h6.4" stroke="#5d8049" strokeWidth="1.1" />
        </>
      }
    />
  ),

  /** 雪国シリーズ：ぼんぼりつきのニット帽 */
  dogSnow: (
    <Frenchie
      accessory={
        <>
          <path d="M7.2 8.8a4.8 4.4 0 0 1 9.6 0z" fill="#a9d3ee" />
          <rect x="6.4" y="8.2" width="11.2" height="2.4" rx="1.2" fill="#eaf3fa" />
          <circle cx="12" cy="3.9" r="1.7" fill="#eaf3fa" />
          <path d="M12 5.6v-1" stroke="#a9d3ee" strokeWidth="1.1" strokeLinecap="round" />
        </>
      }
    />
  ),

  /** 夏シリーズ：むぎわらぼう */
  dogSummer: (
    <Frenchie
      accessory={
        <>
          <ellipse cx="12" cy="8.8" rx="7.8" ry="2.1" fill="#e8ce97" />
          <path d="M8.2 8.6a3.9 3.3 0 0 1 7.6 0z" fill="#f2dfad" />
          <path d="M8.5 8.3h7" stroke="#8fc0e0" strokeWidth="1.2" />
        </>
      }
    />
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
