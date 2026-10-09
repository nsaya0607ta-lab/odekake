import { NextResponse } from "next/server";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

type RpcResponse = { data: unknown; error: { code?: string; message?: string } | null };

const UNAVAILABLE_CODES = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ステージのランキング（自分とフレンドだけ・置き方を最後に変えてからのプレイ） */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "ステージが見つかりませんでした。" }, { status: 400 });
  }
  const { supabase, user } = await requireUser();
  const limit = checkRateLimit(`pinball-stage-ranking:${user.id}`, 60, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "すこし時間をおいてからお試しください。" }, { status: 429 });
  }

  const rpc = supabase.rpc.bind(supabase) as unknown as (fn: "get_pinball_stage_ranking", args: { p_stage_id: string }) => Promise<RpcResponse>;
  const { data, error } = await rpc("get_pinball_stage_ranking", { p_stage_id: id });
  if (error) {
    if (error.code && UNAVAILABLE_CODES.has(error.code)) {
      return NextResponse.json({ ready: false, entries: [] }, { headers: { "Cache-Control": "no-store" } });
    }
    if (error.message?.includes("STAGE_NOT_FOUND")) {
      return NextResponse.json({ error: "このステージはもう見られません。" }, { status: 404 });
    }
    console.error("Failed to load pinball stage ranking", { code: error.code, message: error.message });
    return NextResponse.json({ error: "ランキングを読み込めませんでした。" }, { status: 500 });
  }

  const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
  const avatars = await signThumbOrOriginalPaths(
    supabase,
    rows.flatMap((row) => (typeof row.profile_image_url === "string" ? [row.profile_image_url] : [])),
  );
  return NextResponse.json(
    {
      ready: true,
      entries: rows.flatMap((row) =>
        typeof row.user_id === "string" && typeof row.best_score === "number"
          ? [
              {
                rank: Number(row.rank_position) || 0,
                userId: row.user_id,
                displayName: typeof row.display_name === "string" ? row.display_name : "ゲスト",
                avatarUrl: typeof row.profile_image_url === "string" ? avatars.get(row.profile_image_url) ?? null : null,
                score: row.best_score,
                isMe: row.is_me === true,
              },
            ]
          : [],
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
