import Link from "next/link";
import { IconPlus } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsBackgroundBand } from "@/components/sns/sns-background-band";
import { SnsModeMenu } from "@/components/sns/sns-mode-menu";
import { SnsModeProvider } from "@/components/sns/sns-mode-context";
import { SnsTextFeed } from "@/components/sns/sns-text-feed";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import { getPersonalTextFeed } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "ホーム | SNS" };
export const dynamic = "force-dynamic";

/** グループに紐付かない、フレンド全員分のテキスト投稿（つぶやき）をまとめて見られるホーム画面 */
export default async function SnsHomePage() {
  const { supabase, user } = await requireUser();

  const posts = await getPersonalTextFeed(supabase);
  const [avatarUrls, photoUrls] = await Promise.all([
    signThumbOrOriginalPaths(
      supabase,
      posts.flatMap((p) => (p.profile_image_url ? [p.profile_image_url] : [])),
    ),
    signThumbOrOriginalPaths(supabase, posts.flatMap((p) => p.photo_paths)),
  ]);

  return (
    <SnsModeProvider>
      <PageHeader title="ホーム" showBack={false} leftAction={<SnsModeMenu />} />
      <SnsBackgroundBand hasToggleBar={false} />
      <PageBody>
        <SnsTextFeed posts={posts} avatarUrls={avatarUrls} photoUrls={photoUrls} currentUserId={user.id} />
      </PageBody>
      <Link
        href="/sns/home/new"
        aria-label="投稿する"
        className="fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-leaf text-white shadow-lg active:opacity-80"
        style={{ bottom: "calc(var(--nav-height) + var(--safe-bottom) + 1rem)" }}
      >
        <IconPlus size={24} />
      </Link>
    </SnsModeProvider>
  );
}
