"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconHome, IconMenu, IconUser, IconUsers } from "@/components/icons";
import { useSnsMode } from "@/components/sns/sns-mode-context";

/** ヘッダー左端のハンバーガーメニュー。個人投稿が集まるホームへの導線と、
 * ユーザー/グループの表示切替、未実装のDM導線をまとめて置いておく */
export function SnsModeMenu() {
  const { mode, setMode } = useSnsMode();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function selectMode(next: "user" | "group") {
    setMode(next);
    setOpen(false);
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="表示切替メニュー"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors active:bg-paper-deep"
      >
        <IconMenu />
      </button>

      {open ? (
        <div className="absolute top-full left-0 z-40 mt-1 w-40 overflow-hidden rounded-2xl border border-line bg-card shadow-lg">
          <Link
            href="/sns/home"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-ink-soft active:bg-paper-deep"
          >
            <IconHome size={18} />
            ホーム
          </Link>
          <MenuItem label="ユーザー" icon={<IconUser size={18} />} active={mode === "user"} onClick={() => selectMode("user")} />
          <MenuItem label="グループ" icon={<IconUsers size={18} />} active={mode === "group"} onClick={() => selectMode("group")} />
          <span className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink-faint/60">
            DM
            <span className="ml-auto rounded-full bg-paper-deep px-2 py-0.5 text-[10px]">準備中</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold transition-colors ${
        active ? "bg-leaf-soft text-leaf-deep" : "text-ink-soft active:bg-paper-deep"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
