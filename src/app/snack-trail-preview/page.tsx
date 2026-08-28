import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SnackTrailPreview } from "@/components/snack-trail-preview";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "わんこのおやつ道（プレビュー） | おでかけ記録",
  description: "おでかけアプリの3つ目のミニゲーム候補を遊べるプレビューです。",
};
export const dynamic = "force-dynamic";

// わんこのおやつ道はまだ検証中のため、特定ユーザーにのみ表示する
const SNACK_TRAIL_PREVIEW_USERS = ["しゅん", "さやか"];

export default async function SnackTrailPreviewPage() {
  const { user } = await requireUser();
  if (!SNACK_TRAIL_PREVIEW_USERS.includes(user.displayName)) redirect("/games");

  return <SnackTrailPreview />;
}
