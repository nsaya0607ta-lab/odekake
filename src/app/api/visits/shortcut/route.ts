import { NextResponse } from "next/server";
import { z } from "zod";
import { nearestMunicipality } from "@/lib/geo/municipalities";
import { requireSupabaseEnv } from "@/lib/supabase/env";

const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeRating(value: unknown): unknown {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const text = value.normalize("NFKC").trim();
    if (/^[1-5]$/.test(text)) return Number(text);
    const stars = [...text].filter((char) => char === "⭐" || char === "★").length;
    if (stars >= 1 && stars <= 5) return stars;
  }
  return value;
}

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  address: z.string().trim().max(200).optional().default(""),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  rating: z.preprocess(normalizeRating, z.number().int().min(1).max(5).nullable()).optional().default(null),
  comment: z.string().trim().max(2000).optional().default(""),
  visitedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

type RpcError = { code?: string; message?: string; details?: string };

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";

  if (!tokenPattern.test(token)) {
    return NextResponse.json(
      { ok: false, error: "連携キーが正しくありません。", requestId },
      { status: 401 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "送信データを読み取れませんでした。", requestId },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "場所・評価・感想の送信内容を確認してください。",
        requestId,
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const nearest = nearestMunicipality(input.latitude, input.longitude);
  if (!nearest) {
    return NextResponse.json(
      { ok: false, error: "現在地から市区町村を判定できませんでした。", requestId },
      { status: 400 },
    );
  }

  const { url, anonKey } = requireSupabaseEnv();
  const rpcUrl = `${url.replace(/\/$/, "")}/rest/v1/rpc/record_shortcut_visit_with_token`;

  let response: Response;
  try {
    response = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Client-Info": "odekake-shortcuts-visit/1.0",
      },
      body: JSON.stringify({
        p_token: token,
        p_name: input.name,
        p_address: input.address || null,
        p_latitude: input.latitude,
        p_longitude: input.longitude,
        p_prefecture_code: nearest.municipality.prefectureCode,
        p_municipality_code: nearest.municipality.code,
        p_rating: input.rating,
        p_comment: input.comment || null,
        p_visited_at: input.visitedAt ?? null,
      }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Shortcut visit registration could not reach Supabase", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "訪問記録の保存先へ接続できませんでした。", requestId },
      { status: 502 },
    );
  }

  const text = await response.text();
  if (!response.ok) {
    let rpcError: RpcError = {};
    try {
      rpcError = JSON.parse(text) as RpcError;
    } catch {
      // JSON以外のエラー本文はクライアントへ露出しない。
    }

    const invalidToken = /invalid sync token/i.test(rpcError.message ?? "");
    console.warn("Shortcut visit RPC failed", {
      requestId,
      status: response.status,
      code: rpcError.code,
      message: rpcError.message,
    });
    return NextResponse.json(
      {
        ok: false,
        error: invalidToken ? "連携キーが無効です。再発行してください。" : "訪問記録を保存できませんでした。",
        requestId,
      },
      { status: invalidToken ? 401 : 502 },
    );
  }

  let result: unknown;
  try {
    result = JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json(
      { ok: false, error: "保存結果を確認できませんでした。", requestId },
      { status: 502 },
    );
  }

  const payload = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
  return NextResponse.json(
    {
      ok: true,
      requestId,
      visitId: payload.visitId ?? null,
      spotId: payload.spotId ?? null,
      name: payload.name ?? input.name,
      visitedAt: payload.visitedAt ?? input.visitedAt ?? null,
      municipality: nearest.municipality.name,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
