import Link from "next/link";
import type { ReactNode } from "react";
import { IconChevronRight, IconStar } from "./icons";

export function SectionHeading({
  title,
  moreHref,
  moreLabel = "すべて見る",
}: {
  title: string;
  moreHref?: string;
  moreLabel?: string;
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
      <h2 className="text-base font-bold">{title}</h2>
      {moreHref ? (
        <Link
          href={moreHref}
          className="pressable tap-target -mr-2 flex items-center gap-0.5 rounded-full px-2 py-1 text-sm text-leaf-deep active:bg-paper-deep"
        >
          {moreLabel}
          <IconChevronRight size={15} />
        </Link>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  icon,
}: {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rough-card flex flex-col items-center gap-2 px-6 py-8 text-center">
      {icon ? <span className="text-ink-faint">{icon}</span> : null}
      <p className="font-semibold">{title}</p>
      {description ? <p className="text-sm leading-relaxed text-ink-soft">{description}</p> : null}
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="btn btn-primary mt-2 px-6">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function StarRating({
  value,
  size = 15,
  showValue = true,
}: {
  value: number | null;
  size?: number;
  showValue?: boolean;
}) {
  if (value === null) {
    return <span className="text-xs text-ink-faint">評価なし</span>;
  }

  const ratio = Math.max(0, Math.min(1, value / 5));

  return (
    <span className="inline-flex items-center gap-1" aria-label={`5段階評価で${value}`}>
      {/* 4.5 のような中間の値も表せるよう、塗りつぶした星を割合で切り取って重ねる */}
      <span className="relative inline-flex text-sun">
        <span className="inline-flex">
          {[1, 2, 3, 4, 5].map((n) => (
            <IconStar key={n} size={size} strokeWidth={1.4} />
          ))}
        </span>
        <span
          className="pointer-events-none absolute inset-y-0 left-0 inline-flex overflow-hidden"
          style={{ width: `${ratio * 100}%` }}
          aria-hidden
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <IconStar key={n} size={size} filled strokeWidth={1.4} className="shrink-0" />
          ))}
        </span>
      </span>
      {showValue ? <span className="text-xs font-semibold text-ink-soft">{value.toFixed(1)}</span> : null}
    </span>
  );
}

export function TripTypeBadge({ type, memberCount }: { type: "solo" | "shared"; memberCount?: number }) {
  if (type === "solo") {
    return (
      <span className="rough-pill inline-flex items-center border border-sky bg-sky-soft px-2.5 py-0.5 text-[11px] font-semibold text-[#43718f]">
        一人旅
      </span>
    );
  }
  return (
    <span className="rough-pill inline-flex items-center border border-blossom bg-blossom-soft px-2.5 py-0.5 text-[11px] font-semibold text-[#94525f]">
      共有旅{typeof memberCount === "number" ? ` ${memberCount}人` : ""}
    </span>
  );
}

export function VisitedBadge({ visited }: { visited: boolean }) {
  return (
    <span
      className={`rough-pill inline-flex items-center px-2 py-0.5 text-[11px] font-semibold ${
        visited ? "bg-leaf-soft text-leaf-deep" : "bg-paper-deep text-ink-faint"
      }`}
    >
      {visited ? "訪問済み" : "未訪問"}
    </span>
  );
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return value;
  return `${y}/${m}/${d}`;
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return "—";
  const [, m, d] = value.slice(0, 10).split("-");
  if (!m || !d) return value;
  return `${Number(m)}月${Number(d)}日`;
}

/** カード全体をタップできるリンク行 */
export function LinkRow({
  href,
  leading,
  title,
  subtitle,
  trailing,
}: {
  href: string;
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rough-card pressable flex min-h-14 items-center gap-3 px-4 py-3 active:border-line-strong active:bg-paper-deep"
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{title}</span>
        {subtitle ? <span className="mt-0.5 block truncate text-xs text-ink-soft">{subtitle}</span> : null}
      </span>
      {trailing ?? <IconChevronRight size={18} className="shrink-0 text-ink-faint" />}
    </Link>
  );
}
