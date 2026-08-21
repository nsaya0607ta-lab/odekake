import Link from "next/link";
import { redirect } from "next/navigation";
import { IconPlus, IconUsers } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsPrimaryNav } from "@/components/sns/sns-primary-nav";
import { SnsNotificationEntry } from "@/components/sns/sns-notification-button";
import { getMyFriendGroups } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** グループ一覧の入口。一番左（既定）のグループへ即座に移す。mode クエリはそのまま引き継ぐ */
export default async function SnsGroupsIndexPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const [{ mode }, { supabase, user }] = await Promise.all([searchParams, requireUser()]);

  const groups = await getMyFriendGroups(supabase, user.id);
  const defaultGroup = groups[0];
  if (defaultGroup) {
    redirect(`/sns/groups/${defaultGroup.id}${mode ? `?mode=${mode}` : ""}`);
  }

  return (
    <>
      <PageHeader
        title="SNS"
        subtitle="写真とチャットをグループで共有"
        showBack={false}
        leftAction={<SnsNotificationEntry />}
      />
      <PageBody className="space-y-4">
        <SnsPrimaryNav active="group" userHref={`/sns/users/${user.id}`} groupHref="/sns/groups" />
        <div className="sns-empty-feed px-6 py-10">
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
      </PageBody>
    </>
  );
}
