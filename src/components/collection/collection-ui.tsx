/**
 * 図鑑の共通パーツ（進捗バー・アイテムのカード・グリッド）。
 * 通常の図鑑・シリーズ図鑑・シリーズ詳細で同じものを使う。
 */
import { IconStar } from "@/components/icons";
import { RARITY_STARS, type CollectionItem } from "@/lib/collection/items";
import { ExactSilhouette, hasExactSilhouette } from "./exact-silhouette";
import { ItemArt } from "./item-art";

/** 「25 / 60 (41%)」と進捗バー */
export function CollectionProgress({
  label = "コンプリート率",
  owned,
  total,
  barClass = "bg-leaf",
}: {
  label?: string;
  owned: number;
  total: number;
  barClass?: string;
}) {
  const percent = total > 0 ? Math.round((owned / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink-soft">{label}</span>
        <span className="tabular-nums">
          <span className="text-xl font-bold">{owned}</span>
          <span className="text-sm text-ink-faint"> / {total}</span>
          <span className="ml-1 text-sm text-ink-faint">({percent}%)</span>
        </span>
      </div>
      <span className="mt-1.5 block h-2 w-full overflow-hidden rounded-full bg-paper-deep" aria-hidden="true">
        <span className={`block h-full rounded-full transition-all ${barClass}`} style={{ width: `${percent}%` }} />
      </span>
    </div>
  );
}

/** レアリティの★ */
function RarityStars({ item }: { item: CollectionItem }) {
  const stars = RARITY_STARS[item.rarity] ?? 1;

  return (
    <span className="mt-0.5 flex items-center justify-center gap-px text-sun" aria-label={`レアリティ${stars}`}>
      {Array.from({ length: stars }, (_, index) => (
        <IconStar key={index} size={10} filled strokeWidth={1.2} />
      ))}
    </span>
  );
}

/** 1マス。未取得は黒いシルエット＋「???」 */
export function ItemCard({ item, owned }: { item: CollectionItem; owned: boolean }) {
  const useExactSilhouette = !owned && hasExactSilhouette(item.art);

  return (
    <div
      className={`rough-card flex flex-col items-center px-1.5 py-2.5 ${owned ? "" : "bg-paper-deep/60"}`}
    >
      <span className="flex h-14 w-14 items-center justify-center">
        {useExactSilhouette ? (
          <ExactSilhouette art={item.art} />
        ) : (
          <ItemArt art={item.art} image={item.image} name={item.name} silhouette={!owned} />
        )}
      </span>
      <span
        className={`mt-1.5 line-clamp-2 w-full text-center text-[11px] leading-tight font-semibold ${
          owned ? "text-ink" : "text-ink-faint"
        }`}
      >
        {owned ? item.name : "???"}
      </span>
      {owned ? <RarityStars item={item} /> : null}
    </div>
  );
}

export function ItemGrid({
  items,
  owned,
}: {
  items: readonly CollectionItem[];
  owned: ReadonlySet<string>;
}) {
  if (items.length === 0) {
    return (
      <div className="rough-card px-6 py-8 text-center">
        <p className="text-sm font-semibold text-ink-soft">まだアイテムがありません</p>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
          アイテムが増えるとここに並びます。
        </p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-3 gap-2.5">
      {items.map((item) => (
        <li key={item.id}>
          <ItemCard item={item} owned={owned.has(item.id)} />
        </li>
      ))}
    </ul>
  );
}

/** ホームの「図鑑を見る」ボタンなどに置く本の絵 */
export function CollectionBookArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M3.5 5.5h7c1 0 1.5.6 1.5 1.4v12c-.6-.7-1-1-1.5-1h-7z" fill="#e2cfa8" />
      <path d="M20.5 5.5h-7c-1 0-1.5.6-1.5 1.4v12c.6-.7 1-1 1.5-1h7z" fill="#f6eddd" />
      <path d="M3.5 5.5h7c1 0 1.5.6 1.5 1.4v12c-.6-.7-1-1-1.5-1h-7zM20.5 5.5h-7c-1 0-1.5.6-1.5 1.4v12c.6-.7 1-1 1.5-1h7z" fill="none" stroke="#8b8175" strokeWidth="1" strokeLinejoin="round" />
      <path d="M14.4 9h4M14.4 11.6h4" stroke="#c9a662" strokeWidth="1" strokeLinecap="round" />
      <circle cx="7" cy="10.5" r="2" fill="#a9cf8d" />
    </svg>
  );
}
