"use client";

/**
 * 図鑑の共通パーツ（進捗バー・アイテムのカード・グリッド）。
 * 通常の図鑑・シリーズ図鑑・シリーズ詳細で同じものを使う。
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { GachaRarity } from "@/lib/gacha/config";
import type { CollectionItem } from "@/lib/collection/items";
import { formatSkillLevel, getNextLevelRemaining } from "@/lib/gacha/skill-levels";
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
 */
const RARITY_FRAME_PATHS: Record<GachaRarity, string> = {
  N: "/collection/rarity-frames/n.webp",
  R: "/collection/rarity-frames/r.webp",
  SR: "/collection/rarity-frames/sr.webp",
  SSR: "/collection/rarity-frames/ssr.webp",
  UR: "/collection/rarity-frames/ur.webp",
  LR: "/collection/rarity-frames/lr-v2.webp",
  MR: "/collection/rarity-frames/mr.webp",
};

/**
 * フレーム画像を敷くときの拡大率。以前はN〜URの画像に不透明な
 * クリーム色の余白が焼き込まれており、scaleX(1.18) scaleY(1.06)という
 * 横だけ大きい非対称倍率でそれを除去していたが、絵柄が横方向に歪む
 * 副作用があった。画像側の余白を全レアリティ分トリミング済みのため、
 * 全レアリティ共通で歪みのない均等倍率にする。
 */
const RARITY_FRAME_SCALE: Record<GachaRarity, string> = {
  N: "scale(1)",
  R: "scale(1)",
  SR: "scale(1)",
  SSR: "scale(1)",
  UR: "scale(1)",
  LR: "scale(1)",
  MR: "scale(1)",
};

/**
 * 1マス。
 * owned は「その図鑑の持ち主が所持しているか」、revealed は「閲覧者に中身を見せてよいか」。
 * フレンド図鑑では、相手が所持していても自分が未所持ならシークレットのまま回数だけ表示できる。
 */
export function ItemCard({
  item,
  owned,
  count = 0,
  revealed = owned,
  showCountWhenHidden = false,
}: {
  item: CollectionItem;
  owned: boolean;
  count?: number;
  revealed?: boolean;
  showCountWhenHidden?: boolean;
}) {
  const isRevealed = owned && revealed;
  const useExactSilhouette = !isRevealed && hasExactSilhouette(item.art);
  const drawCount = owned ? Math.max(1, count) : 0;
  const showCount = owned && (isRevealed || showCountWhenHidden);
  return (
    <div
      className={`relative aspect-[561/701] w-full overflow-hidden rounded-[16px] transition-shadow ${
        isRevealed
          ? "bg-transparent shadow-[0_3px_10px_rgba(94,78,53,0.10)]"
          : "border border-[#ddd6c7] bg-[linear-gradient(145deg,#faf8f2_0%,#f1eee6_100%)] shadow-[0_2px_7px_rgba(98,88,70,0.07)]"
      }`}
    >
      {isRevealed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={RARITY_FRAME_PATHS[item.rarity]}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full max-w-none object-fill"
          style={{ transform: RARITY_FRAME_SCALE[item.rarity] }}
        />
      ) : null}

      <div className="relative z-[1] flex h-full w-full flex-col items-center px-[7%] pt-[16%] pb-[7%]">
        <span className="mt-[calc(2%+20px)] flex h-[43%] w-[64%] shrink-0 items-center justify-center">
          {useExactSilhouette ? (
            <ExactSilhouette art={item.art} />
          ) : (
            <ItemArt art={item.art} image={item.image} name={item.name} silhouette={!isRevealed} />
          )}
        </span>

        <span
          className={`mt-[3%] flex min-h-[17%] w-full items-center justify-center line-clamp-2 text-center text-[11px] font-semibold leading-tight ${
            isRevealed ? "" : "text-ink-faint"
          }`}
        >
          {isRevealed ? (
            <span className="rounded-full bg-black/35 px-2 py-0.5 text-white">{item.name}</span>
          ) : (
            "???"
          )}
        </span>

        {!isRevealed && showCount ? (
          <span className="mt-[1%] text-center text-[9px] font-semibold leading-none tabular-nums text-ink-faint">
            出た回数 {drawCount}回
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ItemPreviewModal({ item, count, onClose }: { item: CollectionItem; count: number; onClose: () => void }) {
  const drawCount = Math.max(1, count);
  const skillLevelLabel = formatSkillLevel(item.rarity, drawCount);
  const nextLevelRemaining = getNextLevelRemaining(item.rarity, drawCount);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscrollBehavior = document.body.style.overscrollBehavior;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const modal = (
    <div
      className="fixed left-0 top-0 z-[9999] flex h-[100dvh] w-screen touch-none items-center justify-center bg-[#2d2923]/55 px-5 py-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${item.name}の拡大表示`}
    >
      <div className="relative aspect-[561/701] w-full max-w-[380px] overflow-hidden rounded-[24px] shadow-[0_18px_60px_rgba(35,29,22,0.35)]">
        {/* 図鑑カードと同じ既存のレアリティ背景を拡大表示でも使う。 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={RARITY_FRAME_PATHS[item.rarity]}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full max-w-none object-fill"
          style={{ transform: RARITY_FRAME_SCALE[item.rarity] }}
        />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-[3] flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-paper/95 text-2xl font-medium leading-none text-ink shadow-sm active:scale-95"
          aria-label="拡大表示を閉じる"
        >
          ×
        </button>

        <div className="relative z-[1] flex h-full w-full flex-col items-center px-[8%] pt-[16%] pb-[8%]">
          <div className="mt-[calc(2%+20px)] flex h-[52%] w-[72%] shrink-0 items-center justify-center">
            {item.image ? (
              // 元画像を拡大補間しすぎないよう、実画像をobject-containで表示する。
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image}
                alt={item.name}
                className="block h-auto w-auto max-h-full max-w-full object-contain"
              />
            ) : (
              <ItemArt art={item.art} image={null} name={item.name} silhouette={false} />
            )}
          </div>

          <p className="mt-[5%] flex min-h-[14%] w-full items-center justify-center text-center text-[20px] font-bold leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)]">
            {item.name}
          </p>

          <p className="mt-[2%] text-center text-[12px] font-semibold leading-none tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
            出た回数 {drawCount}回
          </p>

          {skillLevelLabel ? (
            <p className="mt-[2%] flex items-center gap-1.5 text-center text-[11px] font-bold leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
              <span className="rounded-full bg-black/35 px-2 py-0.5">{skillLevelLabel}</span>
              {nextLevelRemaining !== null ? <span>次まであと{nextLevelRemaining}</span> : null}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );

  // 図鑑カードのレイアウト階層から切り離して body 直下へ出すことで、
  // スクロール位置に関係なく「いま見えている画面」の中央へ固定する。
  return createPortal(modal, document.body);
}

export function ItemGrid({
  items,
  owned,
  counts,
  revealedOwned,
  showCountWhenHidden = false,
}: {
  items: readonly CollectionItem[];
  owned: ReadonlySet<string>;
  counts?: ReadonlyMap<string, number>;
  revealedOwned?: ReadonlySet<string>;
  showCountWhenHidden?: boolean;
}) {
  const [previewItem, setPreviewItem] = useState<{ item: CollectionItem; count: number } | null>(null);

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
    <>
      <ul className="grid grid-cols-3 gap-2.5">
        {items.map((item) => {
          const isOwned = owned.has(item.id);
          const isRevealed = isOwned && (revealedOwned ? revealedOwned.has(item.id) : true);
          const itemCount = counts?.get(item.id) ?? (isOwned ? 1 : 0);
          const card = (
            <ItemCard
              item={item}
              owned={isOwned}
              revealed={isRevealed}
              count={itemCount}
              showCountWhenHidden={showCountWhenHidden}
            />
          );

          return (
            <li key={item.id}>
              {isRevealed ? (
                <button
                  type="button"
                  onClick={() => setPreviewItem({ item, count: itemCount })}
                  className="block w-full rounded-[16px] text-left active:scale-[0.98]"
                  aria-label={`${item.name}を拡大表示`}
                >
                  {card}
                </button>
              ) : (
                card
              )}
            </li>
          );
        })}
      </ul>

      {previewItem ? (
        <ItemPreviewModal item={previewItem.item} count={previewItem.count} onClose={() => setPreviewItem(null)} />
      ) : null}
    </>
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
