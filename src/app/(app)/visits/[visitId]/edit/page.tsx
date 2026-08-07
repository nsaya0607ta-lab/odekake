import { notFound } from "next/navigation";
import { deleteVisitAction } from "@/app/actions/visits";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { getTripOptions } from "@/lib/data/trips";
import { getVisitForEdit } from "@/lib/data/visits";
import { resolveWorkspace } from "@/lib/data/workspace";
import { requireUser } from "@/lib/supabase/server";
import { VisitForm } from "../../visit-form";
import { DeleteVisitButton } from "./delete-visit-button";

export const metadata = { title: "訪問履歴を編集 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function EditVisitPage({
  params,
  searchParams,
}: {
  params: Promise<{ visitId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ visitId }, { error }, { supabase, user }] = await Promise.all([
    params,
    searchParams,
    requireUser(),
  ]);

  const workspace = await resolveWorkspace(supabase, user.id);
  const detail = await getVisitForEdit(supabase, visitId);
  if (!detail || !detail.spot) notFound();

  const { record, spot, photos } = detail;

  const [workspaceTrips, { data: tagRows }] = await Promise.all([
    getTripOptions(supabase, workspace.tripIds),
    supabase.from("visit_record_tags").select("tag_id").eq("visit_record_id", visitId),
  ]);

  // この記録の旅行が、いま開いている旅ワークスペースの外にあることがある
  // （別のタブで旅を切り替えた、履歴やブックマークから開いた、など）。
  // 選択肢に無いと保存できなくなるため、その旅行を必ず足しておく。
  let trips = workspaceTrips;
  let outsideWorkspace = false;
  if (!trips.some((trip) => trip.id === record.trip_id)) {
    const { data: ownTrip } = await supabase
      .from("trips")
      .select("id, title, trip_type")
      .eq("id", record.trip_id)
      .maybeSingle();
    if (ownTrip) {
      trips = [ownTrip, ...trips];
      outsideWorkspace = true;
    }
  }

  let tags = "";
  if (tagRows && tagRows.length > 0) {
    const { data: tagNames } = await supabase
      .from("tags")
      .select("name")
      .in(
        "id",
        tagRows.map((t) => t.tag_id),
      );
    tags = (tagNames ?? []).map((t) => t.name).join(" ");
  }

  return (
    <>
      <PageHeader title="訪問履歴を編集" backHref={`/spots/${spot.id}`} />
      <PageBody>
        {error === "delete" ? (
          <p className="rounded-2xl border border-blossom bg-blossom-soft px-4 py-3 text-sm text-[#8f4c59]">
            訪問履歴を削除できませんでした。時間をおいてもう一度お試しください。
          </p>
        ) : null}

        {outsideWorkspace ? (
          <p className="rounded-2xl border border-sky bg-sky-soft px-4 py-3 text-sm text-[#42718f]">
            この記録は、いま開いている「{workspace.name}」とは別の旅のものです。
          </p>
        ) : null}

        <VisitForm
          userId={user.id}
          mode="edit"
          visitId={record.id}
          spotId={spot.id}
          spotName={spot.name}
          trips={trips}
          initialPhotos={photos.flatMap((p) => (p.url ? [{ path: p.storagePath, url: p.url }] : []))}
          defaults={{
            visitedAt: record.visited_at,
            tripId: record.trip_id,
            rating: record.rating ?? 0,
            comment: record.comment ?? "",
            note: record.note ?? "",
            companions: record.companions ?? "",
            amount: record.amount === null ? "" : String(record.amount),
            stayMinutes: record.stay_minutes === null ? "" : String(record.stay_minutes),
            congestionLevel: record.congestion_level === null ? "" : String(record.congestion_level),
            revisitWanted: record.revisit_wanted,
            favorite: record.favorite,
            tags,
          }}
        />

        <form action={deleteVisitAction}>
          <input type="hidden" name="visitId" value={record.id} />
          <input type="hidden" name="spotId" value={spot.id} />
          <DeleteVisitButton />
        </form>
      </PageBody>
    </>
  );
}
