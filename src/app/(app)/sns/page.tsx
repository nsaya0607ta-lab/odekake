import Link from "next/link";
import { IconCamera, IconPlus, IconUsers } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { SnsGroupSwitcher } from "@/components/sns/sns-group-switcher";
import { getFriendsSetupStatus, type FriendsSetupStatus } from "@/lib/data/friends";
import { getMyFriendGroups } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";
import type { FriendGroupRow } from "@/lib/supabase/types";

export const metadata = { title: "SNS | おでかけ記録" };
export const dynamic = "force-dynamic";

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

  return (
    <>
      <TopHeader title="SNS" subtitle="フレンドとグループで写真・チャットを共有" />
      <PageBody>
        {!ready ? (
          <PreparingCard />
        ) : (
          <>
            <SnsGroupSwitcher groups={groups} />
            {groups.length === 0 ? <EmptyGroupsCard /> : <SelectGroupCard />}
          </>
        )}
      </PageBody>
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

function SelectGroupCard() {
  return (
    <div className="rough-card px-6 py-10 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-paper-deep text-ink-faint">
        <IconCamera size={28} />
      </span>
      <p className="mt-3 font-bold">グループを選んでください</p>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
        上のアイコンからグループを開くと、写真とチャットが表示されます。
      </p>
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
        supabase/migrations/0044〜0047
      </p>
    </div>
  );
}
