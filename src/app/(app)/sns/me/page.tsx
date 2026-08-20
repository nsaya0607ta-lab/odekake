import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsBackgroundBand } from "@/components/sns/sns-background-band";
import { SnsGroupSwitcher } from "@/components/sns/sns-group-switcher";
import { getMyFriendGroups, getOwnSnsProfile, signGroupIconUrls } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "個人アカウント | SNS" };
export const dynamic = "force-dynamic";

export default async function SnsPersonalPage() {
  const { supabase, user } = await requireUser();

  const groups = await getMyFriendGroups(supabase);
  const [groupIconUrls, ownProfile] = await Promise.all([
    signGroupIconUrls(supabase, groups),
    getOwnSnsProfile(supabase, user.id),
  ]);

  return (
    <>
      <PageHeader title={ownProfile.displayName} showBack={false} />
      <SnsBackgroundBand />
      <PageBody>
        <SnsGroupSwitcher
          groups={groups}
          iconUrls={Object.fromEntries(groupIconUrls)}
          personalActive
          personalIconUrl={ownProfile.iconUrl}
          personalLabel={ownProfile.displayName}
        />

        {/* 個人アカウントの中身は後で実装する。写真/チャット切替バーと高さだけ揃えておく */}
        <div
          id="sns-toggle-bar"
          className="sticky top-14 z-20 -mx-4 -mt-6 border-b border-line bg-paper/92 px-4 backdrop-blur-sm"
        >
          <div className="mx-auto flex max-w-lg items-center gap-1.5 py-1.5">
            <div className="h-11 w-full" />
          </div>
        </div>
      </PageBody>
    </>
  );
}
