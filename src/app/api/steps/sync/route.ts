import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { todayInJapan } from "@/lib/date";
import { requireSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/types";

const bodySchema = z.object({
  steps: z.number().int().min(0).max(200000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";

  if (!tokenPattern.test(token)) {
    return NextResponse.json({ ok: false, error: "連携キーが正しくありません。" }, { status: 401 });
  }

  let input: z.infer<typeof bodySchema>;
  try {
    input = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { ok: false, error: "steps は0〜200000の整数で送信してください。" },
      { status: 400 },
    );
  }

  const { url, anonKey } = requireSupabaseEnv();
  const supabase = createSupabaseClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const stepDate = input.date ?? todayInJapan();

  const { data: earnedExp, error } = await supabase.rpc("record_daily_steps_with_token", {
    p_token: token,
    p_step_date: stepDate,
    p_steps: input.steps,
  });

  if (error) {
    const invalidToken = /invalid sync token/i.test(error.message);
    console.warn("Shortcut step sync failed", { code: error.code, message: error.message });
    return NextResponse.json(
      { ok: false, error: invalidToken ? "連携キーが無効です。再発行してください。" : "歩数を保存できませんでした。" },
      { status: invalidToken ? 401 : 400 },
    );
  }

  return NextResponse.json(
    { ok: true, date: stepDate, steps: input.steps, earnedExp: earnedExp ?? 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
