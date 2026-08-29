import type { Metadata } from "next";
import { SnackTrailPreview } from "@/components/snack-trail-preview";

export const metadata: Metadata = {
  title: "わんこのおやつ道 | おでかけ記録",
  description: "おでかけアプリの3つ目のミニゲーム候補を遊べるプレビューです。",
};
export const dynamic = "force-dynamic";

export default function SnackTrailPage() {
  return <SnackTrailPreview />;
}
