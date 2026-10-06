import { NextResponse } from "next/server";
import { APP_BACKGROUND_COOKIE, getAppBackground, isAppBackgroundId } from "@/lib/app-backgrounds";
import { checkRateLimit } from "@/lib/rate-limit";
import { canAccessShop } from "@/lib/shop-access";
import { requireUser } from "@/lib/supabase/server";

type RpcResponse = { data: unknown; error: { code?: string; message: string } | null };
type Rpc = (fn: "buy_app_background" | "set_app_background", args: { p_background: string }) => Promise<RpcResponse>;

const SHOP_CLOSED = () => NextResponse.json({ error: "ショップは準備中です。" }, { status: 403 });

const toRecord = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});

async function readBackgroundId(request: Request) {
  const body = (await request.json().catch(() => null)) as { background?: unknown } | null;
  return isAppBackgroundId(body?.background) ? body.background : null;
}

/** ショップの背景を1つ、青コインで買う */
export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!canAccessShop(user.displayName)) return SHOP_CLOSED();
  const id = await readBackgroundId(request);
  if (!id || id === "default") {
    return NextResponse.json({ error: "その背景はありません。" }, { status: 400 });
  }
  const limit = checkRateLimit(`app-background-buy:${user.id}`, 30, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "すこし時間をおいてからお試しください。" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }

  const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;
  const { data, error } = await rpc("buy_app_background", { p_background: id });
  if (error) {
    const bg = getAppBackground(id);
    if (error.message.includes("BLUE_COINS_SHORT")) return NextResponse.json({ error: `青コインが足りません（${bg.name}は${bg.price.toLocaleString()}枚）。` }, { status: 400 });
    if (error.message.includes("BACKGROUND_OWNED")) return NextResponse.json({ error: "もう持っています。" }, { status: 400 });
    if (error.message.includes("INVALID_BACKGROUND")) {
      console.error("App background price is missing in the database (apply the latest app_background migration)", { id });
      return NextResponse.json({ error: "この背景はまだ準備中です。少し待ってからお試しください。" }, { status: 400 });
    }
    console.error("Failed to buy app background", { code: error.code, message: error.message });
    return NextResponse.json({ error: "買えませんでした。時間をおいてお試しください。" }, { status: 400 });
  }
  const result = toRecord(data);
  return NextResponse.json(
    { ok: true, background: id, balance: typeof result.balance === "number" ? result.balance : 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** 使う背景を選ぶ（「いつもの」か、買った背景だけ） */
export async function PATCH(request: Request) {
  const { supabase, user } = await requireUser();
  if (!canAccessShop(user.displayName)) return SHOP_CLOSED();
  const id = await readBackgroundId(request);
  if (!id) {
    return NextResponse.json({ error: "その背景はありません。" }, { status: 400 });
  }

  const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;
  const { error } = await rpc("set_app_background", { p_background: id });
  if (error) {
    if (error.message.includes("BACKGROUND_NOT_OWNED")) return NextResponse.json({ error: "この背景はまだ買っていません。" }, { status: 403 });
    console.error("Failed to set app background", { code: error.code, message: error.message });
    return NextResponse.json({ error: "背景を変えられませんでした。時間をおいてお試しください。" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, background: id }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(APP_BACKGROUND_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
