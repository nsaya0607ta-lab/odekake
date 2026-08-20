import { redirect } from "next/navigation";
import { IconUsers } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { getFriendsSetupStatus, type FriendsSetupStatus } from "@/lib/data/friends";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "SNS | おでかけ記録" };
export const dynamic = "force-dynamic";

/** /sns 単体には何も表示しない。デフォルトでホーム（個人投稿の一覧）へ即座に移す */
export default async function SnsPage() {
  const { supabase } = await requireUser();

  let setupStatus: FriendsSetupStatus = { ready: false, reason: "migration_required" };
  let unavailable = false;

  try {
    setupStatus = await getFriendsSetupStatus(supabase);
  } catch {
    unavailable = true;
  }

  const ready = setupStatus.ready && !unavailable;

  if (ready) {
    redirect("/sns/home");
  }

  return (
    <>
      <TopHeader title="SNS" subtitle="フレンドと投稿・グループで写真・チャットを共有" />
      <PageBody>
        <PreparingCard />
      </PageBody>
    </>
  );
}

function PreparingCard() {
  return (
    <div className="rough-card px-6 py-10 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-paper-deep text-ink-faint">
        <IconUsers size={28} />
      </span>
      <h2 className="mt-3 font-bold">データベース設定が必要です</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
        Supabaseで SNS 機能のSQLを実行すると利用できます。
      </p>
      <p className="mt-3 rounded-2xl bg-paper-deep px-3 py-2 text-xs font-semibold text-ink-soft">
        supabase/migrations/0044〜0051
      </p>
    </div>
  );
}
