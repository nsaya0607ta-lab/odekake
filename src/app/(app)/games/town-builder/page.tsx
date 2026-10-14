import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TownBuilder } from "@/components/games/town-builder";
import { canSeeTownBuilder } from "@/lib/games/town-builder-access";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "ぼくのまちづくり | おでかけ記録",
  description: "白コインで街をつくり、クエストとレベルアップで育てる箱庭RPG。",
};
export const dynamic = "force-dynamic";

export default async function TownBuilderPage() {
  const { supabase, user } = await requireUser();
  if (!(await canSeeTownBuilder(user.displayName, supabase))) notFound();
  return <TownBuilder userId={user.id} />;
}
