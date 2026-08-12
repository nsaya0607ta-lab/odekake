import { BottomNav } from "@/components/bottom-nav";
import { GlobalInteractionFeedback } from "@/components/global-interaction-feedback";
import { LoginBonus } from "@/components/login-bonus";
import { PhotoCleanup } from "@/components/photo-cleanup";
import { getCurrentDogSkin } from "@/lib/data/dog-skin";
import { requireUser } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // (app) 配下はすべてログイン必須の画面なので、ここで確かめてよい。
  // requireUser は React cache でまとめられるので、各ページが個別に呼んでも
  // 通信は増えない。
  const { supabase, user } = await requireUser();
  const skin = await getCurrentDogSkin(supabase, user.id);

  return (
    <div className="min-h-dvh" style={{ paddingBottom: "calc(var(--nav-height) + var(--safe-bottom))" }}>
      {children}
      <GlobalInteractionFeedback />
      <BottomNav />
      <PhotoCleanup />
      {/* ユーザーごと・日本時間の日付ごとに1回だけ表示する。
          DB側でも同じ user_id + 日付で二重付与を防ぐ。 */}
      <LoginBonus skin={skin} userId={user.id} />
    </div>
  );
}
