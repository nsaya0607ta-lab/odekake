import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsBackgroundBand } from "@/components/sns/sns-background-band";
import { SnsTextFeed } from "@/components/sns/sns-text-feed";
import { signPhotoPaths, signThumbOrOriginalPaths } from "@/lib/data/photos";
import { getFriendProfile, getPersonalTextFeed } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** 特定ユーザーの個人投稿画面。グループとは無関係に、そのユーザー自身のつぶやきだけを一覧できる */
export default async function SnsUserHomePage({ params }: { params: Promise<{ userId: string }> }) {
  const [{ userId }, { supabase, user }] = await Promise.all([params, requireUser()]);

  const [profile, posts] = await Promise.all([
    getFriendProfile(supabase, userId),
    getPersonalTextFeed(supabase, userId),
  ]);
  const allPhotoPaths = posts.flatMap((p) => p.photo_paths);
  const [avatarUrls, photoUrls, fullPhotoUrls] = await Promise.all([
    signThumbOrOriginalPaths(
      supabase,
      posts.flatMap((p) => (p.profile_image_url ? [p.profile_image_url] : [])),
    ),
    signThumbOrOriginalPaths(supabase, allPhotoPaths),
    signPhotoPaths(supabase, allPhotoPaths),
  ]);

  return (
    <>
      <PageHeader title={profile.displayName} avatarUrl={profile.iconUrl} />
      <SnsBackgroundBand hasToggleBar={false} />
      <PageBody>
        <SnsTextFeed
          posts={posts}
          avatarUrls={avatarUrls}
          photoUrls={photoUrls}
          fullPhotoUrls={fullPhotoUrls}
          currentUserId={user.id}
        />
      </PageBody>
    </>
  );
}
