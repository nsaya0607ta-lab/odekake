import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { QuickVisit } from "@/components/quick-visit";
import { todayInJapan } from "@/lib/date";
import { ensurePersonalRecordTrip } from "@/lib/data/trips";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "かんたん場所登録 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function QuickVisitPage() {
  const { supabase, user } = await requireUser();
  const personalTrip = await ensurePersonalRecordTrip(supabase, user.id);
  if (!personalTrip) throw new Error("記録先を準備できませんでした。");

  return (
    <>
      <PageHeader title="かんたん場所登録" backHref="/home" />
      <PageBody>
        <div className="rough-card bg-leaf-soft/35 px-4 py-3 text-sm leading-relaxed text-ink-soft">
          現在地の近くにあるお店・施設を選ぶだけで、今日のおでかけとして登録できます。
        </div>
        <QuickVisit
          tripId={personalTrip.id}
          visitedAt={todayInJapan()}
          placeSearchEnabled={Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim())}
        />
      </PageBody>
    </>
  );
}
