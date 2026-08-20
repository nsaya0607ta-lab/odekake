import { redirect } from "next/navigation";
import { canAccessSns } from "@/lib/sns-access";
import { requireUser } from "@/lib/supabase/server";

export default async function SnsLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  // SNSは準備中のため、対象の利用者以外はアクセスできない
  if (!canAccessSns(user.email)) redirect("/home");

  return children;
}
