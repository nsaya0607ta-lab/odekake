import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (error || !userId) return null;
  return supabase;
}

export async function POST() {
  const supabase = await authenticatedClient();
  if (!supabase) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });

  const { data: token, error } = await supabase.rpc("create_steps_sync_token");
  if (error || !token) {
    console.error("Failed to create shortcut sync token", { code: error?.code, message: error?.message });
    return NextResponse.json({ error: "連携キーを発行できませんでした。" }, { status: 500 });
  }

  return NextResponse.json(
    { token },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE() {
  const supabase = await authenticatedClient();
  if (!supabase) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });

  const { error } = await supabase.rpc("revoke_steps_sync_token");
  if (error) {
    console.error("Failed to revoke shortcut sync token", { code: error.code, message: error.message });
    return NextResponse.json({ error: "連携を解除できませんでした。" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
