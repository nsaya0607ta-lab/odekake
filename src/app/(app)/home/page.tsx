import Link from "next/link";
import { IconUser } from "@/components/icons";
import { TopHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { CoinBadge } from "@/components/coin-badge";
import { SoundSettingsButton } from "@/components/sound-settings-button";
import { SharedTripBadge } from "@/components/shared-trip-badge";
import { HomeScene } from "@/components/home-scene";
import { HomeCollectionCard } from "@/components/home-collection-card";
import { HomeHighlightsCarousel } from "@/components/home-highlights-carousel";
import { LevelTag } from "@/components/level-tag";
import { StepsTag } from "@/components/steps-tag";
import { WanderingFrenchie } from "@/components/wandering-frenchie";
import { COLLECTION_ITEMS, countOwned } from "@/lib/collection/items";
import { loadAreaIndex } from "@/lib/data/areas";
import { getCoinSummary } from "@/lib/data/coins";
import { getOwnedItemIds } from "@/lib/data/collection";
import { getCurrentDogSkin } from "@/lib/data/dog-skin";
import { getExpDashboard } from "@/lib/data/exp";
import { getFriendsActivityFeed, getFriendsStepsRanking } from "@/lib/data/friends";
import { signPhotoPath, signPhotoPaths } from "@/lib/data/photos";
import { getRecordSpace } from "@/lib/data/space";
import { getExpProgress } from "@/lib/exp";
import { MUNICIPALITIES, PREFECTURES } from "@/lib/geo";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "あなたの旅 | おでかけ記録" };
export const dynamic = "force-dynamic";

const MINI_GAME_BUTTON_SRC = "/3215A80A-2B64-45E2-8AA5-B7CAF2E0251D.webp";
const GACHA_BUTTON_SRC = "/4738ADDA-10DB-4664-B078-FE6262248CFB.webp";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const [{ supabase, user }, { notice }] = await Promise.all([requireUser(), searchParams]);
  const space = await getRecordSpace(supabase, user.id);

  const [areas, expDashboard, coins, ownedItemIds, dogSkin, profileResult, friendActivity, friendSteps] =
    await Promise.all([
      loadAreaIndex(supabase, space.tripIds),
      getExpDashboard(supabase, user.id),
      getCoinSummary(supabase, user.id),
      getOwnedItemIds(supabase, user.id),
      getCurrentDogSkin(supabase, user.id),
      supabase.from("profiles").select("profile_image_url, introduction").eq("user_id", user.id).maybeSingle(),
      getFriendsActivityFeed(supabase, 10),
      getFriendsStepsRanking(supabase, 3),
    ]);

  const friendAvatarPaths = [
    ...friendActivity.flatMap((row) => (row.profile_image_url ? [row.profile_image_url] : [])),
    ...friendSteps.flatMap((row) => (row.profile_image_url ? [row.profile_image_url] : [])),
  ];
  const [avatarUrl, friendAvatarUrls] = await Promise.all([
    signPhotoPath(supabase, profileResult.data?.profile_image_url),
    signPhotoPaths(supabase, friendAvatarPaths),
  ]);

  const expProgress = getExpProgress(expDashboard.totalExp);
  const collectedItems = countOwned(COLLECTION_ITEMS, ownedItemIds);

  // フレンドごとに最新1件だけ残して、「みんなのおでかけ」に同じ人が並ばないようにする。
  const seenFriendIds = new Set<string>();
  const latestFriendActivity = friendActivity
    .filter((row) => {
      if (seenFriendIds.has(row.friend_user_id)) return false;
      seenFriendIds.add(row.friend_user_id);
      return true;
    })
    .slice(0, 3)
    .map((row) => ({
      key: row.friend_user_id,
      displayName: row.display_name,
      avatarUrl: row.profile_image_url ? (friendAvatarUrls.get(row.profile_image_url) ?? null) : null,
      spotName: row.spot_name,
      registeredAt: row.registered_at,
    }));

  const friendStepsRanking = friendSteps.map((row) => ({
    friendUserId: row.friend_user_id,
    displayName: row.display_name,
    avatarUrl: row.profile_image_url ? (friendAvatarUrls.get(row.profile_image_url) ?? null) : null,
    steps: row.steps,
  }));

  return (
    <>
      <TopHeader
        title={
          <Link href="/mypage/profile" className="flex min-w-0 items-center gap-2" aria-label="マイページを見る">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper-deep">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <IconUser size={22} className="text-ink-faint" />
              )}
            </span>
            <span className="truncate text-[17px] font-bold">{user.displayName}</span>
          </Link>
        }
        action={
          <div className="flex items-center gap-2">
            <SoundSettingsButton />
            <CoinBadge balance={coins.balance} />
            <SharedTripBadge />
          </div>
        }
      />

      <PageBody className="!space-y-3 !py-2">
        {notice === "password-updated" ? (
          <p className="rounded-2xl border border-leaf bg-leaf-soft px-4 py-3 text-sm text-leaf-deep">
            パスワードを変更しました。
          </p>
        ) : null}

        <div className="mt-[10px] space-y-2">
          <section className="rough-card overflow-visible">
            <div className="relative aspect-[1440/768] overflow-visible bg-transparent">
              <HomeScene>
                <LevelTag progress={expProgress} />
                <StepsTag
                  initialSteps={expDashboard.todaySteps}
                  initialStepExp={expDashboard.todayStepExp}
                  initialCoinBalance={coins.balance}
                />
              </HomeScene>
              <WanderingFrenchie level={expProgress.level} skin={dogSkin} />

              <div className="absolute right-2 top-2 z-40 flex w-[132px] flex-col" style={{ gap: 0 }}>
                <Link
                  href="/games"
                  aria-label="ミニゲーム一覧を開く"
                  className="block aspect-[3/1] w-full overflow-visible rounded-full !border-0 !bg-transparent !p-0 !shadow-none active:scale-[0.97]"
                  style={{ background: "transparent", boxShadow: "none" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={MINI_GAME_BUTTON_SRC}
                    alt="ミニゲーム"
                    className="block h-full w-full -translate-y-[6px] !bg-transparent object-contain"
                    style={{ background: "transparent" }}
                  />
                </Link>

                <Link
                  href="/mypage/coins"
                  aria-label="ガチャを引く"
                  className="block aspect-[3/1] w-full overflow-visible rounded-full !border-0 !bg-transparent !p-0 !shadow-none active:scale-[0.97]"
                  style={{ background: "transparent", boxShadow: "none", marginTop: -6 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={GACHA_BUTTON_SRC}
                    alt="ガチャを引く"
                    className="block h-full w-full -translate-y-[9px] !bg-transparent object-contain"
                    style={{ background: "transparent" }}
                  />
                </Link>
              </div>
            </div>
          </section>

          <HomeHighlightsCarousel
            stats={{
              prefectures: areas.totals.visitedPrefectures,
              prefectureTotal: PREFECTURES.length,
              municipalities: areas.totals.visitedMunicipalities,
              municipalityTotal: MUNICIPALITIES.length,
              visits: areas.totals.visits,
            }}
            activity={latestFriendActivity}
            stepsRanking={friendStepsRanking}
          />

          <HomeCollectionCard collected={collectedItems} total={COLLECTION_ITEMS.length} />
        </div>
      </PageBody>
    </>
  );
}
