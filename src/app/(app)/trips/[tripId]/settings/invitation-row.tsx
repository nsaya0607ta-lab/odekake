"use client";

import { useState } from "react";
import { IconCheck, IconLink } from "@/components/icons";

/** 招待1件ぶんの、コピーと共有の操作 */
export function InvitationActions({ code, link }: { code: string; link: string }) {
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

  return (
    <span className="flex shrink-0 gap-1.5">
      <button
        type="button"
        onClick={() => void copy(code, "code")}
        className="rough-pill border border-line-strong bg-card px-2.5 py-1 text-[11px] font-semibold text-ink-soft"
      >
        {copied === "code" ? <IconCheck size={13} /> : null}
        コード
      </button>
      <button
        type="button"
        onClick={() => void copy(link, "link")}
        className="rough-pill flex items-center gap-1 border border-line-strong bg-card px-2.5 py-1 text-[11px] font-semibold text-ink-soft"
      >
        {copied === "link" ? <IconCheck size={13} /> : <IconLink size={13} />}
        リンク
      </button>
    </span>
  );
}
