import Link from "next/link";
import { IconUser } from "@/components/icons";
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

const PROFILE_TICKET_SRC = "/B42684BD-FCE9-4F37-A698-4EEE3884ECA8.png";
const MINI_GAME_BUTTON_SRC = "/4738ADDA-10DB-4664-B078-FE6262248CFB.png";
const GACHA_BUTTON_SRC = "/3215A80A-2B64-45E2-8AA5-B7CAF2E0251D.png";

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

      <PageBody className="!space-y-3 !py-2">
        {notice === "password-updated" ? (
          <p className="rounded-2xl border border-leaf bg-leaf-soft px-4 py-3 text-sm text-leaf-deep">
            パスワードを変更しました。
          </p>
        ) : null}

        <Link
          href="/mypage/profile"
          className="pressable relative block w-full overflow-hidden active:scale-[0.99]"
          style={{ aspectRatio: "1536 / 420" }}
          aria-label={`${user.displayName}のプロフィールを見る`}
        >
          {/* 元画像は上下に余白があるため、チケット部分だけがカード内に見える位置へ戻す。 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={PROFILE_TICKET_SRC}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none absolute left-0 top-[-70%] w-full max-w-none select-none"
          />

          {/* 元画像の丸窓の内側の線に、プロフィール画像の円周が沿うサイズ・位置に合わせる。 */}
          <span className="absolute left-[15.31%] top-[14.02%] aspect-square w-[18.2%] overflow-hidden rounded-full bg-paper-deep">
            {avatarUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              </>
            ) : (
              <span className="flex h-full w-full items-center justify-center text-ink-faint">
                <IconUser size={24} />
              </span>
            )}
          </span>

          <span className="absolute left-[36%] top-1/2 w-[30%] -translate-y-1/2 min-w-0">
            <span className="block truncate text-sm font-bold text-[#3f2d17]">{user.displayName}</span>
            <span className="mt-0.5 block truncate text-[11px] text-[#7b684d]">{user.email}</span>
          </span>
        </Link>

        <div className="space-y-2">
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
                  className="block aspect-[3/1] w-full overflow-hidden rounded-full !border-0 !bg-transparent !p-0 !shadow-none active:scale-[0.97]"
                  style={{ background: "transparent", boxShadow: "none" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={MINI_GAME_BUTTON_SRC}
                    alt="ミニゲーム"
                    className="block h-full w-full !bg-transparent object-contain"
                    style={{ background: "transparent" }}
                  />
                </Link>

                <Link
                  href="/mypage/coins"
                  aria-label="ガチャを引く"
                  className="block aspect-[3/1] w-full overflow-hidden rounded-full !border-0 !bg-transparent !p-0 !shadow-none active:scale-[0.97]"
                  style={{ background: "transparent", boxShadow: "none", marginTop: 0 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={GACHA_BUTTON_SRC}
                    alt="ガチャを引く"
                    className="block h-full w-full !bg-transparent object-contain"
                    style={{ background: "transparent" }}
                  />
                </Link>
              </div>
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
