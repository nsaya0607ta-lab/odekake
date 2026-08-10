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

type CardStyle = {
  card: string;
  inner: string;
  badge: string;
  corner: string;
  accent: string;
};

/**
 * 参考デザイン準拠の図鑑カード配色。
 * N=淡いグリーン / R=澄んだ水色 / SR=アイボリー×上品な金 / SSR=パステル虹色。
 */
const RARITY_CARD_STYLES: Record<GachaRarity, CardStyle> = {
  N: {
    card:
      "border-[#b8cc87] bg-[linear-gradient(145deg,#fffdf5_0%,#f5f8e7_42%,#edf3d7_100%)] shadow-[0_3px_8px_rgba(111,136,71,0.16),0_1px_0_rgba(255,255,255,0.95)_inset]",
    inner: "border-[#d9e3b8]",
    badge:
      "border border-[#b9cc87] bg-[linear-gradient(180deg,#f3f8df_0%,#e3eec3_100%)] text-[#668244] shadow-[0_1px_2px_rgba(92,119,57,0.12)]",
    corner:
      "border-[#abc276] bg-[linear-gradient(180deg,#dce9b9_0%,#bdd58d_100%)] text-[#5f7e3f]",
    accent: "text-[#9ab66d]",
  },
  R: {
    card:
      "border-[#84bde6] bg-[linear-gradient(145deg,#fcfeff_0%,#eef8ff_42%,#e4f3ff_100%)] shadow-[0_3px_9px_rgba(71,139,190,0.18),0_1px_0_rgba(255,255,255,0.98)_inset]",
    inner: "border-[#b9dcf2]",
    badge:
      "border border-[#a4d2ef] bg-[linear-gradient(180deg,#eef9ff_0%,#d9effd_100%)] text-[#2372aa] shadow-[0_1px_2px_rgba(63,128,174,0.13)]",
    corner:
      "border-[#6eaddc] bg-[linear-gradient(180deg,#a8d7f5_0%,#70b6e6_100%)] text-white",
    accent: "text-[#80bee7]",
  },
  SR: {
    card:
      "border-[#dfa83a] bg-[linear-gradient(145deg,#fffdf8_0%,#fff8e8_40%,#ffefc5_100%)] shadow-[0_4px_10px_rgba(177,126,27,0.22),0_1px_0_rgba(255,255,255,0.98)_inset]",
    inner: "border-[#f0ce83]",
    badge:
      "border border-[#e0b04c] bg-[linear-gradient(180deg,#fff4ce_0%,#f5d778_100%)] text-[#9b690a] shadow-[0_1px_2px_rgba(154,105,10,0.15)]",
    corner:
      "border-[#dca02a] bg-[linear-gradient(180deg,#ffd977_0%,#e8ae36_100%)] text-[#8a5b06]",
    accent: "text-[#d8a129]",
  },
  SSR: {
    card:
      "border-[#e7a7d7] bg-[linear-gradient(135deg,#fff2f8_0%,#f7eaff_20%,#eaf8ff_40%,#edffe9_60%,#fff6cf_80%,#fff0f6_100%)] shadow-[0_4px_12px_rgba(180,101,168,0.25),0_1px_0_rgba(255,255,255,0.98)_inset]",
    inner: "border-[#f1c6e2]",
    badge:
      "border border-[#e9a8d3] bg-[linear-gradient(90deg,#ffd5e6_0%,#e7d5ff_33%,#d9efff_58%,#fff0bd_100%)] text-[#a33d7d] shadow-[0_1px_3px_rgba(155,64,124,0.18)]",
    corner:
      "border-[#e29acb] bg-[linear-gradient(135deg,#ffb8d7_0%,#d9c5ff_35%,#bfe9ff_62%,#ffe39a_100%)] text-white",
    accent: "text-[#d884bd]",
  },
};

function PawMark({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`relative block h-3 w-3 opacity-55 ${className}`}>
      <span className="absolute bottom-0 left-[3px] h-[6px] w-[7px] rounded-[50%] bg-current" />
      <span className="absolute left-0 top-[2px] h-[3px] w-[3px] rounded-full bg-current" />
      <span className="absolute left-[4px] top-0 h-[3px] w-[3px] rounded-full bg-current" />
      <span className="absolute right-0 top-[2px] h-[3px] w-[3px] rounded-full bg-current" />
    </span>
  );
}

function CornerBadge({ rarity }: { rarity: GachaRarity }) {
  const style = RARITY_CARD_STYLES[rarity];

  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute left-[7px] top-[6px] z-[3] flex h-[28px] min-w-[27px] items-start justify-center border px-1 pt-[5px] text-[8px] font-black leading-none shadow-[0_1px_3px_rgba(80,70,55,0.14)] ${style.corner}`}
      style={{ clipPath: "polygon(0 0,100% 0,100% 76%,50% 100%,0 76%)" }}
    >
      {rarity}
    </span>
  );
}

/** レアリティを N / R / SR / SSR で表示 */
function RarityLabel({ item }: { item: CollectionItem }) {
  const style = RARITY_CARD_STYLES[item.rarity];

  return (
    <span
      className={`min-w-[32px] rounded-full px-2.5 py-[3px] text-center text-[9px] font-black leading-none ${style.badge}`}
      aria-label={`レアリティ${item.rarity}`}
    >
      {item.rarity}
    </span>
  );
}

/** 参考画像の「カード内装飾」。レア度ごとに密度を変える。 */
function RarityDecorations({ rarity }: { rarity: GachaRarity }) {
  const style = RARITY_CARD_STYLES[rarity];

  if (rarity === "N") {
    return (
      <>
        <PawMark className={`absolute right-2 top-2 ${style.accent}`} />
        <span aria-hidden="true" className={`pointer-events-none absolute bottom-7 left-2 text-[11px] opacity-45 ${style.accent}`}>
          ❧
        </span>
      </>
    );
  }

  if (rarity === "R") {
    return (
      <>
        <span aria-hidden="true" className={`pointer-events-none absolute left-2 top-2 text-[11px] opacity-80 ${style.accent}`}>✦</span>
        <span aria-hidden="true" className={`pointer-events-none absolute right-2 top-5 text-[8px] opacity-65 ${style.accent}`}>✧</span>
        <PawMark className={`absolute bottom-7 right-2 ${style.accent}`} />
      </>
    );
  }

  if (rarity === "SR") {
    return (
      <>
        <span aria-hidden="true" className={`pointer-events-none absolute left-2 top-2 text-[12px] opacity-85 ${style.accent}`}>✦</span>
        <span aria-hidden="true" className={`pointer-events-none absolute right-2 top-3 text-[10px] opacity-75 ${style.accent}`}>✦</span>
        <PawMark className={`absolute bottom-7 left-2 ${style.accent}`} />
      </>
    );
  }

  return (
    <>
      <span aria-hidden="true" className={`pointer-events-none absolute left-2 top-2 text-[12px] opacity-90 ${style.accent}`}>✦</span>
      <span aria-hidden="true" className="pointer-events-none absolute right-2 top-2 text-[10px] text-[#83c8ef] opacity-85">✦</span>
      <span aria-hidden="true" className="pointer-events-none absolute right-3 top-7 text-[8px] text-[#e9b352] opacity-80">✧</span>
      <span aria-hidden="true" className="pointer-events-none absolute bottom-7 left-2 text-[9px] text-[#b69be5] opacity-80">✦</span>
      <PawMark className="absolute bottom-7 right-2 text-[#e6a4c9]" />
    </>
  );
}

/** 1マス。未取得は黒いシルエット＋「???」。 */
export function ItemCard({ item, owned }: { item: CollectionItem; owned: boolean }) {
  const useExactSilhouette = !owned && hasExactSilhouette(item.art);
  const rarityStyle = RARITY_CARD_STYLES[item.rarity];

  return (
    <div
      className={`relative flex h-[132px] flex-col items-center overflow-hidden rounded-[22px] border-2 px-1.5 pb-2 pt-2.5 transition-shadow ${
        owned
          ? rarityStyle.card
          : "border-[#d7d1c6] bg-[linear-gradient(145deg,#fbf9f3_0%,#f1eee7_100%)] shadow-[0_3px_8px_rgba(92,82,68,0.10),0_1px_0_rgba(255,255,255,0.9)_inset]"
      }`}
    >
      {/* 参考画像の二重フレーム */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-[3px] z-0 rounded-[18px] border ${
          owned ? rarityStyle.inner : "border-[#e5dfd4]"
        }`}
      />

      {owned ? <CornerBadge rarity={item.rarity} /> : null}
      {owned ? <RarityDecorations rarity={item.rarity} /> : null}

      <span className="relative z-[2] flex h-14 w-14 shrink-0 items-center justify-center">
        {useExactSilhouette ? (
          <ExactSilhouette art={item.art} />
        ) : (
          <ItemArt art={item.art} image={item.image} name={item.name} silhouette={!owned} />
        )}
      </span>

      <span
        className={`relative z-[2] mt-1 flex min-h-[28px] w-full items-center justify-center line-clamp-2 text-center text-[11px] leading-tight font-semibold ${
          owned ? "text-[#403a33]" : "text-ink-faint"
        }`}
      >
        {owned ? item.name : "???"}
      </span>

      <span className="relative z-[2] mt-auto flex h-[17px] items-center justify-center">
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
