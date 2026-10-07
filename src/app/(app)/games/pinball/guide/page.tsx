import type { Metadata } from "next";
import { PinballRulebook } from "@/components/games/pinball/pinball-rulebook";
import { getOwnedItemCounts } from "@/lib/data/collection";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "ご当地ピンボールのルール | おでかけ記録",
  description: "ご当地ピンボールの遊びかた、台のしかけ、得点、ご当地アイテムのスキル。",
};
export const dynamic = "force-dynamic";

export default async function PinballGuidePage() {
  const { supabase, user } = await requireUser();
  const owned = await getOwnedItemCounts(supabase, user.id);
  return <PinballRulebook owned={owned} />;
}
