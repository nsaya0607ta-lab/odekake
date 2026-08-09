import { todayInJapan } from "@/lib/date";
import type { ExpEventRow } from "@/lib/supabase/types";
import type { DB } from "./client";

export type ExpDashboard = {
  totalExp: number;
  todaySteps: number | null;
  todayStepExp: number;
};

function japanDateFromIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function getExpDashboard(supabase: DB, userId: string): Promise<ExpDashboard> {
  const today = todayInJapan();
  const [totalResult, stepsResult, latestStepsResult] = await Promise.all([
    supabase.from("user_exp").select("total_exp").eq("user_id", userId).maybeSingle(),
    supabase
      .from("daily_steps")
      .select("steps, earned_exp, step_date, updated_at")
      .eq("user_id", userId)
      .eq("step_date", today)
      .maybeSingle(),
    supabase
      .from("daily_steps")
      .select("steps, earned_exp, step_date, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
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
  if (latestStepsResult.error) {
    console.warn("Latest daily steps are unavailable", {
      code: latestStepsResult.error.code,
      message: latestStepsResult.error.message,
    });
  }

  // 通常は step_date が日本時間の今日と一致する行を使う。
  // ショートカット同期直後に日付境界や過去デプロイの時刻処理で step_date がずれていても、
  // 「日本時間の今日に実際に更新された最新行」なら今日の同期結果として表示する。
  const latest = latestStepsResult.data;
  const latestWasUpdatedToday = japanDateFromIso(latest?.updated_at) === today;
  const stepRow = stepsResult.data ?? (latestWasUpdatedToday ? latest : null);

  if (!stepsResult.data && stepRow) {
    console.info("Using latest same-day step sync as dashboard fallback", {
      storedStepDate: stepRow.step_date,
      today,
    });
  }

  return {
    totalExp: totalResult.data?.total_exp ?? 0,
    todaySteps: stepRow?.steps ?? null,
    todayStepExp: stepRow?.earned_exp ?? 0,
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
