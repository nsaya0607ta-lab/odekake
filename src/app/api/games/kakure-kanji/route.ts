import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { decodeKanjiSnapshot, getKanjiSnapshot, kanjiRpc } from "@/lib/data/kakure-kanji";
import { actionSchema, applyKanjiAction } from "@/lib/games/kakure-kanji/actions";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store" };
const envelope = z.object({ userId: z.string().uuid(), requestId: z.string().uuid(), revision: z.number().int().min(0).max(2_000_000_000), action: actionSchema });
const fail = (error: string, status: number, snapshot?: unknown) => NextResponse.json({ error, snapshot }, { status, headers });
export async function GET(request: Request) {
  const { supabase, user } = await requireUser();
  if (new URL(request.url).searchParams.get("account") !== user.id) return fail("アカウントが変わりました。開き直してください。", 403);
  const snapshot = await getKanjiSnapshot(supabase, user.id).catch(() => null);
  return snapshot ? NextResponse.json({ snapshot }, { headers }) : fail("青コインと記録を読み込めませんでした。再試行してください。", 503);
}
export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return fail("この操作を受け付けられません。", 403);
  const limit = checkRateLimit(`kakure-kanji:${user.id}`, 180, 60_000);
  if (!limit.allowed) return fail("少し待ってから操作してください。", 429);
  if (Number(request.headers.get("content-length")) > 160_000) return fail("記録が大きすぎます。", 413);
  const text = await request.text();
  if (text.length > 160_000) return fail("記録が大きすぎます。", 413);
  let raw: unknown; try { raw = JSON.parse(text); } catch { return fail("操作を読み取れませんでした。", 400); }
  const parsed = envelope.safeParse(raw);
  if (!parsed.success) return fail("操作を確認できませんでした。", 400);
  const p = parsed.data;
  if (p.userId !== user.id) return fail("アカウントが変わりました。開き直してください。", 403);
  const snapshot = await getKanjiSnapshot(supabase, user.id).catch(() => null);
  if (!snapshot) return fail("青コインと記録を読み込めませんでした。", 503);
  // 返事を受け取れず同じ操作を再送したときも、保存済みの結果を返す。
  const receipt = await kanjiRpc(supabase, "get_kakure_kanji_receipt", { p_request_id: p.requestId });
  if (receipt.error) return fail("保存を確認できませんでした。同じ操作を再試行できます。", 503);
  if (receipt.data) return NextResponse.json({ snapshot, event: receipt.data, replayed: true }, { headers });
  if (snapshot.revision !== p.revision) return fail("別の画面で更新されました。最新の記録に切り替えました。", 409, snapshot);
  const secret = process.env.KAKURE_KANJI_WALLET_SECRET;
  if (!secret) return fail("青コインに接続できません。時間をおいて再試行してください。", 503);
  let result: ReturnType<typeof applyKanjiAction>;
  try { result = applyKanjiAction(snapshot.save, snapshot.balance, p.action, Date.now()); } catch (error) { return fail(error instanceof Error ? error.message : "操作を確認できませんでした。", 400, snapshot); }
  const payload = JSON.stringify({ userId: user.id, requestId: p.requestId, revision: p.revision, delta: result.delta, save: result.save, event: result.event, keyId: process.env.VERCEL_ENV === "production" ? "production" : "preview" });
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  const committed = await kanjiRpc(supabase, "commit_kakure_kanji", { p_payload: payload, p_signature: signature });
  if (committed.error) {
    const conflict = ["KANJI_CONFLICT", "BLUE_COINS_SHORT"].includes(committed.error.message);
    if (!conflict) console.error("Kanji save failed", { code: committed.error.code, message: committed.error.message });
    return fail(committed.error.message === "BLUE_COINS_SHORT" ? "青コインが足りません。残高を更新しました。" : conflict ? "別の画面で更新されました。もう一度操作してください。" : "保存できませんでした。同じ操作を再試行できます。", conflict ? 409 : 503, conflict ? await getKanjiSnapshot(supabase, user.id).catch(() => null) : undefined);
  }
  const value = committed.data as { snapshot?: unknown; event?: unknown; replayed?: boolean } | null;
  const next = decodeKanjiSnapshot(value?.snapshot);
  return next ? NextResponse.json({ snapshot: next, event: value?.event ?? {}, replayed: value?.replayed === true }, { headers }) : fail("保存結果を確認できませんでした。同じ操作を再試行してください。", 503);
}
