"use client";

import Link from "next/link";
import { useEffect } from "react";
import { IconLeaf } from "@/components/icons";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-sun bg-sun-soft text-[#8a6a28]">
        <IconLeaf size={28} />
      </span>
      <h1 className="text-lg font-bold">画面を表示できませんでした</h1>
      <p className="text-sm leading-relaxed text-ink-soft">
        通信状況が不安定か、データを取得できませんでした。
        <br />
        しばらく待ってから、もう一度お試しください。
      </p>
      <div className="flex w-full gap-2">
        <button type="button" onClick={reset} className="btn btn-primary flex-1">
          もう一度読み込む
        </button>
        <Link href="/home" className="btn btn-quiet flex-1">
          ホームへ戻る
        </Link>
      </div>
    </div>
  );
}
