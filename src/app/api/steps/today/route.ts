import { NextResponse } from "next/server";
import { getCoinSummary } from "@/lib/data/coins";
import { getExpDashboard } from "@/lib/data/exp";
import { requireUser } from "@/lib/supabase/server";

export async function GET() {
  const { supabase, user } = await requireUser();
  const [dashboard, coins] = await Promise.all([
    getExpDashboard(supabase, user.id),
    getCoinSummary(supabase, user.id),
  ]);

  return NextResponse.json(
    {
      ok: true,
      todaySteps: dashboard.todaySteps,
      todayStepExp: dashboard.todayStepExp,
      coinBalance: coins.balance,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
