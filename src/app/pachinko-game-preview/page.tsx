import Link from "next/link";
import { PachinkoGame } from "@/components/pachinko-game";

export const metadata = { title: "わんこパチンコ(プロトタイプ) | おでかけ記録" };

export default function PachinkoGamePreviewPage() {
  return (
    <div className="min-h-dvh bg-[#0c2015]">
      <header className="flex items-center gap-3 border-b border-white/10 bg-black/20 px-3 py-2.5">
        <Link
          href="/games"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg font-black text-white active:scale-95"
          aria-label="ゲーム一覧へ戻る"
        >
          ‹
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[7px] font-black tracking-[0.16em] text-[#ffcf4d]">検証中プロトタイプ</p>
          <h1 className="truncate text-[15px] font-black tracking-[0.04em] text-white">わんこパチンコ</h1>
        </div>
      </header>

      <PachinkoGame />
    </div>
  );
}
