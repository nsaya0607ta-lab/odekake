import type { Metadata } from "next";
import { SnackTrailPreview } from "@/components/snack-trail-preview";

export const metadata: Metadata = {
  title: "わんこのおやつ道（プレビュー） | おでかけ記録",
  description: "おでかけアプリの3つ目のミニゲーム候補を遊べるプレビューです。",
};

export default function SnackTrailPreviewPage() {
  return <SnackTrailPreview />;
}
