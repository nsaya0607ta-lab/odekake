import type { Metadata } from "next";
import { TownBuilder } from "@/components/games/town-builder";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "ぼくのまちづくり | おでかけ記録",
  description: "白コインで街をつくり、クエストとレベルアップで育てる箱庭RPG。",
};
export const dynamic = "force-dynamic";

export default async function TownBuilderPage() {
  const { user } = await requireUser();
  return <TownBuilder userId={user.id} />;
}
