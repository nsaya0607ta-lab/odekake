"use client";

/**
 * シリーズ図鑑内の「ダンボール」セクション用グリッド。
 * ダンボールガチャ(DambourleItem)は通常図鑑のCollectionItemとは別のデータモデル
 * （所持数はuser_dambourle_items、Lv計算式も別）のため、ItemGrid/ItemCardは使わず
 * 専用の閲覧専用カードを用意する（装備切り替えはダンボール選択画面で行う）。
 * imgにonContextMenuハンドラを渡すため、サーバーコンポーネントのままにはできない
 * （"Event handlers cannot be passed to Client Component props"エラーの原因になる）。
 */
import { DEFAULT_BOX_ALT, DEFAULT_BOX_IMAGE, getDambourleBoxImage } from "@/lib/dambourle/box-image";
import { DAMBOURLE_EFFECT_NAMES, DAMBOURLE_PRIZES, getDambourleEffectValueText } from "@/lib/dambourle/prizes";
import { getDambourleLevel, getDambourleMinSkinIndex, getDambourleUnlockedSkinTier } from "@/lib/dambourle/skill-levels";
import { IconLock } from "@/components/icons";

export function DambourleSeriesGrid({ ownedCounts }: { ownedCounts: ReadonlyMap<string, number> }) {
  return (
    <ul className="grid grid-cols-3 gap-2.5">
      <li>
        <DambourleSeriesCard name="初期のダンボール" image={DEFAULT_BOX_IMAGE} alt={DEFAULT_BOX_ALT} unlocked sublabel="効果なし" skillText={null} />
      </li>
      {DAMBOURLE_PRIZES.map((prize) => {
        const count = ownedCounts.get(prize.id) ?? 0;
        const unlocked = count > 0;
        const level = unlocked ? getDambourleLevel(prize.rarity, count) : 0;
        const minSkinIndex = getDambourleMinSkinIndex(prize.id);
        const skinIndex = unlocked ? getDambourleUnlockedSkinTier(prize.id, level) : minSkinIndex;
        return (
          <li key={prize.id}>
            <DambourleSeriesCard
              name={prize.name}
              image={getDambourleBoxImage(prize.id, skinIndex)}
              alt={prize.name}
              unlocked={unlocked}
              sublabel={unlocked ? `${prize.rarity} / Lv${level}` : prize.rarity}
              skillText={unlocked ? `${DAMBOURLE_EFFECT_NAMES[prize.effectKey]} ${getDambourleEffectValueText(prize, level)}` : null}
            />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * フレンドの図鑑用。相手の所持状況(friendCounts)に加え、閲覧者自身の所持(viewerOwned)も見て、
 * 「相手は持っているが自分は未所持」のアイテムはItemCard/ItemGridと同じ規約で
 * シークレット表示（名前・効果は????、出た回数だけ見せる）にする。
 */
export function FriendDambourleGrid({
  friendCounts,
  viewerOwned,
}: {
  friendCounts: ReadonlyMap<string, number>;
  viewerOwned: ReadonlySet<string>;
}) {
  return (
    <ul className="grid grid-cols-3 gap-2.5">
      {DAMBOURLE_PRIZES.map((prize) => {
        const count = friendCounts.get(prize.id) ?? 0;
        const friendOwned = count > 0;
        const revealed = friendOwned && viewerOwned.has(prize.id);
        const level = revealed ? getDambourleLevel(prize.rarity, count) : 0;
        const minSkinIndex = getDambourleMinSkinIndex(prize.id);
        const skinIndex = revealed ? getDambourleUnlockedSkinTier(prize.id, level) : minSkinIndex;
        return (
          <li key={prize.id}>
            <DambourleSeriesCard
              name={prize.name}
              image={getDambourleBoxImage(prize.id, skinIndex)}
              alt={prize.name}
              unlocked={revealed}
              sublabel={revealed ? `${prize.rarity} / Lv${level}` : prize.rarity}
              skillText={revealed ? `${DAMBOURLE_EFFECT_NAMES[prize.effectKey]} ${getDambourleEffectValueText(prize, level)}` : null}
              hiddenCount={!revealed && friendOwned ? count : null}
            />
          </li>
        );
      })}
    </ul>
  );
}

function DambourleSeriesCard({
  name,
  image,
  alt,
  unlocked,
  sublabel,
  skillText,
  hiddenCount = null,
}: {
  name: string;
  image: string;
  alt: string;
  unlocked: boolean;
  sublabel: string;
  skillText: string | null;
  hiddenCount?: number | null;
}) {
  return (
    <div
      className={`rough-card overflow-hidden p-2 text-left ${unlocked ? "" : "border-ink-faint/30"}`}
      aria-label={unlocked ? name : "未所持"}
    >
      <span className={`relative block aspect-square overflow-hidden rounded-xl ${unlocked ? "bg-paper-deep" : "bg-stone-200"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={alt}
          draggable={false}
          onContextMenu={!unlocked ? (event) => event.preventDefault() : undefined}
          style={!unlocked ? { WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" } : undefined}
          className={`h-full w-full object-contain p-2 ${unlocked ? "" : "[filter:brightness(0)] opacity-100"}`}
        />
        {!unlocked ? (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-b from-transparent via-paper/10 to-ink/15">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-white shadow-sm">
              <IconLock size={14} />
            </span>
          </span>
        ) : null}
      </span>

      <p className={`mt-1.5 truncate text-[11px] font-bold ${unlocked ? "text-ink" : "text-ink-faint"}`}>{unlocked ? name : "？？？"}</p>
      <p className="mt-0.5 truncate text-[9px] text-ink-faint">
        {unlocked ? sublabel : hiddenCount != null ? "自分は未所持" : "ガチャで手に入れると解放"}
      </p>
      {hiddenCount != null ? (
        <p className="mt-0.5 truncate text-[9px] font-semibold tabular-nums text-ink-faint">出た回数 {hiddenCount}回</p>
      ) : null}
      {skillText ? <p className="mt-0.5 truncate text-[8px] font-bold text-leaf-deep">{skillText}</p> : null}
    </div>
  );
}
