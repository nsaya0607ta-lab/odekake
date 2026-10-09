import type { Metadata } from "next";
import Link from "next/link";
import { TownBuilder } from "@/components/games/town-builder";

export const metadata: Metadata = { title: "まちづくり体験版 | おでかけ", description: "道路と鉄道をつないで街を育てる、まちづくりゲームの体験版。" };
export default function TownPreviewPage() {
  return <div style={{ background: "#f3f4e9", minHeight: "100vh" }}>
    <nav style={{ display: "flex", justifyContent: "space-between", padding: "12px 20px", fontSize: 11, color: "#7d9479", borderBottom: "1px solid #e2e6d7" }}><span>まちづくり体験版 · 体験版の街はこのブラウザに保存されます</span><Link href="/games/town-builder">自分の街を開く →</Link></nav>
    <TownBuilder userId="public-town-preview" />
  </div>;
}
