import type { Metadata } from "next";
import { BlockGardenLoader } from "@/components/block-garden/block-garden-loader";

export const metadata: Metadata = {
  title: "わんこのブロックガーデン | おでかけ記録",
  description: "小さな3Dフィールドを歩き、ブロックを集めて自由に庭づくりを楽しめるミニゲームです。",
};
export const dynamic = "force-dynamic";

export default function BlockGardenPage() {
  return <BlockGardenLoader />;
}
