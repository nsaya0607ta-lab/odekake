import { NextResponse } from "next/server";
import { HOME_SKIN_THEME_INFO, isHomeSkinPart, isHomeSkinTheme, normalizeHomeSkins } from "@/lib/home-skins";
import { checkRateLimit } from "@/lib/rate-limit";
import { canAccessShop } from "@/lib/shop-access";
import { requireUser } from "@/lib/supabase/server";

type RpcResponse = { data: unknown; error: { code?: string; message: string } | null };
type Rpc = {
  (fn: "buy_home_skins", args: { p_theme: string; p_parts: string[] }): Promise<RpcResponse>;
  (fn: "set_home_skins", args: { p_skins: Record<string, string> }): Promise<RpcResponse>;
};

const SHOP_CLOSED = () => NextResponse.json({ error: "ショップは準備中です。" }, { status: 403 });
const toRecord = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});

/** カードの絵がらを買う（{ theme, parts: [...] }。2枚以上まとめると2割引） */
export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!canAccessShop(user.displayName)) return SHOP_CLOSED();
  const body = toRecord(await request.json().catch(() => null));
  const theme = body.theme;
  const parts = Array.isArray(body.parts) ? [...new Set(body.parts.filter(isHomeSkinPart))] : [];
  if (!isHomeSkinTheme(theme) || theme === "default" || parts.length === 0) {
    return NextResponse.json({ error: "そのカードはありません。" }, { status: 400 });
  }
  const limit = checkRateLimit(`home-skin-buy:${user.id}`, 30, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "すこし時間をおいてからお試しください。" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }

  const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;
  const { data, error } = await rpc("buy_home_skins", { p_theme: theme, p_parts: parts });
  if (error) {
    if (error.message.includes("BLUE_COINS_SHORT")) return NextResponse.json({ error: `青コインが足りません（${HOME_SKIN_THEME_INFO[theme].name}のカード）。` }, { status: 400 });
    if (error.message.includes("HOME_SKIN_OWNED")) return NextResponse.json({ error: "もう持っています。" }, { status: 400 });
    if (error.message.includes("INVALID_HOME_SKIN") || error.code === "PGRST202" || error.code === "42883") {
      console.error("Home skin purchase is not ready in the database (apply 0132)", { code: error.code, message: error.message });
      return NextResponse.json({ error: "このカードはまだ準備中です。少し待ってからお試しください。" }, { status: 400 });
    }
    console.error("Failed to buy home skins", { code: error.code, message: error.message });
    return NextResponse.json({ error: "買えませんでした。時間をおいてお試しください。" }, { status: 400 });
  }
  const result = toRecord(data);
  return NextResponse.json(
    {
      ok: true,
      theme,
      bought: Array.isArray(result.bought) ? result.bought.filter(isHomeSkinPart) : parts,
      balance: typeof result.balance === "number" ? result.balance : 0,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** 使う絵がらを決める（{ scene: "winter", notice: "default", ... }） */
export async function PATCH(request: Request) {
  const { supabase, user } = await requireUser();
  if (!canAccessShop(user.displayName)) return SHOP_CLOSED();
  const skins = normalizeHomeSkins(await request.json().catch(() => null));

  const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;
  const { error } = await rpc("set_home_skins", { p_skins: skins });
  if (error) {
    if (error.message.includes("HOME_SKIN_NOT_OWNED")) return NextResponse.json({ error: "まだ買っていないカードがあります。" }, { status: 403 });
    console.error("Failed to set home skins", { code: error.code, message: error.message });
    return NextResponse.json({ error: "カードを変えられませんでした。時間をおいてお試しください。" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, skins }, { headers: { "Cache-Control": "no-store" } });
}
