import { redirect } from "next/navigation";
import { resolveWorkspace } from "@/lib/data/workspace";
import { safeNextPath } from "@/lib/navigation";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "新しい旅行 | おでかけ記録" };
export const dynamic = "force-dynamic";

/**
 * 既存リンクとの互換用。
 * `type` の指定があればそれに従い、無ければいま開いているワークスペースに応じて
 * 個人旅または共有旅の専用画面へ送る。作成後の戻り先（`next`）も引き継ぐ。
 */
export default async function NewTripPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; next?: string }>;
}) {
  const [{ type, next }, { supabase, user }] = await Promise.all([searchParams, requireUser()]);

  let kind: "personal" | "shared";
  if (type === "solo") kind = "personal";
  else if (type === "shared") kind = "shared";
  else {
    const workspace = await resolveWorkspace(supabase, user.id);
    kind = workspace.kind === "trip" ? "shared" : "personal";
  }

  const query = next ? `?next=${encodeURIComponent(safeNextPath(next))}` : "";
  redirect(`/trips/new/${kind}${query}`);
}
