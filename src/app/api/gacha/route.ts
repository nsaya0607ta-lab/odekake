import { NextResponse } from "next/server";
import { GACHA_HUNDRED_RARITY_RATES, GACHA_PLANS, isGachaPlanId } from "@/lib/gacha/config";
import { drawPrizes } from "@/lib/gacha/draw";
import { getPrize } from "@/lib/gacha/prizes";
import { getSkillLevel } from "@/lib/gacha/skill-levels";
import { getOwnedItemCounts } from "@/lib/data/collection";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

type DrawResult = {
  id: string;
  name: string;
  rarity: string;
  type: string;
  image: string | null;
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

  if (!body || !isGachaPlanId(body.plan)) {
    return NextResponse.json({ error: "ガチャの種類が正しくありません。" }, { status: 400 });
  }
  if (typeof body.requestId !== "string" || body.requestId.length < 8 || body.requestId.length > 100) {
    return NextResponse.json({ error: "リクエストが正しくありません。" }, { status: 400 });
  }

  const plan = GACHA_PLANS[body.plan];

  const limit = checkRateLimit(`gacha:${user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "すこし時間をおいてからお試しください。" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const drawn = drawPrizes(plan.draws, body.plan === "hundred" ? GACHA_HUNDRED_RARITY_RATES : undefined);
  if (drawn.length !== plan.draws) {
    console.error("Gacha prize pool is empty", { plan: body.plan, drawn: drawn.length });
    return NextResponse.json({ error: "ただいまガチャを準備中です。" }, { status: 503 });
  }

  const priorCounts = await getOwnedItemCounts(supabase, user.id);

  const { data, error } = await supabase.rpc("commit_gacha_draw", {
    p_cost: plan.cost,
    p_request_id: body.requestId,
    p_item_ids: drawn.map((prize) => prize.id),
  });

  if (error) {
    console.error("Failed to commit gacha draw", { code: error.code, message: error.message });
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
    const prize = getPrize(id);
    const rarity = prize?.rarity ?? "N";
    const previousCount = runningCounts.get(id) ?? 0;
    const newCount = previousCount + 1;
    runningCounts.set(id, newCount);
    return {
      id,
      name: prize?.name ?? id,
      rarity,
      type: prize?.type ?? "item",
      image: prize?.image ?? null,
      isNew: newIds.has(id),
      previousLevel: getSkillLevel(rarity, previousCount),
      newLevel: getSkillLevel(rarity, newCount),
    };
  });

  return NextResponse.json(
    { results, balance: Number(result.balance ?? 0) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
