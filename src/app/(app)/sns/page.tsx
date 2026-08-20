import Link from "next/link";
import { redirect } from "next/navigation";
import { IconPlus, IconUsers } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { getFriendsSetupStatus, type FriendsSetupStatus } from "@/lib/data/friends";
import { getMyFriendGroups } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";
import type { FriendGroupRow } from "@/lib/supabase/types";

export const metadata = { title: "SNS | おでかけ記録" };
export const dynamic = "force-dynamic";

/** /sns 単体には何も表示しない。一番左（既定）のグループへ即座に移す */
export default async function SnsPage() {
  const { supabase } = await requireUser();

  let setupStatus: FriendsSetupStatus = { ready: false, reason: "migration_required" };
  let groups: FriendGroupRow[] = [];
  let unavailable = false;

  try {
    setupStatus = await getFriendsSetupStatus(supabase);
    if (setupStatus.ready) {
      groups = await getMyFriendGroups(supabase);
    }
  } catch {
    unavailable = true;
  }

  const ready = setupStatus.ready && !unavailable;

  const defaultGroup = groups[0];
  if (ready && defaultGroup) {
    redirect(`/sns/groups/${defaultGroup.id}`);
  }

  return (
    <>
      <TopHeader title="SNS" subtitle="フレンドとグループで写真・チャットを共有" />
      <PageBody>{!ready ? <PreparingCard /> : <EmptyGroupsCard />}</PageBody>
    </>
  );
}

function EmptyGroupsCard() {
  return (
    <div className="rough-card px-6 py-10 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-leaf-soft text-leaf-deep">
        <IconUsers size={28} />
      </span>
      <p className="mt-3 font-bold">まだグループがありません</p>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
        フレンドの中からグループを作って、写真とチャットを共有しましょう。
      </p>
      <Link href="/sns/groups/new" className="btn btn-primary mt-4 inline-flex">
        <IconPlus size={18} />
        グループを作る
      </Link>
    </div>
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
        supabase/migrations/0044〜0048
      </p>
    </div>
  );
}
