import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SnackTrailPreview } from "@/components/snack-trail-preview";
import { canSeeSnackTrail } from "@/lib/games/snack-trail-access";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "わんこのおやつ道 | おでかけ記録",
  description: "おでかけアプリの3つ目のミニゲーム候補を遊べるプレビューです。",
};
export const dynamic = "force-dynamic";

export default async function SnackTrailPage() {
  const { user } = await requireUser();
  if (!canSeeSnackTrail(user.displayName)) redirect("/games");

  return <SnackTrailPreview />;
}
