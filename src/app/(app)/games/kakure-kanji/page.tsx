import { Klee_One } from "next/font/google";
import { KakureKanjiGame } from "@/components/games/kakure-kanji/kakure-kanji-game";
import { requireUser } from "@/lib/supabase/server";

export const metadata = {
  title: "かくれ漢字 | おでかけ記録",
  description: "大きな漢字の中にかくれている、べつの漢字をさがすパズル。",
};
export const dynamic = "force-dynamic";

// 教科書体に近い書体。字の形（はね・はらい・点）が分かりやすいので、答えの字と候補に使う。
const kleeOne = Klee_One({
  weight: ["400", "600"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-kk-mincho",
});

export default async function KakureKanjiPage() {
  await requireUser();
  return (
    <div className={kleeOne.variable}>
      <KakureKanjiGame />
    </div>
  );
}
