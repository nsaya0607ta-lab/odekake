import { notFound, redirect } from "next/navigation";
import { canSeeTownBuilder } from "@/lib/games/town-builder-access";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** 旧体験版のURLにも同じ制限を適用し、本人の保存データを使う本体へ送る。 */
export default async function TownPreviewPage() {
  const { user } = await requireUser();
  if (!canSeeTownBuilder(user.displayName)) notFound();
  redirect("/games/town-builder");
}
