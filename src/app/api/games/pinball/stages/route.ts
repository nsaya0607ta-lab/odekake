import { NextResponse } from "next/server";
import { getPinballBoughtParts } from "@/lib/data/pinball";
import { cleanStageName, ownedPinballParts, parseStageSpec, validateStage } from "@/lib/games/pinball/stage";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

type RpcResponse = { data: unknown; error: { code?: string; message: string } | null };

// ステージの仕組み（0138）がまだのときは「準備中」
const UNAVAILABLE_CODES = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function errorMessage(message: string): { text: string; status: number } {
  if (message.includes("STAGE_LIMIT")) return { text: "ステージは6つまでです。いらないステージを消してから作ってね。", status: 400 };
  if (message.includes("PARTS_SHORT")) return { text: "持っている部品より多く置いています。部品を買うか、へらしてね。", status: 400 };
  if (message.includes("STAGE_NOT_FOUND")) return { text: "このステージは見つかりませんでした。", status: 404 };
  if (message.includes("INVALID_NAME")) return { text: "名前は1〜16文字にしてね。", status: 400 };
  return { text: "保存できませんでした。", status: 400 };
}

/**
 * ステージを保存する（id が無ければ新しく作る）。部品の置き方（すき間など）はここで確かめる（validateStage）。
 * 持っている部品の数・1人6つまでは、DB（save_pinball_stage）も確かめる
 */
export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  const body = toRecord(await request.json().catch(() => null));
  const id = body.id === null || body.id === undefined ? null : typeof body.id === "string" && UUID_RE.test(body.id) ? body.id : undefined;
  const name = cleanStageName(body.name);
  const spec = parseStageSpec(body.spec);
  if (id === undefined || !spec) {
    return NextResponse.json({ error: "ステージのデータが正しくありません。" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "名前は1〜16文字にしてね。" }, { status: 400 });
  }

  const limit = checkRateLimit(`pinball-stage-save:${user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "すこし時間をおいてからお試しください。" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const bought = await getPinballBoughtParts(supabase, user.id);
  if (bought === null) {
    return NextResponse.json({ error: "ステージ作りは準備中です。" }, { status: 503 });
  }
  const issues = validateStage(spec, ownedPinballParts(bought));
  if (issues.length) {
    return NextResponse.json({ error: issues[0]!.message, issues: issues.map((i) => i.message) }, { status: 400 });
  }

  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: "save_pinball_stage",
    args: { p_id: string | null; p_name: string; p_spec: unknown; p_shared: boolean },
  ) => Promise<RpcResponse>;
  const { data, error } = await rpc("save_pinball_stage", { p_id: id, p_name: name, p_spec: spec, p_shared: body.shared === true });
  if (error) {
    if (error.code && UNAVAILABLE_CODES.has(error.code)) {
      return NextResponse.json({ error: "ステージ作りは準備中です。" }, { status: 503 });
    }
    const { text, status } = errorMessage(error.message);
    if (status === 400 && text === "保存できませんでした。") console.error("Failed to save pinball stage", { code: error.code, message: error.message });
    return NextResponse.json({ error: text }, { status });
  }

  const result = toRecord(data);
  return NextResponse.json(
    {
      ok: true,
      id: typeof result.id === "string" ? result.id : null,
      layoutChanged: result.layout_changed === true,
      updatedAt: typeof result.updated_at === "string" ? result.updated_at : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** ステージを消す（自分のものだけ）。遊んだ記録はのこる */
export async function DELETE(request: Request) {
  const { supabase, user } = await requireUser();
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "ステージが見つかりませんでした。" }, { status: 400 });
  }
  const limit = checkRateLimit(`pinball-stage-save:${user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "すこし時間をおいてからお試しください。" }, { status: 429 });
  }
  const rpc = supabase.rpc.bind(supabase) as unknown as (fn: "delete_pinball_stage", args: { p_id: string }) => Promise<RpcResponse>;
  const { error } = await rpc("delete_pinball_stage", { p_id: id });
  if (error) {
    const { text, status } = errorMessage(error.message);
    return NextResponse.json({ error: text === "保存できませんでした。" ? "消せませんでした。" : text }, { status });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
