import { NextResponse } from "next/server";
import { getPinballPart } from "@/lib/games/pinball/stage";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

type RpcResponse = { data: unknown; error: { code?: string; message: string } | null };

// 部品の仕組み（0138）がまだのときは「準備中」
const UNAVAILABLE_CODES = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/**
 * ご当地ピンボールのステージの部品を、赤コインで1回ぶん買う（くぎは10本ずつ）。
 * 値段・持てる数・残高は DB（buy_pinball_part）が決めて確かめる。ここはむだな呼び出しを間引くだけ。
 */
export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  const body = toRecord(await request.json().catch(() => null));
  const part = typeof body.part === "string" ? getPinballPart(body.part) : null;
  if (!part) {
    return NextResponse.json({ error: "その部品はありません。" }, { status: 400 });
  }

  const limit = checkRateLimit(`pinball-parts:${user.id}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "すこし時間をおいてからお試しください。" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const rpc = supabase.rpc.bind(supabase) as unknown as (fn: "buy_pinball_part", args: { p_part: string }) => Promise<RpcResponse>;
  const { data, error } = await rpc("buy_pinball_part", { p_part: part.id });
  if (error) {
    if (error.code && UNAVAILABLE_CODES.has(error.code)) {
      return NextResponse.json({ error: "部品のお店は準備中です。" }, { status: 503 });
    }
    if (error.message.includes("RED_COINS_SHORT")) {
      return NextResponse.json({ error: "赤コインが足りません。" }, { status: 400 });
    }
    if (error.message.includes("PART_LIMIT")) {
      return NextResponse.json({ error: `${part.name}は、もうこれ以上持てません。` }, { status: 400 });
    }
    console.error("Failed to buy pinball part", { code: error.code, message: error.message });
    return NextResponse.json({ error: "買えませんでした。" }, { status: 400 });
  }

  const result = toRecord(data);
  return NextResponse.json(
    {
      ok: true,
      part: part.id,
      owned: typeof result.owned === "number" ? result.owned : null,
      balance: typeof result.balance === "number" ? result.balance : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
