import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsBackgroundBand } from "@/components/sns/sns-background-band";
import { SnsPhotoGrid } from "@/components/sns/sns-photo-grid";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import { getOwnSnsProfile, getSnsFeed } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** 特定ユーザーの個人投稿画面。所属グループを問わず、そのユーザー自身の投稿だけを一覧できる */
export default async function SnsUserHomePage({ params }: { params: Promise<{ userId: string }> }) {
  const [{ userId }, { supabase, user }] = await Promise.all([params, requireUser()]);

  const [profile, feed] = await Promise.all([getOwnSnsProfile(supabase, userId), getSnsFeed(supabase)]);
  const photos = feed.filter((photo) => photo.user_id === userId);
  const [avatarUrls, photoUrls] = await Promise.all([
    signThumbOrOriginalPaths(
      supabase,
      photos.flatMap((p) => (p.profile_image_url ? [p.profile_image_url] : [])),
    ),
    signThumbOrOriginalPaths(supabase, photos.map((p) => p.storage_path)),
  ]);

  return (
    <>
      <PageHeader title={userId === user.id ? "ホーム" : profile.displayName} />
      <SnsBackgroundBand />
      <PageBody>
        <SnsPhotoGrid photos={photos} photoUrls={photoUrls} avatarUrls={avatarUrls} baseHref={`/sns/users/${userId}`} showViewToggle={false} />
      </PageBody>
    </>
  );
}
