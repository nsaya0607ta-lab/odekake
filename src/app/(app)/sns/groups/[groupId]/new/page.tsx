import { notFound } from "next/navigation";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsBackgroundBand } from "@/components/sns/sns-background-band";
import { SnsIllustratedHero } from "@/components/sns/sns-illustrated-hero";
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
      <SnsBackgroundBand hasToggleBar={false} />
      <PageBody className="sns-page-shell sns-subpage-body space-y-4">
        <SnsIllustratedHero
          eyebrow="GROUP ALBUM"
          title={`${group.name}へ写真を追加`}
          description="今日の写真をまとめて選んで、メンバーだけのアルバムへ。"
          artSrc="/illustrations/sns/mode-photo-v2.webp"
          tone="photo"
        />
        <SnsPostForm userId={user.id} groupId={groupId} />
      </PageBody>
    </>
  );
}
