import { notFound } from "next/navigation";
import { CoinBadge } from "@/components/coin-badge";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { TownScreen } from "@/components/town/town-screen";
import { getCoinSummary } from "@/lib/data/coins";
import { requireUser } from "@/lib/supabase/server";
import {
  FALLBACK_TOWN_CATALOG,
  FALLBACK_TOWN_SNAPSHOT,
  getTownCatalog,
  getTownSnapshot,
} from "@/lib/town/data";

export const dynamic = "force-dynamic";

export default async function TownPage() {
  const { supabase, user } = await requireUser();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || profile?.display_name?.trim() !== "しゅん") {
    notFound();
  }

  const [townData, coins] = await Promise.all([
    Promise.all([getTownSnapshot(supabase), getTownCatalog(supabase)])
      .then(([snapshot, catalog]) => ({
        snapshot,
        catalog,
        persistenceMode: "supabase" as const,
      }))
      .catch((error: unknown) => {
        console.error("Town database is not ready; using local fallback", { error });
        return {
          snapshot: FALLBACK_TOWN_SNAPSHOT,
          catalog: FALLBACK_TOWN_CATALOG,
          persistenceMode: "local" as const,
        };
      }),
    getCoinSummary(supabase, user.id),
  ]);

  return (
    <>
      <TopHeader
        backHref="/home"
        title="わんこタウン"
        subtitle="素材を集めて、ちいさな街づくり"
        action={<CoinBadge balance={coins.balance} />}
      />
      <PageBody className="!max-w-lg !space-y-0 !px-0 !py-0">
        <TownScreen
          initialSnapshot={townData.snapshot}
          catalog={townData.catalog}
          initialCoinBalance={coins.balance}
          persistenceMode={townData.persistenceMode}
        />
      </PageBody>
    </>
  );
}
