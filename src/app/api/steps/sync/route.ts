import { NextResponse } from "next/server";
import { z } from "zod";
import { todayInJapan } from "@/lib/date";
import { requireSupabaseEnv } from "@/lib/supabase/env";

/**
 * iPhoneショートカットのJSONフィールドは、画面上では「数字」の変数でも
 * フィールド型がテキストのままだと "1234" や "1,234 歩" として届くことがある。
 * 歩数として明確に解釈できる文字列だけ数値へ変換し、それ以外は拒否する。
 */
const stepsSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;

  const normalized = value
    .trim()
    .replace(/[，,\s]/g, "")
    .replace(/歩$/u, "");

  if (!/^\d+$/.test(normalized)) return value;
  return Number(normalized);
}, z.number().int().min(0).max(200000));

const bodySchema = z.object({
  steps: stepsSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SupabaseRpcError = {
  code?: string;
  message?: string;
};

function diagnostics(requestId: string, stage: string, extra?: Record<string, unknown>) {
  return { requestId, stage, ...extra };
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";

  if (!tokenPattern.test(token)) {
    return NextResponse.json(
      {
        ok: false,
        error: "連携キーが正しくありません。",
        diagnostic: diagnostics(requestId, "authorization"),
      },
      { status: 401 },
    );
  }

  let input: z.infer<typeof bodySchema>;
  try {
    input = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "steps は0〜200000の整数で送信してください。",
        diagnostic: diagnostics(requestId, "request-body"),
      },
      { status: 400 },
    );
  }

  const { url, anonKey } = requireSupabaseEnv();
  const stepDate = input.date ?? todayInJapan();
  const rpcUrl = `${url.replace(/\/$/, "")}/rest/v1/rpc/record_daily_steps_with_token`;

  let rpcResponse: Response;
  try {
    // supabase-jsの抽象化を挟まずREST RPCを直接呼び、HTTPステータスと返却本文を
    // 必ず検証する。ショートカット側にも安全な診断段階を返せるようにする。
    rpcResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Client-Info": "odekake-shortcuts-step-sync/1.0",
      },
      body: JSON.stringify({
        p_token: token,
        p_step_date: stepDate,
        p_steps: input.steps,
      }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Shortcut step sync could not reach Supabase", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        error: "歩数保存先へ接続できませんでした。",
        diagnostic: diagnostics(requestId, "supabase-network"),
      },
      { status: 502 },
    );
  }

  const responseText = await rpcResponse.text();

  if (!rpcResponse.ok) {
    let rpcError: SupabaseRpcError = {};
    try {
      rpcError = JSON.parse(responseText) as SupabaseRpcError;
    } catch {
      // JSON以外のエラー本文はクライアントへ返さず、ステータスだけで診断する。
    }

    const invalidToken = /invalid sync token/i.test(rpcError.message ?? "");
    console.warn("Shortcut step sync RPC failed", {
      requestId,
      status: rpcResponse.status,
      code: rpcError.code,
      message: rpcError.message,
    });

    return NextResponse.json(
      {
        ok: false,
        error: invalidToken ? "連携キーが無効です。再発行してください。" : "歩数を保存できませんでした。",
        diagnostic: diagnostics(requestId, "supabase-rpc", {
          status: rpcResponse.status,
          code: rpcError.code ?? null,
        }),
      },
      { status: invalidToken ? 401 : 502 },
    );
  }

  let earnedExp = 0;
  try {
    const parsed = JSON.parse(responseText) as unknown;
    if (typeof parsed === "number" && Number.isFinite(parsed)) earnedExp = parsed;
  } catch {
    console.warn("Shortcut step sync RPC returned an unexpected body", {
      requestId,
      responseText: responseText.slice(0, 100),
    });
    return NextResponse.json(
      {
        ok: false,
        error: "歩数保存結果を確認できませんでした。",
        diagnostic: diagnostics(requestId, "supabase-response"),
      },
      { status: 502 },
    );
  }

  console.info("Shortcut step sync RPC completed", {
    requestId,
    stepDate,
    steps: input.steps,
    earnedExp,
  });

  return NextResponse.json(
    {
      ok: true,
      date: stepDate,
      steps: input.steps,
      earnedExp,
      diagnostic: diagnostics(requestId, "rpc-complete"),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
