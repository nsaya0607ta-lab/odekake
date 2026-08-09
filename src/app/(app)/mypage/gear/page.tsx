import { GearBoard } from "@/components/gear-board";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { getEquipment } from "@/lib/data/equipment";
import { getExpProgress } from "@/lib/exp";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "そうび | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function GearPage() {
  const { supabase, user } = await requireUser();
  const [{ data: savedExp }, equipment] = await Promise.all([
    supabase.from("user_exp").select("total_exp").eq("user_id", user.id).maybeSingle(),
    getEquipment(supabase, user.id),
  ]);

  const progress = getExpProgress(savedExp?.total_exp ?? 0);

  return (
    <>
      <PageHeader title="そうび" backHref="/mypage" subtitle="レベルアップでもらえたもの" />
      <PageBody>
        <GearBoard currentLevel={progress.level} initialEquipment={equipment} />
      </PageBody>
    </>
  );
}
