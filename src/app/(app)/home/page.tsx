import Link from "next/link";
import { BackgroundCookieSync } from "@/components/background-cookie-sync";
import { BackgroundGazeButton } from "@/components/background-gaze-button";
import { IconUser } from "@/components/icons";
import { TopHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { CoinBadge } from "@/components/coin-badge";
import { GuideBadge } from "@/components/guide-badge";
import { SharedTripBadge } from "@/components/shared-trip-badge";
import { HomeScene } from "@/components/home-scene";
import { HomeWeatherChip, HomeWeatherProvider, HomeWeatherSky } from "@/components/home-weather";
import { homeCardMarginTop } from "@/lib/home-card-layout";
import { HomeCollectionCard, type HomeCollectionRecentItem } from "@/components/home-collection-card";
import { HomeHighlightsCarousel } from "@/components/home-highlights-carousel";
import { HomeNoticeCard } from "@/components/home-notice-card";
import { LevelTag } from "@/components/level-tag";
import { StepsTag } from "@/components/steps-tag";
import { WanderingFrenchie } from "@/components/wandering-frenchie";
import { COLLECTION_ITEMS, countOwned } from "@/lib/collection/items";
import { getCurrentAppBackground, getHomeAppearance } from "@/lib/data/app-backgrounds";
import { loadAreaIndex } from "@/lib/data/areas";
import { getBlueCoinBalance } from "@/lib/data/blue-coins";
import { getCoinSummary } from "@/lib/data/coins";
import { getOwnedItemsForHome } from "@/lib/data/collection";
import { getOwnedDambourleCounts } from "@/lib/data/dambourle";
import { DAMBOURLE_PRIZES } from "@/lib/dambourle/prizes";
import { getCurrentDogSkin } from "@/lib/data/dog-skin";
import { getExpDashboard } from "@/lib/data/exp";
import { getFriendList, getFriendsActivityFeed, getFriendsStepsRanking } from "@/lib/data/friends";
import { getNoticesFeed, getUnreadNoticeCount } from "@/lib/data/notices";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import { getRecordSpace } from "@/lib/data/space";
import { getExpProgress } from "@/lib/exp";
import { MUNICIPALITIES, PREFECTURES } from "@/lib/geo";
import { PREFECTURE_NAMES } from "@/lib/geo/prefecture-names";
import { DEFAULT_HOME_LOOK, type HomeCardId } from "@/lib/home-look";
import { canAccessShop } from "@/lib/shop-access";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "あなたの旅 | おでかけ記録" };
export const dynamic = "force-dynamic";

const MINI_GAME_BUTTON_SRC = "/3215A80A-2B64-45E2-8AA5-B7CAF2E0251D.webp";
const GACHA_BUTTON_SRC = "/4738ADDA-10DB-4664-B078-FE6262248CFB.webp";
const ROOM_BUTTON_SRC = "/room-button.webp";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const [{ supabase, user }, { notice }] = await Promise.all([requireUser(), searchParams]);

  // 旅行IDの取得と、それを必要としないホーム情報の取得を同時に始める。
  // 表示内容は変えず、旅行IDを待ってから全通信を開始していた直列待ちだけをなくす。
  const spacePromise = getRecordSpace(supabase, user.id);
  const [
    areas,
    expDashboard,
    coins,
    ownedItems,
    dogSkin,
    dambourleCounts,
    profileResult,
    friendActivity,
    friendSteps,
    noticesFeed,
    unreadNoticeCount,
    blueCoins,
    friendList,
  ] = await Promise.all([
    spacePromise.then((space) => loadAreaIndex(supabase, space.tripIds)),
    getExpDashboard(supabase, user.id),
    getCoinSummary(supabase, user.id),
    getOwnedItemsForHome(supabase, user.id),
    getCurrentDogSkin(supabase, user.id),
    getOwnedDambourleCounts(supabase, user.id).catch(() => new Map<string, number>()),
    supabase.from("profiles").select("profile_image_url").eq("user_id", user.id).maybeSingle(),
    getFriendsActivityFeed(supabase, 30),
    getFriendsStepsRanking(supabase, 20),
    getNoticesFeed(supabase, 3),
    getUnreadNoticeCount(supabase),
    getBlueCoinBalance(supabase, user.id).catch(() => null),
    // みんなのおでかけの行から、フレンドのページへ行けるようにするため（取れなくてもホームは出す）
    getFriendList(supabase).catch(() => []),
  ]);
  const friendIds = new Set(friendList.map((f) => f.friend_user_id));

  const friendAvatarPaths = [
    ...friendActivity.flatMap((row) => (row.profile_image_url ? [row.profile_image_url] : [])),
    ...friendSteps.flatMap((row) => (row.profile_image_url ? [row.profile_image_url] : [])),
  ];
  const ownAvatarPath = profileResult.data?.profile_image_url ?? null;
  const [ownAvatarUrls, friendAvatarUrls] = await Promise.all([
    signThumbOrOriginalPaths(supabase, ownAvatarPath ? [ownAvatarPath] : []),
    signThumbOrOriginalPaths(supabase, friendAvatarPaths),
  ]);
  const avatarUrl = ownAvatarPath ? (ownAvatarUrls.get(ownAvatarPath) ?? null) : null;

  // ホームの着せかえ（ショップで設定。いまは準備中で、使える人だけ）
  const shopAccess = canAccessShop(user.displayName);
  const [appearance, background] = shopAccess
    ? await Promise.all([getHomeAppearance(supabase, user.id), getCurrentAppBackground()])
    : [{ homeLook: DEFAULT_HOME_LOOK, savedBackground: null }, "default" as const];
  const look = appearance.homeLook;
  // 別の端末で背景を変えていたら、この端末の背景もそろえる
  const backgroundOutdated = appearance.savedBackground !== null && appearance.savedBackground !== background;

  const expProgress = getExpProgress(expDashboard.totalExp);
  const collectedItems = countOwned(COLLECTION_ITEMS, ownedItems.ids);
  // 図鑑カードに出す「最近手に入れたもの」（24時間以内は NEW）
  const collectionItemById = new Map(COLLECTION_ITEMS.map((item) => [item.id, item]));
  const newSince = Date.now() - 24 * 60 * 60 * 1000;
  const recentCollection: HomeCollectionRecentItem[] = ownedItems.recent
    .flatMap(({ id, obtainedAt }) => {
      const item = collectionItemById.get(id);
      return item ? [{ id: item.id, name: item.name, image: item.image, art: item.art, rarity: item.rarity, isNew: Date.parse(obtainedAt) > newSince }] : [];
    })
    .slice(0, 4);
  // 図鑑の母数・所持数に、通常図鑑とは別モデルのダンボールぶんも合算する
  const collectedDambourle = DAMBOURLE_PRIZES.filter((prize) => (dambourleCounts.get(prize.id) ?? 0) > 0).length;
  const totalCollectionCount = COLLECTION_ITEMS.length + DAMBOURLE_PRIZES.length;
  const totalCollectedCount = collectedItems + collectedDambourle;

  // 登録者（自分・フレンド・共有旅の参加者）ごとに最新1件だけ残し、
  // 24時間より前の登録は「みんなのおでかけ」に出さない。
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const activityCutoff = Date.now() - ONE_DAY_MS;
  const seenRegistrantIds = new Set<string>();
  const latestFriendActivity = friendActivity
    .filter((row) => new Date(row.registered_at).getTime() >= activityCutoff)
    .filter((row) => {
      if (seenRegistrantIds.has(row.friend_user_id)) return false;
      seenRegistrantIds.add(row.friend_user_id);
      return true;
    })
    .map((row) => ({
      key: row.friend_user_id,
      displayName: row.display_name,
      avatarUrl: row.profile_image_url ? (friendAvatarUrls.get(row.profile_image_url) ?? null) : null,
      spotName: row.spot_name,
      prefName: PREFECTURE_NAMES.find((p) => p.code === row.prefecture_code)?.name ?? null,
      registeredAt: row.registered_at,
      // 自分 → 記録、フレンド → そのフレンドのページ（共有旅だけの人はリンクなし）
      href: row.friend_user_id === user.id ? "/records" : friendIds.has(row.friend_user_id) ? `/mypage/friends/${row.friend_user_id}` : null,
      isSelf: row.friend_user_id === user.id,
    }));

  // フレンドの歩数ランキングに自分も加えて、自分の順位も分かるようにする。
  const stepsRankingEntries = [
    ...friendSteps.map((row) => ({
      id: row.friend_user_id,
      displayName: row.display_name,
      avatarUrl: row.profile_image_url ? (friendAvatarUrls.get(row.profile_image_url) ?? null) : null,
      steps: row.steps,
      isSelf: false,
    })),
    {
      id: user.id,
      displayName: user.displayName,
      avatarUrl,
      steps: expDashboard.todaySteps ?? 0,
      isSelf: true,
    },
  ].sort((a, b) => b.steps - a.steps);

  const friendStepsRanking = stepsRankingEntries.map((entry, entryIndex) => ({
    ...entry,
    rank: entryIndex + 1,
  }));

  const cards: Record<HomeCardId, React.ReactNode> = {
    notice: <HomeNoticeCard unreadCount={unreadNoticeCount} notices={noticesFeed} />,
    highlights: (
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
    ),
    collection: <HomeCollectionCard collected={totalCollectedCount} total={totalCollectionCount} recent={recentCollection} />,
  };

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
            <CoinBadge balance={coins.balance} blueBalance={blueCoins} />
            <GuideBadge />
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

        <div className={`mt-[10px] home-cards-${look.cards}`}>
          <section className="rough-card overflow-visible">
            <div className="relative aspect-[1440/768] overflow-visible bg-transparent">
              <HomeWeatherProvider>
                <HomeScene>
                  <HomeWeatherSky />
                  <LevelTag progress={expProgress} />
                  <StepsTag
                    initialSteps={expDashboard.todaySteps}
                    initialStepExp={expDashboard.todayStepExp}
                    initialCoinBalance={coins.balance}
                  />
                </HomeScene>
                <WanderingFrenchie level={expProgress.level} skin={dogSkin} />
                <HomeWeatherChip />

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

                  <Link
                    href="/room"
                    aria-label="マイルームを開く"
                    className="block aspect-[3/1] w-full overflow-visible rounded-full !border-0 !bg-transparent !p-0 !shadow-none active:scale-[0.97]"
                    style={{ background: "transparent", boxShadow: "none", marginTop: -6 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ROOM_BUTTON_SRC}
                      alt="マイルーム"
                      className="block h-full w-full -translate-y-[15px] !bg-transparent object-contain"
                      style={{ background: "transparent" }}
                    />
                  </Link>
                </div>
              </HomeWeatherProvider>
            </div>
          </section>

          {look.order
            .filter((id) => !look.hidden.includes(id))
            .map((id, index, shown) => (
              // どの順番でも、1つ上のカードの紙とのあいだが同じになるよう、絵の透明なふちの分を計算してずらす
              <div key={id} className="home-rise" style={{ animationDelay: `${80 * (index + 1)}ms`, marginTop: homeCardMarginTop(index === 0 ? "scene" : shown[index - 1]!, id) }}>
                {cards[id]}
              </div>
            ))}
        </div>
      </PageBody>
      {shopAccess && background !== "default" ? <BackgroundGazeButton /> : null}
      {backgroundOutdated ? <BackgroundCookieSync /> : null}
    </>
  );
}
