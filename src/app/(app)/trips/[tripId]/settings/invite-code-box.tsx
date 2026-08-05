"use client";

import { useState } from "react";
import { IconCheck, IconLink } from "@/components/icons";

export function InviteCodeBox({ code, link }: { code: string; link: string }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const copy = async (value: string, kind: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("コピーできませんでした。手動でコピーしてください。", value);
    }
  };

  if (!code) {
    return (
      <p className="rough-card px-4 py-4 text-sm text-ink-soft">
        招待コードがまだありません。下のボタンから発行してください。
      </p>
    );
  }

  return (
    <div className="rough-card space-y-3 p-4">
      <div>
        <p className="text-xs text-ink-faint">招待コード</p>
        <p className="mt-1 text-2xl font-bold tracking-[0.2em] tabular-nums">{code}</p>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => void copy(code, "code")} className="btn btn-quiet flex-1">
          {copied === "code" ? <IconCheck size={17} /> : null}
          コードをコピー
        </button>
        <button type="button" onClick={() => void copy(link, "link")} className="btn btn-quiet flex-1">
          {copied === "link" ? <IconCheck size={17} /> : <IconLink size={17} />}
          リンクをコピー
        </button>
      </div>

      <p className="text-xs leading-relaxed text-ink-faint">
        このコードまたはリンクを共有すると、相手がログイン後に旅行へ参加できます。
      </p>
    </div>
  );
}
