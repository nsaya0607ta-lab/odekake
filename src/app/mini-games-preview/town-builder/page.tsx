import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** 旧体験版のURLもログインを求めてから、本人の保存データを使う本体へ送る。 */
export default async function TownPreviewPage() {
  await requireUser();
  redirect("/games/town-builder");
}
