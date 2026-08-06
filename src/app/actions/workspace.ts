"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PERSONAL_WORKSPACE_ID, WORKSPACE_COOKIE } from "@/lib/data/workspace";
import { safeNextPath } from "@/lib/navigation";
import { requireUser } from "@/lib/supabase/server";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** 開いているワークスペースを差し替える（旅行の作成・参加のあとに呼ぶ） */
export async function setCurrentWorkspace(workspaceId: string) {
  const store = await cookies();
  store.set(WORKSPACE_COOKIE, workspaceId, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: true,
  });
}

/** 旅ワークスペースを切り替える（Cookie に保存して、その空間のホームへ移動する） */
export async function switchWorkspaceAction(formData: FormData) {
  const requested = String(formData.get("workspaceId") ?? PERSONAL_WORKSPACE_ID);
  const next = safeNextPath(formData.get("next")?.toString());

  let workspaceId = PERSONAL_WORKSPACE_ID;

  if (requested !== PERSONAL_WORKSPACE_ID && /^[0-9a-f-]{36}$/i.test(requested)) {
    const { supabase } = await requireUser();
    // 参加していない旅行は RLS により取得できないため、そのときは自分の旅へ戻す
    const { data } = await supabase
      .from("trips")
      .select("id, trip_type")
      .eq("id", requested)
      .maybeSingle();
    if (data?.trip_type === "shared") workspaceId = data.id;
  }

  await setCurrentWorkspace(workspaceId);
  redirect(next);
}
