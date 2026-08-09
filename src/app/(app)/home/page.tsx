import Link from "next/link";
import {
  IconCalendar,
  IconChevronRight,
  IconHome,
  IconMapPin,
  IconNotebook,
  IconPlus,
} from "@/components/icons";
import { TopHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { CoinBadge } from "@/components/coin-badge";
import { LevelTag } from "@/components/level-tag";
import { TodayStepsCard } from "@/components/today-steps-card";
import { EmptyState, LinkRow, formatDate } from "@/components/ui";
import { WanderingFrenchie } from "@/components/wandering-frenchie";
import { loadAreaIndex } from "@/lib/data/areas";
import { getCoinSummary } from "@/lib/data/coins";
import { getExpDashboard } from "@/lib/data/exp";
import { getEquipment } from "@/lib/data/equipment";
import { formatTripPeriod, getTripSummaries, type TripSummary } from "@/lib/data/trips";
import { getTimeline } from "@/lib/data/visits";
import { getRecordSpace } from "@/lib/data/space";
import { getExpProgress } from "@/lib/exp";
import { MUNICIPALITIES, PREFECTURES } from "@/lib/geo";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "あなたの旅 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const [{ supabase, user }, { notice }] = await Promise.all([requireUser(), searchParams]);
  const space = await getRecordSpace(supabase, user.id);

  const [areas, recent, trips, expDashboard, coins, equipment] = await Promise.all([
    loadAreaIndex(supabase, space.tripIds),
    getTimeline(supabase, { tripIds: space.tripIds, limit: 4 }),
    getTripSummaries(supabase),
    getExpDashboard(supabase, user.id),
    getCoinSummary(supabase, user.id),
    getEquipment(supabase, user.id),
  ]);

  const latest = recent[0] ?? null;
  const expProgress = getExpProgress(expDashboard.totalExp);

  return (
    <>
      <TopHeader title={space.name} action={<CoinBadge balance={coins.balance} />} />

      <PageBody>
        {notice === "password-updated" ? (
          <p className="rounded-2xl border border-leaf bg-leaf-soft px-4 py-3 text-sm text-leaf-deep">
            パスワードを変更しました。
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2 px-1">
          <p className="min-w-0 flex-1 truncate text-sm text-ink-soft">
            <span className="font-bold text-ink">{user.displayName}</span>
            さん、おでかけを記録しましょう
          </p>
          <Link
            href="/mypage/profile"
            className="shrink-0 rounded-full border border-line-strong bg-card px-3 py-1.5 text-xs font-semibold text-ink-soft"
          >
            名前を変える
          </Link>
        </div>

        <section className="rough-card overflow-hidden">
          <div className="relative h-52 overflow-hidden bg-leaf-soft sm:h-56">
            <div className="absolute inset-x-0 bottom-0 h-24 bg-[#eef3e5]" />
            <div className="absolute -left-14 bottom-[-42px] h-32 w-72 rounded-[50%] bg-[#e3ecd7]" />
            <div className="absolute right-[-42px] bottom-[-54px] h-36 w-80 rounded-[50%] bg-[#dce8cf]" />
            <div className="absolute left-[10%] top-6 h-4 w-10 rounded-full bg-white/55" />
            <div className="absolute left-[32%] top-10 h-3 w-8 rounded-full bg-white/45" />
            <div className="absolute right-12 top-5 h-10 w-10 rounded-full border border-[#d7b87d] bg-[#f8e7ca]" />
            <div className="absolute bottom-5 left-[8%] h-6 w-2 rounded-full bg-[#91aa75]" />
            <div className="absolute bottom-4 left-[7.2%] h-5 w-5 rounded-[50%] bg-[#b9cf9f]" />
            <div className="absolute bottom-7 left-[43%] h-8 w-2 rounded-full bg-[#91aa75]" />
            <div className="absolute bottom-6 left-[41.8%] h-6 w-6 rounded-[50%] bg-[#b9cf9f]" />
            <WanderingFrenchie level={expProgress.level} equipment={equipment} />
            <LevelTag progress={expProgress} />
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
            />
          </section>
        </div>

        <TripSection
          trips={trips}
          emptyTitle="旅行計画はまだありません"
          emptyDescription="旅行としてまとめたい予定があるときだけ作成できます。"
        />

      </PageBody>
    </>
  );
}

function TripSection({
  trips,
  emptyTitle,
  emptyDescription,
}: {
  trips: TripSummary[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  const createHref = "/trips/new";

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-base font-bold">
          旅行
          {trips.length > 0 ? (
            <span className="ml-1.5 text-sm font-normal text-ink-faint tabular-nums">{trips.length}件</span>
          ) : null}
        </h2>
        <div className="flex items-center gap-3">
          <Link href={createHref} className="flex items-center gap-0.5 text-sm text-leaf-deep">
            <IconPlus size={15} />
            つくる
          </Link>
          {trips.length > 3 ? (
            <Link href="/records?tab=trips" className="flex items-center gap-0.5 text-sm text-leaf-deep">
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

function DashboardStat({
  icon,
  value,
  unit,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  unit?: string;
  label: string;
  tone: "blossom" | "sky" | "leaf";
}) {
  const toneClass = {
    blossom: "bg-blossom-soft text-[#95505e]",
    sky: "bg-sky-soft text-[#42718f]",
    leaf: "bg-leaf-soft text-leaf-deep",
  }[tone];

  return (
    <div className="flex min-w-0 flex-col items-center gap-1 px-1">
      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${toneClass}`}>{icon}</span>
      <span className="mt-1 flex items-baseline gap-0.5">
        <span className="text-2xl leading-none font-bold tabular-nums">{value}</span>
        {unit ? <span className="text-[10px] text-ink-faint tabular-nums">{unit}</span> : null}
      </span>
      <span className="whitespace-nowrap text-[10px] leading-tight text-ink-soft">{label}</span>
    </div>
  );
}
