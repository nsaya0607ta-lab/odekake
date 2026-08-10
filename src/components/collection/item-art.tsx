/**
 * 図鑑アイテムの絵。
 *
 * 未取得時は「取得後に表示するのと同じ形」へ brightness(0) をかけ、
 * 真っ黒なシルエットとして表示する。
 * 画像素材がある場合は CollectionItem.image を優先し、無い場合だけ内蔵SVGを使う。
 */
import type { ItemArtKey } from "@/lib/collection/items";

function FrenchieFigure({
  backAccessory,
  bodyAccessory,
  headAccessory,
}: {
  backAccessory?: React.ReactNode;
  bodyAccessory?: React.ReactNode;
  headAccessory?: React.ReactNode;
}) {
  return (
    <>
      {/* 背中側の装備。シルエット時にも輪郭へ含まれる */}
      {backAccessory}

      {/* しっぽ */}
      <path
        d="M25.2 15.2c3.1-2 4.2.5 2.3 1.8-1 .7-2.2.3-2.8-.4"
        fill="none"
        stroke="#6f6255"
        strokeWidth="1.35"
        strokeLinecap="round"
      />

      {/* からだ */}
      <ellipse cx="18.2" cy="19" rx="8" ry="6.3" fill="#f7f0e4" stroke="#655a50" strokeWidth="1" />
      <path d="M13.4 22.3h4.2v6.1c0 1.2-.9 2-2.1 2h-.2c-1.2 0-1.9-.8-1.9-2z" fill="#f7f0e4" stroke="#655a50" strokeWidth="1" />
      <path d="M21.3 22.2h4v5.8c0 1.2-.8 2-2 2h-.2c-1.1 0-1.8-.8-1.8-2z" fill="#f7f0e4" stroke="#655a50" strokeWidth="1" />

      {bodyAccessory}

      {/* 顔と耳 */}
      <path d="M5.7 9.2C4.5 5.9 5.6 2.4 6 2c2.7 1.3 4.5 3.4 4.9 6.4z" fill="#f7f0e4" stroke="#655a50" strokeWidth="1" />
      <path d="M15.5 8.5c.4-4 2.4-6.2 5.2-7.1.6.6 1.7 4.3-.1 8.2z" fill="#f7f0e4" stroke="#655a50" strokeWidth="1" />
      <path d="M6.8 7.2C6.4 5.5 6.8 4.1 7.1 3.6c1.1.8 2 2 2.4 3.6z" fill="#efb5a6" />
      <path d="M17.2 7.1c.5-1.7 1.5-3 2.6-3.7.3.8.4 2.3-.1 3.9z" fill="#efb5a6" />
      <ellipse cx="13" cy="14.1" rx="8.2" ry="7.3" fill="#fbf6ec" stroke="#655a50" strokeWidth="1" />

      {/* 片目まわりの模様 */}
      <path d="M13.6 7.5c3.9-.8 6.6 1.3 6.8 4.7.1 2.1-1.2 3.9-3.1 4.4-2.6.6-4.6-1-4.7-3.7-.1-2 .4-4.1 1-5.4z" fill="#a99482" opacity=".9" />

      {/* 顔 */}
      <circle cx="9.8" cy="13.2" r="1.05" fill="#403a35" />
      <circle cx="16.5" cy="13.1" r="1.05" fill="#403a35" />
      <ellipse cx="12.9" cy="16" rx="3.7" ry="2.5" fill="#fffdf8" />
      <ellipse cx="12.8" cy="15.1" rx="1.35" ry="1" fill="#403a35" />
      <path d="M11.1 17.1c1 .9 2.4 1 3.5 0" fill="none" stroke="#655a50" strokeWidth=".85" strokeLinecap="round" />
      <path d="M12.2 17.5c.7.5 1.3.5 1.9 0-.1 1.5-.6 2.2-1 2.2-.5 0-.9-.7-.9-2.2z" fill="#e9998c" />
      <circle cx="8" cy="16.2" r="1" fill="#efb0a4" opacity=".6" />
      <circle cx="18" cy="16.1" r="1" fill="#efb0a4" opacity=".6" />

      {headAccessory}
    </>
  );
}

const SHAPES: Record<ItemArtKey, React.ReactNode> = {
  /** 登山シリーズ：サファリハット＋リュック＋ロールマット */
  dogHiking: (
    <FrenchieFigure
      backAccessory={
        <>
          <rect x="21.1" y="10.2" width="6.7" height="10.2" rx="2" fill="#a87943" stroke="#655a50" strokeWidth=".9" />
          <rect x="22" y="7.8" width="5" height="3.3" rx="1.5" fill="#75955b" stroke="#655a50" strokeWidth=".85" />
          <path d="M24.5 8.2v2.4" stroke="#4f6e40" strokeWidth=".8" />
        </>
      }
      bodyAccessory={
        <>
          <path d="M11.4 17.5c3.5-2.1 9.6-2.8 14 .3v5.4c-3.8 1.8-9.1 1.9-12.7-.2z" fill="#91ad69" opacity=".95" />
          <path d="M15.1 18.1v5.2M20.1 17.3v6.3" stroke="#667c4f" strokeWidth=".65" opacity=".8" />
          <path d="M13.5 20.2h11.7" stroke="#6e5b42" strokeWidth=".75" />
        </>
      }
      headAccessory={
        <>
          <ellipse cx="12.9" cy="8.2" rx="9.1" ry="2.25" fill="#d7b875" stroke="#655a50" strokeWidth=".9" />
          <path d="M8.4 7.8c.3-3 2.2-4.7 4.7-4.7s4.5 1.7 4.8 4.7z" fill="#dcbf7f" stroke="#655a50" strokeWidth=".9" />
          <path d="M8.5 6.8h9" stroke="#738b52" strokeWidth="1" />
          <circle cx="16.5" cy="5.8" r="1.1" fill="#75aac7" stroke="#655a50" strokeWidth=".55" />
        </>
      }
    />
  ),

  /** 雪国シリーズ：ニット帽＋マフラー＋ダウン */
  dogSnow: (
    <FrenchieFigure
      bodyAccessory={
        <>
          <path d="M11.8 17.3c3.6-1.8 9.4-2.2 13.8.8v5.7c-4 1.7-9.3 1.6-12.9-.6z" fill="#a9d4ef" opacity=".96" />
          <path d="M14.5 18.5h10.3M14 21.1h11" stroke="#78afd1" strokeWidth=".65" opacity=".85" />
          <path d="M8.2 17.3c2.8 1.4 7.2 1.6 10.3.1" fill="none" stroke="#8fc5e6" strokeWidth="2.3" strokeLinecap="round" />
          <path d="M15.2 17.9v5.3" stroke="#fff" strokeWidth=".85" opacity=".75" />
        </>
      }
      headAccessory={
        <>
          <path d="M5.8 8.9c.4-4.1 3-6.5 7-6.5 4.1 0 6.8 2.6 7.1 6.5z" fill="#9dcfea" stroke="#655a50" strokeWidth=".9" />
          <rect x="5.1" y="7.4" width="15.5" height="2.8" rx="1.4" fill="#f3f3ef" stroke="#655a50" strokeWidth=".8" />
          <circle cx="12.8" cy="1.8" r="1.8" fill="#f3f3ef" stroke="#655a50" strokeWidth=".75" />
          <path d="M8.1 4.9l1 1m2-1.7.2 1.3m2.3-1.3-.2 1.3m2-1.1-.8 1.1" stroke="#e7f3fb" strokeWidth=".65" strokeLinecap="round" />
        </>
      }
    />
  ),

  /** 夏シリーズ：むぎわら帽子＋アロハシャツ */
  dogSummer: (
    <FrenchieFigure
      bodyAccessory={
        <>
          <path d="M11.6 17.1c3.8-1.7 9.8-1.9 14 .9v5.1c-3.9 1.8-9 1.7-12.6-.3z" fill="#65bdd0" opacity=".96" />
          <circle cx="16.2" cy="19" r=".8" fill="#f5f0d7" />
          <circle cx="21.5" cy="20.7" r=".75" fill="#f5f0d7" />
          <path d="M15.7 18.2l1 1.6m4.3.2 1.1 1.3M18.8 22l.9-1.2" stroke="#71a961" strokeWidth=".7" strokeLinecap="round" />
          <path d="M18.6 17.7v5.8" stroke="#f5f0d7" strokeWidth=".7" opacity=".8" />
        </>
      }
      headAccessory={
        <>
          <ellipse cx="12.9" cy="8.4" rx="9.3" ry="2.15" fill="#e2c077" stroke="#655a50" strokeWidth=".9" />
          <path d="M8.2 8c.2-3 2.1-4.8 4.8-4.8 2.6 0 4.5 1.7 4.8 4.8z" fill="#ecd18e" stroke="#655a50" strokeWidth=".9" />
          <path d="M8.5 7h8.9" stroke="#5caac4" strokeWidth="1.15" />
          <circle cx="17.2" cy="6.2" r="1" fill="#fffaf0" stroke="#d5ac5c" strokeWidth=".5" />
          <circle cx="17.2" cy="6.2" r=".28" fill="#dfb154" />
          <path d="M18.2 6.4c1 .1 1.6.5 2 .9-.9.5-1.6.6-2.3.2z" fill="#6fa35c" />
        </>
      }
    />
  ),
};

const FALLBACK_SHAPE = (
  <>
    <rect x="5" y="8" width="22" height="16" rx="5" fill="#e2cfa8" stroke="#8b8175" strokeWidth="1.1" />
    <path d="M5 13h22" stroke="#c9a662" strokeWidth="1.1" />
    <circle cx="16" cy="19" r="3" fill="#fffaf0" />
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
  silhouette: boolean;
  className?: string;
}) {
  const label = silhouette ? "未取得のアイテム" : name;
  // opacityを落とすと灰色に見えるため、未取得は完全な黒にする。
  const toneClass = silhouette ? "[filter:brightness(0)] opacity-100" : "";

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
      viewBox="0 0 32 32"
      role="img"
      aria-label={label}
      className={`h-full w-full overflow-visible ${toneClass} ${className}`}
    >
      {(art ? SHAPES[art] : null) ?? FALLBACK_SHAPE}
    </svg>
  );
}
