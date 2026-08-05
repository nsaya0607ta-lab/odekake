import Link from "next/link";
import {
  IconBell,
  IconChevronRight,
  IconFlag,
  IconHome,
  IconMapPin,
  IconNotebook,
  IconPlus,
  IconUsers,
} from "@/components/icons";
import { JapanMap } from "@/components/japan-map";
import { TopHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { EmptyState, LinkRow, SectionHeading, formatDate } from "@/components/ui";
import { loadAreaIndex } from "@/lib/data/areas";
import { formatTripPeriod, getTripSummaries, type TripSummary } from "@/lib/data/trips";
import { getTimeline } from "@/lib/data/visits";
import { REGIONS } from "@/lib/geo/regions";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "あなたの旅 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const [{ supabase, user }, { notice }] = await Promise.all([requireUser(), searchParams]);

  const [areas, trips, recent] = await Promise.all([
    loadAreaIndex(supabase),
    getTripSummaries(supabase, user.id),
    getTimeline(supabase, { limit: 4 }),
  ]);

  const visitedRegions = Object.fromEntries(
    REGIONS.map((r) => [r.slug, (areas.region.get(r.slug)?.visitCount ?? 0) > 0]),
  );

  const soloTrips = trips.filter((t) => t.trip.trip_type === "solo");
  const sharedTrips = trips.filter((t) => t.trip.trip_type === "shared");

  return (
    <>
      <TopHeader
        title="あなたの旅"
        action={
          <Link
            href="/invitations"
            aria-label="招待のお知らせ"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft active:bg-paper-deep"
          >
            <IconBell />
          </Link>
        }
      />

      <PageBody>
        {notice === "password-updated" ? (
          <p className="rounded-2xl border border-leaf bg-leaf-soft px-4 py-3 text-sm text-leaf-deep">
            パスワードを変更しました。
          </p>
        ) : null}

        {/* あなたの旅 — 訪問した地域と登録スポットの数 */}
        <section className="rough-card px-5 py-5">
          <p className="mb-4 text-center text-sm font-semibold text-ink-soft">
            <span className="hand-underline px-1">{user.displayName} さんの記録</span>
          </p>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <Stat
              icon={<IconMapPin size={20} />}
              value={areas.totals.visitedPrefectures}
              unit="/ 47"
              label="訪問した都道府県"
              tone="blossom"
            />
            <Stat
              icon={<IconHome size={20} />}
              value={areas.totals.visitedMunicipalities}
              label="訪問した市区町村"
              tone="sky"
            />
            <Stat icon={<IconFlag size={20} />} value={areas.totals.spots} label="登録スポット" tone="leaf" />
          </dl>
        </section>

        <TripSection
          title="一人旅"
          trips={soloTrips}
          emptyTitle="一人旅はまだありません"
          emptyDescription="ひとりのおでかけを記録しましょう。"
          createHref="/trips/new?type=solo"
          createLabel="一人旅をつくる"
        />

        <TripSection
          title="共有旅"
          trips={sharedTrips}
          emptyTitle="共有旅はまだありません"
          emptyDescription="友人を招待して、いっしょに記録できます。"
          createHref="/trips/new?type=shared"
          createLabel="共有旅をつくる"
          showMemberCount
        />

        {/* 日本地図 */}
        <section>
          <SectionHeading title="日本地図" moreHref="/map" moreLabel="地図を開く" />
          <div className="rough-card rough-card-alt px-3 py-4">
            <p className="mb-2 text-center text-xs text-ink-soft">
              <span className="rough-pill bg-leaf-soft px-3 py-1 text-leaf-deep">地図をタップして地域を選択</span>
            </p>
            <JapanMap visitedRegions={visitedRegions} />
          </div>
        </section>

        {/* 最近の記録 */}
        <section>
          <SectionHeading title="最近の記録" moreHref="/records" />
          {recent.length === 0 ? (
            <EmptyState
              icon={<IconNotebook size={30} />}
              title="まだ記録がありません"
              description="訪れた場所を記録すると、ここに表示されます。"
              actionHref="/add"
              actionLabel="記録を追加する"
            />
          ) : (
            <ul className="space-y-2">
              {recent.map((item) => (
                <li key={item.id}>
                  <LinkRow
                    href={`/spots/${item.spotId}`}
                    leading={
                      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-paper-deep">
                        {item.photoUrls[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.photoUrls[0]} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-ink-faint">
                            <IconMapPin size={20} />
                          </span>
                        )}
                      </span>
                    }
                    title={item.spotName}
                    subtitle={`${item.municipalityName}・${item.tripTitle}`}
                    trailing={<span className="shrink-0 text-xs text-ink-faint">{formatDate(item.visitedAt)}</span>}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </PageBody>
    </>
  );
}

/** 一人旅 / 共有旅の一覧。共有旅では参加人数も出す */
function TripSection({
  title,
  trips,
  emptyTitle,
  emptyDescription,
  createHref,
  createLabel,
  showMemberCount = false,
}: {
  title: string;
  trips: TripSummary[];
  emptyTitle: string;
  emptyDescription: string;
  createHref: string;
  createLabel: string;
  showMemberCount?: boolean;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-base font-bold">
          {title}
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
          actionLabel={createLabel}
        />
      ) : (
        <ul className="space-y-2">
          {trips.slice(0, 3).map(({ trip, memberCount, visitCount }) => (
            <li key={trip.id}>
              <LinkRow
                href={`/trips/${trip.id}`}
                title={trip.title}
                subtitle={[formatTripPeriod(trip), `${visitCount}件の記録`].filter(Boolean).join("・")}
                trailing={
                  showMemberCount ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-sky-soft px-2.5 py-1 text-[11px] font-semibold text-[#42718f]">
                      <IconUsers size={13} />
                      <span className="tabular-nums">{memberCount}</span>人
                    </span>
                  ) : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({
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
    <div className="flex flex-col items-center gap-1">
      <span className={`flex h-10 w-10 items-center justify-center rounded-full ${toneClass}`}>{icon}</span>
      <dd className="flex items-baseline gap-0.5">
        <span className="text-3xl leading-none font-bold tabular-nums">{value}</span>
        {unit ? <span className="text-xs text-ink-faint tabular-nums">{unit}</span> : null}
      </dd>
      <dt className="text-xs leading-tight text-ink-soft">{label}</dt>
    </div>
  );
}
