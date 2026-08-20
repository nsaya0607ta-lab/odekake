import { notFound } from "next/navigation";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsPostForm } from "@/components/sns/sns-post-form";
import { getMyFriendGroups } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "写真を投稿 | SNS" };
export const dynamic = "force-dynamic";

export default async function NewSnsGroupPhotoPage({ params }: { params: Promise<{ groupId: string }> }) {
  const [{ groupId }, { supabase, user }] = await Promise.all([params, requireUser()]);

  const groups = await getMyFriendGroups(supabase, user.id);
  const group = groups.find((g) => g.id === groupId);
  if (!group) notFound();

  return (
    <>
      <PageHeader title={`${group.name}に投稿`} backHref={`/sns/groups/${groupId}`} />
      <PageBody>
        <p className="text-xs leading-relaxed text-ink-faint">
          このグループのメンバーだけに共有されます。投稿できるのは今日のうちだけです。
        </p>
        <SnsPostForm userId={user.id} groupId={groupId} />
      </PageBody>
    </>
  );
}
