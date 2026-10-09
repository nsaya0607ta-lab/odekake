import { NextResponse } from "next/server";
import { MAX_SCORE, MAX_SCORE_PER_SECOND } from "@/lib/games/pinball/config";
import { resolvePinballMapId } from "@/lib/games/pinball/maps";
import { STAGE_TABLE_ID } from "@/lib/games/pinball/stage";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

type RpcResponse = { data: unknown; error: { code?: string; message: string } | null };

// マイグレーション（0134）がまだのときは、エラーではなく「準備中」として返す
const UNAVAILABLE_CODES = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);

function int(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ご当地ピンボールの1プレイの結果を記録し、赤コインを受け取る。
 * 物理はブラウザで動くので、ここでは「ありえる値か」と「ある台（マップ）か」を確かめる
 * （スコアのわりに短すぎる時間・知らない台はうけつけない。マップはだれでも遊べる）。赤コインの枚数はサーバーで決める。
 * 自分で作るステージのプレイは stageId をつけて送る（遊べるステージか＝自分のものかフレンドが公開したものかは DB が確かめる）。
 */
export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  const body = toRecord(await request.json().catch(() => null));

  const roundId = typeof body.roundId === "string" && body.roundId.length >= 8 && body.roundId.length <= 100 ? body.roundId : null;
  const stageId = typeof body.stageId === "string" && UUID_RE.test(body.stageId) ? body.stageId : null;
  // 前の「県の台」（都道府県コード）は、同じ形のいつもの台として記録する（古い画面から送られてきたとき）
  const table = stageId ? STAGE_TABLE_ID : typeof body.table === "string" ? resolvePinballMapId(body.table) : null;
  const score = int(body.score, 0, MAX_SCORE);
  const durationMs = int(body.durationMs, 0, 3 * 60 * 60 * 1000);
  const items = int(body.items, 0, 10000);
  const conquests = int(body.conquests, 0, 1000);
  const jackpots = int(body.jackpots, 0, 10000);
  const maxCombo = int(body.maxCombo, 0, 100);
  if (!roundId || !table || score === null || durationMs === null || items === null || conquests === null || jackpots === null || maxCombo === null) {
    return NextResponse.json({ error: "ゲーム結果が正しくありません。" }, { status: 400 });
  }
  if (score > (Math.floor(durationMs / 1000) + 30) * MAX_SCORE_PER_SECOND) {
    return NextResponse.json({ error: "ゲーム結果が正しくありません。" }, { status: 400 });
  }

  // 1ゲーム1〜数分。直接 API を連打して赤コインを稼がれないようにする
  const limit = checkRateLimit(`pinball:${user.id}`, 40, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "すこし時間をおいてからお試しください。" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: "record_pinball_result",
    args: {
      p_round_id: string;
      p_table: string;
      p_score: number;
      p_duration_ms: number;
      p_items: number;
      p_conquests: number;
      p_jackpots: number;
      p_max_combo: number;
      p_stage_id?: string;
    },
  ) => Promise<RpcResponse>;

  const { data, error } = await rpc("record_pinball_result", {
    p_round_id: roundId,
    p_table: table,
    p_score: score,
    p_duration_ms: durationMs,
    p_items: items,
    p_conquests: conquests,
    p_jackpots: jackpots,
    p_max_combo: maxCombo,
    // マップのプレイは、ステージの番号をつけない（0138 より前の関数でも、そのまま記録できるように）
    ...(stageId ? { p_stage_id: stageId } : {}),
  });

  if (error) {
    // マップの記録を受けつけるマイグレーション（0137）・ステージの記録（0138）がまだのとき、記録は INVALID_TABLE か
    // 「関数が無い」になる。そのときも「準備中」として返す（遊べて、スコアは画面に出る）
    if ((error.code && UNAVAILABLE_CODES.has(error.code)) || error.message.includes("INVALID_TABLE")) {
      return NextResponse.json({ ok: true, ready: false }, { headers: { "Cache-Control": "no-store" } });
    }
    if (error.message.includes("TOO_MANY_ROUNDS")) {
      return NextResponse.json({ error: "すこし時間をおいてからお試しください。" }, { status: 429 });
    }
    if (error.message.includes("STAGE_NOT_FOUND")) {
      return NextResponse.json({ error: "このステージはもう遊べません（消されたか、公開をやめたようです）。" }, { status: 404 });
    }
    console.error("Failed to record pinball result", { code: error.code, message: error.message });
    return NextResponse.json({ error: "記録できませんでした。" }, { status: 400 });
  }

  const result = toRecord(data);
  return NextResponse.json(
    {
      ok: true,
      ready: true,
      applied: result.applied === true,
      // もらったコインの色（0138 から赤。それより前の DB は青コインで、kind を返さない）
      kind: result.kind === "red" ? "red" : "blue",
      coins: typeof result.coins === "number" ? result.coins : 0,
      balance: typeof result.balance === "number" ? result.balance : 0,
      best: typeof result.best === "number" ? result.best : score,
      isBest: result.is_best === true,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
