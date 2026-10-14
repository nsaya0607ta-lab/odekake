import { NextResponse } from "next/server";
import { z } from "zod";
import { decodeTownSnapshot, getTownSnapshot, townRpc } from "@/lib/data/town-builder";
import { createTown, decodeTown } from "@/lib/games/town-builder";
import { canSeeTownBuilder } from "@/lib/games/town-builder-access";
import { applyTownCommand, townCommandSchema } from "@/lib/games/town-commands";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

const noStore = { "Cache-Control": "no-store" };
const envelope = z.object({ userId: z.string().uuid(), requestId: z.string().uuid(), revision: z.number().int().min(0).max(2_000_000_000), action: z.enum(["start", "edit", "undo", "quest", "daily", "reset"]), command: townCommandSchema.optional(), questId: z.string().max(40).optional(), starter: z.boolean().optional(), legacy: z.unknown().optional() });
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });

export async function GET(request: Request) {
  const { supabase, user } = await requireUser();
  if (!(await canSeeTownBuilder(user.displayName, supabase))) return fail("見つかりません", 404);
  if (new URL(request.url).searchParams.get("account") !== user.id) return fail("アカウントが変わりました。街の画面を開き直してください。", 403);
  const snapshot = await getTownSnapshot(supabase);
  return snapshot ? NextResponse.json({ snapshot }, { headers: noStore }) : fail("街のデータに接続できません。時間をおいて再試行してください。", 503);
}
export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!(await canSeeTownBuilder(user.displayName, supabase))) return fail("見つかりません", 404);
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return fail("この操作を受け付けられません。", 403);
  const limit = checkRateLimit(`town:${user.id}`, 90, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "少し待ってから操作してください。" }, { status: 429, headers: { ...noStore, "Retry-After": String(limit.retryAfterSeconds) } });
  if (Number(request.headers.get("content-length")) > 160_000) return fail("データが大きすぎます。", 413);
  const raw = await request.text();
  if (raw.length > 160_000) return fail("データが大きすぎます。", 413);
  let input: unknown;
  try { input = JSON.parse(raw); } catch { return fail("操作を読み取れませんでした。", 400); }
  const parsed = envelope.safeParse(input);
  if (!parsed.success) return fail("操作を確認できませんでした。", 400);
  const p = parsed.data;
  if (p.userId !== user.id) return fail("アカウントが変わりました。街の画面を開き直してください。", 403);
  const current = await getTownSnapshot(supabase);
  if (!current) return fail("街のデータに接続できません。再試行してください。", 503);
  // Replays still reach the database: it checks the receipt before checking revision.
  let next = current.town, message = "保存しました", lotId: number | undefined;
  if (p.action === "start") {
    const legacy = p.legacy === undefined ? null : decodeTown(JSON.stringify(p.legacy));
    if (p.legacy !== undefined && !legacy) return fail("以前の街を読み取れませんでした。端末の保存データは残っています。", 400);
    next = legacy ?? createTown(p.starter !== false);
    message = legacy ? "街を引き継ぎました。白コインで街を育てよう！" : "開拓の冒険をはじめよう！";
  } else if (p.action === "reset") {
    next = createTown(p.starter !== false); message = "新しい街をはじめました。白コインと経験値は引き継ぎます。";
  } else if (p.action === "edit") {
    if (!current.town || !p.command) return fail("街と工事を確認できませんでした。", 400);
    if (p.revision === current.revision) {
      const before = { ...current.town, money: current.balance };
      const result = applyTownCommand(before, p.command);
      if (result.town === before) return fail(result.message.replaceAll("資金", "白コイン"), 400);
      next = result.town; message = result.message.replaceAll("¥", "白コイン "); lotId = result.lotId;
    }
  } else if (p.action === "undo") message = "工事を取り消しました。白コインを戻しました。";
  else if (p.action === "quest") message = "クエスト達成！報酬を受け取りました。";
  else if (p.action === "daily") message = "今日の白コインを受け取りました。";
  const { data, error } = await townRpc(supabase, "commit_town_builder", { p_request_id: p.requestId, p_revision: p.revision, p_action: p.action, p_town: next, p_quest: p.questId ?? null, p_import: p.action === "start" && p.legacy !== undefined });
  if (error) {
    const messages: Record<string, [string, number]> = {
      WHITE_COINS_SHORT: ["白コインが足りません。クエストや毎日のログインで集めよう。", 400],
      TOWN_CONFLICT: ["別の画面で街が更新されました。最新の街を読み込みます。", 409],
      TOWN_QUEST_NOT_READY: ["クエストの条件を確認してください。", 400],
      TOWN_UNDO_EMPTY: ["取り消せる工事がありません。", 400],
      TOWN_NOT_ALLOWED: ["見つかりません", 404],
      TOWN_ALREADY_STARTED: ["保存済みの街を読み込みます。", 409],
      TOWN_HOME_LIMIT: ["マイホームは1軒だけ建てられます。", 400],
      TOWN_ROAD_REQUIRED: ["道路の隣に建ててください。", 400],
      INVALID_TOWN: ["この工事は保存できませんでした。街を読み込み直してから、もう一度お試しください。", 400],
    };
    const known = messages[error.message];
    if (!known) console.error("Town operation failed", { code: error.code, message: error.message });
    return fail(known?.[0] ?? "保存を確認できませんでした。同じ操作を再試行できます。", known?.[1] ?? 503);
  }
  const snapshot = decodeTownSnapshot(data);
  if (!snapshot) return fail("保存結果を確認できませんでした。同じ操作を再試行してください。", 503);
  return NextResponse.json({ snapshot, message, lotId }, { headers: noStore });
}
