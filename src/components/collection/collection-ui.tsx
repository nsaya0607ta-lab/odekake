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
 * 図鑑カード専用のレアリティ配色。
 * N=やさしいグリーン / R=爽やかなブルー / SR=落ち着いたゴールド /
 * SSR=パステルの虹色。未取得カードはレアリティを伏せるため共通のニュートラル色にする。
 */
const RARITY_CARD_STYLES: Record<
  GachaRarity,
  { card: string; badge: string; sparkle: string }
> = {
  N: {
    card:
      "border-[#c7d7a5] bg-[linear-gradient(145deg,#fffdf5_0%,#f1f7df_100%)] shadow-[0_2px_8px_rgba(109,139,75,0.10)]",
    badge: "border border-[#cbdba8] bg-[#edf5d5] text-[#5f7f3d]",
    sparkle: "text-[#9fba72]",
  },
  R: {
    card:
      "border-[#acd2ee] bg-[linear-gradient(145deg,#fcfeff_0%,#eaf6ff_100%)] shadow-[0_2px_8px_rgba(92,151,193,0.12)]",
    badge: "border border-[#b7d9f2] bg-[#e4f3ff] text-[#3477a8]",
    sparkle: "text-[#91c8ea]",
  },
  SR: {
    card:
      "border-[#e5bb5c] bg-[linear-gradient(145deg,#fffdf7_0%,#fff5d5_48%,#fff9e8_100%)] shadow-[0_3px_10px_rgba(190,142,43,0.16)]",
    badge: "border border-[#e8c56d] bg-[#fff0bd] text-[#9a6a12]",
    sparkle: "text-[#d9a82f]",
  },
  SSR: {
    card:
      "border-[#e6acd0] bg-[linear-gradient(135deg,#fff6fb_0%,#f5edff_22%,#eaf8ff_45%,#f3ffe9_67%,#fff4d8_84%,#fff4fa_100%)] shadow-[0_3px_12px_rgba(180,115,174,0.18)]",
    badge:
      "border border-[#e7b7da] bg-[linear-gradient(90deg,#ffe0ee_0%,#eadfff_45%,#fff0c9_100%)] text-[#a34785]",
    sparkle: "text-[#d991c1]",
  },
};

/** レアリティを N / R / SR / SSR で表示 */
function RarityLabel({ item }: { item: CollectionItem }) {
  const style = RARITY_CARD_STYLES[item.rarity];

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[9px] font-black leading-none ${style.badge}`}
      aria-label={`レアリティ${item.rarity}`}
    >
      {item.rarity}
    </span>
  );
}

/** 取得済みカードのレア感を出す、小さなきらめき */
function RaritySparkles({ rarity }: { rarity: GachaRarity }) {
  const style = RARITY_CARD_STYLES[rarity];

  if (rarity === "N") {
    return (
      <span aria-hidden="true" className={`pointer-events-none absolute right-2 top-1.5 text-[9px] opacity-45 ${style.sparkle}`}>
        ✦
      </span>
    );
  }

  if (rarity === "R") {
    return (
      <>
        <span aria-hidden="true" className={`pointer-events-none absolute left-2 top-2 text-[10px] opacity-60 ${style.sparkle}`}>
          ✧
        </span>
        <span aria-hidden="true" className={`pointer-events-none absolute right-2 top-5 text-[8px] opacity-45 ${style.sparkle}`}>
          ✦
        </span>
      </>
    );
  }

  if (rarity === "SR") {
    return (
      <>
        <span aria-hidden="true" className={`pointer-events-none absolute left-2 top-2 text-[11px] opacity-75 ${style.sparkle}`}>
          ✦
        </span>
        <span aria-hidden="true" className={`pointer-events-none absolute right-2 top-3 text-[9px] opacity-60 ${style.sparkle}`}>
          ✦
        </span>
      </>
    );
  }

  return (
    <>
      <span aria-hidden="true" className={`pointer-events-none absolute left-2 top-1.5 text-[12px] opacity-80 ${style.sparkle}`}>
        ✦
      </span>
      <span aria-hidden="true" className="pointer-events-none absolute right-2 top-2 text-[10px] text-[#9fcff0] opacity-75">
        ✦
      </span>
      <span aria-hidden="true" className="pointer-events-none absolute bottom-7 left-2.5 text-[8px] text-[#e3b955] opacity-70">
        ✧
      </span>
    </>
  );
}

/** 1マス。未取得は黒いシルエット＋「???」 */
export function ItemCard({ item, owned }: { item: CollectionItem; owned: boolean }) {
  const useExactSilhouette = !owned && hasExactSilhouette(item.art);
  const rarityStyle = RARITY_CARD_STYLES[item.rarity];

  return (
    <div
      className={`rough-card relative flex h-[132px] flex-col items-center overflow-hidden border px-1.5 py-2.5 transition-shadow ${
        owned
          ? rarityStyle.card
          : "border-[#ddd6c7] bg-[linear-gradient(145deg,#faf8f2_0%,#f1eee6_100%)] shadow-[0_2px_7px_rgba(98,88,70,0.07)]"
      }`}
    >
      {owned ? <RaritySparkles rarity={item.rarity} /> : null}

      <span className="relative z-[1] flex h-14 w-14 shrink-0 items-center justify-center">
        {useExactSilhouette ? (
          <ExactSilhouette art={item.art} />
        ) : (
          <ItemArt art={item.art} image={item.image} name={item.name} silhouette={!owned} />
        )}
      </span>
      <span
        className={`relative z-[1] mt-1.5 flex min-h-[28px] w-full items-center justify-center line-clamp-2 text-center text-[11px] leading-tight font-semibold ${
          owned ? "text-ink" : "text-ink-faint"
        }`}
      >
        {owned ? item.name : "???"}
      </span>
      <span className="relative z-[1] mt-auto flex h-4 items-center justify-center">
        {owned ? <RarityLabel item={item} /> : null}
      </span>
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
