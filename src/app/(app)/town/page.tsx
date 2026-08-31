import { CoinBadge } from "@/components/coin-badge";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { TownScreen } from "@/components/town/town-screen";
import { getCoinSummary } from "@/lib/data/coins";
import { getCurrentDogSkin } from "@/lib/data/dog-skin";
import { requireUser } from "@/lib/supabase/server";
import { getTownCatalog, getTownSnapshot } from "@/lib/town/data";

export const metadata = { title: "わんこタウン | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function TownPage() {
  const { supabase, user } = await requireUser();
  const [snapshot, catalog, coins, dogSkin] = await Promise.all([
    getTownSnapshot(supabase),
    getTownCatalog(supabase),
    getCoinSummary(supabase, user.id),
    getCurrentDogSkin(supabase, user.id),
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
          initialSnapshot={snapshot}
          catalog={catalog}
          initialCoinBalance={coins.balance}
          dogSkin={dogSkin}
        />
      </PageBody>
    </>
  );
}
