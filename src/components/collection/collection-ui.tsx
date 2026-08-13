/**
 * 図鑑の共通パーツ（進捗バー・アイテムのカード・グリッド）。
 * 通常の図鑑・シリーズ図鑑・シリーズ詳細で同じものを使う。
 */
import type { GachaRarity } from "@/lib/gacha/config";
import type { CollectionItem } from "@/lib/collection/items";
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

/**
 * 生成したレアリティカードのテンプレート。
 * 元画像の縦横比 561:701 を維持したまま、カード全面へ敷く。
 * UR は将来追加用として public/collection/rarity-frames/ur.webp に配置済み。
 */
const RARITY_FRAME_PATHS: Record<GachaRarity, string> = {
  N: "/collection/rarity-frames/n.webp",
  R: "/collection/rarity-frames/r.webp",
  SR: "/collection/rarity-frames/sr.webp",
  SSR: "/collection/rarity-frames/ssr.webp",
};

/** 1マス。未取得はこれまで通りレアリティを伏せ、黒いシルエット＋「???」 */
export function ItemCard({ item, owned, count = 0 }: { item: CollectionItem; owned: boolean; count?: number }) {
  const useExactSilhouette = !owned && hasExactSilhouette(item.art);
  const drawCount = owned ? Math.max(1, count) : 0;

  return (
    <div
      className={`relative aspect-[561/701] w-full overflow-hidden rounded-[16px] transition-shadow ${
        owned
          ? "bg-transparent shadow-[0_3px_10px_rgba(94,78,53,0.10)]"
          : "border border-[#ddd6c7] bg-[linear-gradient(145deg,#faf8f2_0%,#f1eee6_100%)] shadow-[0_2px_7px_rgba(98,88,70,0.07)]"
      }`}
    >
      {owned ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={RARITY_FRAME_PATHS[item.rarity]}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
      ) : null}

      <div className="relative z-[1] flex h-full w-full flex-col items-center px-[7%] pt-[14%] pb-[7%]">
        <span className="flex h-[43%] w-[64%] shrink-0 items-center justify-center">
          {useExactSilhouette ? (
            <ExactSilhouette art={item.art} />
          ) : (
            <ItemArt art={item.art} image={item.image} name={item.name} silhouette={!owned} />
          )}
        </span>

        <span
          className={`mt-[3%] flex min-h-[17%] w-full items-center justify-center line-clamp-2 text-center text-[11px] font-semibold leading-tight ${
            owned ? "text-[#514a42]" : "text-ink-faint"
          }`}
        >
          {owned ? item.name : "???"}
        </span>

        <span
          className={`mt-[1%] text-center text-[9px] font-semibold leading-none tabular-nums ${
            owned ? "text-[#6d655c]" : "invisible"
          }`}
          aria-hidden={!owned}
        >
          出た回数 {drawCount}回
        </span>
      </div>
    </div>
  );
}

export function ItemGrid({
  items,
  owned,
  counts,
}: {
  items: readonly CollectionItem[];
  owned: ReadonlySet<string>;
  counts?: ReadonlyMap<string, number>;
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
      {items.map((item) => {
        const isOwned = owned.has(item.id);
        return (
          <li key={item.id}>
            <ItemCard item={item} owned={isOwned} count={counts?.get(item.id) ?? (isOwned ? 1 : 0)} />
          </li>
        );
      })}
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
