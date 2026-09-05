import { NextResponse } from "next/server";
import { DAMBOURLE_PLANS, isDambourlePlanId } from "@/lib/dambourle/config";
import { drawDambourlePrizes } from "@/lib/dambourle/draw";
import { getDambourlePrize } from "@/lib/dambourle/prizes";
import { getDambourleLevel } from "@/lib/dambourle/skill-levels";
import { getOwnedDambourleCounts } from "@/lib/data/dambourle";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

type DrawResult = {
  id: string;
  name: string;
  rarity: string;
  isNew: boolean;
  previousLevel: number;
  newLevel: number;
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();

  const body = (await request.json().catch(() => null)) as {
    plan?: unknown;
    requestId?: unknown;
  } | null;

  if (!body || !isDambourlePlanId(body.plan)) {
    return NextResponse.json({ error: "ガチャの種類が正しくありません。" }, { status: 400 });
  }
  if (typeof body.requestId !== "string" || body.requestId.length < 8 || body.requestId.length > 100) {
    return NextResponse.json({ error: "リクエストが正しくありません。" }, { status: 400 });
  }

  const plan = DAMBOURLE_PLANS[body.plan];

  const limit = checkRateLimit(`dambourle-gacha:${user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "すこし時間をおいてからお試しください。" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const drawn = drawDambourlePrizes(plan.draws);
  if (drawn.length !== plan.draws) {
    console.error("Dambourle prize pool is empty", { plan: body.plan, drawn: drawn.length });
    return NextResponse.json({ error: "ただいまガチャを準備中です。" }, { status: 503 });
  }

  const priorCounts = await getOwnedDambourleCounts(supabase, user.id);

  const { data, error } = await supabase.rpc("commit_dambourle_draw", {
    p_cost: plan.cost,
    p_request_id: body.requestId,
    p_item_ids: drawn.map((prize) => prize.id),
  });

  if (error) {
    console.error("Failed to commit dambourle draw", { code: error.code, message: error.message });
    return NextResponse.json({ error: "ガチャをまわせませんでした。" }, { status: 500 });
  }

  const result = toRecord(data);
  if (result.ok !== true) {
    if (result.reason === "insufficient_coins") {
      return NextResponse.json(
        { error: "コインが足りません", balance: Number(result.balance ?? 0) },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "ガチャをまわせませんでした。" }, { status: 400 });
  }

  const grantedIds = toStringArray(result.item_ids);
  const newIds = new Set(toStringArray(result.new_item_ids));

  const runningCounts = new Map(priorCounts);
  const results: DrawResult[] = grantedIds.map((id) => {
    const prize = getDambourlePrize(id);
    const rarity = prize?.rarity ?? "SSR";
    const previousCount = runningCounts.get(id) ?? 0;
    const newCount = previousCount + 1;
    runningCounts.set(id, newCount);
    return {
      id,
      name: prize?.name ?? id,
      rarity,
      isNew: newIds.has(id),
      previousLevel: previousCount > 0 ? getDambourleLevel(rarity, previousCount) : 0,
      newLevel: getDambourleLevel(rarity, newCount),
    };
  });

  return NextResponse.json(
    { results, balance: Number(result.balance ?? 0), duplicateCoins: Number(result.duplicate_coins ?? 0) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
