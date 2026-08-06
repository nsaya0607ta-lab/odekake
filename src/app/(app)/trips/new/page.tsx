import { redirect } from "next/navigation";
import { resolveWorkspace } from "@/lib/data/workspace";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "新しい旅行 | おでかけ記録" };
export const dynamic = "force-dynamic";

/**
 * 既存リンクとの互換用。
 * 現在開いているワークスペースに応じて、個人旅または共有旅の専用画面へ送る。
 */
export default async function NewTripPage() {
  const { supabase, user } = await requireUser();
  const workspace = await resolveWorkspace(supabase, user.id);

  redirect(workspace.kind === "trip" ? "/trips/new/shared" : "/trips/new/personal");
}
