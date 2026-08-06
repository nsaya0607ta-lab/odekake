import Link from "next/link";
import { switchWorkspaceAction } from "@/app/actions/workspace";
import {
  IconBell,
  IconChevronRight,
  IconFlag,
  IconHome,
  IconMapPin,
  IconNotebook,
  IconPlus,
  IconSliders,
  IconUsers,
} from "@/components/icons";
import { JapanMap } from "@/components/japan-map";
import { TopHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { TripActivityList } from "@/components/trip-activity-list";
import { EmptyState, LinkRow, SectionHeading, formatDate } from "@/components/ui";
import { loadAreaIndex } from "@/lib/data/areas";
import { formatTripPeriod, getTripActivities, getTripSummaries, type TripSummary } from "@/lib/data/trips";
import { getTimeline } from "@/lib/data/visits";
import { listWorkspaces, resolveWorkspace } from "@/lib/data/workspace";
import { MUNICIPALITIES, PREFECTURES } from "@/lib/geo";
import { REGIONS } from "@/lib/geo/regions";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "あなたの旅 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const [{ supabase, user }, { notice }] = await Promise.all([requireUser(), searchParams]);
  const workspace = await resolveWorkspace(supabase, user.id);

  const [areas, recent, workspaces] = await Promise.all([
    loadAreaIndex(supabase, workspace.tripIds),
    getTimeline(supabase, { tripIds: workspace.tripIds, limit: 4 }),
    listWorkspaces(supabase, user.id),
  ]);

  const visitedRegions = Object.fromEntries(
    REGIONS.map((r) => [r.slug, (areas.region.get(r.slug)?.visitCount ?? 0) > 0]),
  );

  const isShared = workspace.kind === "trip";
  const sharedWorkspaces = workspaces.filter((w) => w.kind === "trip");

  // 個人旅画面では個人旅だけ、共有旅画面では共有旅だけを扱う。
  const soloTrips = isShared
    ? []
    : (await getTripSummaries(supabase, user.id)).filter((t) => t.trip.trip_type === "solo");
  const activities = isShared ? await getTripActivities(supabase, workspace.id, 6) : [];

  return (
    <>
      <TopHeader
        title={workspace.name}
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

        <div className="flex items-center justify-between gap-2 px-1">
          <p className="min-w-0 flex-1 truncate text-sm text-ink-soft">
            <span className="font-bold text-ink">{user.displayName}</span>
            さん、{isShared ? "今日はどこを記録しますか？" : "おでかけの記録を続けましょう"}
          </p>
          <Link
            href="/workspaces"
            className="shrink-0 rounded-full border border-line-strong bg-card px-3 py-1.5 text-xs font-semibold text-ink-soft"
          >
            旅を切替
          </Link>
        </div>

        <section className="rough-card px-5 py-5">
          <div className="mb-3 flex items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                isShared ? "bg-sky-soft text-[#42718f]" : "bg-blossom-soft text-[#95505e]"
              }`}
            >
              {isShared ? <IconUsers size={14} /> : <IconFlag size={14} />}
            </span>
            <p className="min-w-0 flex-1 truncate text-xs font-semibold text-ink-soft">
              {isShared ? `${workspace.name} の共有記録` : `${user.displayName} さんの個人記録`}
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-2 text-center">
            <Stat
              icon={<IconMapPin size={20} />}
              value={areas.totals.visitedPrefectures}
              unit={`/ ${PREFECTURES.length}`}
              label="都道府県"
              tone="blossom"
            />
            <Stat
              icon={<IconHome size={20} />}
              value={areas.totals.visitedMunicipalities}
              unit={`/ ${MUNICIPALITIES.length}`}
              label="市区町村など"
              tone="sky"
            />
            <Stat
              icon={<IconNotebook size={20} />}
              value={areas.totals.visits}
              unit="回"
              label="訪問数"
              tone="leaf"
            />
          </dl>

          {isShared && workspace.trip ? (
            <div className="mt-4 flex items-center gap-3 border-t border-line pt-3">
              <span className="min-w-0 flex-1 text-xs text-ink-soft">
                {[formatTripPeriod(workspace.trip), `${workspace.memberCount}人で記録中`]
                  .filter(Boolean)
                  .join("・")}
              </span>
              <Link
                href={`/trips/${workspace.id}`}
                className="flex shrink-0 items-center gap-1 text-xs text-leaf-deep"
              >
                <IconSliders size={14} />
                旅行の詳細
              </Link>
            </div>
          ) : null}
        </section>

        {isShared ? null : (
          <TripSection
            title="個人旅"
            trips={soloTrips}
            emptyTitle="個人旅はまだありません"
            emptyDescription="自分だけのおでかけを記録しましょう。"
            createHref="/trips/new/personal"
            createLabel="個人旅をつくる"
          />
        )}

        {isShared ? (
          <section>
            <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
              <h2 className="text-base font-bold">
                共有旅
                {sharedWorkspaces.length > 0 ? (
                  <span className="ml-1.5 text-sm font-normal text-ink-faint tabular-nums">
                    {sharedWorkspaces.length}件
                  </span>
                ) : null}
              </h2>
              <Link href="/trips/new/shared" className="flex items-center gap-0.5 text-sm text-leaf-deep">
                <IconPlus size={15} />
                つくる
              </Link>
            </div>

            {sharedWorkspaces.length === 0 ? (
              <EmptyState
                title="共有旅はまだありません"
                description="友人を招待すると、その旅だけの地図と記録がつくられます。"
                actionHref="/trips/new/shared"
                actionLabel="共有旅をつくる"
              />
            ) : (
              <ul className="space-y-2">
                {sharedWorkspaces.map((item) => (
                  <li key={item.id}>
                    <form action={switchWorkspaceAction}>
                      <input type="hidden" name="workspaceId" value={item.id} />
                      <button
                        type="submit"
                        className={`rough-card flex w-full items-center gap-3 px-4 py-3 text-left transition-transform active:scale-[0.99] ${
                          item.isCurrent ? "border-leaf bg-leaf-soft" : ""
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{item.name}</span>
                          <span className="mt-0.5 block truncate text-xs text-ink-faint">
                            {[item.trip ? formatTripPeriod(item.trip) : null, `${item.visitCount}件の記録`]
                              .filter(Boolean)
                              .join("・")}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-sky-soft px-2.5 py-1 text-[11px] font-semibold text-[#42718f]">
                          <IconUsers size={13} />
                          <span className="tabular-nums">{item.memberCount}</span>人
                        </span>
                        {item.isCurrent ? (
                          <span className="shrink-0 text-[11px] font-semibold text-leaf-deep">表示中</span>
                        ) : (
                          <IconChevronRight size={16} className="shrink-0 text-ink-faint" />
                        )}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {isShared ? (
          <section>
            <SectionHeading title="みんなの動き" moreHref={`/trips/${workspace.id}`} />
            <TripActivityList entries={activities} />
          </section>
        ) : null}

        <section>
          <SectionHeading title="最近の記録" moreHref="/records" />
          {recent.length === 0 ? (
            <EmptyState
              icon={<IconNotebook size={30} />}
              title="まだ記録がありません"
              description={
                isShared
                  ? "この共有旅で訪れた場所を記録すると、ここに表示されます。"
                  : "個人旅で訪れた場所を記録すると、ここに表示されます。"
              }
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

        <section>
          <SectionHeading title="日本地図" moreHref="/map" moreLabel="地図を開く" />
          <div className="rough-card rough-card-alt px-3 py-4">
            <p className="mb-2 text-center text-xs text-ink-soft">
              <span className="rough-pill bg-leaf-soft px-3 py-1 text-leaf-deep">
                {isShared ? "この共有旅で訪れた場所だけが色付きます" : "個人旅で訪れた場所だけが色付きます"}
              </span>
            </p>
            <JapanMap visitedRegions={visitedRegions} />
          </div>
        </section>
      </PageBody>
    </>
  );
}

function TripSection({
  title,
  trips,
  emptyTitle,
  emptyDescription,
  createHref,
  createLabel,
}: {
  title: string;
  trips: TripSummary[];
  emptyTitle: string;
  emptyDescription: string;
  createHref: string;
  createLabel: string;
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
