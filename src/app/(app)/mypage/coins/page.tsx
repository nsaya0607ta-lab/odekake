import Link from "next/link";
import { CoinPill } from "@/components/coin-badge";
import { CoinEarnMethods } from "@/components/coin-earn-methods";
import { CoinHero } from "@/components/coin-hero";
import { CoinLiveRefresh } from "@/components/coin-live-refresh";
import { CoinUseCards } from "@/components/coin-use-cards";
import { DambourleGachaSection } from "@/components/dambourle-gacha-section";
import { IconChevronRight, IconPaw } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { getCoinSummary } from "@/lib/data/coins";
import { getCurrentDogSkin } from "@/lib/data/dog-skin";
import { getRecordSpace } from "@/lib/data/space";
import { isDambourleGachaEnabled } from "@/lib/dambourle/feature-flag";
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
          <Link
            href="/mypage/coin-history"
            className="rough-card flex items-center gap-3 p-4 active:scale-[0.99]"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">コイン獲得履歴を見る</span>
              <span className="mt-0.5 block text-[11px] text-ink-soft">獲得・利用した理由を振り返れます</span>
            </span>
            <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
          </Link>
          <CoinUseCards balance={summary.balance} />
          {isDambourleGachaEnabled(user.email) ? <DambourleGachaSection balance={summary.balance} /> : null}
          <CoinEarnMethods />
        </div>
      </PageBody>
    </>
  );
}
