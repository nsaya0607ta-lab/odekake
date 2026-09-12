import Link from "next/link";
import { FrenchieCatchGame } from "@/components/frenchie-catch-game";
import { IconChevronRight, IconNotebook } from "@/components/icons";
import { ItemCatchLiveRefresh } from "@/components/item-catch-live-refresh";
import { ItemCatchRanking } from "@/components/item-catch-ranking";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { COLLECTION_ITEMS, hasMinigameSkillLevel } from "@/lib/collection/items";
import { DEFAULT_BOX_ALT, DEFAULT_BOX_IMAGE, getDambourleBoxImage } from "@/lib/dambourle/box-image";
import { getDambourlePrize, type DambourleEffectKey } from "@/lib/dambourle/prizes";
import { getDambourleLevel, getDambourleMinSkinIndex, getDambourleUnlockedSkinTier } from "@/lib/dambourle/skill-levels";
import { getOwnedItemCounts } from "@/lib/data/collection";
import { getEquippedDambourle, getOwnedDambourleCounts } from "@/lib/data/dambourle";
import { getSkillLevel, MAX_SKILL_LEVEL } from "@/lib/gacha/skill-levels";
import { isManagementTestAccount, MANAGEMENT_TEST_ACCOUNT_ITEM_CATCH_IDS } from "@/lib/management-test-account";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "アイテムキャッチ | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function ItemCatchPage() {
  const { supabase, user } = await requireUser();
  const [ownedItemCounts, ownedDambourleCounts, equippedDambourle, profile] = await Promise.all([
    getOwnedItemCounts(supabase, user.id),
    getOwnedDambourleCounts(supabase, user.id),
    getEquippedDambourle(supabase, user.id),
    // 検証用アカウント判定は、更新後にJWTへ反映されるまでタイムラグが起こりうる
    // user.displayName（JWTのuser_metadata由来）ではなく、常に最新のprofilesを直接見る
    supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
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

  // 検証用の管理アカウントだけ、出現アイテムを直近追加した10種に絞る（ユーザー指定。
  // 実際の所持数に関わらず全種Lv.MAXで出現させ、新アイテムをすぐ試せるようにする）
  const catchItems = isManagementTestAccount(profile.data?.display_name)
    ? MANAGEMENT_TEST_ACCOUNT_ITEM_CATCH_IDS.flatMap((id) => {
        const item = COLLECTION_ITEMS.find((entry) => entry.id === id);
        if (!item || !item.image || !hasMinigameSkillLevel(item)) return [];
        return [{ id: item.id, name: item.name, image: item.image, rarity: item.rarity, level: MAX_SKILL_LEVEL }];
      })
    : COLLECTION_ITEMS.flatMap((item) => {
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
    <>
      <ItemCatchLiveRefresh />
      <div className="item-catch-lockable">
        <TopHeader
          backHref="/games"
          title="アイテムキャッチ"
          subtitle="50秒でどこまでキャッチできる？"
        />
      </div>

      <PageBody className="!space-y-3 !py-3">
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
          className="item-catch-lockable rough-card flex items-center gap-3 p-4 active:scale-[0.99]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-leaf-soft text-leaf-deep">
            <IconNotebook size={21} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">ルールとスキルを見る</span>
            <span className="mt-0.5 block text-[11px] text-ink-soft">得点のしくみと、持っているスキルの効果</span>
          </span>
          <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
        </Link>

        <div className="item-catch-lockable">
          <ItemCatchRanking />
        </div>
      </PageBody>
    </>
  );
}
