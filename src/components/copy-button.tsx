"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconCheck } from "./icons";

/**
 * 押すと文字列をクリップボードへ写すボタン。
 * クリップボードが使えない環境（http や古い端末）では、
 * 手で選べるように prompt へ落とす。
 */
export function CopyButton({
  value,
  children,
  copiedLabel = "コピーしました",
  className,
  icon,
}: {
  value: string;
  children: ReactNode;
  copiedLabel?: string;
  className?: string;
  icon?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("コピーできませんでした。手動でコピーしてください。", value);
    }
  };

  return (
    <button type="button" onClick={() => void copy()} className={className}>
      {copied ? <IconCheck size={17} /> : icon}
      <span className="truncate">{copied ? copiedLabel : children}</span>
    </button>
  );
}
