import Link from "next/link";
import { IconChevronRight, IconUser } from "@/components/icons";
import { TopHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { CoinBadge } from "@/components/coin-badge";
import { SharedTripBadge } from "@/components/shared-trip-badge";
import { HomeScene } from "@/components/home-scene";
import { HomeCollectionCard } from "@/components/home-collection-card";
import { HomeStatsCard } from "@/components/home-stats-card";
import { LevelTag } from "@/components/level-tag";
import { StepsTag } from "@/components/steps-tag";
import { WanderingFrenchie } from "@/components/wandering-frenchie";
import { COLLECTION_ITEMS, countOwned } from "@/lib/collection/items";
import { loadAreaIndex } from "@/lib/data/areas";
import { getCoinSummary } from "@/lib/data/coins";
import { getOwnedItemIds } from "@/lib/data/collection";
import { getCurrentDogSkin } from "@/lib/data/dog-skin";
import { getExpDashboard } from "@/lib/data/exp";
import { signPhotoPath } from "@/lib/data/photos";
import { getRecordSpace } from "@/lib/data/space";
import { getExpProgress } from "@/lib/exp";
import { MUNICIPALITIES, PREFECTURES } from "@/lib/geo";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "あなたの旅 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const [{ supabase, user }, { notice }] = await Promise.all([requireUser(), searchParams]);
  const space = await getRecordSpace(supabase, user.id);

  const [areas, expDashboard, coins, ownedItemIds, dogSkin, profileResult] = await Promise.all([
    loadAreaIndex(supabase, space.tripIds),
    getExpDashboard(supabase, user.id),
    getCoinSummary(supabase, user.id),
    getOwnedItemIds(supabase, user.id),
    getCurrentDogSkin(supabase, user.id),
    supabase.from("profiles").select("profile_image_url, introduction").eq("user_id", user.id).maybeSingle(),
  ]);
  const avatarUrl = await signPhotoPath(supabase, profileResult.data?.profile_image_url);

  const expProgress = getExpProgress(expDashboard.totalExp);
  const collectedItems = countOwned(COLLECTION_ITEMS, ownedItemIds);

  return (
    <>
      <TopHeader
        title={space.name}
        action={
          <div className="flex items-center gap-2">
            <CoinBadge balance={coins.balance} />
            <SharedTripBadge />
          </div>
        }
      />

      <PageBody>
        {notice === "password-updated" ? (
          <p className="rounded-2xl border border-leaf bg-leaf-soft px-4 py-3 text-sm text-leaf-deep">
            パスワードを変更しました。
          </p>
        ) : null}

        <Link
          href="/mypage/profile"
          className="rough-card pressable flex items-center gap-3 px-4 py-3 active:border-line-strong active:bg-paper-deep"
        >
          <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-paper-deep">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-ink-faint">
                <IconUser size={22} />
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold">{user.displayName}</span>
            <span className="mt-0.5 block truncate text-xs text-ink-faint">{user.email}</span>
            {profileResult.data?.introduction ? (
              <span className="mt-1 block line-clamp-1 text-xs text-ink-soft">{profileResult.data.introduction}</span>
            ) : null}
          </span>
          <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
        </Link>

        <div className="space-y-3">
          <section className="rough-card overflow-visible">
            {/* 絵を切らずに全部出すので、カードの縦横比は絵と同じにする（SCENE_RATIO）。
                ここを変えると板と文字がずれる */}
            <div className="relative aspect-[1440/768] overflow-visible bg-transparent">
              {/* 看板の文字は絵の中の板に乗せるので、必ず HomeScene の中に入れる */}
              <HomeScene>
                <LevelTag progress={expProgress} />
                <StepsTag
                  initialSteps={expDashboard.todaySteps}
                  initialStepExp={expDashboard.todayStepExp}
                  initialCoinBalance={coins.balance}
                />
              </HomeScene>
              {/* 犬はカード全体を基準に歩くので、絵の箱の外に置く */}
              <WanderingFrenchie level={expProgress.level} skin={dogSkin} />
            </div>
          </section>

          <HomeStatsCard
            prefectures={areas.totals.visitedPrefectures}
            prefectureTotal={PREFECTURES.length}
            municipalities={areas.totals.visitedMunicipalities}
            municipalityTotal={MUNICIPALITIES.length}
            visits={areas.totals.visits}
          />

          <HomeCollectionCard collected={collectedItems} total={COLLECTION_ITEMS.length} />
        </div>
      </PageBody>
    </>
  );
}
