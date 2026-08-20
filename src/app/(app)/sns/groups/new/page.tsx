import { IconUsers } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { getFriendList } from "@/lib/data/friends";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import { requireUser } from "@/lib/supabase/server";
import { GroupForm } from "./group-form";

export const metadata = { title: "グループを作る | SNS" };
export const dynamic = "force-dynamic";

export default async function NewSnsGroupPage() {
  const { supabase, user } = await requireUser();
  const friends = await getFriendList(supabase);
  const avatarUrls = await signThumbOrOriginalPaths(
    supabase,
    friends.flatMap((f) => (f.profile_image_url ? [f.profile_image_url] : [])),
  );

  return (
    <>
      <PageHeader title="グループを作る" backHref="/sns" />
      <PageBody>
        {friends.length === 0 ? (
          <div className="rough-card px-6 py-10 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-paper-deep text-ink-faint">
              <IconUsers size={28} />
            </span>
            <p className="mt-3 font-bold">まだフレンドがいません</p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
              先にフレンドを追加すると、グループに招待できます。
            </p>
          </div>
        ) : (
          <GroupForm userId={user.id} friends={friends} avatarUrls={Object.fromEntries(avatarUrls)} />
        )}
      </PageBody>
    </>
  );
}
