import Link from "next/link";
import { IconPlus } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsBackgroundBand } from "@/components/sns/sns-background-band";
import { SnsPhotoGrid } from "@/components/sns/sns-photo-grid";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import { getPersonalSnsFeed } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "ホーム | SNS" };
export const dynamic = "force-dynamic";

/** グループに紐付かない個人投稿を、フレンド全員分まとめて見られるホーム画面 */
export default async function SnsHomePage() {
  const { supabase } = await requireUser();

  const photos = await getPersonalSnsFeed(supabase);
  const [avatarUrls, photoUrls] = await Promise.all([
    signThumbOrOriginalPaths(
      supabase,
      photos.flatMap((p) => (p.profile_image_url ? [p.profile_image_url] : [])),
    ),
    signThumbOrOriginalPaths(supabase, photos.map((p) => p.storage_path)),
  ]);

  return (
    <>
      <PageHeader title="ホーム" />
      <SnsBackgroundBand />
      <PageBody>
        <SnsPhotoGrid photos={photos} photoUrls={photoUrls} avatarUrls={avatarUrls} baseHref="/sns/home" showViewToggle={false} />
      </PageBody>
      <Link
        href="/sns/home/new"
        aria-label="投稿する"
        className="fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-leaf text-white shadow-lg active:opacity-80"
        style={{ bottom: "calc(var(--nav-height) + var(--safe-bottom) + 1rem)" }}
      >
        <IconPlus size={24} />
      </Link>
    </>
  );
}
