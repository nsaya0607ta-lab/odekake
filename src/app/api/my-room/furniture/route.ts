import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { FURNITURE, isFurnitureId } from "@/lib/room/types";
import { requireUser } from "@/lib/supabase/server";

type RpcResponse = { data: unknown; error: { code?: string; message: string } | null };

const toRecord = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});

/** わんこのおへやの家具を1こ、青コインで買う */
export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  const body = (await request.json().catch(() => null)) as { furniture?: unknown } | null;
  if (!isFurnitureId(body?.furniture)) {
    return NextResponse.json({ error: "その家具はありません。" }, { status: 400 });
  }
  const limit = checkRateLimit(`room-furniture:${user.id}`, 60, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "すこし時間をおいてからお試しください。" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }

  const rpc = supabase.rpc.bind(supabase) as unknown as (fn: "buy_room_furniture", args: { p_furniture: string }) => Promise<RpcResponse>;
  const { data, error } = await rpc("buy_room_furniture", { p_furniture: body.furniture });
  if (error) {
    const name = FURNITURE[body.furniture].name;
    if (error.message.includes("BLUE_COINS_SHORT")) return NextResponse.json({ error: `青コインが足りません（${name}は${FURNITURE[body.furniture].price.toLocaleString()}枚）。` }, { status: 400 });
    if (error.message.includes("FURNITURE_LIMIT")) return NextResponse.json({ error: `${name}は2こまでです。` }, { status: 400 });
    console.error("Failed to buy room furniture", { code: error.code, message: error.message });
    return NextResponse.json({ error: "買えませんでした。時間をおいてお試しください。" }, { status: 400 });
  }
  const result = toRecord(data);
  return NextResponse.json(
    { ok: true, furniture: body.furniture, owned: typeof result.owned === "number" ? result.owned : 0, balance: typeof result.balance === "number" ? result.balance : 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
