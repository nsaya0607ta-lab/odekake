import type { ReactNode } from "react";

export function PageBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto max-w-lg space-y-6 px-4 py-5 fade-in ${className}`}>{children}</main>;
}
