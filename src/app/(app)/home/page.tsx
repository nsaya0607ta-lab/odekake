import Link from "next/link";
import { CollectionBookArt } from "@/components/collection/collection-ui";
import {
  IconCalendar,
  IconChevronRight,
  IconHome,
  IconMapPin,
  IconNotebook,
  IconUser,
} from "@/components/icons";
import { JourneyScopeSwitcher, type JourneyScopeOption } from "@/components/journey-scope-switcher";
import { TopHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { CoinBadge } from "@/components/coin-badge";
import { SharedTripBadge } from "@/components/shared-trip-badge";
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

        <section className="rough-card overflow-hidden">
          <div className="relative h-60 overflow-hidden bg-[#edf5e6] sm:h-64">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_20%,rgba(255,255,255,0.9)_0_5%,transparent_6%),linear-gradient(180deg,#e8f3ef_0%,#edf5e4_42%,#dfecc6_43%,#dfecc6_100%)]" />
            <div className="absolute inset-x-0 top-[36%] h-[24%] bg-[linear-gradient(155deg,transparent_0_10%,rgba(173,204,157,0.35)_11%_28%,transparent_29%_36%,rgba(154,190,151,0.28)_37%_55%,transparent_56%)]" />
            <div className="absolute left-0 top-0 h-20 w-[48%] origin-left -rotate-6 rounded-br-[75%] bg-[#8c6d35]/90" />
            <div className="absolute left-[4%] top-0 h-16 w-[42%] origin-left -rotate-3 rounded-br-[70%] bg-[#b08a48]" />
            <div className="absolute left-[7%] top-2 h-6 w-6 rounded-full bg-[#8fb76e] shadow-[28px_2px_0_0_#9bc57a,58px_6px_0_0_#87b16a,88px_-2px_0_0_#9ac377,118px_2px_0_0_#7faa64,148px_8px_0_0_#9cc47c]" />
            <div className="absolute left-0 right-0 bottom-0 h-[46%] bg-[linear-gradient(180deg,rgba(223,236,198,0)_0%,rgba(220,236,188,0.6)_15%,#d9e9b5_100%)]" />
            <div className="absolute bottom-8 left-[2%] h-12 w-5 rounded-[50%] bg-[#8fb570]" />
            <div className="absolute bottom-7 left-[0.7%] h-12 w-12 rounded-full bg-[#a4ca81]" />
            <div className="absolute bottom-10 right-[7%] h-20 w-5 rounded-[50%] bg-[#8b6a3e]" />
            <div className="absolute bottom-14 right-[2%] h-16 w-16 rounded-full bg-[#8fbd68]" />
            <div className="absolute bottom-[18%] left-[5%] right-[4%] h-5 opacity-50 [background-image:radial-gradient(circle,#a77b43_0_25%,transparent_27%),linear-gradient(90deg,transparent_0_65%,#b58c58_66%_78%,transparent_79%)] [background-size:34px_18px,34px_18px]" />

            <div className="absolute left-2 top-2 z-20 w-[34%] min-w-[118px] max-w-[150px] sm:left-4 sm:top-3 sm:w-[31%]">
              <Link
                href="/mypage/exp-history"
                className="block rounded-[24px] border-2 border-[#d7b47b] bg-[#fff5db]/95 p-2.5 shadow-[0_3px_0_rgba(137,93,42,0.15)] active:scale-[0.98]"
              >
                <div className="mx-auto -mt-4 mb-1 w-[88%] rounded-full bg-[#6f9b50] px-2 py-1 text-center text-[9px] font-bold text-white shadow-sm">
                  おでかけレベル
                </div>
                <div className="flex items-end justify-center gap-1 text-[#4d4032]">
                  <span className="pb-0.5 text-[10px] font-semibold">Lv.</span>
                  <span className="text-[26px] font-bold leading-none tabular-nums">{expProgress.level}</span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[8px] text-[#6d5a42]">
                  <span className="font-bold">EXP</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#dfc79e]/80">
                    <span className="block h-full rounded-full bg-[#6f9b50]" style={{ width: `${expProgress.progressPercent}%` }} />
                  </span>
                  <span className="tabular-nums">{expProgress.totalExp} / {expProgress.nextLevelExp}</span>
                </div>
              </Link>

              <div className="mx-auto h-5 w-[2px] bg-[#a97844] shadow-[58px_0_0_0_#a97844]" />

              <div className="rounded-[26px] border-2 border-[#d9a08c] bg-[#fff5db]/95 p-2.5 shadow-[0_3px_0_rgba(137,93,42,0.15)]">
                <div className="mx-auto -mt-4 mb-1 w-[82%] rounded-full bg-[#e6a38f] px-2 py-1 text-center text-[9px] font-bold text-[#6f493d] shadow-sm">
                  今日のおさんぽ
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[#4d4032]">
                  <span aria-hidden="true" className="text-base">👟</span>
                  <span className="text-[28px] font-bold leading-none tabular-nums">{(expDashboard.todaySteps ?? 0).toLocaleString("ja-JP")}</span>
                  <span className="pt-2 text-[10px] font-bold">歩</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dfc79e]/80">
                  <span
                    className="block h-full rounded-full bg-[#dc8d7b]"
                    style={{ width: `${Math.min(100, ((expDashboard.todaySteps ?? 0) / 5000) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-center text-[8px] font-semibold text-[#6d5a42]">
                  目標まであと {Math.max(0, 5000 - (expDashboard.todaySteps ?? 0)).toLocaleString("ja-JP")} 歩
                </p>
              </div>
            </div>

            <div className="absolute inset-y-0 left-[33%] right-0 z-10">
              <WanderingFrenchie level={expProgress.level} skin={dogSkin} />
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-line px-2 py-4 text-center">
            <DashboardStat
              icon={<IconMapPin size={18} />}
              value={areas.totals.visitedPrefectures}
              unit={`/ ${PREFECTURES.length}`}
              label="都道府県"
              tone="blossom"
            />
            <DashboardStat
              icon={<IconHome size={18} />}
              value={areas.totals.visitedMunicipalities}
              unit={`/ ${MUNICIPALITIES.length}`}
              label="市区町村など"
              tone="sky"
            />
            <DashboardStat
              icon={<IconNotebook size={18} />}
              value={areas.totals.visits}
              unit="回"
              label="訪問数"
              tone="leaf"
            />
          </div>
        </section>

        <Link
          href="/collection"
          className="rough-card pressable flex items-center gap-3 px-4 py-3 active:border-line-strong active:bg-paper-deep"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-leaf-soft">
            <CollectionBookArt className="w-7" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">図鑑を見る</span>
            <span className="mt-0.5 block text-xs text-ink-soft">
              集めたアイテムのコレクション
              <span className="ml-1.5 tabular-nums">
                {collectedItems} / {COLLECTION_ITEMS.length}
              </span>
            </span>
          </span>
          <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
        </Link>

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

function DashboardStat({
  icon,
  value,
  unit,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  unit: string;
  label: string;
  tone: "blossom" | "sky" | "leaf";
}) {
  const tones = {
    blossom: "bg-blossom-soft text-[#9f5765]",
    sky: "bg-sky-soft text-[#477da2]",
    leaf: "bg-leaf-soft text-leaf-deep",
  };

  return (
    <div className="px-2">
      <span className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full ${tones[tone]}`}>{icon}</span>
      <p className="mt-2 whitespace-nowrap text-3xl font-bold tabular-nums">
        {value}
        <span className="ml-1 text-[10px] font-normal text-ink-faint">{unit}</span>
      </p>
      <p className="mt-1 whitespace-nowrap text-xs font-semibold text-ink-soft">{label}</p>
    </div>
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
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="shrink-0 text-base font-bold">旅行</h2>
          {scopeOptions.length > 1 ? (
            <JourneyScopeSwitcher
              options={scopeOptions}
              selectedValue={selectedScopeValue}
              queryKey="scopeTrip"
              compact
            />
          ) : null}
        </div>
        <Link
          href={`/trips/new${selectedRootId ? `?parent=${selectedRootId}` : ""}`}
          className="flex shrink-0 items-center gap-1 text-sm text-leaf-deep"
        >
          ＋ つくる
        </Link>
      </div>

      {trips.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} actionHref={selectedRootId ? `/trips/new?parent=${selectedRootId}` : "/trips/new"} actionLabel="旅行をつくる" />
      ) : (
        <ul className="space-y-2">
          {trips.map(({ trip, visitCount }) => (
            <li key={trip.id}>
              <LinkRow
                href={`/trips/${trip.id}${selectedSharedRootId ? `?scopeTrip=${selectedSharedRootId}` : ""}`}
                title={trip.title}
                subtitle={`${formatTripPeriod(trip) ?? "日程未設定"}・${visitCount}件の記録`}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
