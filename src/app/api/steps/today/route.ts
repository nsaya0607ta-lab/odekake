import { NextResponse } from "next/server";
import { ensureTodayStepCoins, getCoinSummary } from "@/lib/data/coins";
import { getExpDashboard } from "@/lib/data/exp";
import { requireUser } from "@/lib/supabase/server";

export async function GET() {
  const { supabase, user } = await requireUser();
  const dashboard = await getExpDashboard(supabase, user.id);
  const stepCoins = await ensureTodayStepCoins(supabase, user.id, dashboard.todaySteps);
  const coins = await getCoinSummary(supabase, user.id);

  return NextResponse.json(
    {
      ok: true,
      todaySteps: dashboard.todaySteps,
      todayStepExp: dashboard.todayStepExp,
      todayStepCoins: stepCoins.actualCoins ?? 0,
      expectedStepCoins: stepCoins.expectedCoins,
      coinBalance: coins.balance,
      coinRepairApplied: stepCoins.repaired,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
