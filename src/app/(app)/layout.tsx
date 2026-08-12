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
      {/* ホームに限らず、その日はじめて開いた画面で出す。
          画面を移っても付け直されないよう、レイアウト側に置いている */}
      <LoginBonus skin={skin} />
    </div>
  );
}
