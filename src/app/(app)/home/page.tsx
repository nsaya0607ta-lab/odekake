import Link from "next/link";
import { IconCalendar, IconChevronRight, IconMapPin, IconPlus, IconUser } from "@/components/icons";
import { JourneyScopeSwitcher, type JourneyScopeOption } from "@/components/journey-scope-switcher";
import { TopHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { CoinBadge } from "@/components/coin-badge";
import { SharedTripBadge } from "@/components/shared-trip-badge";
import { HomeScene } from "@/components/home-scene";
import { HomeCollectionCard } from "@/components/home-collection-card";
import { HomeStatsCard } from "@/components/home-stats-card";
import { LevelTag } from "@/components/level-tag";
import { StepsTag } from "@/components/steps-tag";
import { TodayStepsCard } from "@/components/today-steps-card";
import { EmptyState, LinkRow, formatDate } from "@/components/ui";
import { WanderingFrenchie } from "@/components/wandering-frenchie";
import { COLLECTION_ITEMS, countOwned } from "@/lib/collection/items";
import { loadAreaIndex } from "@/lib/data/areas";
import { getCoinSummary } from "@/lib/data/coins";
import { getOwnedItemIds } from "@/lib/data/collection";
import { getCurrentDogSkin } from "@/lib/data/dog-skin";
import { getExpDashboard } from "@/lib/data/exp";
import { signPhotoPath } from "@/lib/data/photos";
import {
  formatTripPeriod,
  getRecordDestinationHierarchy,
  getTripSummaries,
  type TripSummary,
} from "@/lib/data/trips";
import { getTimeline } from "@/lib/data/visits";
import { getRecordSpace } from "@/lib/data/space";
import { getExpProgress } from "@/lib/exp";
import { MUNICIPALITIES, PREFECTURES } from "@/lib/geo";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "あなたの旅 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; scopeTrip?: string }>;
}) {
  const [{ supabase, user }, { notice, scopeTrip }] = await Promise.all([requireUser(), searchParams]);
  const space = await getRecordSpace(supabase, user.id);
  const destinations = await getRecordDestinationHierarchy(supabase, user.id, space.name);
  const roots = [...(destinations.personal ? [destinations.personal] : []), ...destinations.shared];
  const selectedRoot = roots.find((root) => root.kind === "shared" && root.id === scopeTrip) ?? destinations.personal ?? roots[0] ?? null;
  const scopeOptions: JourneyScopeOption[] = roots.map((root) => ({
    value: root.kind === "personal" ? "personal" : root.id,
    name: root.title,
    kind: root.kind,
  }));
  const selectedScopeValue = selectedRoot?.kind === "shared" ? selectedRoot.id : "personal";

  const [areas, recent, allTrips, expDashboard, coins, ownedItemIds, dogSkin, profileResult] = await Promise.all([
    loadAreaIndex(supabase, space.tripIds),
    getTimeline(supabase, { tripIds: space.tripIds, limit: 4 }),
    getTripSummaries(supabase),
    getExpDashboard(supabase, user.id),
    getCoinSummary(supabase, user.id),
    getOwnedItemIds(supabase, user.id),
    getCurrentDogSkin(supabase, user.id),
    supabase.from("profiles").select("profile_image_url, introduction").eq("user_id", user.id).maybeSingle(),
  ]);
  const avatarUrl = await signPhotoPath(supabase, profileResult.data?.profile_image_url);

  const trips = selectedRoot
    ? allTrips.filter((summary) => summary.trip.parent_trip_id === selectedRoot.id)
    : allTrips;
  const latest = recent[0] ?? null;
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

        <div className="grid grid-cols-2 items-stretch gap-3">
          <section className="grid min-w-0 grid-rows-[40px_240px]">
            <div className="flex h-10 items-center justify-between gap-2 px-1">
              <h2 className="truncate text-base font-bold">最近の記録</h2>
              <Link href="/records" className="flex shrink-0 items-center gap-0.5 text-sm text-leaf-deep">
                すべて見る
                <IconChevronRight size={15} />
              </Link>
            </div>
            {latest ? (
              <Link
                href={`/spots/${latest.spotId}`}
                className="rough-card flex h-full min-h-0 flex-col justify-between overflow-hidden p-4 active:scale-[0.99]"
              >
                <div className="min-h-0">
                  <span className="mb-3 flex h-14 w-14 overflow-hidden rounded-2xl bg-paper-deep">
                    {latest.photoUrls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={latest.photoUrls[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-ink-faint">
                        <IconMapPin size={20} />
                      </span>
                    )}
                  </span>
                  <span className="block line-clamp-2 font-bold leading-snug">{latest.spotName}</span>
                  <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-ink-soft">
                    {latest.municipalityName}・{latest.tripTitle}
                  </span>
                </div>
                <span className="flex items-center justify-between gap-1 text-xs text-ink-faint">
                  <span className="flex min-w-0 items-center gap-1 truncate">
                    <IconCalendar size={13} />
                    {formatDate(latest.visitedAt)}
                  </span>
                  <IconChevronRight size={17} className="shrink-0" />
                </span>
              </Link>
            ) : (
              <div className="rough-card flex h-full min-h-0 flex-col items-center justify-center overflow-hidden px-4 text-center">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-paper-deep text-ink-faint">
                  <IconMapPin size={20} />
                </span>
                <p className="mt-3 text-sm font-bold">まだ記録がありません</p>
                <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-ink-soft">
                  訪れた場所を記録するとここに表示されます。
                </p>
                <Link
                  href="/add"
                  className="mt-4 shrink-0 rounded-full border border-leaf bg-leaf-soft px-4 py-2 text-xs font-semibold text-leaf-deep"
                >
                  記録を追加する
                </Link>
              </div>
            )}
          </section>

          <section className="grid min-w-0 grid-rows-[40px_240px]">
            <div className="flex h-10 items-center px-1">
              <h2 className="truncate text-base font-bold">今日の歩数</h2>
            </div>
            <TodayStepsCard
              initialSteps={expDashboard.todaySteps}
              initialStepExp={expDashboard.todayStepExp}
              initialCoinBalance={coins.balance}
            />
          </section>
        </div>

        <TripSection
          trips={trips}
          emptyTitle="旅行計画はまだありません"
          emptyDescription="旅行としてまとめたい予定があるときだけ作成できます。"
          scopeOptions={scopeOptions}
          selectedScopeValue={selectedScopeValue}
          selectedRootId={selectedRoot?.id}
          selectedSharedRootId={selectedRoot?.kind === "shared" ? selectedRoot.id : undefined}
        />
      </PageBody>
    </>
  );
}

function TripSection({
  trips,
  emptyTitle,
  emptyDescription,
  scopeOptions,
  selectedScopeValue,
  selectedRootId,
  selectedSharedRootId,
}: {
  trips: TripSummary[];
  emptyTitle: string;
  emptyDescription: string;
  scopeOptions: JourneyScopeOption[];
  selectedScopeValue: string;
  selectedRootId?: string;
  selectedSharedRootId?: string;
}) {
  const createHref = selectedRootId ? `/trips/new?parent=${encodeURIComponent(selectedRootId)}` : "/trips/new";
  const recordsHref = `/records?tab=trips${selectedSharedRootId ? `&scopeTrip=${encodeURIComponent(selectedSharedRootId)}` : ""}`;

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-base font-bold">
            旅行
            {trips.length > 0 ? (
              <span className="ml-1.5 text-sm font-normal text-ink-faint tabular-nums">{trips.length}件</span>
            ) : null}
          </h2>
          {scopeOptions.length > 1 ? (
            <JourneyScopeSwitcher
              options={scopeOptions}
              selectedValue={selectedScopeValue}
              basePath="/home"
              queryKey="scopeTrip"
              triggerLabel="切り替え"
            />
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <Link href={createHref} className="flex items-center gap-0.5 text-sm text-leaf-deep">
            <IconPlus size={15} />
            つくる
          </Link>
          {trips.length > 3 ? (
            <Link href={recordsHref} className="flex items-center gap-0.5 text-sm text-leaf-deep">
              すべて見る
              <IconChevronRight size={15} />
            </Link>
          ) : null}
        </div>
      </div>
      {trips.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          actionHref={createHref}
          actionLabel="旅行の計画を立てる"
        />
      ) : (
        <ul className="space-y-2">
          {trips.slice(0, 3).map(({ trip, visitCount }) => (
            <li key={trip.id}>
              <LinkRow
                href={`/trips/${trip.id}`}
                title={trip.title}
                subtitle={[formatTripPeriod(trip), `${visitCount}件の記録`].filter(Boolean).join("・")}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
