import { redirect } from "next/navigation";
import { canAccessSns } from "@/lib/sns-access";
import { requireUser } from "@/lib/supabase/server";

export default async function SnsLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  // SNSは準備中のため、対象の利用者以外はアクセスできない
  if (!canAccessSns(user.email)) redirect("/home");

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/backgrounds/gradient-bubbles.jpg" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-paper/55" />
      </div>
      {children}
    </div>
  );
}
