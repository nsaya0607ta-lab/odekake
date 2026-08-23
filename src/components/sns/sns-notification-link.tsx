"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { markSnsNotificationItemReadAction } from "@/app/actions/sns";
import type { SnsNotificationKind } from "@/lib/data/sns-notifications";

/**
 * 通知1件をタップして開いたときに、その1件だけを既読にしてから遷移する。
 * グループ通知はグループ画面を開いた時点で既読になる既存の仕組みに任せるため、ここでは何もしない。
 */
export function SnsNotificationLink({
  id,
  kind,
  href,
  className,
  children,
}: {
  id: string;
  kind: SnsNotificationKind;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  function handleClick() {
    if (kind === "group") return;
    markSnsNotificationItemReadAction(id).catch(() => {});
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
