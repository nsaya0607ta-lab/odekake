import { NextResponse } from "next/server";
import { getExpDashboard } from "@/lib/data/exp";
import { requireUser } from "@/lib/supabase/server";

export async function GET() {
  const { supabase, user } = await requireUser();
  const dashboard = await getExpDashboard(supabase, user.id);

  return NextResponse.json(
    {
      ok: true,
      todaySteps: dashboard.todaySteps,
      todayStepExp: dashboard.todayStepExp,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
