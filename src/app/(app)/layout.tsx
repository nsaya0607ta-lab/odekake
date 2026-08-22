import { Suspense } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { GlobalInteractionFeedback } from "@/components/global-interaction-feedback";
import { LoginBonus } from "@/components/login-bonus";
import { PhotoCleanup } from "@/components/photo-cleanup";
import { SnsBottomNavIndicator } from "@/components/sns/sns-bottom-nav-indicator";
import { getCurrentDogSkin } from "@/lib/data/dog-skin";
import { canAccessSns } from "@/lib/sns-access";
import { requireUser } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // (app) 配下はすべてログイン必須の画面なので、ここで確かめてよい。
  // requireUser は React cache でまとめられるので、各ページが個別に呼んでも
  // 通信は増えない。
  const { user } = await requireUser();
  const snsAvailable = canAccessSns(user.email);

  return (
    <div className="min-h-dvh" style={{ paddingBottom: "calc(var(--nav-height) + var(--safe-bottom))" }}>
      {children}
      <GlobalInteractionFeedback />
      <BottomNav
        snsLocked={!snsAvailable}
        snsUnreadIndicator={snsAvailable ? <SnsBottomNavIndicator /> : null}
      />
      <PhotoCleanup />
      {/* 犬のスキン取得は毎回の画面遷移に乗る処理なので、ここをSuspenseで
          切り離してページ本体の描画をブロックしないようにする。
          スキン変更cookieが無い利用者は遷移のたびにDB照会が走っていたため、
          その待ち時間がすべてのページ表示に上乗せされていた。 */}
      <Suspense fallback={null}>
        <LoginBonusSection userId={user.id} />
      </Suspense>
    </div>
  );
}

async function LoginBonusSection({ userId }: { userId: string }) {
  const { supabase } = await requireUser();
  const skin = await getCurrentDogSkin(supabase, userId);

  // ユーザーごと・日本時間の日付ごとに1回だけ表示する。
  // DB側でも同じ user_id + 日付で二重付与を防ぐ。
  return <LoginBonus skin={skin} userId={userId} />;
}
