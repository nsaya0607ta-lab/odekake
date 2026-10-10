import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TownBuilder } from "@/components/games/town-builder";
import { canSeeTownBuilder } from "@/lib/games/town-builder-access";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "ぼくのまちづくり | おでかけ記録",
  description: "道路と鉄道を敷き、住宅や商店を建てて街を育てる箱庭ゲーム。",
};
export const dynamic = "force-dynamic";

export default async function TownBuilderPage() {
  const { user } = await requireUser();
  if (!canSeeTownBuilder(user.displayName)) notFound();
  return <TownBuilder userId={user.id} />;
}
