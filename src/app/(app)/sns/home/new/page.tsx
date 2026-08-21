import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsBackgroundBand } from "@/components/sns/sns-background-band";
import { SnsIllustratedHero } from "@/components/sns/sns-illustrated-hero";
import { SnsTextComposeForm } from "@/components/sns/sns-text-compose-form";
import { getFriendList } from "@/lib/data/friends";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import { getPersonalTextPost, getSnsHiddenUserIds, getSnsLinkableVisits } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "投稿する | SNS" };
export const dynamic = "force-dynamic";

export default async function NewSnsHomePostPage({
  searchParams,
}: {
  searchParams: Promise<{ quote?: string }>;
}) {
  const [{ supabase, user }, sp] = await Promise.all([requireUser(), searchParams]);
  const quoteId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(sp.quote ?? "") ? sp.quote : undefined;
  const [visitOptions, friends, quotePost, hiddenUserIds] = await Promise.all([
    getSnsLinkableVisits(supabase, user.id),
    getFriendList(supabase).catch(() => []),
    quoteId ? getPersonalTextPost(supabase, quoteId).catch(() => null) : Promise.resolve(null),
    getSnsHiddenUserIds(supabase).catch(() => new Set<string>()),
  ]);
  const quotePhotoPath = quotePost?.photo_paths[0];
  const quotePhotoUrl = quotePhotoPath
    ? (await signThumbOrOriginalPaths(supabase, [quotePhotoPath])).get(quotePhotoPath)
    : undefined;

  return (
    <>
      <PageHeader title="つぶやく" backHref="/sns/home" />
      <SnsBackgroundBand hasToggleBar={false} />
      <PageBody className="sns-page-shell sns-subpage-body space-y-4">
        <SnsIllustratedHero
          eyebrow="CREATE A MEMORY"
          title={quotePost ? "気持ちを添えてシェア" : "今日を、旅の便りに"}
          description={quotePost ? "元の投稿を残したまま、あなたのひとことを添えられます。" : "ひとこと・写真・場所を、好きな組み合わせでフレンドへ。"}
          artSrc="/illustrations/sns/compose-post-v2.webp"
          tone="compose"
        />
        <SnsTextComposeForm
          userId={user.id}
          visitOptions={visitOptions}
          mentionOptions={friends
            .filter((friend) => !hiddenUserIds.has(friend.friend_user_id))
            .map((friend) => ({ id: friend.friend_user_id, label: friend.display_name }))}
          quote={quotePost ? {
            id: quotePost.id,
            displayName: quotePost.display_name,
            body: quotePost.body,
            photoUrl: quotePhotoUrl,
            spotName: quotePost.linked_spot_name ?? undefined,
          } : undefined}
        />
      </PageBody>
    </>
  );
}
