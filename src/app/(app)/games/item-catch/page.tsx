import Link from "next/link";
import Image from "next/image";
import { FrenchieCatchGame } from "@/components/frenchie-catch-game";
import { IconChevronLeft, IconChevronRight, IconNotebook } from "@/components/icons";
import { ItemCatchLiveRefresh } from "@/components/item-catch-live-refresh";
import { ItemCatchRanking } from "@/components/item-catch-ranking";
import styles from "@/components/item-catch-visual.module.css";
import { PageBody } from "@/components/page-body";
import { COLLECTION_ITEMS, hasMinigameSkillLevel } from "@/lib/collection/items";
import { DEFAULT_BOX_ALT, DEFAULT_BOX_IMAGE, getDambourleBoxImage } from "@/lib/dambourle/box-image";
import { getDambourlePrize, type DambourleEffectKey } from "@/lib/dambourle/prizes";
import { getDambourleLevel, getDambourleMinSkinIndex, getDambourleUnlockedSkinTier } from "@/lib/dambourle/skill-levels";
import { getOwnedItemCounts } from "@/lib/data/collection";
import { getEquippedDambourle, getOwnedDambourleCounts } from "@/lib/data/dambourle";
import { getSkillLevel } from "@/lib/gacha/skill-levels";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "アイテムキャッチ | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function ItemCatchPage() {
  const { supabase, user } = await requireUser();
  const [ownedItemCounts, ownedDambourleCounts, equippedDambourle] = await Promise.all([
    getOwnedItemCounts(supabase, user.id),
    getOwnedDambourleCounts(supabase, user.id),
    getEquippedDambourle(supabase, user.id),
  ]);

  let equippedBoxImage = DEFAULT_BOX_IMAGE;
  let equippedBoxAlt = DEFAULT_BOX_ALT;
  let dambourleSkillBoost = 0;
  let dambourleEffect: { key: DambourleEffectKey; level: number } | null = null;
  if (equippedDambourle) {
    const prize = getDambourlePrize(equippedDambourle.itemId);
    const count = ownedDambourleCounts.get(equippedDambourle.itemId) ?? 0;
    if (prize && count > 0) {
      const level = getDambourleLevel(prize.rarity, count);
      const maxTier = getDambourleUnlockedSkinTier(equippedDambourle.itemId, level);
      const minSkinIndex = getDambourleMinSkinIndex(equippedDambourle.itemId);
      const skinIndex = Math.max(minSkinIndex, Math.min(equippedDambourle.skinIndex, maxTier));
      equippedBoxImage = getDambourleBoxImage(equippedDambourle.itemId, skinIndex);
      equippedBoxAlt = `装備中のダンボール（${prize.name}）`;
      // No.11「全アイテムのスキルLv上昇」装備時は、そのダンボール自身のLv(1〜5)ぶん底上げする
      if (equippedDambourle.itemId === "dambourle_no11") dambourleSkillBoost = level;
      // それ以外の効果はミニゲーム側でまとめて解決する（effectKey + そのダンボール自身のLv）
      else dambourleEffect = { key: prize.effectKey, level };
    }
  }

  const catchItems = COLLECTION_ITEMS.flatMap((item) => {
    const count = ownedItemCounts.get(item.id) ?? 0;
    if (count <= 0 || !item.image) return [];
    if (!hasMinigameSkillLevel(item)) return [];
    return [{
      id: item.id,
      name: item.name,
      image: item.image,
      rarity: item.rarity,
      level: getSkillLevel(item.rarity, count),
    }];
  });

  return (
    <div className={styles.pageShell}>
      <ItemCatchLiveRefresh />

      <header className={styles.pageHeader}>
        <div className={styles.headerInner}>
          <Link href="/games" aria-label="ゲーム一覧へ戻る" className={styles.headerBack}>
            <IconChevronLeft size={22} />
          </Link>
          <div className={styles.headerCopy}>
            <p className={styles.eyebrow}>ODEKAKE MINI GAME 01</p>
            <h1 className={styles.headerTitle}>アイテムキャッチ</h1>
            <p className={styles.headerSubtitle}>お気に入りの箱で、空からのごほうびをキャッチ！</p>
          </div>
          <span className={styles.headerBadge}>
            <Image src="/games/item-catch/menu-icon-v2.webp" alt="" width={24} height={24} />
            50秒
          </span>
        </div>
      </header>

      <PageBody className={`!space-y-3 !py-3 ${styles.pageBody}`}>
        <FrenchieCatchGame
          ownedItems={catchItems}
          equippedBoxImage={equippedBoxImage}
          equippedBoxAlt={equippedBoxAlt}
          dambourleSkillBoost={dambourleSkillBoost}
          dambourleEffect={dambourleEffect}
          showDambourlePicker
        />

        <Link
          href="/games/item-catch/guide"
          className={`${styles.guideCard} flex items-center gap-3 p-4 active:scale-[0.99]`}
        >
          <span className={`${styles.guideIcon} flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl`}>
            <IconNotebook size={21} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">ルールとスキルを見る</span>
            <span className="mt-0.5 block text-[11px] text-ink-soft">得点のしくみと、持っているスキルの効果</span>
          </span>
          <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
        </Link>

        <div className={styles.rankingShell}>
          <ItemCatchRanking />
        </div>
      </PageBody>
    </div>
  );
}
