import Link from "next/link";
import { respondSharedTripInvitationAction } from "./actions";
import { IconCalendar, IconPlus, IconUsers } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { getSharedTripList, getSharedTripsSetupStatus } from "@/lib/data/shared-trips";
import { formatDate } from "@/components/ui";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "共有旅 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function SharedTripsPage({ searchParams }: { searchParams: Promise<{ created?: string; responded?: string }> }) {
  const [{ supabase }, params] = await Promise.all([requireUser(), searchParams]);
  const status = await getSharedTripsSetupStatus(supabase);
  const trips = status.ready ? await getSharedTripList(supabase) : [];
  const invitations = trips.filter((trip) => trip.my_status === "invited");
  const participating = trips.filter((trip) => trip.my_status === "accepted");

  return (
    <>
      <PageHeader title="共有旅" backHref="/home" />
      <PageBody>
        {params.created === "1" ? <p className="rounded-2xl border border-leaf bg-leaf-soft px-4 py-3 text-sm text-leaf-deep">共有旅を作成し、フレンドへ参加確認を送りました。</p> : null}
        {!status.ready ? <SetupCard /> : <>
          {invitations.length > 0 ? <section className="space-y-3"><h2 className="px-1 font-bold">参加確認</h2>{invitations.map((trip) => <InvitationCard key={trip.trip_id} trip={trip} />)}</section> : null}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1"><h2 className="font-bold">参加中の共有旅</h2><span className="text-sm text-ink-faint">{participating.length}件</span></div>
            {participating.length === 0 ? <div className="rough-card px-6 py-9 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-leaf-soft text-leaf-deep"><IconUsers size={27} /></span><p className="mt-3 font-bold">共有旅はまだありません</p><p className="mt-2 text-xs text-ink-faint">フレンドを選んで、一緒に旅の記録を始めましょう。</p></div> : participating.map((trip) => <TripCard key={trip.trip_id} trip={trip} />)}
          </section>
          <Link href="/shared-trips/new" className="btn btn-primary w-full"><IconPlus size={18} />新しい共有旅を作る</Link>
        </>}
      </PageBody>
    </>
  );
}

type Trip = Awaited<ReturnType<typeof getSharedTripList>>[number];
function TripCard({ trip }: { trip: Trip }) {
  return <article className="rough-card p-4"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-leaf-soft text-leaf-deep"><IconUsers size={21} /></span><div className="min-w-0 flex-1"><h3 className="truncate font-bold">{trip.title}</h3><p className="mt-1 truncate text-xs text-ink-soft">{trip.member_names.join("・")}</p><p className="mt-2 flex items-center gap-1 text-[11px] text-ink-faint"><IconCalendar size={13} />更新 {formatDate(trip.updated_at.slice(0, 10))}・{trip.member_count}人</p></div></div></article>;
}
function InvitationCard({ trip }: { trip: Trip }) {
  return <article className="rough-card space-y-3 border-blossom p-4"><div><p className="text-xs font-semibold text-blossom">{trip.owner_name}さんからの参加確認</p><h3 className="mt-1 font-bold">{trip.title}</h3></div><form action={respondSharedTripInvitationAction} className="grid grid-cols-2 gap-2"><input type="hidden" name="tripId" value={trip.trip_id} /><button name="response" value="decline" className="btn btn-quiet">辞退する</button><button name="response" value="accept" className="btn btn-primary">参加する</button></form></article>;
}
function SetupCard() {
  return <div className="rough-card px-6 py-10 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-paper-deep text-ink-faint"><IconUsers size={27} /></span><h2 className="mt-3 font-bold">共有旅のデータベース設定が必要です</h2><p className="mt-2 text-xs text-ink-faint">Supabaseで 0023_shared_trips.sql を実行すると利用できます。</p></div>;
}
