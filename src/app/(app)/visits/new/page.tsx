import { notFound, redirect } from "next/navigation";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { getTripOptions } from "@/lib/data/trips";
import { resolveWorkspace } from "@/lib/data/workspace";
import { requireUser } from "@/lib/supabase/server";
import { VisitForm } from "../visit-form";

export const metadata = { title: "訪問履歴を追加 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function NewVisitPage({
  searchParams,
}: {
  searchParams: Promise<{ spot?: string; trip?: string; created?: string }>;
}) {
  const [{ supabase, user }, { spot: spotId, trip: tripId, created }] = await Promise.all([
    requireUser(),
    searchParams,
  ]);

  if (!spotId) redirect("/add");

  const { data: spot } = await supabase.from("spots").select("id, name").eq("id", spotId).maybeSingle();
  if (!spot) notFound();

  const workspace = await resolveWorkspace(supabase, user.id);
  const trips = await getTripOptions(supabase, workspace.tripIds);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title="訪問履歴を追加" />
      <PageBody>
        {created === "1" ? (
          <p className="rounded-2xl border border-leaf bg-leaf-soft px-4 py-3 text-sm text-leaf-deep">
            スポットを登録しました。続けて訪問の記録を残しましょう。
          </p>
        ) : null}

        <VisitForm
          userId={user.id}
          mode="create"
          spotId={spot.id}
          spotName={spot.name}
          trips={trips}
          defaults={{
            visitedAt: today,
            tripId: tripId ?? trips[0]?.id ?? "",
            rating: 0,
            comment: "",
            note: "",
            companions: "",
            amount: "",
            stayMinutes: "",
            congestionLevel: "",
            revisitWanted: false,
            favorite: false,
            tags: "",
          }}
        />
      </PageBody>
    </>
  );
}
