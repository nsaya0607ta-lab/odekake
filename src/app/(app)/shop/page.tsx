import { redirect } from "next/navigation";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { BackgroundShop } from "@/components/shop/background-shop";
import { getCurrentAppBackground, getOwnedAppBackgrounds } from "@/lib/data/app-backgrounds";
import { getBlueCoinBalance } from "@/lib/data/blue-coins";
import { canAccessShop } from "@/lib/shop-access";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "ショップ | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const { supabase, user } = await requireUser();
  // 準備中（ナビでは押せないが、URLを直接開いたときもホームへ戻す）
  if (!canAccessShop(user.displayName)) redirect("/home");
  const [current, owned, blueCoins] = await Promise.all([
    getCurrentAppBackground(),
    getOwnedAppBackgrounds(supabase, user.id),
    getBlueCoinBalance(supabase, user.id),
  ]);

  return (
    <>
      <TopHeader title="ショップ" subtitle="青コインで、アプリの背景を買えます" />
      <PageBody className="!space-y-4">
        {owned && blueCoins !== null ? (
          <BackgroundShop current={current} owned={[...owned]} blueCoins={blueCoins} />
        ) : (
          <p className="rounded-2xl border border-line bg-card px-4 py-6 text-center text-sm text-ink-soft">
            ショップは準備中です。もうしばらくお待ちください。
          </p>
        )}
      </PageBody>
    </>
  );
}
