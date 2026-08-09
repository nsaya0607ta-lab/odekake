"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { IconChevronLeft } from "./icons";

type Props = {
  title: string;
  /** 指定するとその URL へ戻る。省略時はブラウザ履歴を1つ戻る */
  backHref?: string;
  subtitle?: string;
  action?: ReactNode;
};

export function PageHeader({ title, backHref, subtitle, action }: Props) {
  const router = useRouter();

  const backButtonClass =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors active:bg-paper-deep";

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/92 backdrop-blur-sm">
      <div className="mx-auto flex max-w-lg items-center gap-1 px-2 py-2">
        {backHref ? (
          <Link href={backHref} aria-label="戻る" className={backButtonClass}>
            <IconChevronLeft />
          </Link>
        ) : (
          <button type="button" aria-label="戻る" onClick={() => router.back()} className={backButtonClass}>
            <IconChevronLeft />
          </button>
        )}
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-[17px] font-bold">{title}</h1>
          {subtitle ? <p className="truncate text-xs text-ink-faint">{subtitle}</p> : null}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center">{action}</div>
      </div>
    </header>
  );
}

/** 戻るボタンを持たない画面（下部ナビの主要5画面）向け */
export function TopHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/92 backdrop-blur-sm">
      <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
        <span className="min-w-0 flex-1">
          <h1 className="truncate text-[19px] font-bold">{title}</h1>
          {subtitle ? <span className="block truncate text-xs text-ink-faint">{subtitle}</span> : null}
        </span>
        {action}
      </div>
    </header>
  );
}
