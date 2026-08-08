import { todayInJapan } from "@/lib/date";
import type { ExpEventRow } from "@/lib/supabase/types";
import type { DB } from "./client";

export type ExpDashboard = {
  totalExp: number;
  todaySteps: number | null;
  todayStepExp: number;
};

export async function getExpDashboard(supabase: DB, userId: string): Promise<ExpDashboard> {
  const today = todayInJapan();
  const [totalResult, stepsResult] = await Promise.all([
    supabase.from("user_exp").select("total_exp").eq("user_id", userId).maybeSingle(),
    supabase
      .from("daily_steps")
      .select("steps, earned_exp")
      .eq("user_id", userId)
      .eq("step_date", today)
      .maybeSingle(),
  ]);

  // マイグレーション適用前の短い移行時間にもホーム全体を落とさない。
  if (totalResult.error) {
    console.warn("EXP summary is unavailable", {
      code: totalResult.error.code,
      message: totalResult.error.message,
    });
  }
  if (stepsResult.error) {
    console.warn("Daily steps are unavailable", {
      code: stepsResult.error.code,
      message: stepsResult.error.message,
    });
  }

  return {
    totalExp: totalResult.data?.total_exp ?? 0,
    todaySteps: stepsResult.data?.steps ?? null,
    todayStepExp: stepsResult.data?.earned_exp ?? 0,
  };
}

export async function getExpHistory(supabase: DB, userId: string, limit = 100): Promise<ExpEventRow[]> {
  const { data, error } = await supabase
    .from("exp_events")
    .select("*")
    .eq("user_id", userId)
    .gt("exp", 0)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to load EXP history", { code: error.code, message: error.message });
    return [];
  }
  return data ?? [];
}

