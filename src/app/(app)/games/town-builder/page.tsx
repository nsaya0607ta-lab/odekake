import type { Metadata } from "next";
import { TopHeader } from "@/components/page-header";
import { TownBuilder } from "@/components/games/town-builder";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "ぼくのまちづくり | おでかけ記録",
  description: "道路と鉄道を敷き、住宅や商店を建てて街を育てる箱庭ゲーム。",
};
export const dynamic = "force-dynamic";

export default async function TownBuilderPage() {
  const { user } = await requireUser();
  return (
    <>
      <TopHeader backHref="/games" title="ぼくのまちづくり" subtitle="交通と建築で街を育てよう" />
      <TownBuilder userId={user.id} />
    </>
  );
}
