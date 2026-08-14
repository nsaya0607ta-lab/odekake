import { CoinPill } from "@/components/coin-badge";
import { CoinEarnMethods } from "@/components/coin-earn-methods";
import { CoinHero } from "@/components/coin-hero";
import { CoinLiveRefresh } from "@/components/coin-live-refresh";
import { CoinUseCards } from "@/components/coin-use-cards";
import { IconPaw } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { getCoinSummary } from "@/lib/data/coins";
import { getCurrentDogSkin } from "@/lib/data/dog-skin";
import { getRecordSpace } from "@/lib/data/space";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "おでかけコイン | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function CoinsPage() {
  const { supabase, user } = await requireUser();
  const space = await getRecordSpace(supabase, user.id);

  const [summary, skin] = await Promise.all([
    getCoinSummary(supabase, user.id),
    getCurrentDogSkin(supabase, user.id),
  ]);

  return (
    <>
      <CoinLiveRefresh />
      <TopHeader
        backHref="/home"
        title={
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate">{space.name}</span>
            <IconPaw size={15} className="shrink-0 text-ink-faint" />
          </span>
        }
        subtitle="おでかけも、思い出も、いっしょに。"
        action={<CoinPill balance={summary.balance} />}
      />

      <PageBody>
        <div className="space-y-4">
          <CoinHero balance={summary.balance} skin={skin} />
          <CoinUseCards balance={summary.balance} />
          <CoinEarnMethods />
        </div>
      </PageBody>
    </>
  );
}
