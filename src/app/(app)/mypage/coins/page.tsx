import { CoinPill } from "@/components/coin-badge";
import { CoinEarnMethods } from "@/components/coin-earn-methods";
import { CoinHero } from "@/components/coin-hero";
import { CoinShopPreview } from "@/components/coin-shop-preview";
import { CoinUseCards } from "@/components/coin-use-cards";
import { IconPaw } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { getStepCoins } from "@/lib/coins";
import { getCoinSummary } from "@/lib/data/coins";
import { getExpDashboard } from "@/lib/data/exp";
import { getRecordSpace } from "@/lib/data/space";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "おでかけコイン | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function CoinsPage() {
  const { supabase, user } = await requireUser();
  const space = await getRecordSpace(supabase, user.id);

  const [summary, expDashboard] = await Promise.all([
    getCoinSummary(supabase, user.id),
    getExpDashboard(supabase, user.id),
  ]);

  return (
    <>
      <TopHeader
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
        {/* 画面全体の余白は PageBody（space-y-6）より詰めたいので、内側で持つ */}
        <div className="space-y-4">
          <CoinHero balance={summary.balance} todayCoins={getStepCoins(expDashboard.todaySteps)} />

          <CoinUseCards balance={summary.balance} />

          <CoinShopPreview />

          <CoinEarnMethods />
        </div>
      </PageBody>
    </>
  );
}
